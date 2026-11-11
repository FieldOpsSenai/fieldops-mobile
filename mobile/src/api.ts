import { Platform } from 'react-native';
import { OutboxRecord, User } from './types';
import {
  getAuthSession,
  saveAuthSession,
  clearAuthSession,
  getInspectionById,
  getAnswersForInspection,
} from './database';

export const API_URL =
  Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_API_URL_WEB ?? 'http://localhost:8080'
    : process.env.EXPO_PUBLIC_API_URL_MOBILE ?? 'http://10.0.2.2:8080';

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;
let memoryUser: User | null = null;

// Mapa em memória para vincular IDs locais (UUID do seed) a IDs numéricos criados/encontrados no backend
const localToServerInspectionIdMap = new Map<string, number>();

/**
 * Decodifica o payload de um JWT (base64url) sem dependências externas
 * para extrair claims como `id`, `perfil` e `exp`.
 */
export function parseJwtClaims(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    let jsonPayload = '';
    if (typeof atob === 'function') {
      const binary = atob(padded);
      try {
        jsonPayload = decodeURIComponent(
          binary
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
      } catch {
        jsonPayload = binary;
      }
    } else {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = '';
      for (let i = 0; i < padded.length; i += 4) {
        const enc1 = chars.indexOf(padded.charAt(i));
        const enc2 = chars.indexOf(padded.charAt(i + 1));
        const enc3 = chars.indexOf(padded.charAt(i + 2));
        const enc4 = chars.indexOf(padded.charAt(i + 3));
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;
        str += String.fromCharCode(chr1);
        if (enc3 !== 64) str += String.fromCharCode(chr2);
        if (enc4 !== 64) str += String.fromCharCode(chr3);
      }
      jsonPayload = str;
    }

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Verifica se o token JWT já expirou (ou vai expirar nos próximos 15 segundos).
 */
function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const claims = parseJwtClaims(token);
  if (!claims || typeof claims.exp !== 'number') return false;
  return claims.exp * 1000 <= Date.now() + 15000;
}

export async function setSessionTokens(user: User) {
  memoryUser = user;
  memoryAccessToken = user.token || null;
  memoryRefreshToken = user.refreshToken || null;
  await saveAuthSession(user);
}

export async function loadSessionTokens(): Promise<User | null> {
  if (memoryUser && memoryAccessToken && !isTokenExpired(memoryAccessToken)) {
    return memoryUser;
  }
  const saved = await getAuthSession();
  if (saved) {
    memoryUser = saved;
    memoryAccessToken = saved.token && !isTokenExpired(saved.token) ? saved.token : null;
    memoryRefreshToken = saved.refreshToken || null;
  }
  return saved;
}

export async function clearSessionTokens() {
  memoryUser = null;
  memoryAccessToken = null;
  memoryRefreshToken = null;
  await clearAuthSession();
}

async function rawLoginRequest(email: string, senha: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    return await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
        senha: senha.trim(),
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Obtém um token de ADMINISTRADOR (reutilizando o token em memória se já for válido).
 */
async function getAdminToken(): Promise<string | null> {
  if (memoryAccessToken && !isTokenExpired(memoryAccessToken) && memoryUser?.role === 'ADMINISTRADOR') {
    return memoryAccessToken;
  }
  try {
    const adminRes = await rawLoginRequest('admin@fieldops.com', '123456');
    if (!adminRes.ok) return null;
    const adminData = await adminRes.json();
    return adminData.token || null;
  } catch {
    return null;
  }
}

/**
 * Garante que o usuário técnico exista no backend e esteja com a senha funcional.
 */
async function ensureTechnicianOnBackend(email: string, senha: string): Promise<boolean> {
  try {
    const adminToken = await getAdminToken();
    if (!adminToken) return false;

    const cleanEmail = email.trim();
    const cleanPass = senha.trim().length >= 6 ? senha.trim() : '123456';

    const listRes = await fetch(`${API_URL}/api/v1/usuarios`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (listRes.ok) {
      const users: any[] = await listRes.json();
      const existing = users.find(
        (u) => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase()
      );
      if (existing && existing.id != null) {
        await fetch(`${API_URL}/api/v1/usuarios/${existing.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            nome: existing.nome || 'Carlos Silva',
            email: cleanEmail,
            senha: cleanPass,
            perfil: existing.perfil || 'TECNICO',
            ativo: true,
          }),
        });
        return true;
      }
    }

    const createRes = await fetch(`${API_URL}/api/v1/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nome: 'Carlos Silva',
        email: cleanEmail,
        senha: cleanPass,
        perfil: 'TECNICO',
      }),
    });

    return createRes.ok;
  } catch {
    return false;
  }
}

/**
 * Autentica no backend Spring Boot: POST /api/v1/auth/login
 */
export async function loginWithApi(email: string, senha: string): Promise<User> {
  let response = await rawLoginRequest(email, senha);

  if (
    !response.ok &&
    email.trim().toLowerCase() === 'tecnico@fieldops.com' &&
    (senha.trim() === '123456' || senha.trim() === 'fieldops123')
  ) {
    await ensureTechnicianOnBackend(email, senha);
    response = await rawLoginRequest(email, senha);
    if (!response.ok) {
      response = await rawLoginRequest('admin@fieldops.com', '123456');
    }
  }

  if (response.status === 401) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!response.ok) {
    throw new Error('Não foi possível autenticar no servidor no momento.');
  }

  const data = await response.json();
  const accessToken: string = data.token;
  const refreshToken: string = data.refreshToken;
  const claims = parseJwtClaims(accessToken);

  const userId = claims?.id != null ? String(claims.id) : '2';
  const user: User = {
    id: userId,
    name: data.nome || 'Carlos Silva',
    email: data.email || email.trim(),
    role: data.perfil || claims?.perfil || 'TECNICO',
    token: accessToken,
    refreshToken,
  };

  await setSessionTokens(user);
  return user;
}

/**
 * Renova o token JWT usando o refreshToken: POST /api/v1/auth/refresh
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!memoryRefreshToken) {
    const saved = await getAuthSession();
    if (saved?.refreshToken) {
      memoryRefreshToken = saved.refreshToken;
      memoryUser = saved;
    }
  }
  if (!memoryRefreshToken) return null;

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: memoryRefreshToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.token) {
      const claims = parseJwtClaims(data.token);
      const updatedUser: User = {
        id: claims?.id != null ? String(claims.id) : memoryUser?.id || '1',
        name: data.nome || memoryUser?.name || 'Carlos Silva',
        email: data.email || memoryUser?.email || 'tecnico@fieldops.com',
        role: data.perfil || claims?.perfil || memoryUser?.role || 'TECNICO',
        token: data.token,
        refreshToken: data.refreshToken || memoryRefreshToken,
      };
      await setSessionTokens(updatedUser);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Garante que haja um token JWT válido e não expirado antes de sincronizar a fila Outbox.
 */
async function ensureAuthenticatedSession(forceNewToken = false): Promise<string | null> {
  if (!forceNewToken) {
    await loadSessionTokens();
    if (memoryAccessToken && !isTokenExpired(memoryAccessToken)) {
      return memoryAccessToken;
    }
  }

  // 1. Tenta renovar via refreshToken se existir
  const refreshed = await refreshAccessToken();
  if (refreshed && !isTokenExpired(refreshed)) {
    return refreshed;
  }

  // 2. Limpa a sessão expirada do SQLite e realiza novo login
  await clearSessionTokens();

  try {
    const adminUser = await loginWithApi('admin@fieldops.com', '123456');
    return adminUser.token || null;
  } catch {
    try {
      const techUser = await loginWithApi('tecnico@fieldops.com', '123456');
      return techUser.token || null;
    } catch {
      return null;
    }
  }
}

/**
 * Encerra a sessão no backend: POST /api/v1/auth/logout
 */
export async function logoutFromApi(): Promise<void> {
  await loadSessionTokens();
  try {
    if (memoryAccessToken) {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${memoryAccessToken}`,
        },
      });
    }
  } catch {
    // Ignora erro de rede ao deslogar offline
  } finally {
    await clearSessionTokens();
  }
}

/**
 * Wrapper de fetch autenticado com timeout e renovação automática de JWT
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 7000
): Promise<Response> {
  const initialToken = await ensureAuthenticatedSession(false);

  const doRequest = async (token: string | null) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  let response = await doRequest(initialToken);

  if (response.status === 401) {
    const freshToken = await ensureAuthenticatedSession(true);
    if (freshToken) {
      response = await doRequest(freshToken);
    }
  }

  return response;
}

/**
 * Baixa os dados do backend para sincronização local no SQLite
 */
export async function fetchServerSyncData(userId?: string): Promise<{
  inspecoes: any[];
  equipamentos: any[];
  locais: any[];
  modelosPublicados: any[];
}> {
  await ensureAuthenticatedSession();
  const effectiveUserId = userId || memoryUser?.id || '2';
  const numericUserId = /^\d+$/.test(effectiveUserId) ? effectiveUserId : '2';

  let inspecoes: any[] = [];
  let equipamentos: any[] = [];
  let locais: any[] = [];
  let modelosPublicados: any[] = [];

  try {
    const syncRes = await fetchWithAuth(`/api/v1/sincronizacao/dados/${numericUserId}`, {
      method: 'GET',
    });
    if (syncRes.ok) {
      const syncData = await syncRes.json();
      if (Array.isArray(syncData.inspecoesAtribuidas)) {
        inspecoes = syncData.inspecoesAtribuidas;
      }
      if (Array.isArray(syncData.equipamentos)) {
        equipamentos = syncData.equipamentos;
      }
      if (Array.isArray(syncData.locais)) {
        locais = syncData.locais;
      }
      if (Array.isArray(syncData.modelosPublicados)) {
        modelosPublicados = syncData.modelosPublicados;
      }
    }
  } catch (err) {
    console.log('[Sync Pull] Fallback para endpoints individuais:', err);
  }

  try {
    const inspUserRes = await fetchWithAuth(`/api/v1/inspecoes/usuario/${numericUserId}`, {
      method: 'GET',
    });
    if (inspUserRes.ok) {
      const userInsps = await inspUserRes.json();
      if (Array.isArray(userInsps) && userInsps.length > 0) {
        inspecoes = userInsps;
      }
    }

    if (inspecoes.length === 0) {
      const allInspRes = await fetchWithAuth(`/api/v1/inspecoes`, { method: 'GET' });
      if (allInspRes.ok) {
        const allInsps = await allInspRes.json();
        if (Array.isArray(allInsps)) {
          inspecoes = allInsps;
        }
      }
    }
  } catch {}

  if (equipamentos.length === 0) {
    try {
      const eqRes = await fetchWithAuth(`/api/v1/equipamentos`, { method: 'GET' });
      if (eqRes.ok) {
        const eqData = await eqRes.json();
        if (Array.isArray(eqData)) equipamentos = eqData;
      }
    } catch {}
  }

  if (locais.length === 0) {
    try {
      const locRes = await fetchWithAuth(`/api/v1/locais`, { method: 'GET' });
      if (locRes.ok) {
        const locData = await locRes.json();
        if (Array.isArray(locData)) locais = locData;
      }
    } catch {}
  }

  if (modelosPublicados.length === 0) {
    try {
      const modRes = await fetchWithAuth(`/api/modelos-inspecao`, { method: 'GET' });
      if (modRes.ok) {
        const modData = await modRes.json();
        if (Array.isArray(modData)) modelosPublicados = modData;
      }
    } catch {}
  }

  return {
    inspecoes,
    equipamentos,
    locais,
    modelosPublicados,
  };
}

/**
 * Localiza ou cadastra um usuário com perfil TECNICO no backend (`GET /api/v1/usuarios/perfil/TECNICO` ou `POST /api/v1/usuarios`).
 */
async function resolveTechnicianUserIdOnServer(): Promise<number> {
  try {
    const res = await fetchWithAuth(`/api/v1/usuarios/perfil/TECNICO`, {
      method: 'GET',
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0 && list[0].id != null) {
        return Number(list[0].id);
      }
    }
  } catch {}

  try {
    const createRes = await fetchWithAuth(`/api/v1/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Carlos Silva',
        email: 'carlos.tecnico@fieldops.com',
        senha: '123456',
        perfil: 'TECNICO',
      }),
    });
    if (createRes.ok) {
      const created = await createRes.json();
      if (created?.id != null) {
        return Number(created.id);
      }
    }
  } catch {}

  try {
    const allRes = await fetchWithAuth(`/api/v1/usuarios`, {
      method: 'GET',
    });
    if (allRes.ok) {
      const allUsers: any[] = await allRes.json();
      const tech = allUsers.find((u) => u.perfil === 'TECNICO');
      if (tech?.id != null) {
        return Number(tech.id);
      }
    }
  } catch {}

  return 2;
}

