import NetInfo from '@react-native-community/netinfo';
import { getOutboxPending, updateOutboxStatus, getSyncStats } from './database';
import { sendOutboxEvent } from './api';

export type SyncResult = {
  total: number;
  synced: number;
  failed: number;
  isOnline: boolean;
};

export async function processOutboxQueue(): Promise<SyncResult> {
  const netState = await NetInfo.fetch();
  const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

  const pendingList = await getOutboxPending();

  if (pendingList.length === 0) {
    return { total: 0, synced: 0, failed: 0, isOnline };
  }

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
      synced++;
    } catch (err: any) {
      console.log(`[Sync Error] Evento ${record.id}:`, err.message);
      await updateOutboxStatus(record.id, 'ERROR', err.message || 'Falha ao sincronizar');
      failed++;
    }
  }

  return {
    total: pendingList.length,
    synced,
    failed,
    isOnline: true,
  };
}

export { getSyncStats };
