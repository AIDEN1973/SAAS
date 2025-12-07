/**
 * Core Consultation Types
 * 
 * ?�담/기록 관�?공통 모듈
 * [불�? 규칙] Core Layer??Industry 모듈???�존?��? ?�음
 */

export interface Consultation {
  id: string;
  tenant_id: string;
  person_id?: string;
  consultation_type: string;
  title?: string;
  content: string;
  consultation_date: string;  // date
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateConsultationInput {
  person_id?: string;
  consultation_type: string;
  title?: string;
  content: string;
  consultation_date: string;
}

export interface UpdateConsultationInput {
  consultation_type?: string;
  title?: string;
  content?: string;
  consultation_date?: string;
}

export interface ConsultationFilter {
  person_id?: string;
  consultation_type?: string;
  date_from?: string;
  date_to?: string;
}

