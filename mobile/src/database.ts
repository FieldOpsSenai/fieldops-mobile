import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import {
  Inspection,
  InspectionItem,
  InspectionAnswer,
  EvidencePhoto,
  OutboxRecord,
  OutboxEventType,
  ChecklistItemWithAnswer,
  CriticalityLevel,
  PriorityLevel,
  User,
} from './types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('fieldops.db');
  }
  return dbPromise;
}

export async function initDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      client_name TEXT NOT NULL,
      location_name TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      equipment_name TEXT NOT NULL,
      equipment_qr_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      scheduled_date TEXT NOT NULL,
      assigned_tech_id TEXT NOT NULL,
      assigned_tech_name TEXT NOT NULL,
      start_latitude REAL,
      start_longitude REAL,
      start_accuracy REAL,
      started_at TEXT,
      end_latitude REAL,
      end_longitude REAL,
      end_accuracy REAL,
      completed_at TEXT,
      notes TEXT,
      rejection_reason TEXT,
      sync_status TEXT NOT NULL DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS inspection_items (
      id TEXT PRIMARY KEY NOT NULL,
      inspection_id TEXT NOT NULL,
      section_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      response_type TEXT NOT NULL,
      options_json TEXT,
      required INTEGER NOT NULL DEFAULT 1,
      evidence_required INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inspection_answers (
      id TEXT PRIMARY KEY NOT NULL,
      inspection_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      value TEXT NOT NULL,
      observation TEXT,
      is_non_conform INTEGER NOT NULL DEFAULT 0,
      criticality TEXT,
      answered_at TEXT NOT NULL,
      UNIQUE(inspection_id, item_id),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inspection_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence_photos (
      id TEXT PRIMARY KEY NOT NULL,
      inspection_id TEXT NOT NULL,
      item_id TEXT,
      file_uri TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      event_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      senha TEXT NOT NULL,
      nome TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'TECNICO'
    );

    CREATE TABLE IF NOT EXISTS auth_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      token TEXT,
      refresh_token TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  try {
    await db.execAsync(`ALTER TABLE inspection_answers ADD COLUMN criticality TEXT;`);
  } catch {}

  try {
    await db.execAsync(`ALTER TABLE inspections ADD COLUMN start_accuracy REAL;`);
  } catch {}

  try {
    await db.execAsync(`ALTER TABLE inspections ADD COLUMN end_accuracy REAL;`);
  } catch {}

  try {
    await db.execAsync(`ALTER TABLE inspections ADD COLUMN rejection_reason TEXT;`);
  } catch {}

  try {
    await db.execAsync(
      `ALTER TABLE inspection_items ADD COLUMN evidence_required INTEGER NOT NULL DEFAULT 0;`
    );
  } catch {}

  // Remove quaisquer dados fictícios de versões anteriores caso o app tenha sido atualizado por cima
  try {
    await db.execAsync(`
      DELETE FROM inspection_answers WHERE inspection_id IN ('insp-8822b-uuid', 'insp-8821a-uuid', 'insp-8825d-uuid');
      DELETE FROM evidence_photos WHERE inspection_id IN ('insp-8822b-uuid', 'insp-8821a-uuid', 'insp-8825d-uuid');
      DELETE FROM inspection_items WHERE inspection_id IN ('insp-8822b-uuid', 'insp-8821a-uuid', 'insp-8825d-uuid');
      DELETE FROM inspections WHERE id IN ('insp-8822b-uuid', 'insp-8821a-uuid', 'insp-8825d-uuid');
      DELETE FROM sync_outbox WHERE entity_id IN ('insp-8822b-uuid', 'insp-8821a-uuid', 'insp-8825d-uuid') OR payload_json LIKE '%insp-882%';
    `);
  } catch {}
}

// -------------------------------------------------------------
// OPERAÇÕES DO BANCO DE DADOS
// -------------------------------------------------------------

export async function getInspections(
  searchTerm?: string,
  statusFilter?: string,
  priorityFilter?: string,
  dateFilter?: string
): Promise<Inspection[]> {
  const db = await getDatabase();
  let query = `SELECT * FROM inspections WHERE 1=1`;
  const params: any[] = [];

  if (searchTerm && searchTerm.trim() !== '') {
    query += ` AND (title LIKE ? OR code LIKE ? OR client_name LIKE ? OR location_name LIKE ?)`;
    const term = `%${searchTerm.trim()}%`;
    params.push(term, term, term, term);
  }

  if (statusFilter && statusFilter !== 'ALL') {
    query += ` AND status = ?`;
    params.push(statusFilter);
  }

  if (priorityFilter && priorityFilter !== 'ALL') {
    query += ` AND priority = ?`;
    params.push(priorityFilter);
  }

  if (dateFilter && dateFilter.trim() !== '' && dateFilter !== 'ALL') {
    if (dateFilter === 'TODAY') {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const todayStr = `%${dd}/${mm}/${yyyy}%`;
      query += ` AND scheduled_date LIKE ?`;
      params.push(todayStr);
    } else {
      query += ` AND scheduled_date LIKE ?`;
      params.push(`%${dateFilter.trim()}%`);
    }
  }

  query += ` ORDER BY CASE status 
    WHEN 'REJECTED' THEN 0
    WHEN 'IN_PROGRESS' THEN 1 
    WHEN 'SCHEDULED' THEN 2 
    WHEN 'COMPLETED' THEN 3 
    ELSE 4 END, CASE priority
    WHEN 'HIGH' THEN 1
    WHEN 'MEDIUM' THEN 2
    WHEN 'LOW' THEN 3
    ELSE 4 END, scheduled_date ASC`;

  return db.getAllAsync<Inspection>(query, ...params);
}

export async function getInspectionById(id: string): Promise<Inspection | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Inspection>(
    `SELECT * FROM inspections WHERE id = ?`,
    id
  );
  return rows[0] || null;
}

