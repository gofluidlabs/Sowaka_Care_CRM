export type Role = 'owner' | 'doctor' | 'front_desk'
export type AppointmentStatus = 'scheduled' | 'waiting' | 'with_doctor' | 'completed' | 'cancelled' | 'no_show'

export interface User {
  id: number
  name: string
  email: string | null
  phone: string | null
  username: string
  role: Role
  designation: string | null
  status: 'active' | 'inactive'
  must_change_password: boolean
  created_at: string
  last_login: string | null
  last_active: string | null
  doctor: {
    id: number
    code: string
    specialization: string | null
    department: string | null
    consultation_fee: number
  } | null
}

export interface DayStats {
  patients: number
  completed: number
  pending: number
  waiting: number
  cancelled: number
}

export interface Doctor {
  id: number
  user_id: number
  code: string
  name: string
  specialization: string | null
  department: string | null
  consultation_fee: number
  phone: string | null
  email: string | null
  status: string
  last_active: string | null
  today?: DayStats
}

export interface Patient {
  id: number
  patient_code: string
  name: string
  phone: string
  dob: string | null
  age: number | null
  gender: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  blood_group: string | null
  primary_doctor_id: number | null
  primary_doctor_name: string | null
  created_at: string
  created_by_name: string | null
  medical_history?: string | null
  allergies?: string | null
  last_visit?: string | null
}

export interface Appointment {
  id: number
  patient_id: number
  patient_name: string
  patient_code: string
  patient_phone: string
  patient_age: number | null
  patient_gender: string | null
  doctor_id: number
  doctor_name: string
  department: string | null
  appointment_date: string
  appointment_time: string
  visit_type: string
  reason: string | null
  status: AppointmentStatus
  fee: number
  amount_paid: number
  payment_status: 'paid' | 'partial' | 'pending'
  has_visit: boolean
  created_by_name: string | null
  created_at: string
  arrived_at: string | null
  completed_at: string | null
}

export interface PrescriptionItem {
  id?: number
  medicine: string
  dosage: string | null
  duration: string | null
  instructions: string | null
}

export interface Visit {
  id: number
  patient_id: number
  doctor_id: number
  doctor_name: string
  appointment_id: number | null
  visit_type: string
  diagnosis: string | null
  notes: string | null
  vitals: string | null
  follow_up_date: string | null
  created_at: string
  updated_at: string
  prescriptions: PrescriptionItem[]
}

export interface Payment {
  id: number
  patient_id: number
  patient_name: string
  patient_code: string
  appointment_id: number | null
  doctor_name: string | null
  amount: number
  payment_method: string
  status: string
  note: string | null
  created_by_name: string | null
  created_at: string
}

export interface Activity {
  id: number
  user_id: number | null
  user_name: string
  user_role: Role | null
  action: string
  description: string
  entity_type: string | null
  entity_id: number | null
  entity_label: string | null
  timestamp: string
}

export interface TimelineEvent {
  at: string
  type: 'registration' | 'appointment' | 'visit' | 'payment'
  status?: AppointmentStatus
  title: string
  detail: string
}

export interface Counts {
  appointments: number
  patients: number
  scheduled: number
  waiting: number
  with_doctor: number
  completed: number
  pending: number
  cancelled: number
}

export interface Notification {
  level: 'info' | 'warning'
  message: string
  link: string
}
