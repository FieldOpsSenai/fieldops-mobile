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
      started_at TEXT,
      end_latitude REAL,
      end_longitude REAL,
      completed_at TEXT,
      notes TEXT,
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
      nome TEXT NOT NULL DEFAULT 'Carlos Silva',
      perfil TEXT NOT NULL DEFAULT 'TECHNICIAN'
    );
  `);

  await seedDatabaseIfEmpty(db);
}

async function seedDatabaseIfEmpty(db: SQLite.SQLiteDatabase) {
  // Usuário padrão do Técnico
  const usersCheck = await db.getAllAsync<{ count: number }>(
    `SELECT count(*) as count FROM usuarios WHERE email = 'tecnico@fieldops.com'`
  );
  if (!usersCheck[0] || usersCheck[0].count === 0) {
    await db.runAsync(
      `INSERT INTO usuarios (id, email, senha, nome, perfil)
       VALUES (?, ?, ?, ?, ?)`,
      'usr-tech-001',
      'tecnico@fieldops.com',
      'fieldops123',
      'Carlos Silva',
      'TECHNICIAN'
    );
  }

  // Verifica se já existem inspeções
  const inspCheck = await db.getAllAsync<{ count: number }>(
    `SELECT count(*) as count FROM inspections`
  );

  if (inspCheck[0] && inspCheck[0].count > 0) {
    return; // Já populado
  }

  // Inspeção 1: Em andamento (Alta prioridade)
  const insp1Id = 'insp-8822b-uuid';
  await db.runAsync(
    `INSERT INTO inspections (
      id, code, title, client_name, location_name,
      equipment_id, equipment_name, equipment_qr_code,
      status, priority, scheduled_date,
      assigned_tech_id, assigned_tech_name, notes, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    insp1Id,
    '#INSP-8822B',
    'Industrial Pipeline Inspection',
    'Apex Industrial Corp',
    'Sector 4, Main Refinery Complex',
    'EQ-V102',
    'Válvula Reguladora de Pressão V-102',
    'EQ-VALVE-102',
    'IN_PROGRESS',
    'HIGH',
    'Hoje, 08:00 - 10:30',
    'usr-tech-001',
    'Carlos Silva',
    'Verificar estanqueidade, vibração anormal e pressão do manômetro.',
    'PENDING'
  );

  // Itens dinâmicos para a Inspeção 1 com todos os tipos suportados
  const items1 = [
    {
      id: 'item-8822b-1',
      section: '1. Integridade Física e Fixação',
      title: 'Integridade visual da carcaça e suportes',
      desc: 'Verificar se existem trincas, deformações ou corrosão severa.',
      type: 'CONFORMITY',
      options: null,
      req: 1,
      order: 1,
    },
    {
      id: 'item-8822b-2',
      section: '1. Integridade Física e Fixação',
      title: 'Número de patrimônio legível na placa',
      desc: 'Conferir se o tag metálico confere com o sistema.',
      type: 'BOOLEAN',
      options: null,
      req: 1,
      order: 2,
    },
    {
      id: 'item-8822b-3',
      section: '2. Parâmetros Operacionais',
      title: 'Pressão da linha no manômetro (PSI)',
      desc: 'Faixa aceitável entre 45 e 60 PSI.',
      type: 'NUMBER',
      options: null,
      req: 1,
      order: 3,
    },
    {
      id: 'item-8822b-4',
      section: '2. Parâmetros Operacionais',
      title: 'Estado de lubrificação das gaxetas',
      desc: 'Classificar conforme padrão visual de manutenção.',
      type: 'SINGLE_CHOICE',
      options: JSON.stringify(['Excelente', 'Adequado', 'Necessita Troca']),
      req: 1,
      order: 4,
    },
    {
      id: 'item-8822b-5',
      section: '3. Evidências e Finalização',
      title: 'Data do último teste hidrostático',
      desc: 'Conforme selo do certificado de inspeção.',
      type: 'DATE',
      options: null,
      req: 0,
      order: 5,
    },
    {
      id: 'item-8822b-6',
      section: '3. Evidências e Finalização',
      title: 'Observações técnicas detalhadas',
      desc: 'Registrar anomalias térmicas, ruídos ou recomendações.',
      type: 'TEXT_LONG',
      options: null,
      req: 0,
      order: 6,
    },
  ];

  for (const item of items1) {
    await db.runAsync(
      `INSERT INTO inspection_items (
        id, inspection_id, section_name, title, description,
        response_type, options_json, required, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      insp1Id,
      item.section,
      item.title,
      item.desc,
      item.type,
      item.options,
      item.req,
      item.order
    );
  }

  // Resposta inicial de exemplo para o item 1 (Conforme)
  await db.runAsync(
    `INSERT INTO inspection_answers (
      id, inspection_id, item_id, value, observation, is_non_conform, answered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    Crypto.randomUUID(),
    insp1Id,
    'item-8822b-1',
    'CONFORM',
    'Sem trincas na estrutura principal.',
    0,
    new Date().toISOString()
  );

  // Inspeção 2: Agendada (Média prioridade)
  const insp2Id = 'insp-8821a-uuid';
  await db.runAsync(
    `INSERT INTO inspections (
      id, code, title, client_name, location_name,
      equipment_id, equipment_name, equipment_qr_code,
      status, priority, scheduled_date,
      assigned_tech_id, assigned_tech_name, notes, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    insp2Id,
    '#INSP-8821A',
    'HVAC Routine Check & Filter Audit',
    'Global Logistics Hub',
    'Warehouse B, Roof Access',
    'EQ-HVAC-04',
    'Chiller Central de Refrigeração Ch-4',
    'EQ-HVAC-04',
    'SCHEDULED',
    'MEDIUM',
    'Hoje, 11:00 - 12:30',
    'usr-tech-001',
    'Carlos Silva',
    'Inspeção preventiva semestral nos trocadores de calor.',
    'SYNCED'
  );

  const items2 = [
    {
      id: 'item-8821a-1',
      section: '1. Filtros e Serpentinas',
      title: 'Condição dos filtros de ar G4/F7',
      desc: 'Avaliar saturação por poeira ou resíduos.',
      type: 'CONFORMITY',
      options: null,
      req: 1,
      order: 1,
    },
    {
      id: 'item-8821a-2',
      section: '1. Filtros e Serpentinas',
      title: 'Temperatura de saída da água gelada (°C)',
      desc: 'Faixa operacional nominal entre 6°C e 9°C.',
      type: 'NUMBER',
      options: null,
      req: 1,
      order: 2,
    },
    {
      id: 'item-8821a-3',
      section: '2. Motores e Correias',
      title: 'Tensão da correia de transmissão',
      desc: 'Verificar alinhamento e tensão.',
      type: 'BOOLEAN',
      options: null,
      req: 1,
      order: 3,
    },
    {
      id: 'item-8821a-4',
      section: '2. Motores e Correias',
      title: 'Observação do painel elétrico',
      desc: 'Registrar caso haja disjuntor com aquecimento.',
      type: 'TEXT_SHORT',
      options: null,
      req: 0,
      order: 4,
    },
  ];

  for (const item of items2) {
    await db.runAsync(
      `INSERT INTO inspection_items (
        id, inspection_id, section_name, title, description,
        response_type, options_json, required, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      insp2Id,
      item.section,
      item.title,
      item.desc,
      item.type,
      item.options,
      item.req,
      item.order
    );
  }

  // Inspeção 3: Agendada para o período da tarde
  const insp3Id = 'insp-8825d-uuid';
  await db.runAsync(
    `INSERT INTO inspections (
      id, code, title, client_name, location_name,
      equipment_id, equipment_name, equipment_qr_code,
      status, priority, scheduled_date,
      assigned_tech_id, assigned_tech_name, notes, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    insp3Id,
    '#INSP-8825D',
    'Safety Equipment & Valves Audit',
    'Stark Energy Plant',
    'Grid Alpha, Northern Sector',
    'EQ-STRK-01',
    'Gerador de Emergência G-01',
    'EQ-STRK-01',
    'SCHEDULED',
    'LOW',
    'Hoje, 14:00 - 16:00',
    'usr-tech-001',
    'Carlos Silva',
    'Checagem de nível de óleo e carga das baterias de partida.',
    'SYNCED'
  );

  const items3 = [
    {
      id: 'item-8825d-1',
      section: '1. Sistema de Partida',
      title: 'Tensão das baterias de partida (Vdc)',
      desc: 'Deve indicar no mínimo 24Vdc em repouso.',
      type: 'NUMBER',
      options: null,
      req: 1,
      order: 1,
    },
    {
      id: 'item-8825d-2',
      section: '1. Sistema de Partida',
      title: 'Nível do óleo lubrificante no cárter',
      desc: 'Dentro das marcas de mínimo e máximo.',
      type: 'CONFORMITY',
      options: null,
      req: 1,
      order: 2,
    },
  ];

  for (const item of items3) {
    await db.runAsync(
      `INSERT INTO inspection_items (
        id, inspection_id, section_name, title, description,
        response_type, options_json, required, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      insp3Id,
      item.section,
      item.title,
      item.desc,
      item.type,
      item.options,
      item.req,
      item.order
    );
  }
}

// -------------------------------------------------------------
// OPERAÇÕES DO BANCO DE DADOS
// -------------------------------------------------------------

export async function getInspections(searchTerm?: string, statusFilter?: string): Promise<Inspection[]> {
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

  query += ` ORDER BY CASE status 
    WHEN 'IN_PROGRESS' THEN 1 
    WHEN 'SCHEDULED' THEN 2 
    WHEN 'COMPLETED' THEN 3 
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

export async function getChecklistWithAnswers(inspectionId: string): Promise<ChecklistItemWithAnswer[]> {
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
}): Promise<InspectionAnswer> {
  const db = await getDatabase();
  const answerId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const nonConformInt = params.isNonConform ? 1 : 0;

  // UPSERT
  await db.runAsync(
    `INSERT INTO inspection_answers (
      id, inspection_id, item_id, value, observation, is_non_conform, answered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(inspection_id, item_id) DO UPDATE SET
      value = excluded.value,
      observation = excluded.observation,
      is_non_conform = excluded.is_non_conform,
      answered_at = excluded.answered_at`,
    answerId,
    params.inspectionId,
    params.itemId,
    params.value,
    params.observation || null,
    nonConformInt,
    now
  );

  // Enfileira evento na outbox
  await queueOutboxEvent(
    'SAVE_ANSWER',
    answerId,
    {
      inspectionId: params.inspectionId,
      itemId: params.itemId,
      value: params.value,
      observation: params.observation,
      isNonConform: params.isNonConform,
      answeredAt: now,
    }
  );

  // Marca inspeção com alteração pendente
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

  await queueOutboxEvent(
    'ATTACH_EVIDENCE',
    photoId,
    {
      photoId,
      inspectionId: params.inspectionId,
      itemId: params.itemId,
      fileUri: params.fileUri,
      description: params.description,
      createdAt: now,
    }
  );

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
  longitude?: number | null
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE inspections 
     SET status = 'IN_PROGRESS', 
         started_at = ?, 
         start_latitude = ?, 
         start_longitude = ?,
         sync_status = 'PENDING'
     WHERE id = ?`,
    now,
    latitude || null,
    longitude || null,
    inspectionId
  );

  await queueOutboxEvent('START_INSPECTION', inspectionId, {
    inspectionId,
    startedAt: now,
    latitude,
    longitude,
  });
}

export async function completeInspection(
  inspectionId: string,
  latitude?: number | null,
  longitude?: number | null
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE inspections 
     SET status = 'COMPLETED', 
         completed_at = ?, 
         end_latitude = ?, 
         end_longitude = ?,
         sync_status = 'PENDING'
     WHERE id = ?`,
    now,
    latitude || null,
    longitude || null,
    inspectionId
  );

  await queueOutboxEvent('COMPLETE_INSPECTION', inspectionId, {
    inspectionId,
    completedAt: now,
    latitude,
    longitude,
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
  const rows = await db.getAllAsync<{ id: string; email: string; nome: string; perfil: string }>(
    `SELECT id, email, nome, perfil FROM usuarios WHERE LOWER(email) = LOWER(?) AND senha = ?`,
    email.trim(),
    pass.trim()
  );

  if (rows[0]) {
    return {
      id: rows[0].id,
      email: rows[0].email,
      name: rows[0].nome,
      role: rows[0].perfil,
    };
  }

  return null;
}
