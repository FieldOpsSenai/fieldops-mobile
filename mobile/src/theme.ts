export const colors = {
  primary: '#004D40',
  primaryDark: '#00382E',
  primaryLight: '#E0F2F1',
  secondary: '#00796B',
  background: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#EDF2F7',

  // Status
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  info: '#3B82F6',
  infoLight: '#EFF6FF',
};

export const statusColors: Record<string, { bg: string; text: string }> = {
  APPROVED: { bg: '#E6F4EA', text: '#137333' },
  IN_PROGRESS: { bg: '#E0F2FE', text: '#0284C7' },
  SCHEDULED: { bg: '#F1F5F9', text: '#475569' },
  COMPLETED: { bg: '#EDE9FE', text: '#6D28D9' },
  FAILED: { bg: '#FEE2E2', text: '#B91C1C' },
  HIGH: { bg: '#FEE2E2', text: '#B91C1C' },
  MEDIUM: { bg: '#FEF3C7', text: '#B45309' },
  LOW: { bg: '#F1F5F9', text: '#475569' },
  SYNCED: { bg: '#E6F4EA', text: '#137333' },
  PENDING: { bg: '#FEF3C7', text: '#B45309' },
  ERROR: { bg: '#FEE2E2', text: '#B91C1C' },
};
