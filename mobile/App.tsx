import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  SafeAreaView,
  Text,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { colors } from './src/theme';
import { initDatabase, getSyncStats, getInspectionById } from './src/database';
import { Inspection, User } from './src/types';
import { Header } from './src/components/Header';
import { BottomTabs, TabKey } from './src/components/BottomTabs';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { DashboardScreen } from './src/features/dashboard/DashboardScreen';
import { InspectionsListScreen } from './src/features/inspections/InspectionsListScreen';
import { ScheduleScreen } from './src/features/inspections/ScheduleScreen';
import { SyncOutboxScreen } from './src/features/sync/SyncOutboxScreen';
import { InspectionDetailScreen } from './src/features/inspections/InspectionDetailScreen';
import { DynamicChecklistScreen } from './src/features/checklist/DynamicChecklistScreen';
import { SummaryCompleteScreen } from './src/features/checklist/SummaryCompleteScreen';

type ScreenView =
  | 'MAIN_TABS'
  | 'INSPECTION_DETAIL'
  | 'DYNAMIC_CHECKLIST'
  | 'SUMMARY_COMPLETE';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [currentView, setCurrentView] = useState<ScreenView>('MAIN_TABS');
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Inicializa o banco SQLite
  useEffect(() => {
    async function setup() {
      try {
        await initDatabase();
        const stats = await getSyncStats();
        setPendingSyncCount(stats.pending);
        setDbReady(true);
      } catch (err) {
        console.error('Falha ao iniciar SQLite:', err);
      }
    }
    setup();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
    });

    return () => unsubscribe();
  }, []);

  const refreshSyncBadge = async () => {
    try {
      const stats = await getSyncStats();
      setPendingSyncCount(stats.pending);
    } catch (err) {
      console.log('Erro ao atualizar badge de sync:', err);
    }
  };

  const handleSelectInspection = (inspection: Inspection) => {
    setSelectedInspection(inspection);
    setCurrentView('INSPECTION_DETAIL');
  };

  const handleOpenChecklist = (inspection: Inspection) => {
    setSelectedInspection(inspection);
    setCurrentView('DYNAMIC_CHECKLIST');
  };

  const handleOpenSummary = (inspection: Inspection) => {
    setSelectedInspection(inspection);
    setCurrentView('SUMMARY_COMPLETE');
  };

  const handleBackToDetail = async () => {
    if (selectedInspection) {
      const refreshed = await getInspectionById(selectedInspection.id);
      if (refreshed) setSelectedInspection(refreshed);
    }
    setCurrentView('INSPECTION_DETAIL');
    refreshSyncBadge();
  };

  const handleBackToTabs = async () => {
    setCurrentView('MAIN_TABS');
    refreshSyncBadge();
  };

  const handleLogout = () => {
    Alert.alert('Encerrar Sessão', 'Deseja realmente sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          setCurrentUser(null);
          setCurrentView('MAIN_TABS');
          setActiveTab('dashboard');
        },
      },
    ]);
  };

  if (!dbReady) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar style="light" />
        <View style={styles.splashLogoBox}>
          <Ionicons name="shield-checkmark" size={52} color="#FFFFFF" />
          <Text style={styles.splashBrand}>FieldOps</Text>
          <Text style={styles.splashBrandSub}>TECHNICAL INSPECTION</Text>
        </View>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 40 }} />
        <Text style={styles.splashLoadingText}>Inicializando banco local...</Text>
      </View>
    );
  }

  // Se o usuário ainda não logou, renderiza a tela de Login
  if (!currentUser) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Main Header (Visível nas abas principais) */}
      {currentView === 'MAIN_TABS' && (
        <Header
          isOnline={isOnline}
          syncPendingCount={pendingSyncCount}
          userName={currentUser.name}
          onSyncPress={() => setActiveTab('sync')}
          onLogout={handleLogout}
        />
      )}

      {/* Screen Router */}
      <View style={styles.screenContainer}>
        {currentView === 'MAIN_TABS' && activeTab === 'dashboard' && (
          <DashboardScreen
            onSelectInspection={handleSelectInspection}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {currentView === 'MAIN_TABS' && activeTab === 'inspections' && (
          <InspectionsListScreen onSelectInspection={handleSelectInspection} />
        )}

        {currentView === 'MAIN_TABS' && activeTab === 'schedule' && (
          <ScheduleScreen onSelectInspection={handleSelectInspection} />
        )}

        {currentView === 'MAIN_TABS' && activeTab === 'sync' && (
          <SyncOutboxScreen onSyncCompleted={refreshSyncBadge} />
        )}

        {currentView === 'INSPECTION_DETAIL' && selectedInspection && (
          <InspectionDetailScreen
            inspection={selectedInspection}
            onBack={handleBackToTabs}
            onOpenChecklist={handleOpenChecklist}
            onOpenSummary={handleOpenSummary}
            onRefreshInspection={(updated) => setSelectedInspection(updated)}
          />
        )}

        {currentView === 'DYNAMIC_CHECKLIST' && selectedInspection && (
          <DynamicChecklistScreen
            inspection={selectedInspection}
            onBack={handleBackToDetail}
            onProceedToSummary={handleOpenSummary}
          />
        )}

        {currentView === 'SUMMARY_COMPLETE' && selectedInspection && (
          <SummaryCompleteScreen
            inspection={selectedInspection}
            onBack={handleBackToDetail}
            onFinishComplete={() => {
              handleBackToTabs();
            }}
          />
        )}
      </View>

      {/* Bottom Tabs (Somente nas abas principais) */}
      {currentView === 'MAIN_TABS' && (
        <BottomTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingCount={pendingSyncCount}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogoBox: {
    alignItems: 'center',
    gap: 6,
  },
  splashBrand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  splashBrandSub: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
  },
  splashLoadingText: {
    marginTop: 12,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
