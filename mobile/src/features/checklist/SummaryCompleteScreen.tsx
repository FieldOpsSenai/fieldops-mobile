import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Badge } from '../../components/Badge';
import { Inspection, ChecklistItemWithAnswer } from '../../types';
import {
  getChecklistWithAnswers,
  completeInspection,
  getInspectionById,
} from '../../database';

interface SummaryCompleteScreenProps {
  inspection: Inspection;
  onBack: () => void;
  onFinishComplete: (completedInspection: Inspection) => void;
}

export const SummaryCompleteScreen: React.FC<SummaryCompleteScreenProps> = ({
  inspection,
  onBack,
  onFinishComplete,
}) => {
  const [items, setItems] = useState<ChecklistItemWithAnswer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getChecklistWithAnswers(inspection.id).then(setItems);
  }, [inspection.id]);

  const nonConformItems = items.filter(
    (i) => i.answer?.is_non_conform === 1 || i.answer?.value === 'NON_CONFORM'
  );

  const missingRequired = items.filter((i) => i.required === 1 && !i.answer?.value);
  const totalEvidences = items.reduce((acc, curr) => acc + curr.evidences.length, 0);

  const handleComplete = async () => {
    if (missingRequired.length > 0) {
      Alert.alert(
        'Itens Obrigatórios Pendentes',
        `Ainda existem ${missingRequired.length} item(ns) obrigatório(s) sem resposta. Conclua todas as respostas obrigatórias antes de finalizar.`
      );
      return;
    }

    try {
      setLoading(true);

      // Coleta GPS final de conclusão da ordem de serviço
      let lat: number | null = null;
      let lon: number | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }
      } catch (locErr) {
        console.log('GPS indisponível no término:', locErr);
      }

      await completeInspection(inspection.id, lat, lon);
      const updated = await getInspectionById(inspection.id);

      Alert.alert(
        'Vistoria Concluída!',
        'A inspeção foi finalizada e gravada com sucesso no SQLite local. Os dados foram enfileirados no Outbox para sincronização com a retaguarda.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (updated) onFinishComplete(updated);
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Erro ao concluir', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resumo da Vistoria</Text>
        <Badge label={inspection.status} type={inspection.status} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Inspection Header Card */}
        <View style={styles.card}>
          <Text style={styles.codeText}>{inspection.code}</Text>
          <Text style={styles.titleText}>{inspection.title}</Text>
          <Text style={styles.clientText}>{inspection.client_name}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Equipamento:</Text>
            <Text style={styles.metaValue}>{inspection.equipment_name}</Text>
          </View>
        </View>

        {/* Missing Required Alert */}
        {missingRequired.length > 0 && (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle" size={24} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Atenção: Itens Pendentes</Text>
              <Text style={styles.warningDesc}>
                {missingRequired.length} item(ns) obrigatório(s) ainda não foram respondidos.
              </Text>
            </View>
          </View>
        )}

        {/* Non-conformities Banner */}
        {nonConformItems.length > 0 ? (
          <View style={styles.nonConformCard}>
            <View style={styles.nonConformHeader}>
              <Ionicons name="warning" size={20} color="#FFFFFF" />
              <Text style={styles.nonConformTitle}>
                Não Conformidades Detectadas ({nonConformItems.length})
              </Text>
            </View>

            <View style={styles.nonConformBody}>
              {nonConformItems.map((nc) => (
                <View key={nc.id} style={styles.ncItem}>
                  <Ionicons name="close-circle" size={18} color={colors.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ncTitle}>{nc.title}</Text>
                    <Text style={styles.ncObs}>
                      {nc.answer?.observation || 'Sem observação detalhada registrada.'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.successText}>Nenhuma não conformidade apontada na vistoria.</Text>
          </View>
        )}

        {/* Checklist Completo e Evidências Fotográficas */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Checklist Completo & Evidências ({totalEvidences} fotos)
          </Text>

          {items.map((item) => (
            <View key={item.id} style={styles.summaryItem}>
              <View style={styles.summaryItemTop}>
                <Ionicons
                  name={
                    item.answer?.value === 'NON_CONFORM' || item.answer?.is_non_conform === 1
                      ? 'close-circle'
                      : item.answer?.value
                      ? 'checkmark-circle'
                      : 'ellipse-outline'
                  }
                  size={18}
                  color={
                    item.answer?.value === 'NON_CONFORM' || item.answer?.is_non_conform === 1
                      ? colors.danger
                      : item.answer?.value
                      ? colors.success
                      : colors.textMuted
                  }
                />
                <Text style={styles.summaryItemTitle}>{item.title}</Text>
              </View>

              <Text style={styles.summaryItemValue}>
                Resposta: <Text style={{ fontWeight: '700' }}>{item.answer?.value || 'Não respondido'}</Text>
              </Text>

              {item.answer?.observation && (
                <Text style={styles.summaryItemObs}>Obs: {item.answer.observation}</Text>
              )}

              {/* Miniaturas de Fotos */}
              {item.evidences.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                  {item.evidences.map((p) => (
                    <Image key={p.id} source={{ uri: p.file_uri }} style={styles.summaryPhoto} />
                  ))}
                </ScrollView>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.finishBtn,
            missingRequired.length > 0 && styles.finishBtnDisabled,
          ]}
          onPress={handleComplete}
          disabled={loading || missingRequired.length > 0}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
              <Text style={styles.finishBtnText}>Concluir Vistoria & Gravar Outbox</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
    marginBottom: 2,
  },
  clientText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  warningDesc: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 1,
  },
  nonConformCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    overflow: 'hidden',
  },
  nonConformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  nonConformTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  nonConformBody: {
    padding: 12,
    gap: 10,
  },
  ncItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  ncTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  ncObs: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    padding: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  summaryItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 10,
  },
  summaryItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summaryItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  summaryItemValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 24,
  },
  summaryItemObs: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginLeft: 24,
    marginTop: 2,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    marginLeft: 24,
  },
  summaryPhoto: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: '#E2E8F0',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  finishBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

