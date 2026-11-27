import { Platform } from 'react-native';
import { CriticalityLevel, OutboxRecord, User } from './types';
import {
  getAuthSession,
  saveAuthSession,
  clearAuthSession,
  getInspectionById,
  getAnswersForInspection,
  getSavedApiUrl,
  saveCustomApiUrl,
} from './database';

export const DEFAULT_API_URL =
  Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_API_URL_WEB ?? 'http://localhost:8080'
    : process.env.EXPO_PUBLIC_API_URL_MOBILE ?? 'http://34.229.97.191:8080';

export const API_URL = DEFAULT_API_URL;

let runtimeApiUrl: string = DEFAULT_API_URL;

export function normalizeApiBaseUrl(raw: string): string {
  let cleaned = raw.trim();
  if (!cleaned) return DEFAULT_API_URL;
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `http://${cleaned}`;
  }
  cleaned = cleaned
    .replace(/\/swagger-ui\.html.*$/i, '')
    .replace(/\/swagger-ui\/.*$/i, '')
    .replace(/\/api\/v1.*$/i, '')
    .replace(/\/+$/, '');
  return cleaned || DEFAULT_API_URL;
}

export function getApiUrl(): string {
  return runtimeApiUrl;
}

export async function initApiUrl(): Promise<string> {
  try {
    const saved = await getSavedApiUrl();
    runtimeApiUrl = saved ? normalizeApiBaseUrl(saved) : DEFAULT_API_URL;
  } catch {
    runtimeApiUrl = DEFAULT_API_URL;
  }
  return runtimeApiUrl;
}

