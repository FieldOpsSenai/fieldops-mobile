export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type InspectionStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'APPROVED'
  | 'FAILED';

export type SyncStatus = 'SYNCED' | 'PENDING' | 'ERROR';

export type ResponseType =
  | 'CONFORMITY'
  | 'BOOLEAN'
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'NUMBER'
  | 'SINGLE_CHOICE'
  | 'DATE';

export type ConformityValue = 'CONFORM' | 'NON_CONFORM' | 'NOT_APPLICABLE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Inspection {
  id: string;
  code: string;
  title: string;
  client_name: string;
  location_name: string;
  equipment_id: string;
  equipment_name: string;
  equipment_qr_code: string;
  status: InspectionStatus;
  priority: PriorityLevel;
  scheduled_date: string;
  assigned_tech_id: string;
  assigned_tech_name: string;
  start_latitude?: number | null;
  start_longitude?: number | null;
  started_at?: string | null;
  end_latitude?: number | null;
  end_longitude?: number | null;
  completed_at?: string | null;
  notes?: string | null;
  sync_status: SyncStatus;
}

export interface InspectionItem {
  id: string;
  inspection_id: string;
  section_name: string;
  title: string;
  description?: string | null;
  response_type: ResponseType;
  options_json?: string | null; // ex: '["Alta", "Média", "Baixa"]'
  required: number; // 1 or 0
  order_index: number;
}

export interface InspectionAnswer {
  id: string;
  inspection_id: string;
  item_id: string;
  value: string;
  observation?: string | null;
  is_non_conform: number; // 1 or 0
  answered_at: string;
}

export interface EvidencePhoto {
  id: string;
  inspection_id: string;
  item_id?: string | null;
  file_uri: string;
  description?: string | null;
  created_at: string;
  sync_status: SyncStatus;
}

export type OutboxEventType =
  | 'START_INSPECTION'
  | 'SAVE_ANSWER'
  | 'ATTACH_EVIDENCE'
  | 'COMPLETE_INSPECTION';

export interface OutboxRecord {
  id: string;
  event_type: OutboxEventType;
  entity_id: string;
  payload_json: string;
  status: 'PENDING' | 'SYNCING' | 'ERROR' | 'SYNCED';
  attempts: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItemWithAnswer extends InspectionItem {
  answer?: InspectionAnswer;
  evidences: EvidencePhoto[];
}
