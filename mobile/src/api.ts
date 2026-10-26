import { Platform } from 'react-native';
import { OutboxRecord } from './types';

const API_URL =
  Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_API_URL_WEB ?? 'http://localhost:8080'
    : process.env.EXPO_PUBLIC_API_URL_MOBILE ?? 'http://10.0.2.2:8080';

export async function sendOutboxEvent(record: OutboxRecord): Promise<{ success: boolean; data?: any }> {
  try {
    const payload = JSON.parse(record.payload_json);

    // Timeout de 5 segundos para não travar a fila se o backend estiver fora do ar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const endpointMap: Record<string, string> = {
      START_INSPECTION: `/api/v1/inspections/${record.entity_id}/start`,
      SAVE_ANSWER: `/api/v1/inspections/answers`,
      ATTACH_EVIDENCE: `/api/v1/inspections/evidence`,
      COMPLETE_INSPECTION: `/api/v1/inspections/${record.entity_id}/complete`,
    };

    const endpoint = endpointMap[record.event_type] || `/api/v1/sync/events`;

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': record.id,
      },
      body: JSON.stringify({
        eventId: record.id,
        eventType: record.event_type,
        entityId: record.entity_id,
        payload,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Servidor retornou HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    // Se estiver offline ou a API não responder, simulamos persistência segura local
    if (error.name === 'AbortError' || error.message.includes('Network') || error.message.includes('Failed to fetch')) {
      // Offline mode
      console.log(`[API OFFLINE] Evento ${record.id} mantido na fila local: ${error.message}`);
      throw new Error('Sem conexão com o servidor. O item permanece na fila local.');
    }
    throw error;
  }
}
