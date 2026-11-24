import NetInfo from '@react-native-community/netinfo';
import {
  getDatabase,
  getOutboxPending,
  updateOutboxStatus,
  getSyncStats,
  syncServerDataToLocalDb,
  markInspectionSynced,
} from './database';
import { sendOutboxEvent, fetchServerSyncData } from './api';

export type SyncOutcome = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface SyncMetadata {
  last_sync_at: string | null;
  last_sync_result: SyncOutcome | null;
  last_sync_message: string | null;
}

async function ensureSyncMetadataTable() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_at TEXT,
      last_sync_result TEXT,
      last_sync_message TEXT
    );
  `);
}

export async function saveSyncMetadata(
  result: SyncOutcome,
  message?: string | null
): Promise<SyncMetadata> {
  await ensureSyncMetadataTable();
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_metadata (id, last_sync_at, last_sync_result, last_sync_message)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_sync_at = excluded.last_sync_at,
       last_sync_result = excluded.last_sync_result,
       last_sync_message = excluded.last_sync_message`,
    now,
    result,
    message || null
  );
  return {
    last_sync_at: now,
    last_sync_result: result,
    last_sync_message: message || null,
  };
}

export async function getSyncMetadata(): Promise<SyncMetadata> {
  await ensureSyncMetadataTable();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    last_sync_at: string | null;
    last_sync_result: SyncOutcome | null;
    last_sync_message: string | null;
  }>(`SELECT last_sync_at, last_sync_result, last_sync_message FROM sync_metadata WHERE id = 1`);

  if (!rows[0]) {
    return {
      last_sync_at: null,
      last_sync_result: null,
      last_sync_message: null,
    };
  }
  return rows[0];
}

export type SyncResult = {
  total: number;
  synced: number;
  failed: number;
  isOnline: boolean;
  pulledInspections?: number;
};

export async function pullServerData(userId?: string): Promise<number> {
  const netState = await NetInfo.fetch();
  const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
  if (!isOnline) return 0;

  try {
    const serverData = await fetchServerSyncData(userId);
    await syncServerDataToLocalDb(serverData);
    await saveSyncMetadata(
      'SUCCESS',
      `${serverData.inspecoes.length} inspeção(ões) sincronizada(s) do servidor.`
    );
    return serverData.inspecoes.length;
  } catch (err: any) {
    console.log('[Pull Sync] Servidor indisponível ou modo offline:', err.message);
    return 0;
  }
}

export async function processOutboxQueue(): Promise<SyncResult> {
  const netState = await NetInfo.fetch();
  const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

  const pendingList = await getOutboxPending();

  if (!isOnline) {
    await saveSyncMetadata('FAILED', 'Tentativa sem conexão de rede (modo offline).');
    return {
      total: pendingList.length,
      synced: 0,
      failed: pendingList.length,
      isOnline: false,
    };
  }

  let synced = 0;
  let failed = 0;

  for (const record of pendingList) {
    try {
      await updateOutboxStatus(record.id, 'SYNCING');
      await sendOutboxEvent(record);
      await updateOutboxStatus(record.id, 'SYNCED');

      try {
        const parsed = JSON.parse(record.payload_json);
        const inspId = parsed.inspectionId || record.entity_id;
        if (inspId) {
          await markInspectionSynced(inspId);
        }
      } catch {}

      synced++;
    } catch (err: any) {
      console.log(`[Sync Error] Evento ${record.id}:`, err.message);
      await updateOutboxStatus(record.id, 'ERROR', err.message || 'Falha ao sincronizar');
      failed++;
    }
  }

  // Após enviar a fila Outbox, atualiza os dados locais com o estado mais recente do servidor
  const pulledInspections = await pullServerData();

  const outcome: SyncOutcome =
    failed === 0 ? 'SUCCESS' : synced > 0 ? 'PARTIAL' : 'FAILED';
  const summaryMsg =
    pendingList.length === 0
      ? `Sincronização concluída (${pulledInspections} inspeções verificadas).`
      : `${synced} enviado(s) com sucesso, ${failed} falha(s).`;
  await saveSyncMetadata(outcome, summaryMsg);

  return {
    total: pendingList.length,
    synced,
    failed,
    isOnline: true,
    pulledInspections,
  };
}

export { getSyncStats };
