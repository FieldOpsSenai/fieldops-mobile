import '@expo/metro-runtime';

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';

import {
  buscarUsuarioPorEmail,
  initDatabase,
  inserirUsuario,
  marcarComoSincronizado,
  validarCredenciais,
} from './src/database';
import { listarUsuariosRemotos } from './src/api';
import { sincronizarPendentes } from './src/sync';
import OverviewDashboard from './src/screens/OverviewDashboard';

export default function App() {
  const [autenticado, setAutenticado] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const sincronizandoRef = useRef(false);

  async function sincronizar(mostrarMensagem = false) {
    if (sincronizandoRef.current) {
      return;
    }

    try {
      sincronizandoRef.current = true;
      const resultado = await sincronizarPendentes();

      if (mostrarMensagem) {
        Alert.alert(
          'Sincronização',
          `Pendentes: ${resultado.total}\n` +
            `Sincronizados: ${resultado.sincronizados}\n` +
            `Erros: ${resultado.erros}`
        );
      }
    } finally {
      sincronizandoRef.current = false;
    }
  }

  useEffect(() => {
    let ativo = true;
    let unsubscribe: (() => void) | undefined;

    async function iniciar() {
      try {
        await initDatabase();

        if (!ativo) {
          return;
        }

        setPronto(true);

        unsubscribe = NetInfo.addEventListener((state) => {
          const conectado =
            state.isConnected === true &&
            state.isInternetReachable !== false;

          if (conectado) {
            void sincronizar(false);
          }
        });

        const rede = await NetInfo.fetch();
        const conectado =
          rede.isConnected === true &&
          rede.isInternetReachable !== false;

        if (conectado) {
          void sincronizar(false);
        }
      } catch (error) {
        console.error('Erro ao inicializar banco SQLite:', error);
      }
    }

    void iniciar();

    return () => {
      ativo = false;
      unsubscribe?.();
    };
  }, []);

  async function handleLogin() {
    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!emailLimpo) {
      Alert.alert('Campo Obrigatório', 'Por favor, informe seu e-mail corporativo.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLimpo)) {
      Alert.alert('E-mail Inválido', 'Por favor, informe um endereço de e-mail corporativo válido.');
      return;
    }

    if (!senhaLimpa) {
      Alert.alert('Campo Obrigatório', 'Por favor, informe sua senha de acesso.');
      return;
    }

    try {
      setCarregando(true);

      // 1. Tentar validar diretamente no SQLite local
      let usuarioAutenticado = await validarCredenciais(emailLimpo, senhaLimpa);

      // 2. Se não encontrar no banco local e houver conectividade, tentar consultar usuários na API
      if (!usuarioAutenticado) {
        const rede = await NetInfo.fetch();
        const conectado =
          rede.isConnected === true &&
          rede.isInternetReachable !== false;

        if (conectado) {
          try {
            const remotos = await listarUsuariosRemotos();
            if (Array.isArray(remotos)) {
              for (const remoto of remotos) {
                if (remoto.email?.trim().toLowerCase() === emailLimpo.toLowerCase()) {
                  const usuarioLocal = await buscarUsuarioPorEmail(remoto.email);
                  if (!usuarioLocal) {
                    await inserirUsuario(remoto.id, remoto.email, remoto.senha ?? '');
                    await marcarComoSincronizado(remoto.id);
                  }
                }
              }
              // Valida novamente após atualizar banco local
              usuarioAutenticado = await validarCredenciais(emailLimpo, senhaLimpa);
            }
          } catch (syncError) {
            console.log('Não foi possível consultar usuários remotos:', syncError);
          }
        }
      }

      // 3. Se credenciais não conferem ou usuário não foi encontrado
      if (!usuarioAutenticado) {
        Alert.alert(
          'Credenciais Inválidas',
          'E-mail corporativo ou senha incorretos. Por favor, verifique seus dados.'
        );
        return;
      }

      // 4. Sucesso: dispara sincronização de pendências em segundo plano se online
      const rede = await NetInfo.fetch();
      const conectado =
        rede.isConnected === true &&
        rede.isInternetReachable !== false;

      if (conectado) {
        void sincronizar(false);
      }

      setAutenticado(true);
    } catch (error) {
      Alert.alert(
        'Erro na Autenticação',
        'Não foi possível concluir o login. Tente novamente.'
      );
      console.error(error);
    } finally {
      setCarregando(false);
    }
  }

  function handleEsqueciSenha() {
    Alert.alert(
      'Redefinição de Senha',
      'Um link para redefinição de senha foi enviado para o e-mail corporativo cadastrado.'
    );
  }

  if (autenticado) {
    return (
      <OverviewDashboard
        onLogout={() => {
          setAutenticado(false);
          setSenha('');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Principal */}
          <View style={styles.card}>
            {/* Logo com borda suave */}
            <View style={styles.logoContainer}>
              <Image
                source={require('./assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Cabeçalho */}
            <Text style={styles.title}>FieldOps Portal</Text>
            <Text style={styles.subtitle}>Inspeção e Controle Técnico</Text>

            {/* Formulário */}
            <View style={styles.form}>
              {/* Campo: E-mail Corporativo */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>E-mail Corporativo</Text>
                <View style={styles.inputContainer}>
                  <Feather
                    name="mail"
                    size={18}
                    color="#4b5563"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="tecnico@fieldops.com"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Campo: Senha */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Senha</Text>
                <View style={styles.inputContainer}>
                  <Feather
                    name="lock"
                    size={18}
                    color="#4b5563"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#9ca3af"
                    value={senha}
                    onChangeText={setSenha}
                    secureTextEntry={!mostrarSenha}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setMostrarSenha(!mostrarSenha)}
                    style={styles.eyeButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather
                      name={mostrarSenha ? 'eye-off' : 'eye'}
                      size={16}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>

                {/* Link Esqueci minha senha */}
                <TouchableOpacity
                  onPress={handleEsqueciSenha}
                  style={styles.forgotPasswordContainer}
                >
                  <Text style={styles.forgotPasswordText}>
                    Esqueci minha senha
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Botão Entrar (#004d4d) */}
              <TouchableOpacity
                style={[styles.button, (!pronto || carregando) && styles.buttonDisabled]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={!pronto || carregando}
              >
                {carregando ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Entrar</Text>
                )}
              </TouchableOpacity>

              {/* Rodapé do Card com a Versão */}
              <Text style={styles.versionText}>
                Versão 2.4.1 (Build 890)
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    backgroundColor: '#ffffff',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 28,
    // Sombra suave para iOS e Android
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logoContainer: {
    width: 110,
    height: 110,
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 28,
  },
  form: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#374151',
    borderRadius: 4,
    height: 46,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  eyeButton: {
    paddingLeft: 6,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    color: '#005959',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#004d4d',
    borderRadius: 4,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
  },
});
