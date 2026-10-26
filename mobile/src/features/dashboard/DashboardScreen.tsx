import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Badge } from '../../components/Badge';
import { Inspection } from '../../types';
import { getInspections, getSyncStats } from '../../database';

interface DashboardScreenProps {
  onSelectInspection: (inspection: Inspection) => void;
  onNavigateTab: (tab: 'inspections' | 'schedule' | 'sync') => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onSelectInspection,
  onNavigateTab,
}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    scheduled: 0,
    completed: 0,
    pendingSync: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const all = await getInspections();
      setInspections(all);

      const syncStats = await getSyncStats();

      setStats({
        total: all.length,
        inProgress: all.filter((i) => i.status === 'IN_PROGRESS').length,
        scheduled: all.filter((i) => i.status === 'SCHEDULED').length,
        completed: all.filter((i) => i.status === 'COMPLETED').length,
        pendingSync: syncStats.pending,
      });
    } catch (err) {
      console.log('Erro ao carregar dashboard:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const urgentInspections = inspections.filter(
    (i) => i.status === 'IN_PROGRESS' || i.priority === 'HIGH'
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.content}>
        {/* Subtitle */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.screenTitle}>Visão Geral do Técnico</Text>
            <Text style={styles.screenSubtitle}>Ordens de Serviço e Vistorias em Campo</Text>
          </View>
        </View>

        {/* 4 Metric Cards */}
        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={[styles.kpiCard, { borderLeftColor: colors.primary }]}
            activeOpacity={0.8}
            onPress={() => onNavigateTab('inspections')}
          >
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiTitle}>TOTAL INSPEÇÕES</Text>
              <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.kpiValue}>{stats.total}</Text>
            <Text style={styles.kpiSubtext}>Atribuídas ao técnico</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.kpiCard, { borderLeftColor: colors.info }]}
            activeOpacity={0.8}
            onPress={() => onNavigateTab('inspections')}
          >
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiTitle}>EM ANDAMENTO</Text>
              <Ionicons name="time-outline" size={18} color={colors.info} />
            </View>
            <Text style={styles.kpiValue}>{stats.inProgress}</Text>
            <Text style={[styles.kpiSubtext, { color: colors.info }]}>Checklist ativo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.kpiCard, { borderLeftColor: colors.warning }]}
            activeOpacity={0.8}
            onPress={() => onNavigateTab('schedule')}
          >
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiTitle}>AGENDADAS</Text>
              <Ionicons name="calendar-outline" size={18} color={colors.warning} />
            </View>
            <Text style={styles.kpiValue}>{stats.scheduled}</Text>
            <Text style={[styles.kpiSubtext, { color: colors.warning }]}>Aguardando início</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.kpiCard, { borderLeftColor: colors.danger }]}
            activeOpacity={0.8}
            onPress={() => onNavigateTab('sync')}
          >
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiTitle}>FILA OUTBOX</Text>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.danger} />
            </View>
            <Text style={styles.kpiValue}>{stats.pendingSync}</Text>
            <Text style={[styles.kpiSubtext, { color: colors.danger }]}>Itens pendentes</Text>
          </TouchableOpacity>
        </View>

        {/* Section: Inspeções Prioritárias */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Atividades Prioritárias</Text>
          <TouchableOpacity onPress={() => onNavigateTab('inspections')}>
            <Text style={styles.sectionAction}>Ver Todas</Text>
          </TouchableOpacity>
        </View>

        {urgentInspections.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.success} />
            <Text style={styles.emptyText}>Nenhuma inspeção de alta prioridade pendente.</Text>
          </View>
        ) : (
          urgentInspections.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.inspectionCard}
              activeOpacity={0.7}
              onPress={() => onSelectInspection(item)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardCode}>{item.code}</Text>
                <Badge label={item.status} type={item.status} />
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardClient}>{item.client_name}</Text>

              <View style={styles.cardLocationRow}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.cardLocation} numberOfLines={1}>
                  {item.location_name}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.cardDateRow}>
                  <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.cardDate}>{item.scheduled_date}</Text>
                </View>
                <Badge label={item.priority} type={item.priority} />
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Banner de Sincronização Local */}
        <TouchableOpacity
          style={styles.syncCard}
          activeOpacity={0.8}
          onPress={() => onNavigateTab('sync')}
        >
          <Ionicons name="server-outline" size={28} color={colors.primary} />
          <View style={styles.syncCardContent}>
            <Text style={styles.syncCardTitle}>Banco Local SQLite Ativo</Text>
            <Text style={styles.syncCardDesc}>
              Os checklists podem ser executados sem internet. Seus dados e fotos são gravados no
              aparelho e sincronizados automaticamente quando houver conexão.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
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
    paddingBottom: 32,
  },
  titleRow: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  kpiSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  inspectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardClient: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  cardLocation: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  cardDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDate: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  syncCardContent: {
    flex: 1,
  },
  syncCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 2,
  },
  syncCardDesc: {
    fontSize: 11,
    color: colors.primaryDark,
    lineHeight: 16,
  },
});

