import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

interface NativeScannerModalProps {
  visible: boolean;
  expectedQrCode: string;
  equipmentName: string;
  onClose: () => void;
  onScanSuccess: (scannedCode: string) => void;
}

export const NativeScannerModal: React.FC<NativeScannerModalProps> = ({
  visible,
  expectedQrCode,
  equipmentName,
  onClose,
  onScanSuccess,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const cleanScanned = data.trim();
    const cleanExpected = expectedQrCode.trim();

    if (cleanScanned === cleanExpected) {
      Alert.alert(
        'Equipamento Confirmado!',
        `QR Code válido: ${cleanScanned}\nEquipamento: ${equipmentName}`,
        [
          {
            text: 'Iniciar Checklist',
            onPress: () => {
              setScanned(false);
              onScanSuccess(cleanScanned);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Divergência de Equipamento!',
        `O QR Code lido (${cleanScanned}) não confere com o previsto (${cleanExpected}). Deseja prosseguir com ressalva?`,
        [
          {
            text: 'Tentar Novamente',
            style: 'cancel',
            onPress: () => setScanned(false),
          },
          {
            text: 'Prosseguir com Ressalva',
            style: 'destructive',
            onPress: () => {
              setScanned(false);
              onScanSuccess(cleanScanned);
            },
          },
        ]
      );
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      Alert.alert('Erro', 'Por favor, digite o código do equipamento.');
      return;
    }
    handleBarcodeScanned({ data: manualCode });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Validar Equipamento</Text>
          <TouchableOpacity
            onPress={() => setShowManualInput(!showManualInput)}
            style={styles.manualBtn}
          >
            <Ionicons
              name={showManualInput ? 'camera' : 'keypad-outline'}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Expected Info Banner */}
        <View style={styles.targetBanner}>
          <Text style={styles.targetLabel}>Equipamento Agendado:</Text>
          <Text style={styles.targetName}>{equipmentName}</Text>
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>QR Esperado: {expectedQrCode}</Text>
          </View>
        </View>

        {showManualInput ? (
          <View style={styles.manualContainer}>
            <Ionicons name="barcode-outline" size={64} color={colors.primary} />
            <Text style={styles.manualTitle}>Entrada Manual do Código</Text>
            <Text style={styles.manualDesc}>
              Caso a etiqueta esteja danificada, insira o código impresso abaixo:
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: EQ-VALVE-102"
              placeholderTextColor={colors.textMuted}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.confirmBtn} onPress={handleManualSubmit}>
              <Text style={styles.confirmBtnText}>Confirmar Código</Text>
            </TouchableOpacity>
          </View>
        ) : !permission ? (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Carregando permissões da câmera...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-reverse-outline" size={54} color="#FFFFFF" />
            <Text style={styles.permissionTitle}>Permissão de Câmera Necessária</Text>
            <Text style={styles.permissionDesc}>
              O FieldOps precisa acessar a câmera do celular para ler o QR Code da máquina em campo.
            </Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Conceder Acesso à Câmera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />

            {/* Viewfinder Target Overlay */}
            <View style={styles.overlay}>
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <Text style={styles.instructionText}>
                Aponte a câmera para a etiqueta com o QR Code
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
  },
  closeBtn: {
    padding: 6,
  },
  manualBtn: {
    padding: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  targetBanner: {
    backgroundColor: '#1E293B',
    padding: 14,
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  targetLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  targetName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 6,
  },
  codeBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  codeText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  viewfinder: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#38BDF8',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 28,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  manualContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  manualDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 20,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