export async function updateApiUrl(customUrl: string | null): Promise<string> {
  if (!customUrl || !customUrl.trim()) {
    await saveCustomApiUrl(null);
    runtimeApiUrl = DEFAULT_API_URL;
    return runtimeApiUrl;
  }
  const normalized = normalizeApiBaseUrl(customUrl);
  await saveCustomApiUrl(normalized);
  runtimeApiUrl = normalized;
  return runtimeApiUrl;
}

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;
let memoryUser: User | null = null;

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
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

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
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
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
    memoryAccessToken =
      saved.token && !isTokenExpired(saved.token) ? saved.token : null;
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
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
    return await fetch(`${getApiUrl()}/api/v1/auth/login`, {
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
 * Autentica no backend Spring Boot: POST /api/v1/auth/login
 */
export async function loginWithApi(email: string, senha: string): Promise<User> {
  const response = await rawLoginRequest(email, senha);

  if (response.status === 401 || response.status === 403) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!response.ok) {
    throw new Error('Não foi possível autenticar no servidor no momento.');
  }

  const data = await response.json();
  const accessToken: string = data.token;
  const refreshToken: string = data.refreshToken;
  const claims = parseJwtClaims(accessToken);

  const userId = String(data.id ?? claims?.id ?? '');
  const user: User = {
    id: userId,
    name: data.nome || claims?.nome || email.trim(),
    email: data.email || claims?.sub || email.trim(),
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
    const response = await fetch(`${getApiUrl()}/api/v1/auth/refresh`, {
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
        id: String(data.id ?? claims?.id ?? memoryUser?.id ?? ''),
        name: data.nome || memoryUser?.name || '',
        email: data.email || memoryUser?.email || '',
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
 * Garante que haja um token JWT válido do usuário autenticado antes de chamar a API.
 */
async function ensureAuthenticatedSession(
  forceNewToken = false
): Promise<string | null> {
  if (!forceNewToken) {
    await loadSessionTokens();
    if (memoryAccessToken && !isTokenExpired(memoryAccessToken)) {
      return memoryAccessToken;
    }
  }

  const refreshed = await refreshAccessToken();
  if (refreshed && !isTokenExpired(refreshed)) {
    return refreshed;
  }

  return memoryAccessToken;
}

/**
 * Encerra a sessão no backend: POST /api/v1/auth/logout
 */
export async function logoutFromApi(): Promise<void> {
  await loadSessionTokens();
  try {
    if (memoryAccessToken) {
      await fetch(`${getApiUrl()}/api/v1/auth/logout`, {
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
  timeoutMs = 10000
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
      const res = await fetch(`${getApiUrl()}${endpoint}`, {
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
 * Baixa os dados reais do backend para armazenamento local no SQLite
 */
export async function fetchServerSyncData(userId?: string): Promise<{
  inspecoes: any[];
  equipamentos: any[];
  locais: any[];
  modelosPublicados: any[];
  snapshotsByInspection: Record<string, any[]>;
}> {
  await ensureAuthenticatedSession();
  const effectiveUserId = userId || memoryUser?.id || '';

  let inspecoes: any[] = [];
  let equipamentos: any[] = [];
  let locais: any[] = [];
  let modelosPublicados: any[] = [];
  const snapshotsByInspection: Record<string, any[]> = {};

  // 1. Busca inspeções atribuídas ao técnico autenticado (DTO completo com revisaoAprovada e motivoReprovacao)
  try {
    const minhasRes = await fetchWithAuth(`/api/v1/inspecoes/minhas`, {
      method: 'GET',
    });
    if (minhasRes.ok) {
      const data = await minhasRes.json();
      if (Array.isArray(data)) {
        inspecoes = data;
      }
    }
  } catch {}

  if (inspecoes.length === 0 && /^\d+$/.test(effectiveUserId)) {
    try {
      const userRes = await fetchWithAuth(
        `/api/v1/inspecoes/usuario/${effectiveUserId}`,
        { method: 'GET' }
      );
      if (userRes.ok) {
        const data = await userRes.json();
        if (Array.isArray(data)) {
          inspecoes = data;
        }
      }
    } catch {}
  }

  // 2. Busca dados complementares (equipamentos c/ QR Code, locais e modelos publicados)
  if (/^\d+$/.test(effectiveUserId)) {
    try {
      const syncRes = await fetchWithAuth(
        `/api/v1/sincronizacao/dados/${effectiveUserId}`,
        { method: 'GET' }
      );
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (Array.isArray(syncData.equipamentos)) {
          equipamentos = syncData.equipamentos;
        }
        if (Array.isArray(syncData.locais)) {
          locais = syncData.locais;
        }
        if (Array.isArray(syncData.modelosPublicados)) {
          modelosPublicados = syncData.modelosPublicados;
        }
        if (inspecoes.length === 0 && Array.isArray(syncData.inspecoesAtribuidas)) {
          inspecoes = syncData.inspecoesAtribuidas;
        }
      }
    } catch {}
  }

  if (equipamentos.length === 0) {
    try {
      const eqRes = await fetchWithAuth(`/api/v1/equipamentos`, { method: 'GET' });
      if (eqRes.ok) {
        const eqData = await eqRes.json();
        if (Array.isArray(eqData)) equipamentos = eqData;
        else if (Array.isArray(eqData?.content)) equipamentos = eqData.content;
      }
    } catch {}
  }

  if (locais.length === 0) {
    try {
      const locRes = await fetchWithAuth(`/api/v1/locais`, { method: 'GET' });
      if (locRes.ok) {
        const locData = await locRes.json();
        if (Array.isArray(locData)) locais = locData;
        else if (Array.isArray(locData?.content)) locais = locData.content;
      }
    } catch {}
  }

  // 3. Baixa o snapshot imutável dos itens de checklist de cada inspeção atribuída
  for (const insp of inspecoes) {
    if (!insp || insp.id == null) continue;
    try {
      const snapRes = await fetchWithAuth(
        `/api/v1/inspecoes/${insp.id}/snapshot`,
        { method: 'GET' }
      );
      if (snapRes.ok) {
        const snapData = await snapRes.json();
        if (Array.isArray(snapData)) {
          snapshotsByInspection[String(insp.id)] = snapData;
        }
      }
    } catch {}
  }

  return {
    inspecoes,
    equipamentos,
    locais,
    modelosPublicados,
    snapshotsByInspection,
  };
}

function parseServerInspectionId(localInspectionId: string): number {
  const trimmed = String(localInspectionId || '').trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`ID de inspeção inválido para sincronização: ${localInspectionId}`);
  }
  return Number(trimmed);
}

function extractSnapshotItemId(localItemId?: string | null): number | null {
  if (!localItemId) return null;
  const match = String(localItemId).match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function mapCriticalityToApi(
  level?: CriticalityLevel | null
): 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA' {
  switch (level) {
    case 'LOW':
      return 'BAIXA';
    case 'HIGH':
      return 'ALTA';
    case 'CRITICAL':
      return 'CRITICA';
    case 'MEDIUM':
    default:
      return 'MEDIA';
  }
}

/**
 * Envia um evento da fila Outbox para os endpoints reais do `fieldops-api`.
 */
export async function sendOutboxEvent(
  record: OutboxRecord
): Promise<{ success: boolean; data?: any }> {
  try {
    const payload = JSON.parse(record.payload_json);

    // 1. INÍCIO DE INSPEÇÃO -> Confirma QR Code (se lido) + PATCH /api/v1/inspecoes/{id}/status
    if (record.event_type === 'START_INSPECTION') {
      const localInspId = payload.inspectionId || record.entity_id;
      const serverInspId = parseServerInspectionId(localInspId);

      if (payload.scannedQrCode) {
        try {
          await fetchWithAuth(
            `/api/v1/inspecoes/${serverInspId}/confirmar-equipamento`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ codigoQr: String(payload.scannedQrCode) }),
            }
          );
        } catch {}
      }

      const gpsNote =
        payload.latitude && payload.longitude
          ? `Iniciada em campo (GPS: ${Number(payload.latitude).toFixed(5)}, ${Number(
              payload.longitude
            ).toFixed(5)})`
          : 'Iniciada em campo via aplicativo mobile';

      const response = await fetchWithAuth(
        `/api/v1/inspecoes/${serverInspId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'EM_ANDAMENTO',
            observacoes: gpsNote,
          }),
        }
      );

      if (!response.ok && response.status !== 409 && response.status !== 400) {
        throw new Error('Não foi possível registrar o início da inspeção no servidor.');
      }

      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    }

    // 2. SALVAR RESPOSTA INDIVIDUAL -> PUT /api/v1/inspecoes/{id}/respostas (+ NaoConformidade se aplicável)
    if (record.event_type === 'SAVE_ANSWER') {
      const localInspId = payload.inspectionId || record.entity_id;
      const serverInspId = parseServerInspectionId(localInspId);
      const snapshotItemId = extractSnapshotItemId(payload.itemId);

      if (snapshotItemId == null) {
        throw new Error('Item do checklist sem identificador de snapshot válido.');
      }

      const saveRes = await fetchWithAuth(
        `/api/v1/inspecoes/${serverInspId}/respostas`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            snapshotItemId,
            valor: String(payload.value ?? ''),
            observacao: payload.observation ? String(payload.observation) : null,
          }),
        }
      );

      // Se a inspeção já tiver sido concluída numa tentativa anterior, ignora conflito de estado
      if (!saveRes.ok && saveRes.status !== 400 && saveRes.status !== 409) {
        throw new Error('Não foi possível sincronizar a resposta com o servidor.');
      }

      const savedAnswer = await saveRes.json().catch(() => null);

      if (payload.isNonConform) {
        try {
          const ncListRes = await fetchWithAuth(
            `/api/v1/nao-conformidades/inspecao/${serverInspId}`,
            { method: 'GET' }
          );
          const existingNcs: any[] = ncListRes.ok ? await ncListRes.json() : [];
          const descricaoNc = (
            payload.observation || 'Não conformidade identificada durante a inspeção.'
          ).trim();

          const alreadyExists = existingNcs.some(
            (nc) =>
              (savedAnswer?.id != null && nc.resposta?.id === savedAnswer.id) ||
              (nc.descricao && nc.descricao.trim() === descricaoNc)
          );

          if (!alreadyExists) {
            await fetchWithAuth(`/api/v1/nao-conformidades`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                criticidade: mapCriticalityToApi(payload.criticality),
                descricao: descricaoNc,
                inspecaoId: serverInspId,
                respostaId: savedAnswer?.id ?? null,
              }),
            });
          }
        } catch {}
      }

      return { success: true, data: savedAnswer };
    }

    // 3. UPLOAD DE EVIDÊNCIA FOTOGRÁFICA -> POST /api/v1/inspecoes/{inspecaoId}/fotos?snapshotItemId=...
    if (record.event_type === 'ATTACH_EVIDENCE') {
      const localInspId = payload.inspectionId || record.entity_id;
      const serverInspId = parseServerInspectionId(localInspId);
      const snapshotItemId = extractSnapshotItemId(payload.itemId);
      const fileUri: string = payload.fileUri || '';

      if (!fileUri) {
        throw new Error('Caminho do arquivo de foto ausente.');
      }

      // Em retentativas (attempts > 1), evita duplicar a foto caso o upload anterior já tenha sido gravado
      if (record.attempts > 1 && snapshotItemId != null) {
        try {
          const existingRes = await fetchWithAuth(
            `/api/v1/inspecoes/${serverInspId}/fotos/itens/${snapshotItemId}`,
            { method: 'GET' }
          );
          if (existingRes.ok) {
            const existingPhotos = await existingRes.json();
            if (Array.isArray(existingPhotos) && existingPhotos.length > 0) {
              return { success: true, data: existingPhotos[0] };
            }
          }
        } catch {}
      }

      const formData = new FormData();
      const filename = `evidencia_${record.entity_id}.jpg`;

      if (Platform.OS === 'web' || fileUri.startsWith('data:')) {
        const blobRes = await fetch(fileUri);
        const blob = await blobRes.blob();
        formData.append('arquivo', blob, filename);
      } else {
        formData.append('arquivo', {
          uri: fileUri,
          name: filename,
          type: 'image/jpeg',
        } as any);
      }

      const query =
        snapshotItemId != null ? `?snapshotItemId=${snapshotItemId}` : '';
      const response = await fetchWithAuth(
        `/api/v1/inspecoes/${serverInspId}/fotos${query}`,
        {
          method: 'POST',
          body: formData,
        },
        20000
      );

      if (!response.ok) {
        throw new Error('Não foi possível enviar a foto de evidência para o servidor.');
      }

      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    }

    // 4. CONCLUSÃO DE INSPEÇÃO -> Upsert respostas + POST /concluir + POST /sincronizacao/sincronizar (idempotente)
    if (record.event_type === 'COMPLETE_INSPECTION') {
      const localInspId = payload.inspectionId || record.entity_id;
      const serverInspId = parseServerInspectionId(localInspId);
      const localInspection = await getInspectionById(localInspId);
      const answers = await getAnswersForInspection(localInspId);

      // Garante que todas as respostas locais estejam salvas sem duplicação (upsert por snapshotItemId)
      for (const a of answers) {
        const snapshotItemId = extractSnapshotItemId(a.item_id);
        if (snapshotItemId == null) continue;
        await fetchWithAuth(`/api/v1/inspecoes/${serverInspId}/respostas`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            snapshotItemId,
            valor: String(a.value ?? ''),
            observacao: a.observation ? String(a.observation) : null,
          }),
        }).catch(() => {});
      }

      // Valida pendências e limpa eventual reprovação anterior no servidor
      const concluirRes = await fetchWithAuth(
        `/api/v1/inspecoes/${serverInspId}/concluir`,
        { method: 'POST' }
      );

      if (!concluirRes.ok && concluirRes.status !== 409) {
        const errBody = await concluirRes.json().catch(() => null);
        const serverMsg = errBody?.mensagem || errBody?.message;
        if (concluirRes.status === 400 && serverMsg) {
          throw new Error(serverMsg);
        }
      }

      const userSession = await loadSessionTokens();
      const tecnicoId = /^\d+$/.test(String(userSession?.id || ''))
        ? Number(userSession!.id)
        : Number(localInspection?.assigned_tech_id || 0);

      const rawDate = payload.completedAt || new Date().toISOString();
      const dataDispositivo = rawDate.slice(0, 19);

      const gpsSuffix =
        payload.latitude && payload.longitude
          ? ` (GPS conclusão: ${Number(payload.latitude).toFixed(5)}, ${Number(
              payload.longitude
            ).toFixed(5)})`
          : '';

      const observacoesGerais = `${
        localInspection?.notes || 'Inspeção concluída via aplicativo mobile.'
      }${gpsSuffix}`.slice(0, 250);

      // Registra dataDispositivo e chave de idempotência sem duplicar respostas (respostas já salvas via PUT)
      const syncRes = await fetchWithAuth(`/api/v1/sincronizacao/sincronizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': record.id,
        },
        body: JSON.stringify({
          inspecaoId: serverInspId,
          tecnicoId,
          dataDispositivo,
          observacoesGerais,
          respostas: [],
        }),
      });

      if (!concluirRes.ok && !syncRes.ok) {
        throw new Error('Não foi possível concluir a inspeção no servidor.');
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
      console.log(
        `[API OFFLINE] Evento ${record.id} mantido na fila local: ${error.message}`
      );
      throw new Error(
        'Sem conexão com o servidor. O item permanece na fila local.'
      );
    }
    throw error;
  }
}