export async function getChecklistWithAnswers(
  inspectionId: string
): Promise<ChecklistItemWithAnswer[]> {
  const db = await getDatabase();

  const items = await db.getAllAsync<InspectionItem>(
    `SELECT * FROM inspection_items WHERE inspection_id = ? ORDER BY order_index ASC`,
    inspectionId
  );

  const answers = await db.getAllAsync<InspectionAnswer>(
    `SELECT * FROM inspection_answers WHERE inspection_id = ?`,
    inspectionId
  );

  const photos = await db.getAllAsync<EvidencePhoto>(
    `SELECT * FROM evidence_photos WHERE inspection_id = ?`,
    inspectionId
  );

  const answersMap = new Map<string, InspectionAnswer>();
  for (const a of answers) {
    answersMap.set(a.item_id, a);
  }

  return items.map((item) => ({
    ...item,
    answer: answersMap.get(item.id),
    evidences: photos.filter((p) => p.item_id === item.id),
  }));
}

export async function saveAnswer(params: {
  inspectionId: string;
  itemId: string;
  value: string;
  observation?: string | null;
  isNonConform: boolean;
  criticality?: CriticalityLevel | null;
}): Promise<InspectionAnswer> {
  const db = await getDatabase();
  const answerId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const nonConformInt = params.isNonConform ? 1 : 0;
  const resolvedCriticality = params.isNonConform
    ? params.criticality || 'MEDIUM'
    : null;

  await db.runAsync(
    `INSERT INTO inspection_answers (
      id, inspection_id, item_id, value, observation, is_non_conform, criticality, answered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(inspection_id, item_id) DO UPDATE SET
      value = excluded.value,
      observation = excluded.observation,
      is_non_conform = excluded.is_non_conform,
      criticality = excluded.criticality,
      answered_at = excluded.answered_at`,
    answerId,
    params.inspectionId,
    params.itemId,
    params.value,
    params.observation || null,
    nonConformInt,
    resolvedCriticality,
    now
  );

  await queueOutboxEvent('SAVE_ANSWER', answerId, {
    inspectionId: params.inspectionId,
    itemId: params.itemId,
    value: params.value,
    observation: params.observation,
    isNonConform: params.isNonConform,
    criticality: resolvedCriticality,
    answeredAt: now,
  });

  await db.runAsync(
    `UPDATE inspections SET sync_status = 'PENDING' WHERE id = ?`,
    params.inspectionId
  );

  return {
    id: answerId,
    inspection_id: params.inspectionId,
    item_id: params.itemId,
    value: params.value,
    observation: params.observation,
    is_non_conform: nonConformInt,
    criticality: resolvedCriticality,
    answered_at: now,
  };
}

