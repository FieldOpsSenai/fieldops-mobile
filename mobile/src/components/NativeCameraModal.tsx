import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

interface NativeCameraModalProps {
  visible: boolean;
  itemTitle?: string;
  onClose: () => void;
  onPhotoCaptured: (savedUri: string) => void;
}

export const NativeCameraModal: React.FC<NativeCameraModalProps> = ({
  visible,
  itemTitle,
  onClose,
  onPhotoCaptured,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<any>(null);

  const handleTakePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });

      if (photo && photo.uri) {
        setPhotoUri(photo.uri);
      }
    } catch (err: any) {
      Alert.alert('Erro ao fotografar', err.message || 'Falha na câmera.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmPhoto = () => {
    if (!photoUri) return;
    const finalUri = photoUri;
    setPhotoUri(null);
    onPhotoCaptured(finalUri);
  };

  const handleRetake = () => {
    setPhotoUri(null);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setPhotoUri(null);
              onClose();
            }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {photoUri ? 'Confirmar Evidência' : 'Capturar Foto'}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {itemTitle ? (
          <View style={styles.itemTitleBanner}>
            <Text style={styles.itemLabel}>Item de Inspeção:</Text>
            <Text style={styles.itemText} numberOfLines={2}>
              {itemTitle}
            </Text>
          </View>
        ) : null}

        {/* Content */}
        {photoUri ? (
          // Preview Screen
          <View style={styles.previewContainer}>
            <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="contain" />
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
                <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
                <Text style={styles.retakeText}>Refazer Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmPhoto}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.confirmText}>Usar Evidência</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : !permission ? (
          <View style={styles.permissionContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.permissionText}>Carregando câmera...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={60} color="#FFFFFF" />
            <Text style={styles.permissionTitle}>Acesso à Câmera Necessário</Text>
            <Text style={styles.permissionDesc}>
              Para comprovar o estado físico do equipamento e anexar fotos ao relatório, autorize o
              uso da câmera.
            </Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Permitir Acesso</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Live Camera
          <View style={styles.cameraWrapper}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" ref={cameraRef} />

            {/* Shutter Button Bar */}
            <View style={styles.shutterBar}>
              <TouchableOpacity
                style={styles.shutterBtn}
                onPress={handleTakePicture}
                disabled={isCapturing}
                activeOpacity={0.7}
              >
                {isCapturing ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <View style={styles.innerShutter} />
                )}
              </TouchableOpacity>
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
    paddingBottom: 14,
    backgroundColor: '#0F172A',
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  itemTitleBanner: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  itemText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  shutterBar: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  innerShutter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#0F172A',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  retakeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  permissionText: {
    color: '#FFFFFF',
    marginTop: 12,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
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
});
