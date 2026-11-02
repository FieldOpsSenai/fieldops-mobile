import React, { useState, useEffect, useMemo } from 'react';
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

interface CalendarCell {
  day: number;
  month: number; // 0-11
  year: number;
  isCurrentMonth: boolean;
}

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const FULL_WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Dom) a 6 (Sáb)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];

  // Dias finais do mês anterior
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
    });
  }

  // Dias do mês atual
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      month,
      year,
      isCurrentMonth: true,
    });
  }

  // Dias iniciais do próximo mês para completar 42 células (6 semanas)
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({
      day: nextDay++,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
    });
  }

  return cells;
}

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({
  onSelectInspection,
}) => {
  const today = useMemo(() => new Date(), []);

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<{
    day: number;
    month: number;
    year: number;
  }>({
    day: today.getDate(),
    month: today.getMonth(),
    year: today.getFullYear(),
  });

  useEffect(() => {
    getInspections().then(setInspections);
  }, []);

  const calendarCells = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const weeks = useMemo(() => {
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      rows.push(calendarCells.slice(i, i + 7));
    }
    return rows;
  }, [calendarCells]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectCell = (cell: CalendarCell) => {
    setSelectedDate({ day: cell.day, month: cell.month, year: cell.year });
    if (!cell.isCurrentMonth) {
      setViewMonth(cell.month);
      setViewYear(cell.year);
    }
  };

  const handleGoToToday = () => {
    const d = today.getDate();
    const m = today.getMonth();
    const y = today.getFullYear();
    setViewMonth(m);
    setViewYear(y);
    setSelectedDate({ day: d, month: m, year: y });
  };

  const isSameDay = (
    a: { day: number; month: number; year: number },
    b: { day: number; month: number; year: number }
  ) => a.day === b.day && a.month === b.month && a.year === b.year;

  const todayObj = {
    day: today.getDate(),
    month: today.getMonth(),
    year: today.getFullYear(),
  };

  // Verifica se uma inspeção pertence a uma data específica
  const doesInspectionMatchDate = (
    inspection: Inspection,
    target: { day: number; month: number; year: number }
  ) => {
    const raw = inspection.scheduled_date || '';
    if (raw.toLowerCase().includes('hoje')) {
      return isSameDay(target, todayObj);
    }
    const dd = String(target.day).padStart(2, '0');
    const mm = String(target.month + 1).padStart(2, '0');
    const yyyy = String(target.year);
    if (raw.includes(`${dd}/${mm}/${yyyy}`) || raw.includes(`${yyyy}-${mm}-${dd}`)) {
      return true;
    }
    return isSameDay(target, todayObj);
  };

  const hasInspectionsOnDate = (target: {
    day: number;
    month: number;
    year: number;
  }) => inspections.some((i) => doesInspectionMatchDate(i, target));

  const dayInspections = useMemo(
    () => inspections.filter((i) => doesInspectionMatchDate(i, selectedDate)),
    [inspections, selectedDate]
  );

  const morningItems = dayInspections.filter(
    (i) => i.scheduled_date.includes('08:') || i.scheduled_date.includes('11:')
  );

  const afternoonItems = dayInspections.filter(
    (i) =>
      i.scheduled_date.includes('14:') ||
      !morningItems.some((m) => m.id === i.id)
  );

  const selectedWeekdayName =
    FULL_WEEKDAYS[
      new Date(selectedDate.year, selectedDate.month, selectedDate.day).getDay()
    ];
  const isSelectedToday = isSameDay(selectedDate, todayObj);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Title Row */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Agenda de Campo</Text>
          {!isSelectedToday && (
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={handleGoToToday}
              activeOpacity={0.7}
            >
              <Ionicons name="today-outline" size={14} color={colors.primary} />
              <Text style={styles.todayBtnText}>Hoje</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Monthly Calendar Card */}
        <View style={styles.calendarCard}>
          {/* Month & Navigator */}
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>
              {MONTH_NAMES[viewMonth]} de {viewYear}
            </Text>
            <View style={styles.monthNavGroup}>
              <TouchableOpacity
                style={styles.navArrow}
                onPress={handlePrevMonth}
                activeOpacity={0.7}
              >
                <Ionicons name="caret-up" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navArrow}
                onPress={handleNextMonth}
                activeOpacity={0.7}
              >
                <Ionicons name="caret-down" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Weekday Headers (D S T Q Q S S) */}
          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((w, idx) => (
              <View key={idx} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{w}</Text>
              </View>
            ))}
          </View>

          {/* 6-Week Monthly Grid */}
          <View style={styles.gridContainer}>
            {weeks.map((week, wIdx) => (
              <View key={wIdx} style={styles.weekRow}>
                {week.map((cell, cIdx) => {
                  const isSelected = isSameDay(cell, selectedDate);
                  const isToday = isSameDay(cell, todayObj);
                  const hasEvents = hasInspectionsOnDate(cell);

                  return (
                    <TouchableOpacity
                      key={`${wIdx}-${cIdx}`}
                      style={styles.dayCellWrapper}
                      onPress={() => handleSelectCell(cell)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          isToday && !isSelected && styles.dayCircleToday,
                          isSelected && styles.dayCircleSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNum,
                            !cell.isCurrentMonth && styles.dayNumOutside,
                            isToday && !isSelected && styles.dayNumToday,
                            isSelected && styles.dayNumSelected,
                          ]}
                        >
                          {cell.day}
                        </Text>
                        {hasEvents && (
                          <View
                            style={[
                              styles.dayDot,
                              isSelected && styles.dayDotSelected,
                            ]}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Selected Date Summary Bar */}
        <View style={styles.selectedDateBanner}>
          <View style={styles.selectedDateInfo}>
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={styles.selectedDateText}>
              {selectedWeekdayName}, {selectedDate.day} de{' '}
              {MONTH_NAMES[selectedDate.month]}
              {isSelectedToday ? ' (Hoje)' : ''}
            </Text>
          </View>
          <Text style={styles.selectedDateCount}>
            {dayInspections.length}{' '}
            {dayInspections.length === 1 ? 'vistoria' : 'vistorias'}
          </Text>
        </View>

        {/* Turno: Manhã */}
        <View style={styles.timeGroup}>
          <Text style={styles.groupHeader}>TURNO DA MANHÃ (08:00 - 12:00)</Text>

          {morningItems.length === 0 ? (
            <Text style={styles.emptyTurno}>
              Nenhuma vistoria agendada pela manhã neste dia.
            </Text>
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
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.timeText}>{item.scheduled_date}</Text>
                  </View>
                  <Badge label={item.status} type={item.status} />
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardClient}>{item.client_name}</Text>

                <View style={styles.divider} />

                <View style={styles.locationRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
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
            <Text style={styles.emptyTurno}>
              Nenhuma vistoria agendada para a tarde neste dia.
            </Text>
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
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.timeText}>{item.scheduled_date}</Text>
                  </View>
                  <Badge label={item.status} type={item.status} />
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardClient}>{item.client_name}</Text>

                <View style={styles.divider} />

                <View style={styles.locationRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'lowercase',
  },
  monthNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  gridContainer: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCellWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayCircleSelected: {
    backgroundColor: colors.primary,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dayNumOutside: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  dayNumToday: {
    color: colors.primary,
    fontWeight: '800',
  },
  dayNumSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  dayDotSelected: {
    backgroundColor: '#38BDF8',
  },
  selectedDateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  selectedDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  selectedDateCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
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


