import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

interface HeaderProps {
  onSyncPress?: () => void;
  syncPendingCount?: number;
  isOnline?: boolean;
  userName?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSyncPress,
  syncPendingCount = 0,
  isOnline = true,
  userName = 'Carlos Silva',
  onLogout,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.logoText}>FieldOps</Text>
            <Text style={styles.techNameText}>{userName}</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            {onLogout && (
              <TouchableOpacity
                style={styles.iconButton}
                activeOpacity={0.7}
                onPress={onLogout}
              >
                <Ionicons name="log-out-outline" size={22} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sync Status Banner */}
        <TouchableOpacity
          style={styles.syncBanner}
          activeOpacity={0.8}
          onPress={onSyncPress}
        >
          <View
            style={[
              styles.syncDot,
              {
                backgroundColor: !isOnline
                  ? colors.danger
                  : syncPendingCount > 0
                  ? colors.warning
                  : colors.success,
              },
            ]}
          />
          <Text style={styles.syncText}>
            {!isOnline
              ? `Offline (Modo sem rede)`
              : syncPendingCount > 0
              ? `Sync: ${syncPendingCount} pendência(s) na fila local`
              : `Sync: Ativo (Atualizado)`}
          </Text>
          {syncPendingCount > 0 && (
            <Ionicons name="sync-outline" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  techNameText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 6,
    borderRadius: 20,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  syncText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
