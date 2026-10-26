import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Badge } from '../../components/Badge';
import { Inspection } from '../../types';
import { getInspections } from '../../database';

interface ScheduleScreenProps {
  onSelectInspection: (inspection: Inspection) => void;
}

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({
  onSelectInspection,
}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedDay, setSelectedDay] = useState(14);

  const days = [
    { day: 'SEG', num: 12 },
    { day: 'TER', num: 13 },
    { day: 'QUA', num: 14 },
    { day: 'QUI', num: 15 },
    { day: 'SEX', num: 16 },
    { day: 'SÁB', num: 17 },
  ];

  useEffect(() => {
    getInspections().then(setInspections);
  }, []);

  const morningItems = inspections.filter((i) =>
    i.scheduled_date.includes('08:') || i.scheduled_date.includes('11:')
  );

  const afternoonItems = inspections.filter(
    (i) => i.scheduled_date.includes('14:') || !morningItems.some((m) => m.id === i.id)
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>Agenda de Campo</Text>

        {/* Month & Navigator */}
        <View style={styles.monthHeader}>
          <TouchableOpacity style={styles.navArrow}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>Outubro 2026</Text>
          <TouchableOpacity style={styles.navArrow}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Days Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysContainer}
        >
          {days.map((d) => {
            const isSelected = selectedDay === d.num;

            return (
              <TouchableOpacity
                key={d.num}
                style={[styles.dayCard, isSelected && styles.dayCardSelected]}
                onPress={() => setSelectedDay(d.num)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                  {d.day}
                </Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                  {d.num}
                </Text>
                {isSelected && <View style={styles.dayDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Turno: Manhã */}
        <View style={styles.timeGroup}>
          <Text style={styles.groupHeader}>TURNO DA MANHÃ (08:00 - 12:00)</Text>

          {morningItems.length === 0 ? (
            <Text style={styles.emptyTurno}>Nenhuma vistoria agendada pela manhã.</Text>
          ) : (
            morningItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.card,
                  item.status === 'IN_PROGRESS' && styles.cardActiveBorder,
                ]}
                activeOpacity={0.7}
                onPress={() => onSelectInspection(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={15} color={colors.primary} />
                    <Text style={styles.timeText}>{item.scheduled_date}</Text>
                  </View>
                  <Badge label={item.status} type={item.status} />
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardClient}>{item.client_name}</Text>

                <View style={styles.divider} />

                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.location_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Turno: Tarde */}
        <View style={styles.timeGroup}>
          <Text style={styles.groupHeader}>TURNO DA TARDE (12:00 - 18:00)</Text>

          {afternoonItems.length === 0 ? (
            <Text style={styles.emptyTurno}>Nenhuma vistoria agendada para a tarde.</Text>
          ) : (
            afternoonItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => onSelectInspection(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                    <Text style={styles.timeText}>{item.scheduled_date}</Text>
                  </View>
                  <Badge label={item.status} type={item.status} />
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardClient}>{item.client_name}</Text>

                <View style={styles.divider} />

                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.location_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={styles.footerNote}>— FIM DA PROGRAMAÇÃO DO DIA —</Text>
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
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  navArrow: {
    padding: 6,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  daysContainer: {
    gap: 8,
    paddingBottom: 16,
  },
  dayCard: {
    width: 58,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dayNameSelected: {
    color: '#E0F2F1',
  },
  dayNum: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  dayNumSelected: {
    color: '#FFFFFF',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
    marginTop: 4,
  },
  timeGroup: {
    marginTop: 16,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardActiveBorder: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
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
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  emptyTurno: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 20,
    letterSpacing: 1,
  },
});

