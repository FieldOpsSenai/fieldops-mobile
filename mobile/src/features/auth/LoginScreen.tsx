import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { User } from '../../types';
import { authenticateUser, upsertOfflineUser, saveAuthSession } from '../../database';
import {
  loginWithApi,
  getApiUrl,
  updateApiUrl,
  DEFAULT_API_URL,
} from '../../api';
import { pullServerData } from '../../sync';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getApiUrl());
  const [activeServerUrl, setActiveServerUrl] = useState(getApiUrl());

  useEffect(() => {
    const current = getApiUrl();
    setActiveServerUrl(current);
    setServerUrlInput(current);
  }, []);

  const handleSaveServerUrl = async () => {
    const updated = await updateApiUrl(serverUrlInput);
    setActiveServerUrl(updated);
    setServerUrlInput(updated);
    setShowServerConfig(false);
    setErrorMessage(null);
  };

  const handleResetServerUrl = async () => {
    const updated = await updateApiUrl(null);
    setActiveServerUrl(updated);
    setServerUrlInput(updated);
    setShowServerConfig(false);
    setErrorMessage(null);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      // 1. Tenta autenticar diretamente na API Spring Boot (/api/v1/auth/login)
      try {
        const apiUser = await loginWithApi(email, password);
        await upsertOfflineUser(apiUser, password.trim());
        await pullServerData(apiUser.id);
        onLoginSuccess(apiUser);
        return;
      } catch (apiErr: any) {
        if (apiErr.message === 'INVALID_CREDENTIALS') {
          setErrorMessage('Credenciais inválidas. Verifique o e-mail e a senha.');
          return;
        }
        console.log('[Auth] API indisponível, utilizando autenticação offline SQLite:', apiErr.message);
      }

      // 2. Fallback Offline no SQLite caso o servidor esteja inacessível
      const localUser = await authenticateUser(email, password);

      if (localUser) {
        await saveAuthSession(localUser);
        onLoginSuccess(localUser);
      } else {
        setErrorMessage(
          'Servidor inacessível e credenciais não encontradas no banco offline local.'
        );
      }
    } catch (err: any) {
      Alert.alert('Erro ao entrar', err.message || 'Falha de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        {/* Emblem / Logo */}
        <View style={styles.logoWrapper}>
          <View style={styles.logoBox}>
            <Ionicons name="shield-checkmark" size={42} color={colors.primary} />
            <Text style={styles.logoBrand}>FieldOps</Text>
            <Text style={styles.logoBrandSub}>TECHNICAL INSPECTION</Text>
          </View>
        </View>

        {/* Titles */}
        <Text style={styles.portalTitle}>FieldOps Portal</Text>
        <Text style={styles.portalSubtitle}>Inspeção e Controle Técnico</Text>

        {/* Error message */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Email Field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>E-mail Corporativo</Text>
          <View style={[styles.inputBox, errorMessage && styles.inputBoxError]}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.textInput}
              placeholder="tecnico@fieldops.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={(txt) => {
                setEmail(txt);
                setErrorMessage(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Password Field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Senha</Text>
          <View style={[styles.inputBox, errorMessage && styles.inputBoxError]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.textInput}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(txt) => {
                setPassword(txt);
                setErrorMessage(null);
              }}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginBtnText}>Entrar</Text>
          )}
        </TouchableOpacity>

        {/* Server URL Config (discreto para troca rápida de IP AWS) */}
        <TouchableOpacity
          style={styles.serverToggleBtn}
          onPress={() => setShowServerConfig((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons name="server-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.serverToggleText} numberOfLines={1}>
            API: {activeServerUrl.replace(/^https?:\/\//i, '')}
          </Text>
          <Ionicons
            name={showServerConfig ? 'chevron-up' : 'create-outline'}
            size={14}
            color={colors.primary}
          />
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.serverConfigBox}>
            <Text style={styles.serverConfigLabel}>URL da API (AWS / Local)</Text>
            <View style={styles.inputBox}>
              <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.textInput}
                placeholder={DEFAULT_API_URL}
                placeholderTextColor={colors.textMuted}
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
            <View style={styles.serverConfigActions}>
              <TouchableOpacity
                style={styles.serverResetBtn}
                onPress={handleResetServerUrl}
              >
                <Text style={styles.serverResetBtnText}>Padrão</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.serverSaveBtn}
                onPress={handleSaveServerUrl}
              >
                <Text style={styles.serverSaveBtnText}>Salvar IP</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Footer Build Info */}
        <Text style={styles.versionText}>FieldOps Mobile v1.0.0</Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingVertical: 36,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBox: {
    width: 140,
    height: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  logoBrand: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
  },
  logoBrandSub: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  portalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  portalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 4,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  inputBoxError: {
    borderColor: colors.danger,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  loginBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  serverToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 10,
  },
  serverToggleText: {
    fontSize: 12,
    color: colors.textSecondary,
    maxWidth: 230,
  },
  serverConfigBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  serverConfigLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  serverConfigActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  serverResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  serverResetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  serverSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  serverSaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