export async function addEvidencePhoto(params: {
  inspectionId: string;
  itemId?: string | null;
  fileUri: string;
  description?: string | null;
}): Promise<EvidencePhoto> {
  const db = await getDatabase();
  const photoId = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO evidence_photos (
      id, inspection_id, item_id, file_uri, description, created_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
    photoId,
    params.inspectionId,
    params.itemId || null,
    params.fileUri,
    params.description || null,
    now
  );

  await queueOutboxEvent('ATTACH_EVIDENCE', photoId, {
    photoId,
    inspectionId: params.inspectionId,
    itemId: params.itemId,
    fileUri: params.fileUri,
    description: params.description,
    createdAt: now,
  });

  await db.runAsync(
    `UPDATE inspections SET sync_status = 'PENDING' WHERE id = ?`,
    params.inspectionId
  );

  return {
    id: photoId,
    inspection_id: params.inspectionId,
    item_id: params.itemId,
    file_uri: params.fileUri,
    description: params.description,
    created_at: now,
    sync_status: 'PENDING',
  };
}

export async function startInspection(
  inspectionId: string,
  latitude?: number | null,
  longitude?: number | null,
  accuracy?: number | null,
  scannedQrCode?: string | null
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE inspections 
     SET status = 'IN_PROGRESS', 
         started_at = ?, 
         start_latitude = ?, 
         start_longitude = ?,
         start_accuracy = ?,
         sync_status = 'PENDING'
     WHERE id = ?`,
    now,
    latitude || null,
    longitude || null,
    accuracy || null,
    inspectionId
  );

  await queueOutboxEvent('START_INSPECTION', inspectionId, {
    inspectionId,
    startedAt: now,
    latitude,
    longitude,
    accuracy,
    scannedQrCode: scannedQrCode || null,
  });
}

export async function completeInspection(
  inspectionId: string,
  latitude?: number | null,
  longitude?: number | null,
  accuracy?: number | null
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE inspections 
     SET status = 'COMPLETED', 
         completed_at = ?, 
         end_latitude = ?, 
         end_longitude = ?,
         end_accuracy = ?,
         rejection_reason = NULL,
         sync_status = 'PENDING'
     WHERE id = ?`,
    now,
    latitude || null,
    longitude || null,
    accuracy || null,
    inspectionId
  );

  await queueOutboxEvent('COMPLETE_INSPECTION', inspectionId, {
    inspectionId,
    completedAt: now,
    latitude,
    longitude,
    accuracy,
  });
}

// -------------------------------------------------------------
// FILA OUTBOX (Sincronização Idempotente)
// -------------------------------------------------------------

export async function queueOutboxEvent(
  eventType: OutboxEventType,
  entityId: string,
  payload: any
): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_outbox (
      id, event_type, entity_id, payload_json, status, attempts, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?)`,
    id,
    eventType,
    entityId,
    JSON.stringify(payload),
    now,
    now
  );

  return id;
}

export async function getOutboxPending(): Promise<OutboxRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<OutboxRecord>(
    `SELECT * FROM sync_outbox WHERE status IN ('PENDING', 'ERROR') ORDER BY created_at ASC`
  );
}

export async function getAllOutboxRecords(): Promise<OutboxRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<OutboxRecord>(
    `SELECT * FROM sync_outbox ORDER BY created_at DESC LIMIT 50`
  );
}

export async function updateOutboxStatus(
  id: string,
  status: 'PENDING' | 'SYNCING' | 'ERROR' | 'SYNCED',
  errorMessage?: string | null
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE sync_outbox 
     SET status = ?, 
         attempts = attempts + 1, 
         error_message = ?, 
         updated_at = ? 
     WHERE id = ?`,
    status,
    errorMessage || null,
    now,
    id
  );
}