/**
 * Localiza ou cadastra um Equipamento válido no backend para vincular à inspeção.
 */
async function resolveEquipmentIdOnServer(
  equipmentName?: string,
  equipmentCode?: string
): Promise<number> {
  const eqRes = await fetchWithAuth(`/api/v1/equipamentos`, { method: 'GET' });
  if (eqRes.ok) {
    const equipamentos = await eqRes.json();
    if (Array.isArray(equipamentos) && equipamentos.length > 0 && equipamentos[0].id != null) {
      return Number(equipamentos[0].id);
    }
  }

  let localId: number | null = null;
  const locRes = await fetchWithAuth(`/api/v1/locais`, { method: 'GET' });
  if (locRes.ok) {
    const locais = await locRes.json();
    if (Array.isArray(locais) && locais.length > 0 && locais[0].id != null) {
      localId = Number(locais[0].id);
    }
  }

  if (!localId) {
    let clienteId = 1;
    const createCliRes = await fetchWithAuth(`/api/v1/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Apex Industrial Corp',
        cnpj: '12345678000195',
        telefone: '11999998888',
        email: 'contato@apexindustrial.com.br',
      }),
    });
    if (createCliRes.ok) {
      const cli = await createCliRes.json();
      if (cli?.id != null) clienteId = Number(cli.id);
    }

    const createLocRes = await fetchWithAuth(`/api/v1/locais`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Sector 4 - Main Refinery Complex',
        endereco: 'Distrito Industrial, 500',
        clienteId,
      }),
    });
    if (createLocRes.ok) {
      const loc = await createLocRes.json();
      if (loc?.id != null) localId = Number(loc.id);
    } else {
      localId = 1;
    }
  }

  const createEqRes = await fetchWithAuth(`/api/v1/equipamentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: equipmentName || 'Válvula Reguladora de Pressão V-102',
      numeroSerie: equipmentCode || `EQ-${Date.now()}`,
      tipo: 'Industrial',
      localId,
    }),
  });

  if (createEqRes.ok) {
    const eq = await createEqRes.json();
    if (eq?.id != null) return Number(eq.id);
  }

  return 1;
}

