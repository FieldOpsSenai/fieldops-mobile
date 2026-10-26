import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export type TabKey = 'dashboard' | 'inspections' | 'schedule' | 'sync';

interface BottomTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  pendingCount?: number;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({
  activeTab,
  onTabChange,
  pendingCount = 0,
}) => {
  const tabs = [
    { key: 'dashboard' as TabKey, label: 'Dashboard', icon: 'grid-outline' as const },
    { key: 'inspections' as TabKey, label: 'Inspections', icon: 'checkbox-outline' as const },
    { key: 'schedule' as TabKey, label: 'Schedule', icon: 'calendar-outline' as const },
    { key: 'sync' as TabKey, label: 'Sync Outbox', icon: 'sync-outline' as const, badge: pendingCount },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => onTabChange(tab.key)}
          >
            {isActive ? (
              <View style={styles.activePill}>
                <Ionicons name={tab.icon} size={18} color="#FFFFFF" />
                <Text style={styles.activeText}>{tab.label}</Text>
              </View>
            ) : (
              <View style={styles.inactiveItem}>
                <Ionicons name={tab.icon} size={20} color={colors.textSecondary} />
                <Text style={styles.inactiveText}>{tab.label}</Text>
                {Boolean(tab.badge && tab.badge > 0) && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 74 : 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 14 : 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    gap: 6,
  },
  activeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inactiveItem: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 2,
  },
  inactiveText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.warning,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