export async function getSyncStats() {
  const db = await getDatabase();
  const pending = await db.getAllAsync<{ count: number }>(
    `SELECT count(*) as count FROM sync_outbox WHERE status = 'PENDING'`
  );
  const error = await db.getAllAsync<{ count: number }>(
    `SELECT count(*) as count FROM sync_outbox WHERE status = 'ERROR'`
  );
  const synced = await db.getAllAsync<{ count: number }>(
    `SELECT count(*) as count FROM sync_outbox WHERE status = 'SYNCED'`
  );

  return {
    pending: pending[0]?.count || 0,
    error: error[0]?.count || 0,
    synced: synced[0]?.count || 0,
  };
}

export async function authenticateUser(email: string, pass: string): Promise<User | null> {
  const db = await getDatabase();
  const cleanEmail = email.trim();
  const cleanPass = pass.trim();

  const rows = await db.getAllAsync<{
    id: string;
    email: string;
    nome: string;
    perfil: string;
    senha: string;
  }>(
    `SELECT id, email, nome, perfil, senha FROM usuarios WHERE LOWER(email) = LOWER(?)`,
    cleanEmail
  );

  const matched = rows.find((r) => r.senha === cleanPass);

  if (matched) {
    return {
      id: matched.id,
      email: matched.email,
      name: matched.nome,
      role: matched.perfil,
    };
  }

  return null;
}

export async function upsertOfflineUser(user: User, password?: string) {
  const db = await getDatabase();
  const existing = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?)`,
    user.email.trim()
  );

  if (existing.length > 0) {
    if (password) {
      await db.runAsync(
        `UPDATE usuarios SET id = ?, nome = ?, perfil = ?, senha = ? WHERE LOWER(email) = LOWER(?)`,
        user.id,
        user.name,
        user.role,
        password,
        user.email.trim()
      );
    } else {
      await db.runAsync(
        `UPDATE usuarios SET id = ?, nome = ?, perfil = ? WHERE LOWER(email) = LOWER(?)`,
        user.id,
        user.name,
        user.role,
        user.email.trim()
      );
    }
  } else if (password) {
    await db.runAsync(
      `INSERT INTO usuarios (id, email, senha, nome, perfil) VALUES (?, ?, ?, ?, ?)`,
      user.id,
      user.email.trim(),
      password,
      user.name,
      user.role
    );
  }
}

export async function saveAuthSession(user: User) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO auth_session (id, user_id, name, email, role, token, refresh_token, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       user_id = excluded.user_id,
       name = excluded.name,
       email = excluded.email,
       role = excluded.role,
       token = excluded.token,
       refresh_token = excluded.refresh_token,
       updated_at = excluded.updated_at`,
    user.id,
    user.name,
    user.email,
    user.role,
    user.token || null,
    user.refreshToken || null,
    now
  );
}

export async function getAuthSession(): Promise<User | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    user_id: string;
    name: string;
    email: string;
    role: string;
    token: string | null;
    refresh_token: string | null;
  }>(`SELECT * FROM auth_session WHERE id = 1`);

  if (!rows[0]) return null;
  return {
    id: rows[0].user_id,
    name: rows[0].name,
    email: rows[0].email,
    role: rows[0].role,
    token: rows[0].token || undefined,
    refreshToken: rows[0].refresh_token || undefined,
  };
}

