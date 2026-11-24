import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Badge, formatCriticalityLabel } from '../../components/Badge';
import { Inspection, ChecklistItemWithAnswer } from '../../types';
import { startInspection, getInspectionById, getChecklistWithAnswers } from '../../database';
import { NativeScannerModal } from '../../components/NativeScannerModal';

interface InspectionDetailScreenProps {
  inspection: Inspection;
  onBack: () => void;
  onOpenChecklist: (inspection: Inspection) => void;
  onOpenSummary: (inspection: Inspection) => void;
  onRefreshInspection: (updated: Inspection) => void;
}

export const InspectionDetailScreen: React.FC<InspectionDetailScreenProps> = ({
  inspection,
  onBack,
  onOpenChecklist,
  onOpenSummary,
  onRefreshInspection,
}) => {
  const [scannerVisible, setScannerVisible] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItemWithAnswer[]>([]);

  useEffect(() => {
    getChecklistWithAnswers(inspection.id)
      .then(setChecklistItems)
      .catch((err) => console.log('Erro ao carregar acompanhamento da inspeção:', err));
  }, [inspection.id, inspection.status]);

  const nonConformities = checklistItems.filter(
    (i) => i.answer?.is_non_conform === 1 || i.answer?.value === 'NON_CONFORM'
  );

  const allEvidences = checklistItems.flatMap((i) =>
    i.evidences.map((ev) => ({
      ...ev,
      itemTitle: i.title,
      sectionName: i.section_name,
    }))
  );

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return 'Horário não informado';
    try {
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return iso;
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      const hh = String(dt.getHours()).padStart(2, '0');
      const min = String(dt.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
    } catch {
      return iso;
    }
  };

  const handleStartWithGps = async () => {
    try {
      setLoadingGps(true);

      // Coleta pontual de coordenadas GPS conforme RN-013 / Seção 13.7
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
        console.log('GPS indisponível no momento:', locErr);
      }

      await startInspection(inspection.id, lat, lon);
      const updated = await getInspectionById(inspection.id);

      if (updated) {
        onRefreshInspection(updated);
        onOpenChecklist(updated);
      }
    } catch (err: any) {
      Alert.alert('Erro ao iniciar', err.message || 'Falha ao iniciar vistoria');
    } finally {
      setLoadingGps(false);
    }
  };

  const handleScanSuccess = async (scannedCode: string) => {
    setScannerVisible(false);
    await handleStartWithGps();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerCode}>{inspection.code}</Text>
        <Badge label={inspection.status} type={inspection.status} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
        {/* Title & Priority */}
        <View style={styles.cardSection}>
          <Text style={styles.title}>{inspection.title}</Text>
          <View style={styles.priorityRow}>
            <Text style={styles.priorityLabel}>Nível de Prioridade:</Text>
            <Badge label={inspection.priority} type={inspection.priority} />
          </View>
        </View>

        {/* Alerta de Inspeção Reprovada pelo Supervisor (PBI-062 / AC-REVIEW) */}
        {((inspection.status as string) === 'REJECTED' || inspection.status === 'FAILED') && (
          <View style={styles.rejectedCard}>
            <View style={styles.rejectedHeader}>
              <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
              <Text style={styles.rejectedHeaderTitle}>
                Inspeção Reprovada — Correção Solicitada
              </Text>
            </View>
            <View style={styles.rejectedBody}>
              <Text style={styles.rejectedReasonLabel}>Motivo / Instruções do Supervisor:</Text>
              <Text style={styles.rejectedReasonText}>
                {(inspection as any).rejection_reason ||
                  inspection.notes ||
                  'Revise os itens apontados pelo supervisor, atualize as evidências e reenvie a vistoria.'}
              </Text>
            </View>
          </View>
        )}

        {/* Local & Cliente */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Local da Vistoria</Text>

          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={18} color={colors.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Cliente</Text>
              <Text style={styles.infoValue}>{inspection.client_name}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Endereço / Área Técnica</Text>
              <Text style={styles.infoValue}>{inspection.location_name}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Horário Agendado</Text>
              <Text style={styles.infoValue}>{inspection.scheduled_date}</Text>
            </View>
          </View>
        </View>

        {/* Equipamento & QR Code */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Equipamento Agendado</Text>

          <View style={styles.equipmentBox}>
            <Ionicons name="cube-outline" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.equipmentName}>{inspection.equipment_name}</Text>
              <Text style={styles.equipmentId}>ID do Sistema: {inspection.equipment_id}</Text>
            </View>
          </View>

          <View style={styles.qrRow}>
            <Ionicons name="qr-code-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.qrLabel}>Código QR esperado:</Text>
            <Text style={styles.qrCodeText}>{inspection.equipment_qr_code}</Text>
          </View>
        </View>

        {/* Instruções */}
        {inspection.notes && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Instruções do Supervisor</Text>
            <Text style={styles.notesText}>{inspection.notes}</Text>
          </View>
        )}

        {/* Georreferenciamento de Início e Conclusão (RN-061 / RN-062) */}
        {inspection.started_at && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Comprovação de Presença (GPS)</Text>
            <View style={styles.gpsRow}>
              <Ionicons name="navigate-circle-outline" size={18} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsText}>
                  {inspection.start_latitude && inspection.start_longitude
                    ? `Início: Lat ${inspection.start_latitude.toFixed(6)}, Long ${inspection.start_longitude.toFixed(6)}${
                        (inspection as any).start_accuracy
                          ? ` (±${Math.round((inspection as any).start_accuracy)}m)`
                          : ''
                      }`
                    : 'Início: Coordenadas salvas no dispositivo'}
                </Text>
                <Text style={styles.gpsTimeText}>
                  Horário de início: {formatDateTime(inspection.started_at)}
                </Text>
                {inspection.completed_at && (
                  <>
                    <Text style={[styles.gpsText, { marginTop: 6 }]}>
                      {inspection.end_latitude && inspection.end_longitude
                        ? `Conclusão: Lat ${inspection.end_latitude.toFixed(6)}, Long ${inspection.end_longitude.toFixed(6)}${
                            (inspection as any).end_accuracy
                              ? ` (±${Math.round((inspection as any).end_accuracy)}m)`
                              : ''
                          }`
                        : 'Conclusão: Registrada no dispositivo'}
                    </Text>
                    <Text style={styles.gpsTimeText}>
                      Horário de conclusão: {formatDateTime(inspection.completed_at)}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Acompanhamento: Evidências e Não Conformidades (PBI-047) */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>
            Acompanhamento de Não Conformidades ({nonConformities.length})
          </Text>

          {nonConformities.length === 0 ? (
            <View style={styles.emptyTrackingRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
              <Text style={styles.emptyTrackingText}>
                Nenhuma não conformidade registrada para a inspeção {inspection.code}.
              </Text>
            </View>
          ) : (
            <View style={styles.trackingList}>
              {nonConformities.map((nc) => {
                const crit = nc.answer?.criticality || 'MEDIUM';
                return (
                  <View key={nc.id} style={styles.ncTrackingCard}>
                    <View style={styles.ncTrackingHeader}>
                      <Text style={styles.ncTrackingItemTitle}>{nc.title}</Text>
                      <Badge
                        label={`Criticidade: ${formatCriticalityLabel(crit)}`}
                        type={crit}
                      />
                    </View>
                    <Text style={styles.ncTrackingOrigin}>
                      Inspeção {inspection.code} • {nc.section_name}
                    </Text>
                    <Text style={styles.ncTrackingDesc}>
                      {nc.answer?.observation || 'Sem descrição detalhada registrada.'}
                    </Text>
                    {nc.answer?.answered_at && (
                      <Text style={styles.ncTrackingTime}>
                        Data/Hora: {formatDateTime(nc.answer.answered_at)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.evidenceSubSection}>
            <Text style={styles.sectionTitle}>
              Evidências Fotográficas ({allEvidences.length})
            </Text>

            {allEvidences.length === 0 ? (
              <Text style={styles.emptyEvidenceText}>
                Nenhuma fotografia de evidência anexada até o momento.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.evidenceGalleryRow}
              >
                {allEvidences.map((ev) => (
                  <View key={ev.id} style={styles.evidenceCard}>
                    <Image source={{ uri: ev.file_uri }} style={styles.evidenceThumb} />
                    <Text style={styles.evidenceItemName} numberOfLines={1}>
                      {ev.itemTitle}
                    </Text>
                    <Text style={styles.evidenceInspCode} numberOfLines={1}>
                      {ev.sectionName}
                    </Text>
                    <Text style={styles.evidenceInspCode}>
                      {inspection.code} • {formatDateTime(ev.created_at)}
                    </Text>
                    <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                      <Badge
                        label={ev.sync_status === 'SYNCED' ? 'ENVIADA' : 'PENDENTE'}
                        type={ev.sync_status}
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        {inspection.status === 'SCHEDULED' ? (
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.8}
            onPress={() => setScannerVisible(true)}
            disabled={loadingGps}
          >
            {loadingGps ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Validar QR Code e Iniciar</Text>
              </>
            )}
          </TouchableOpacity>
        ) : inspection.status === 'IN_PROGRESS' ||
          (inspection.status as string) === 'REJECTED' ||
          inspection.status === 'FAILED' ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              ((inspection.status as string) === 'REJECTED' || inspection.status === 'FAILED') && {
                backgroundColor: colors.danger,
              },
            ]}
            activeOpacity={0.8}
            onPress={() => onOpenChecklist(inspection)}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>
              {(inspection.status as string) === 'REJECTED' || inspection.status === 'FAILED'
                ? 'Corrigir Checklist e Reenviar'
                : 'Continuar Checklist Dinâmico'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
            activeOpacity={0.8}
            onPress={() => onOpenSummary(inspection)}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Ver Resumo e Evidências</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Scanner Modal */}
      <NativeScannerModal
        visible={scannerVisible}
        expectedQrCode={inspection.equipment_qr_code}
        equipmentName={inspection.equipment_name}
        onClose={() => setScannerVisible(false)}
        onScanSuccess={handleScanSuccess}
      />
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerCode: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'monospace',
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    marginTop: 1,
  },
  equipmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    gap: 12,
    marginBottom: 10,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  equipmentId: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  qrCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: 'monospace',
  },
  notesText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 6,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successLight,
    padding: 10,
    borderRadius: 6,
  },
  gpsText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  gpsTimeText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rejectedCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    overflow: 'hidden',
  },
  rejectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  rejectedHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectedBody: {
    padding: 12,
  },
  rejectedReasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rejectedReasonText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  emptyTrackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successLight,
    padding: 10,
    borderRadius: 6,
  },
  emptyTrackingText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    flex: 1,
  },
  trackingList: {
    gap: 10,
  },
  ncTrackingCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    padding: 10,
  },
  ncTrackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ncTrackingItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  ncTrackingOrigin: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ncTrackingDesc: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
  ncTrackingTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },
  evidenceSubSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  emptyEvidenceText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  evidenceGalleryRow: {
    flexDirection: 'row',
  },
  evidenceCard: {
    width: 140,
    marginRight: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  evidenceThumb: {
    width: '100%',
    height: 84,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    marginBottom: 4,
  },
  evidenceItemName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  evidenceInspCode: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

