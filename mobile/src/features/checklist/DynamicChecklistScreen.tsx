import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Inspection, ChecklistItemWithAnswer } from '../../types';
import {
  getChecklistWithAnswers,
  saveAnswer,
  addEvidencePhoto,
  getInspectionById,
} from '../../database';
import { NativeCameraModal } from '../../components/NativeCameraModal';

interface DynamicChecklistScreenProps {
  inspection: Inspection;
  onBack: () => void;
  onProceedToSummary: (inspection: Inspection) => void;
}

export const DynamicChecklistScreen: React.FC<DynamicChecklistScreenProps> = ({
  inspection,
  onBack,
  onProceedToSummary,
}) => {
  const [items, setItems] = useState<ChecklistItemWithAnswer[]>([]);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [activeCameraItem, setActiveCameraItem] = useState<ChecklistItemWithAnswer | null>(null);

  const loadChecklist = async () => {
    try {
      const data = await getChecklistWithAnswers(inspection.id);
      setItems(data);
    } catch (err) {
      console.log('Erro ao carregar itens do checklist:', err);
    }
  };

  useEffect(() => {
    loadChecklist();
  }, [inspection.id]);

  // Salva resposta dinamicamente e atualiza estado local
  const handleAnswerChange = async (
    item: ChecklistItemWithAnswer,
    value: string,
    observation?: string,
    isNonConform?: boolean
  ) => {
    try {
      const nonConform =
        isNonConform !== undefined
          ? isNonConform
          : item.response_type === 'CONFORMITY'
          ? value === 'NON_CONFORM'
          : false;

      const currentObs = observation !== undefined ? observation : item.answer?.observation || '';

      await saveAnswer({
        inspectionId: inspection.id,
        itemId: item.id,
        value,
        observation: currentObs,
        isNonConform: nonConform,
      });

      // Atualiza visualmente
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                answer: {
                  id: i.answer?.id || 'temp',
                  inspection_id: inspection.id,
                  item_id: item.id,
                  value,
                  observation: currentObs,
                  is_non_conform: nonConform ? 1 : 0,
                  answered_at: new Date().toISOString(),
                },
              }
            : i
        )
      );
    } catch (err: any) {
      Alert.alert('Erro ao salvar resposta', err.message);
    }
  };

  const handleObservationChange = async (item: ChecklistItemWithAnswer, obs: string) => {
    if (!item.answer?.value) {
      return; // Preenche a resposta primeiro
    }
    await handleAnswerChange(item, item.answer.value, obs, item.answer.is_non_conform === 1);
  };

  const handleOpenCamera = (item: ChecklistItemWithAnswer) => {
    setActiveCameraItem(item);
    setCameraModalVisible(true);
  };

  const handlePhotoCaptured = async (savedUri: string) => {
    if (!activeCameraItem) return;

    try {
      await addEvidencePhoto({
        inspectionId: inspection.id,
        itemId: activeCameraItem.id,
        fileUri: savedUri,
        description: `Evidência capturada para: ${activeCameraItem.title}`,
      });

      setCameraModalVisible(false);
      setActiveCameraItem(null);
      await loadChecklist(); // Recarrega fotos
    } catch (err: any) {
      Alert.alert('Erro ao anexar foto', err.message);
    }
  };

  // Agrupamento por seção
  const sectionsMap = new Map<string, ChecklistItemWithAnswer[]>();
  for (const item of items) {
    const list = sectionsMap.get(item.section_name) || [];
    list.push(item);
    sectionsMap.set(item.section_name, list);
  }

  // Progresso
  const totalRequired = items.filter((i) => i.required === 1).length;
  const answeredRequired = items.filter((i) => i.required === 1 && i.answer?.value).length;
  const totalAnswered = items.filter((i) => i.answer?.value).length;
  const percent = items.length > 0 ? Math.round((totalAnswered / items.length) * 100) : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {inspection.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            {answeredRequired} de {totalRequired} obrigatórios respondidos
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.progressText}>{percent}% Concluído</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {Array.from(sectionsMap.entries()).map(([sectionTitle, sectionItems]) => (
          <View key={sectionTitle} style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Ionicons name="folder-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            </View>

            {sectionItems.map((item) => {
              const currentVal = item.answer?.value;
              const isNonConform = item.answer?.is_non_conform === 1;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    isNonConform && styles.itemCardNonConform,
                  ]}
                >
                  {/* Item Header */}
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.required === 1 && (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredText}>* Obrigatório</Text>
                      </View>
                    )}
                  </View>

                  {item.description && (
                    <Text style={styles.itemDesc}>{item.description}</Text>
                  )}

                  {/* Dynamic Input Switch */}
                  <View style={styles.inputContainer}>
                    {/* TIPO: CONFORMITY (Conforme / Não Conforme / N/A) */}
                    {item.response_type === 'CONFORMITY' && (
                      <View style={styles.choiceGroup}>
                        <TouchableOpacity
                          style={[
                            styles.choiceBtn,
                            currentVal === 'CONFORM' && styles.choiceBtnConform,
                          ]}
                          onPress={() => handleAnswerChange(item, 'CONFORM')}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={currentVal === 'CONFORM' ? '#FFFFFF' : colors.success}
                          />
                          <Text
                            style={[
                              styles.choiceBtnText,
                              currentVal === 'CONFORM' && styles.choiceBtnTextActive,
                            ]}
                          >
                            Conforme
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.choiceBtn,
                            currentVal === 'NON_CONFORM' && styles.choiceBtnNonConform,
                          ]}
                          onPress={() => handleAnswerChange(item, 'NON_CONFORM')}
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color={currentVal === 'NON_CONFORM' ? '#FFFFFF' : colors.danger}
                          />
                          <Text
                            style={[
                              styles.choiceBtnText,
                              currentVal === 'NON_CONFORM' && styles.choiceBtnTextActive,
                            ]}
                          >
                            Não Conforme
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.choiceBtn,
                            currentVal === 'NOT_APPLICABLE' && styles.choiceBtnNA,
                          ]}
                          onPress={() => handleAnswerChange(item, 'NOT_APPLICABLE')}
                        >
                          <Text
                            style={[
                              styles.choiceBtnText,
                              currentVal === 'NOT_APPLICABLE' && styles.choiceBtnTextActive,
                            ]}
                          >
                            N/A
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* TIPO: BOOLEAN (Sim / Não) */}
                    {item.response_type === 'BOOLEAN' && (
                      <View style={styles.choiceGroup}>
                        <TouchableOpacity
                          style={[
                            styles.choiceBtn,
                            currentVal === 'true' && styles.choiceBtnConform,
                          ]}
                          onPress={() => handleAnswerChange(item, 'true')}
                        >
                          <Text
                            style={[
                              styles.choiceBtnText,
                              currentVal === 'true' && styles.choiceBtnTextActive,
                            ]}
                          >
                            Sim
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.choiceBtn,
                            currentVal === 'false' && styles.choiceBtnNonConform,
                          ]}
                          onPress={() => handleAnswerChange(item, 'false')}
                        >
                          <Text
                            style={[
                              styles.choiceBtnText,
                              currentVal === 'false' && styles.choiceBtnTextActive,
                            ]}
                          >
                            Não
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* TIPO: NUMBER */}
                    {item.response_type === 'NUMBER' && (
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="Insira o valor numérico medido..."
                        placeholderTextColor={colors.textMuted}
                        defaultValue={currentVal || ''}
                        onEndEditing={(e) => handleAnswerChange(item, e.nativeEvent.text)}
                      />
                    )}

                    {/* TIPO: SINGLE_CHOICE */}
                    {item.response_type === 'SINGLE_CHOICE' && (
                      <View style={styles.pillGroup}>
                        {(() => {
                          try {
                            const opts: string[] = item.options_json
                              ? JSON.parse(item.options_json)
                              : ['Opção 1', 'Opção 2'];
                            return opts.map((opt) => (
                              <TouchableOpacity
                                key={opt}
                                style={[
                                  styles.pillBtn,
                                  currentVal === opt && styles.pillBtnActive,
                                ]}
                                onPress={() => handleAnswerChange(item, opt)}
                              >
                                <Text
                                  style={[
                                    styles.pillText,
                                    currentVal === opt && styles.pillTextActive,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            ));
                          } catch {
                            return null;
                          }
                        })()}
                      </View>
                    )}

                    {/* TIPO: TEXT_SHORT */}
                    {item.response_type === 'TEXT_SHORT' && (
                      <TextInput
                        style={styles.textInput}
                        placeholder="Digite a resposta curta..."
                        placeholderTextColor={colors.textMuted}
                        defaultValue={currentVal || ''}
                        onEndEditing={(e) => handleAnswerChange(item, e.nativeEvent.text)}
                      />
                    )}

                    {/* TIPO: TEXT_LONG */}
                    {item.response_type === 'TEXT_LONG' && (
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        multiline
                        numberOfLines={3}
                        placeholder="Descreva detalhadamente..."
                        placeholderTextColor={colors.textMuted}
                        defaultValue={currentVal || ''}
                        onEndEditing={(e) => handleAnswerChange(item, e.nativeEvent.text)}
                      />
                    )}

                    {/* TIPO: DATE */}
                    {item.response_type === 'DATE' && (
                      <TextInput
                        style={styles.textInput}
                        placeholder="AAAA-MM-DD (Ex: 2026-10-25)"
                        placeholderTextColor={colors.textMuted}
                        defaultValue={currentVal || ''}
                        onEndEditing={(e) => handleAnswerChange(item, e.nativeEvent.text)}
                      />
                    )}
                  </View>

                  {/* Observações / Anotações */}
                  <View style={styles.obsSection}>
                    <Text style={styles.obsLabel}>Observações do item:</Text>
                    <TextInput
                      style={styles.obsInput}
                      placeholder="Adicione observações técnicas se houver..."
                      placeholderTextColor={colors.textMuted}
                      defaultValue={item.answer?.observation || ''}
                      onEndEditing={(e) => handleObservationChange(item, e.nativeEvent.text)}
                    />
                  </View>

                  {/* Galeria de Fotos de Evidências */}
                  <View style={styles.evidenceSection}>
                    <View style={styles.evidenceHeader}>
                      <Text style={styles.evidenceLabel}>
                        Evidências ({item.evidences.length})
                      </Text>
                      <TouchableOpacity
                        style={styles.addPhotoBtn}
                        onPress={() => handleOpenCamera(item)}
                      >
                        <Ionicons name="camera" size={15} color={colors.primary} />
                        <Text style={styles.addPhotoText}>Anexar Foto</Text>
                      </TouchableOpacity>
                    </View>

                    {item.evidences.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.photoThumbList}
                      >
                        {item.evidences.map((photo) => (
                          <Image
                            key={photo.id}
                            source={{ uri: photo.file_uri }}
                            style={styles.photoThumb}
                          />
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.finishBtn}
          activeOpacity={0.8}
          onPress={() => onProceedToSummary(inspection)}
        >
          <Text style={styles.finishBtnText}>Revisar e Concluir Vistoria</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Native Camera Modal */}
      <NativeCameraModal
        visible={cameraModalVisible}
        itemTitle={activeCameraItem?.title}
        onClose={() => setCameraModalVisible(false)}
        onPhotoCaptured={handlePhotoCaptured}
      />
    </KeyboardAvoidingView>
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
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: 'monospace',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  itemCardNonConform: {
    borderColor: colors.danger,
    borderLeftWidth: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  inputContainer: {
    marginVertical: 8,
  },
  choiceGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  choiceBtnConform: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  choiceBtnNonConform: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  choiceBtnNA: {
    backgroundColor: '#64748B',
    borderColor: '#64748B',
  },
  choiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  choiceBtnTextActive: {
    color: '#FFFFFF',
  },
  pillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  pillBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  obsSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  obsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  obsInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  evidenceSection: {
    marginTop: 10,
  },
  evidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  evidenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  photoThumbList: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 8,
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
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