export async function clearAuthSession() {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM auth_session WHERE id = 1`);
}

export async function getAnswersForInspection(
  inspectionId: string
): Promise<InspectionAnswer[]> {
  const db = await getDatabase();
  return db.getAllAsync<InspectionAnswer>(
    `SELECT * FROM inspection_answers WHERE inspection_id = ?`,
    inspectionId
  );
}

export async function markInspectionSynced(inspectionId: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE inspections SET sync_status = 'SYNCED' WHERE id = ?`,
    inspectionId
  );
  await db.runAsync(
    `UPDATE evidence_photos SET sync_status = 'SYNCED' WHERE inspection_id = ?`,
    inspectionId
  );
}

function mapServerStatusToLocal(
  serverStatus?: string,
  revisaoAprovada?: boolean | null
): Inspection['status'] {
  if (revisaoAprovada === true) {
    return 'APPROVED';
  }
  if (revisaoAprovada === false) {
    return 'REJECTED';
  }

  switch ((serverStatus || '').toUpperCase()) {
    case 'EM_ANDAMENTO':
    case 'IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'CONCLUIDA':
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'EM_REVISAO':
    case 'COMPLETED':
      return 'COMPLETED';
    case 'APROVADA':
    case 'APPROVED':
      return 'APPROVED';
    case 'REPROVADA':
    case 'REJECTED':
      return 'REJECTED';
    case 'CANCELADA':
    case 'CANCELED':
    case 'FAILED':
      return 'FAILED';
    case 'AGENDADA':
    case 'PENDENTE':
    case 'ASSIGNED':
    case 'SCHEDULED':
    default:
      return 'SCHEDULED';
  }
}

function mapServerPriorityToLocal(prioridade?: string | null): PriorityLevel {
  switch ((prioridade || '').toUpperCase()) {
    case 'BAIXA':
    case 'LOW':
      return 'LOW';
    case 'ALTA':
    case 'URGENTE':
    case 'HIGH':
      return 'HIGH';
    case 'MEDIA':
    case 'MEDIUM':
    default:
      return 'MEDIUM';
  }
}

function mapServerResponseTypeToLocal(
  tipoResposta?: string
): InspectionItem['response_type'] {
  const raw = (tipoResposta || '').toUpperCase().trim();
  if (raw.includes('BOOL') || raw === 'SIM_NAO' || raw === 'YES_NO') return 'BOOLEAN';
  if (raw.includes('NUM')) return 'NUMBER';
  if (raw.includes('CHOICE') || raw.includes('OPCOES') || raw.includes('MULTIPLA')) {
    return 'SINGLE_CHOICE';
  }
  if (raw.includes('DATE') || raw.includes('DATA')) return 'DATE';
  if (raw.includes('LONG') || raw.includes('LONGO')) return 'TEXT_LONG';
  if (raw.includes('TEXT')) return 'TEXT_SHORT';
  return 'CONFORMITY';
}

function formatServerDate(isoDate?: string | null): string {
  if (!isoDate) return 'Data não informada';
  try {
    const dt = new Date(isoDate);
    if (isNaN(dt.getTime())) return String(isoDate);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
  } catch {
    return String(isoDate);
  }
}

