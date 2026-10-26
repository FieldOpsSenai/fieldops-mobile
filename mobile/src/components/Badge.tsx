import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { statusColors } from '../theme';

interface BadgeProps {
  label: string;
  type?: string;
  size?: 'small' | 'medium';
}

export const Badge: React.FC<BadgeProps> = ({ label, type, size = 'small' }) => {
  const colorConfig = statusColors[type || label] || { bg: '#F1F5F9', text: '#475569' };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colorConfig.bg },
        size === 'medium' && styles.mediumBadge,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: colorConfig.text },
          size === 'medium' && styles.mediumText,
        ]}
      >
        {label.replace('_', ' ')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  mediumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mediumText: {
    fontSize: 12,
  },
});
