import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Badge } from '../../components/Badge';
import { Inspection } from '../../types';
import { getInspections } from '../../database';
import { pullServerData } from '../../sync';

interface InspectionsListScreenProps {
  onSelectInspection: (inspection: Inspection) => void;
}

export const InspectionsListScreen: React.FC<InspectionsListScreenProps> = ({
  onSelectInspection,
}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'IN_PROGRESS' | 'SCHEDULED' | 'COMPLETED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [customDateText, setCustomDateText] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const effectiveDateFilter = customDateText.trim() !== '' ? customDateText.trim() : dateFilter;

  const fetchInspections = async () => {
    try {
      const data = await getInspections(search, activeFilter, priorityFilter, effectiveDateFilter);
      setInspections(data);
    } catch (err) {
      console.log('Erro ao listar inspeções:', err);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [search, activeFilter, priorityFilter, effectiveDateFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await pullServerData();
    await fetchInspections();
    setRefreshing(false);
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    activeFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    effectiveDateFilter !== 'ALL';

  const clearAllFilters = () => {
    setSearch('');
    setActiveFilter('ALL');
    setPriorityFilter('ALL');
    setDateFilter('ALL');
    setCustomDateText('');
  };

  const filterOptions = [
    { key: 'ALL', label: 'Todas' },
    { key: 'IN_PROGRESS', label: 'Em Andamento' },
    { key: 'SCHEDULED', label: 'Agendadas' },
    { key: 'COMPLETED', label: 'Concluídas' },
  ];

  const priorityOptions = [
    { key: 'ALL', label: 'Todas' },
    { key: 'HIGH', label: 'Alta' },
    { key: 'MEDIUM', label: 'Média' },
    { key: 'LOW', label: 'Baixa' },
  ];

  const dateOptions = [
    { key: 'ALL', label: 'Qualquer data' },
    { key: 'TODAY', label: 'Hoje' },
  ];

  return (
    <View style={styles.container}>
      {/* Search & Filters Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por código, cliente ou local..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtro por Estado */}
        <Text style={styles.filterGroupLabel}>Estado:</Text>
        <View style={styles.filterRow}>
          {filterOptions.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                activeFilter === f.key && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(f.key as any)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filtro por Prioridade */}
        <Text style={styles.filterGroupLabel}>Prioridade:</Text>
        <View style={styles.filterRow}>
          {priorityOptions.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.filterChip,
                priorityFilter === p.key && styles.filterChipActive,
              ]}
              onPress={() => setPriorityFilter(p.key as any)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  priorityFilter === p.key && styles.filterChipTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filtro por Data */}
        <Text style={styles.filterGroupLabel}>Data agendada:</Text>
        <View style={styles.dateFilterRow}>
          {dateOptions.map((d) => (
            <TouchableOpacity
              key={d.key}
              style={[
                styles.filterChip,
                dateFilter === d.key && customDateText.trim() === '' && styles.filterChipActive,
              ]}
              onPress={() => {
                setCustomDateText('');
                setDateFilter(d.key);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  dateFilter === d.key && customDateText.trim() === '' && styles.filterChipTextActive,
                ]}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.dateInputBox}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <TextInput
              style={styles.dateInput}
              placeholder="DD/MM/AAAA ou horário"
              placeholderTextColor={colors.textMuted}
              value={customDateText}
              onChangeText={setCustomDateText}
            />
            {customDateText.length > 0 && (
              <TouchableOpacity onPress={() => setCustomDateText('')}>
                <Ionicons name="close-circle" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearAllFilters}>
            <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            <Text style={styles.clearFiltersText}>Limpar filtros ativos</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={inspections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma inspeção encontrada</Text>
            <Text style={styles.emptySubtitle}>
              Tente ajustar os filtros de busca ou verifique a fila de sincronização.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => onSelectInspection(item)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.codeText}>{item.code}</Text>
              <Badge label={item.status} type={item.status} />
            </View>

            <Text style={styles.titleText}>{item.title}</Text>
            <Text style={styles.clientText}>{item.client_name}</Text>

            <View style={styles.infoRow}>
              <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.equipment_name}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.location_name}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.footerLeft}>
                <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.footerDate}>{item.scheduled_date}</Text>
              </View>

              <View style={styles.footerRight}>
                <Badge label={item.priority} type={item.priority} />
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateInputBox: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    height: 30,
    gap: 6,
  },
  dateInput: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    paddingVertical: 0,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 10,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  clientText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoText: {
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
    paddingTop: 10,
    marginTop: 6,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