export async function syncServerDataToLocalDb(payload: {
  inspecoes: any[];
  equipamentos: any[];
  locais: any[];
  modelosPublicados?: any[];
  snapshotsByInspection?: Record<string, any[]>;
}) {
  const db = await getDatabase();

  const locaisMap = new Map<number, any>();
  for (const loc of payload.locais || []) {
    if (loc && loc.id != null) {
      locaisMap.set(Number(loc.id), loc);
    }
  }

  const equipamentosMap = new Map<number, any>();
  for (const eq of payload.equipamentos || []) {
    if (eq && eq.id != null) {
      equipamentosMap.set(Number(eq.id), eq);
    }
  }

  const modelosMap = new Map<number, any>();
  for (const mod of payload.modelosPublicados || []) {
    if (mod && mod.id != null) {
      modelosMap.set(Number(mod.id), mod);
    }
  }

  const snapshotsByInspection = payload.snapshotsByInspection || {};

  for (const srvInsp of payload.inspecoes || []) {
    if (!srvInsp || srvInsp.id == null) continue;

    const idStr = String(srvInsp.id);
    const code = `#INSP-${String(srvInsp.id).padStart(4, '0')}`;
    const title =
      srvInsp.descricao || srvInsp.modeloTitulo || `Inspeção #${srvInsp.id}`;

    const eqIdNum = Number(srvInsp.equipamentoId ?? srvInsp.equipamento?.id ?? 0);
    const eqObj = equipamentosMap.get(eqIdNum) || srvInsp.equipamento || {};
    const equipmentId =
      eqObj.numeroSerie || (eqIdNum ? String(eqIdNum) : idStr);
    const equipmentName =
      srvInsp.equipamentoNome || eqObj.nome || `Equipamento #${eqIdNum || idStr}`;
    const equipmentQrCode =
      eqObj.qrCode || eqObj.numeroSerie || String(eqIdNum || idStr);

    const locIdNum = Number(
      srvInsp.localId ?? eqObj.localId ?? eqObj.local?.id ?? 0
    );
    const locObj = locaisMap.get(locIdNum) || eqObj.local || {};
    const locationName =
      srvInsp.localNome ||
      eqObj.localNome ||
      (locObj.nome
        ? `${locObj.nome}${locObj.endereco ? ` - ${locObj.endereco}` : ''}`
        : `Local #${locIdNum || idStr}`);

    const clientName =
      srvInsp.clienteNome ||
      locObj.clienteNome ||
      locObj.cliente?.nome ||
      'Cliente';

    const assignedTechId = String(
      srvInsp.usuarioId ?? srvInsp.usuario?.id ?? ''
    );
    const assignedTechName =
      srvInsp.usuarioNome || srvInsp.usuario?.nome || 'Técnico';

    const serverStatus = mapServerStatusToLocal(
      srvInsp.status,
      srvInsp.revisaoAprovada
    );
    const priority = mapServerPriorityToLocal(srvInsp.prioridade);
    const scheduledDate = formatServerDate(srvInsp.dataAgendada);
    const notes = srvInsp.instrucoes || srvInsp.observacoes || null;
    const rejectionReason =
      srvInsp.revisaoAprovada === false
        ? srvInsp.motivoReprovacao || null
        : null;

    const existingRows = await db.getAllAsync<Inspection>(
      `SELECT * FROM inspections WHERE id = ?`,
      idStr
    );
    const existing = existingRows[0];

    if (existing) {
      const keepLocalStatus = existing.sync_status === 'PENDING';
      await db.runAsync(
        `UPDATE inspections SET
          code = ?,
          title = ?,
          client_name = ?,
          location_name = ?,
          equipment_id = ?,
          equipment_name = ?,
          equipment_qr_code = ?,
          status = ?,
          priority = ?,
          scheduled_date = ?,
          assigned_tech_id = ?,
          assigned_tech_name = ?,
          notes = ?,
          rejection_reason = ?
        WHERE id = ?`,
        code,
        title,
        clientName,
        locationName,
        equipmentId,
        equipmentName,
        equipmentQrCode,
        keepLocalStatus ? existing.status : serverStatus,
        priority,
        scheduledDate,
        assignedTechId,
        assignedTechName,
        keepLocalStatus ? existing.notes : notes,
        keepLocalStatus ? existing.rejection_reason ?? null : rejectionReason,
        idStr
      );
    } else {
      await db.runAsync(
        `INSERT INTO inspections (
          id, code, title, client_name, location_name,
          equipment_id, equipment_name, equipment_qr_code,
          status, priority, scheduled_date,
          assigned_tech_id, assigned_tech_name, notes, rejection_reason, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
        idStr,
        code,
        title,
        clientName,
        locationName,
        equipmentId,
        equipmentName,
        equipmentQrCode,
        serverStatus,
        priority,
        scheduledDate,
        assignedTechId,
        assignedTechName,
        notes,
        rejectionReason
      );
    }

    const snapItems = snapshotsByInspection[idStr] || [];

    if (snapItems.length > 0) {
      // Se havia itens antigos fora do padrão -snap- e nenhuma resposta local pendente, substitui pelos itens reais do snapshot
      if (!existing || existing.sync_status !== 'PENDING') {
        const legacyCount = await db.getAllAsync<{ count: number }>(
          `SELECT count(*) as count FROM inspection_items WHERE inspection_id = ? AND id NOT LIKE '%-snap-%'`,
          idStr
        );
        if (legacyCount[0] && legacyCount[0].count > 0) {
          await db.runAsync(
            `DELETE FROM inspection_items WHERE inspection_id = ? AND id NOT LIKE '%-snap-%'`,
            idStr
          );
        }
      }

      let orderCounter = 1;
      for (const snap of snapItems) {
        if (!snap || snap.id == null) continue;
        const localItemId = `${idStr}-snap-${snap.id}`;
        const descParts: string[] = [];
        if (snap.critico) descParts.push('Item crítico.');
        if (snap.evidenciaObrigatoria) {
          descParts.push('Evidência fotográfica obrigatória.');
        }

        await db.runAsync(
          `INSERT INTO inspection_items (
            id, inspection_id, section_name, title, description,
            response_type, options_json, required, evidence_required, order_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            section_name = excluded.section_name,
            title = excluded.title,
            description = excluded.description,
            response_type = excluded.response_type,
            required = excluded.required,
            evidence_required = excluded.evidence_required,
            order_index = excluded.order_index`,
          localItemId,
          idStr,
          snap.secaoTitulo || 'Checklist',
          snap.itemDescricao || 'Item de Verificação',
          descParts.length > 0 ? descParts.join(' ') : null,
          mapServerResponseTypeToLocal(snap.tipoResposta),
          null,
          snap.obrigatorio === false ? 0 : 1,
          snap.evidenciaObrigatoria === true ? 1 : 0,
          snap.ordem ?? orderCounter++
        );
      }
    } else {
      // Caso o endpoint de snapshot esteja vazio, tenta o modelo vinculado real da inspeção
      const existingItems = await db.getAllAsync<{ count: number }>(
        `SELECT count(*) as count FROM inspection_items WHERE inspection_id = ?`,
        idStr
      );
      const modeloIdNum = Number(
        srvInsp.modeloId ?? srvInsp.modeloInspecao?.id ?? 0
      );
      const modelo = modelosMap.get(modeloIdNum) || srvInsp.modeloInspecao;

      if (
        (!existingItems[0] || existingItems[0].count === 0) &&
        modelo &&
        Array.isArray(modelo.secoes)
      ) {
        let orderCounter = 1;
        for (const secao of modelo.secoes) {
          const sectionTitle = secao.titulo || `Seção ${secao.ordem || 1}`;
          for (const item of secao.itens || []) {
            const localItemId =
              item.id != null ? `${idStr}-item-${item.id}` : Crypto.randomUUID();
            await db.runAsync(
              `INSERT OR IGNORE INTO inspection_items (
                id, inspection_id, section_name, title, description,
                response_type, options_json, required, evidence_required, order_index
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              localItemId,
              idStr,
              sectionTitle,
              item.descricao || 'Item de Verificação',
              item.critico ? 'Item crítico.' : null,
              mapServerResponseTypeToLocal(item.tipoResposta),
              null,
              item.obrigatorio === false ? 0 : 1,
              item.evidenciaObrigatoria === true ? 1 : 0,
              item.ordem ?? orderCounter++
            );
          }
        }
      }
    }
  }
}

export async function getSavedApiUrl(): Promise<string | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'api_url' LIMIT 1`
  );
  return rows[0]?.value || null;
}

export async function saveCustomApiUrl(url: string | null): Promise<void> {
  const db = await getDatabase();
  if (!url || !url.trim()) {
    await db.runAsync(`DELETE FROM app_settings WHERE key = 'api_url'`);
  } else {
    await db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES ('api_url', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      url.trim()
    );
  }
}
