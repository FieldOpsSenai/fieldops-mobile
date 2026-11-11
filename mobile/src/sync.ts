import NetInfo from '@react-native-community/netinfo';
import {
  getOutboxPending,
  updateOutboxStatus,
  getSyncStats,
  syncServerDataToLocalDb,
  markInspectionSynced,
} from './database';
import { sendOutboxEvent, fetchServerSyncData } from './api';

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

  return {
    total: pendingList.length,
    synced,
    failed,
    isOnline: true,
    pulledInspections,
  };
}

export { getSyncStats };
