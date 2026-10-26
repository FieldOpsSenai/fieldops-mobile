import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Badge } from '../../components/Badge';
import { Inspection } from '../../types';
import { startInspection, getInspectionById } from '../../database';
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

        {/* Georreferenciamento de Início */}
        {inspection.started_at && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Comprovação de Presença (GPS)</Text>
            <View style={styles.gpsRow}>
              <Ionicons name="navigate-circle-outline" size={18} color={colors.success} />
              <Text style={styles.gpsText}>
                {inspection.start_latitude && inspection.start_longitude
                  ? `Lat: ${inspection.start_latitude.toFixed(6)}, Long: ${inspection.start_longitude.toFixed(6)}`
                  : 'Coordenadas salvas no dispositivo'}
              </Text>
            </View>
          </View>
        )}
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
        ) : inspection.status === 'IN_PROGRESS' ? (
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.8}
            onPress={() => onOpenChecklist(inspection)}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Continuar Checklist Dinâmico</Text>
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