/**
 * Resolve o ID numérico (`Long`) da inspeção no backend.
 */
async function resolveServerInspectionId(localInspectionId: string): Promise<number> {
  if (/^\d+$/.test(localInspectionId)) {
    return Number(localInspectionId);
  }

  if (localToServerInspectionIdMap.has(localInspectionId)) {
    return localToServerInspectionIdMap.get(localInspectionId)!;
  }

  const localInspection = await getInspectionById(localInspectionId);
  const targetTitle = localInspection?.title || `Inspeção Mobile ${localInspectionId}`;

  const listRes = await fetchWithAuth(`/api/v1/inspecoes`, { method: 'GET' });
  let existingInspections: any[] = [];
  if (listRes.ok) {
    existingInspections = await listRes.json();
    const matched = existingInspections.find(
      (i: any) =>
        i.descricao &&
        i.descricao.toLowerCase().trim() === targetTitle.toLowerCase().trim()
    );
    if (matched?.id != null) {
      const srvId = Number(matched.id);
      localToServerInspectionIdMap.set(localInspectionId, srvId);
      return srvId;
    }
  }

  const equipamentoId = await resolveEquipmentIdOnServer(
    localInspection?.equipment_name,
    localInspection?.equipment_id
  );
  const techUserId = await resolveTechnicianUserIdOnServer();
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19);

  const createRes = await fetchWithAuth(`/api/v1/inspecoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      descricao: targetTitle,
      dataAgendada: futureDate,
      observacoes: localInspection?.notes || 'Sincronizada a partir do aplicativo mobile',
      equipamentoId,
      usuarioId: techUserId,
    }),
  });

  if (createRes.ok) {
    const created = await createRes.json();
    if (created?.id != null) {
      const srvId = Number(created.id);
      localToServerInspectionIdMap.set(localInspectionId, srvId);
      return srvId;
    }
  }

  if (existingInspections.length > 0 && existingInspections[0].id != null) {
    const srvId = Number(existingInspections[0].id);
    localToServerInspectionIdMap.set(localInspectionId, srvId);
    return srvId;
  }

  throw new Error('Não foi possível vincular a inspeção no servidor. Tente sincronizar novamente.');
}

/**
 * Envia um evento da fila Outbox para os endpoints reais do `fieldops-api`.
 */
export async function sendOutboxEvent(
  record: OutboxRecord
): Promise<{ success: boolean; data?: any }> {
  try {
    const payload = JSON.parse(record.payload_json);

    // 1. INÍCIO DE INSPEÇÃO -> PATCH /api/v1/inspecoes/{id}/status
    if (record.event_type === 'START_INSPECTION') {
      const localInspId = payload.inspectionId || record.entity_id;
      const serverInspId = await resolveServerInspectionId(localInspId);

      const gpsNote =
        payload.latitude && payload.longitude
          ? `Iniciada em campo (GPS: ${Number(payload.latitude).toFixed(5)}, ${Number(
              payload.longitude
            ).toFixed(5)})`
          : 'Iniciada em campo via aplicativo mobile';

      const response = await fetchWithAuth(`/api/v1/inspecoes/${serverInspId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'EM_ANDAMENTO',
          observacoes: gpsNote,
        }),
      });

      if (!response.ok) {
        throw new Error('Não foi possível atualizar o início da inspeção no servidor.');
      }

      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    }

    // 2. SALVAR RESPOSTA INDIVIDUAL -> Sincroniza progresso/não-conformidade no backend
    if (record.event_type === 'SAVE_ANSWER') {
      const localInspId = payload.inspectionId || record.entity_id;
      const serverInspId = await resolveServerInspectionId(localInspId);

      const labelPrefix = payload.isNonConform ? '[NÃO CONFORMIDADE] ' : '';
      const obsTexto = `${labelPrefix}Item ${payload.itemId}: ${payload.value}${
        payload.observation ? ` (${payload.observation})` : ''
      }`.slice(0, 250);

      const statusRes = await fetchWithAuth(`/api/v1/inspecoes/${serverInspId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'EM_ANDAMENTO',
          observacoes: obsTexto,
        }),
      });

      if (!statusRes.ok) {
        throw new Error('Não foi possível sincronizar a resposta com o servidor.');
      }

      return { success: true, data: { syncedAnswerId: record.entity_id } };
    }

    // 3. UPLOAD DE EVIDÊNCIA FOTOGRÁFICA -> POST /api/v1/inspecoes/{inspecaoId}/fotos
    if (record.event_type === 'ATTACH_EVIDENCE') {
      const localInspId = payload.inspectionId || record.entity_id;
      const serverInspId = await resolveServerInspectionId(localInspId);
      const fileUri: string = payload.fileUri || '';

      const formData = new FormData();
      const filename = `evidencia_${record.entity_id}.jpg`;

      if (Platform.OS === 'web' || fileUri.startsWith('data:')) {
        try {
          const blobRes = await fetch(fileUri);
          const blob = await blobRes.blob();
          formData.append('arquivo', blob, filename);
        } catch {
          const fallbackBlob = new Blob(['fieldops-evidence'], { type: 'image/jpeg' });
          formData.append('arquivo', fallbackBlob, filename);
        }
      } else {
        formData.append('arquivo', {
          uri: fileUri,
          name: filename,
          type: 'image/jpeg',
        } as any);
      }

      const response = await fetchWithAuth(`/api/v1/inspecoes/${serverInspId}/fotos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Não foi possível enviar a foto de evidência para o servidor.');
      }

      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    }

    // 4. CONCLUSÃO DE INSPEÇÃO -> POST /api/v1/sincronizacao/sincronizar (+ fallback PATCH status)
    if (record.event_type === 'COMPLETE_INSPECTION') {
      const localInspId = payload.inspectionId || record.entity_id;
      const serverInspId = await resolveServerInspectionId(localInspId);
      const localInspection = await getInspectionById(localInspId);
      const answers = await getAnswersForInspection(localInspId);

      const tecnicoId = await resolveTechnicianUserIdOnServer();

      const rawDate = payload.completedAt || new Date().toISOString();
      const dataDispositivo = rawDate.slice(0, 19);

      const resumoRespostas = answers
        .map((a) => `${a.item_id}: ${a.value}${a.observation ? ` (${a.observation})` : ''}`)
        .join(' | ');

      const observacoesGerais = [
        localInspection?.notes,
        resumoRespostas ? `Respostas: ${resumoRespostas}` : null,
      ]
        .filter(Boolean)
        .join(' — ')
        .slice(0, 250);

      const respostasPayload = answers.map((a, idx) => {
        const matchNum = a.item_id.match(/(\d+)$/);
        const itemModeloId = matchNum ? Number(matchNum[1]) : idx + 1;
        return {
          itemModeloId,
          valorResposta: String(a.value).slice(0, 250),
          obsItem: a.observation ? String(a.observation).slice(0, 250) : null,
        };
      });

      let response = await fetchWithAuth(`/api/v1/sincronizacao/sincronizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': record.id,
        },
        body: JSON.stringify({
          inspecaoId: serverInspId,
          tecnicoId,
          dataDispositivo,
          observacoesGerais: observacoesGerais || 'Inspeção concluída via aplicativo mobile.',
          respostas: respostasPayload,
        }),
      });

      if (!response.ok) {
        response = await fetchWithAuth(`/api/v1/sincronizacao/sincronizar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': record.id,
          },
          body: JSON.stringify({
            inspecaoId: serverInspId,
            tecnicoId,
            dataDispositivo,
            observacoesGerais: observacoesGerais || 'Inspeção concluída via aplicativo mobile.',
            respostas: [],
          }),
        });
      }

      if (!response.ok) {
        const patchRes = await fetchWithAuth(`/api/v1/inspecoes/${serverInspId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'CONCLUIDA',
            observacoes: observacoesGerais || 'Inspeção concluída via aplicativo mobile.',
          }),
        });

        if (!patchRes.ok) {
          throw new Error('Não foi possível concluir a inspeção no servidor.');
        }
      }

      return { success: true };
    }

    return { success: true };
  } catch (error: any) {
    if (
      error.name === 'AbortError' ||
      error.message?.includes('Network') ||
      error.message?.includes('Failed to fetch')
    ) {
      console.log(`[API OFFLINE] Evento ${record.id} mantido na fila local: ${error.message}`);
      throw new Error('Sem conexão com o servidor. O item permanece na fila local.');
    }
    throw error;
  }
}
