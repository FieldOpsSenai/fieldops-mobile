import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Badge } from '../../components/Badge';
import { OutboxRecord } from '../../types';
import { getAllOutboxRecords, getSyncStats } from '../../database';
import { processOutboxQueue } from '../../sync';

interface SyncOutboxScreenProps {
  onSyncCompleted?: () => void;
}

export const SyncOutboxScreen: React.FC<SyncOutboxScreenProps> = ({ onSyncCompleted }) => {
  const [records, setRecords] = useState<OutboxRecord[]>([]);
  const [stats, setStats] = useState({ pending: 0, synced: 0, error: 0 });
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadOutboxData = async () => {
    try {
      const net = await NetInfo.fetch();
      setIsOnline(Boolean(net.isConnected));

      const outbox = await getAllOutboxRecords();
      setRecords(outbox);

      const st = await getSyncStats();
      setStats(st);
    } catch (err) {
      console.log('Erro ao carregar outbox:', err);
    }
  };

  useEffect(() => {
    loadOutboxData();
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
    });
    return () => unsubscribe();
  }, []);

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      const res = await processOutboxQueue();

      await loadOutboxData();
      if (onSyncCompleted) onSyncCompleted();

      if (!res.isOnline) {
        Alert.alert(
          'Sem Conexão',
          'O dispositivo está desconectado da internet. Seus dados continuam gravados com total segurança no SQLite local.'
        );
      } else if (res.total === 0) {
        Alert.alert('Fila Vazia', 'Todas as alterações já estão sincronizadas com o servidor.');
      } else {
        Alert.alert(
          'Sincronização Concluída',
          `Total processado: ${res.total}\nSucessos: ${res.synced}\nFalhas: ${res.failed}`
        );
      }
    } catch (err: any) {
      Alert.alert('Erro de Sincronização', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOutboxData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Central de Sincronização</Text>
        <Text style={styles.subtitle}>Fila Outbox e Tolerância a Falhas Offline</Text>

        {/* Network Status Banner */}
        <View
          style={[
            styles.netBanner,
            isOnline ? styles.netBannerOnline : styles.netBannerOffline,
          ]}
        >
          <Ionicons
            name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={22}
            color={isOnline ? colors.success : colors.danger}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.netTitle,
                { color: isOnline ? colors.success : colors.danger },
              ]}
            >
              {isOnline ? 'Conexão de Rede Disponível' : 'Modo 100% Offline Ativo'}
            </Text>
            <Text style={styles.netDesc}>
              {isOnline
                ? 'Comunicação habilitada com a API central.'
                : 'Trabalhe normalmente. As ações serão salvas no SQLite.'}
            </Text>
          </View>
        </View>

        {/* Outbox Metrics */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { borderLeftColor: colors.warning }]}>
            <Text style={styles.statLabel}>PENDENTES</Text>
            <Text style={styles.statNum}>{stats.pending}</Text>
            <Text style={styles.statSub}>Aguardando envio</Text>
          </View>

          <View style={[styles.statBox, { borderLeftColor: colors.success }]}>
            <Text style={styles.statLabel}>CONFIRMADOS</Text>
            <Text style={styles.statNum}>{stats.synced}</Text>
            <Text style={styles.statSub}>Idempotentes</Text>
          </View>

          <View style={[styles.statBox, { borderLeftColor: colors.danger }]}>
            <Text style={styles.statLabel}>FALHAS</Text>
            <Text style={styles.statNum}>{stats.error}</Text>
            <Text style={styles.statSub}>Retentativas</Text>
          </View>
        </View>

        {/* Sync Button */}
        <TouchableOpacity
          style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]}
          onPress={handleSyncNow}
          disabled={isSyncing}
          activeOpacity={0.8}
        >
          {isSyncing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.syncBtnText}>Sincronizar Fila Agora</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Outbox Records List */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Eventos Recentes do Outbox</Text>

          {records.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="file-tray-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum evento registrado na fila ainda.</Text>
            </View>
          ) : (
            records.map((rec) => (
              <View key={rec.id} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordType}>{rec.event_type}</Text>
                  <Badge label={rec.status} type={rec.status} />
                </View>

                <Text style={styles.recordId}>UUID: {rec.id}</Text>

                {rec.error_message && (
                  <Text style={styles.recordError}>Erro: {rec.error_message}</Text>
                )}

                <View style={styles.recordFooter}>
                  <Text style={styles.recordDate}>
                    {new Date(rec.created_at).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.recordAttempts}>Tentativas: {rec.attempts}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  netBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  netBannerOnline: {
    backgroundColor: colors.successLight,
    borderColor: '#A7F3D0',
  },
  netBannerOffline: {
    backgroundColor: colors.dangerLight,
    borderColor: '#FECACA',
  },
  netTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  netDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 2,
  },
  statSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  syncBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  syncBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  historySection: {
    gap: 10,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordType: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'monospace',
  },
  recordId: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  recordError: {
    fontSize: 11,
    color: colors.danger,
    marginTop: 4,
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 6,
  },
  recordDate: {
    fontSize: 10,
    color: colors.textMuted,
  },
  recordAttempts: {
    fontSize: 10,
    color: colors.textMuted,
  },
});

