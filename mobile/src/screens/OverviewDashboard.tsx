import React, { useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

// ==========================================
// Tipos e Interfaces TypeScript
// ==========================================

export type CriticalityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface NonConformity {
  id: string;
  code: string;
  title: string;
  equipmentOrArea: string;
  criticality: CriticalityLevel;
}

export interface KPIData {
  totalInspections: {
    value: string;
    subtext: string;
  };
  delayed: {
    value: string;
    subtext: string;
  };
  awaitingReview: {
    value: string;
    subtext: string;
  };
  nonConform: {
    value: string;
    subtext: string;
  };
}

export interface OverviewDashboardProps {
  onLogout?: () => void;
  onNavigateTab?: (tab: 'Dashboard' | 'Inspections' | 'Schedule' | 'Settings') => void;
}

// ==========================================
// Dados Iniciais / Mock Data
// ==========================================

const INITIAL_KPIS: KPIData = {
  totalInspections: {
    value: '1,204',
    subtext: '+12% this week',
  },
  delayed: {
    value: '18',
    subtext: 'Action required',
  },
  awaitingReview: {
    value: '42',
    subtext: 'Requires supervisor',
  },
  nonConform: {
    value: '7',
    subtext: 'Critical threshold OK',
  },
};

const NON_CONFORMITIES: NonConformity[] = [
  {
    id: '1',
    code: 'NCF-8922',
    title: 'Valve Leakage - Main Line A',
    equipmentOrArea: 'Equipment: V-102',
    criticality: 'HIGH',
  },
  {
    id: '2',
    code: 'NCF-8921',
    title: 'Pressure Drop Anomaly',
    equipmentOrArea: 'Equipment: P-04',
    criticality: 'MEDIUM',
  },
  {
    id: '3',
    code: 'NCF-8919',
    title: 'Missing Label Tags',
    equipmentOrArea: 'Area: Zone C',
    criticality: 'LOW',
  },
];

// ==========================================
// Componente Principal: OverviewDashboard
// ==========================================

export default function OverviewDashboard({
  onLogout,
  onNavigateTab,
}: OverviewDashboardProps) {
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Inspections' | 'Schedule' | 'Settings'>('Dashboard');
  const [hasNotification] = useState(true);

  function handleTabPress(tab: 'Dashboard' | 'Inspections' | 'Schedule' | 'Settings') {
    setActiveTab(tab);
    onNavigateTab?.(tab);
  }

  function handleNotificationPress() {
    Alert.alert(
      'Notificações FieldOps',
      'Você possui 3 novas não conformidades críticas pendentes de avaliação do supervisor.'
    );
  }

  function handleViewAllPress() {
    Alert.alert(
      'Não Conformidades',
      'Exibindo listagem completa das 7 não conformidades registradas.'
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* 1. Cabeçalho (Header) */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.brandTitle}>FieldOps</Text>
        </View>

        <View style={styles.headerActions}>
          {onLogout && (
            <TouchableOpacity
              onPress={onLogout}
              style={styles.logoutButton}
              accessibilityLabel="Sair"
            >
              <Feather name="log-out" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNotificationPress}
            style={styles.notificationButton}
            accessibilityLabel="Notificações"
          >
            <Feather name="bell" size={24} color="#1f2937" />
            {hasNotification && <View style={styles.notificationBadge} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo com Scroll */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Secção "Overview" e Estado de Sincronização */}
        <Text style={styles.sectionTitle}>Overview</Text>

        <View style={styles.syncBanner}>
          <View style={styles.syncDot} />
          <Text style={styles.syncText}>Sync: Active (Just now)</Text>
        </View>

        {/* 3. Grelha de Indicadores KPI (2x2) */}
        <View style={styles.kpiGrid}>
          {/* Cartão 1: TOTAL INSPECTIONS */}
          <View style={[styles.kpiCard, styles.kpiCardTeal]}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>TOTAL{'\n'}INSPECTIONS</Text>
              <Feather name="check-square" size={20} color="#006666" />
            </View>
            <Text style={styles.kpiValue}>{INITIAL_KPIS.totalInspections.value}</Text>
            <Text style={styles.kpiSubtextRegular}>
              {INITIAL_KPIS.totalInspections.subtext}
            </Text>
          </View>

          {/* Cartão 2: DELAYED */}
          <View style={[styles.kpiCard, styles.kpiCardRed]}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>DELAYED</Text>
              <Feather name="alert-triangle" size={20} color="#b91c1c" />
            </View>
            <Text style={styles.kpiValue}>{INITIAL_KPIS.delayed.value}</Text>
            <Text style={styles.kpiSubtextAlert}>
              {INITIAL_KPIS.delayed.subtext}
            </Text>
          </View>

          {/* Cartão 3: AWAITING REVIEW */}
          <View style={[styles.kpiCard, styles.kpiCardAmber]}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>AWAITING{'\n'}REVIEW</Text>
              <View style={styles.clockIconContainer}>
                <Feather name="calendar" size={17} color="#78350f" />
                <View style={styles.clockBadgeMini}>
                  <Feather name="clock" size={8} color="#ffffff" />
                </View>
              </View>
            </View>
            <Text style={styles.kpiValue}>{INITIAL_KPIS.awaitingReview.value}</Text>
            <Text style={styles.kpiSubtextRegular}>
              {INITIAL_KPIS.awaitingReview.subtext}
            </Text>
          </View>

          {/* Cartão 4: NON-CONFORM */}
          <View style={[styles.kpiCard, styles.kpiCardDark]}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>NON-CONFORM</Text>
              <Feather name="alert-circle" size={20} color="#374151" />
            </View>
            <Text style={styles.kpiValue}>{INITIAL_KPIS.nonConform.value}</Text>
            <Text style={styles.kpiSubtextRegular}>
              {INITIAL_KPIS.nonConform.subtext}
            </Text>
          </View>
        </View>

        {/* 4. Secção "Non-conformities by Criticality" */}
        <View style={styles.criticalityContainer}>
          <View style={styles.criticalityHeader}>
            <Text style={styles.criticalityTitle}>Non-conformities by Criticality</Text>
            <TouchableOpacity onPress={handleViewAllPress}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.criticalityDivider} />

          {/* Lista de Itens */}
          {NON_CONFORMITIES.map((item, index) => {
            const isLast = index === NON_CONFORMITIES.length - 1;

            return (
              <React.Fragment key={item.id}>
                <View style={styles.ncItem}>
                  {/* Ícone Lateral Conforme Criticidade */}
                  {item.criticality === 'HIGH' && (
                    <View style={[styles.ncIconBox, styles.ncIconBoxHigh]}>
                      <Text style={styles.exclamationMarkHigh}>!</Text>
                    </View>
                  )}

                  {item.criticality === 'MEDIUM' && (
                    <View style={[styles.ncIconBox, styles.ncIconBoxMedium]}>
                      <Feather name="alert-octagon" size={18} color="#92400e" />
                    </View>
                  )}

                  {item.criticality === 'LOW' && (
                    <View style={[styles.ncIconBox, styles.ncIconBoxLow]}>
                      <Feather name="info" size={18} color="#475569" />
                    </View>
                  )}

                  {/* Informações Centrais */}
                  <View style={styles.ncInfo}>
                    <Text style={styles.ncTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.ncSubtitle} numberOfLines={1}>
                      ID: {item.code} • {item.equipmentOrArea}
                    </Text>
                  </View>

                  {/* Tag à Direita */}
                  {item.criticality === 'HIGH' && (
                    <View style={[styles.tagBadge, styles.tagBadgeHigh]}>
                      <Text style={[styles.tagText, styles.tagTextHigh]}>HIGH</Text>
                    </View>
                  )}

                  {item.criticality === 'MEDIUM' && (
                    <View style={[styles.tagBadge, styles.tagBadgeMedium]}>
                      <Text style={[styles.tagText, styles.tagTextMedium]}>MEDIUM</Text>
                    </View>
                  )}

                  {item.criticality === 'LOW' && (
                    <View style={[styles.tagBadge, styles.tagBadgeLow]}>
                      <Text style={[styles.tagText, styles.tagTextLow]}>LOW</Text>
                    </View>
                  )}
                </View>

                {!isLast && <View style={styles.itemSeparator} />}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>

      {/* 5. Navegação Inferior (Bottom Tab Bar) */}
      <View style={styles.bottomBar}>
        {/* Tab 1: Dashboard (Ativo) */}
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'Dashboard' && styles.tabItemActive]}
          onPress={() => handleTabPress('Dashboard')}
          activeOpacity={0.8}
        >
          <Feather
            name="grid"
            size={18}
            color={activeTab === 'Dashboard' ? '#ffffff' : '#374151'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'Dashboard' && styles.tabLabelActive,
            ]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Inspections */}
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'Inspections' && styles.tabItemActive]}
          onPress={() => handleTabPress('Inspections')}
          activeOpacity={0.8}
        >
          <Feather
            name="check-square"
            size={18}
            color={activeTab === 'Inspections' ? '#ffffff' : '#374151'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'Inspections' && styles.tabLabelActive,
            ]}
          >
            Inspections
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Schedule */}
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'Schedule' && styles.tabItemActive]}
          onPress={() => handleTabPress('Schedule')}
          activeOpacity={0.8}
        >
          <Feather
            name="calendar"
            size={18}
            color={activeTab === 'Schedule' ? '#ffffff' : '#374151'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'Schedule' && styles.tabLabelActive,
            ]}
          >
            Schedule
          </Text>
        </TouchableOpacity>

        {/* Tab 4: Settings */}
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'Settings' && styles.tabItemActive]}
          onPress={() => handleTabPress('Settings')}
          activeOpacity={0.8}
        >
          <Feather
            name="settings"
            size={18}
            color={activeTab === 'Settings' ? '#ffffff' : '#374151'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'Settings' && styles.tabLabelActive,
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// Estilização com StyleSheet
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  headerTitleContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#005959',
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutButton: {
    padding: 6,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#059669',
    marginRight: 8,
  },
  syncText: {
    fontSize: 12,
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '500',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    rowGap: 14,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    // Sombra sutil
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiCardTeal: {
    borderLeftWidth: 4,
    borderLeftColor: '#006666',
  },
  kpiCardRed: {
    borderLeftWidth: 4,
    borderLeftColor: '#b91c1c',
  },
  kpiCardAmber: {
    borderLeftWidth: 4,
    borderLeftColor: '#78350f',
  },
  kpiCardDark: {
    borderLeftWidth: 4,
    borderLeftColor: '#374151',
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 28,
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  clockIconContainer: {
    position: 'relative',
  },
  clockBadgeMini: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#78350f',
    borderRadius: 4,
    width: 9,
    height: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  kpiSubtextRegular: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  kpiSubtextAlert: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  criticalityContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  criticalityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  criticalityTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111827',
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#005959',
  },
  criticalityDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginTop: 12,
    marginBottom: 10,
  },
  ncItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  ncIconBox: {
    width: 38,
    height: 42,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ncIconBoxHigh: {
    backgroundColor: '#fee2e2',
  },
  exclamationMarkHigh: {
    color: '#b91c1c',
    fontSize: 20,
    fontWeight: '900',
  },
  ncIconBoxMedium: {
    backgroundColor: '#fef3c7',
  },
  ncIconBoxLow: {
    backgroundColor: '#e2e8f0',
  },
  ncInfo: {
    flex: 1,
    paddingRight: 8,
  },
  ncTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  ncSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
  },
  tagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    minWidth: 46,
    alignItems: 'center',
  },
  tagBadgeHigh: {
    backgroundColor: '#fee2e2',
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tagTextHigh: {
    color: '#b91c1c',
  },
  tagBadgeMedium: {
    backgroundColor: '#ffedd5',
  },
  tagTextMedium: {
    color: '#9a3412',
  },
  tagBadgeLow: {
    backgroundColor: '#e2e8f0',
  },
  tagTextLow: {
    color: '#475569',
  },
  itemSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    minWidth: 68,
  },
  tabItemActive: {
    backgroundColor: '#005959',
    paddingHorizontal: 14,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#374151',
    marginTop: 3,
  },
  tabLabelActive: {
    color: '#ffffff',
  },
});
