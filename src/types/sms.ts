export interface SmsAccount {
  user: string;
  pwd: string;
  name?: string;
  enabled: boolean;
  dailyLimit?: number;
}

export interface SmsRecord {
  phone: string;
  name?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  attempts: number;
  last_error: string;
  last_time: string;
  created_at: string;
  api_used: string;
  assigned_api: string;
  message_sent: string;
  message_id?: string;
  delivery_status?: string;
  delivery_reason?: string;
  delivery_checked_at?: string;
  auto_retry_count: number;
  next_attempt_at?: string;
}

export interface RunSettings {
  dailyLimit: number;
  delayMin: number;
  delayMax: number;
  batchSize: number;
  batchPause: number;
  maxRetries: number;
  autoMode: boolean;
  scheduleEnabled: boolean;
  scheduleTime: string;
  scheduleDays: string[];
  scheduleOnlyOnline: boolean;
  scheduleMessage: string;
  scheduleCount: number;
  lastScheduleRun?: string;
}

export interface SavedFolder {
  name: string;
  files: {
    filename: string;
    numbers: string[];
    savedAt: string;
  }[];
}

export interface LicenseData {
  key: string;
  date: string;
  days: number;
}

export interface DeviceInfo {
  name: string;
  lastSeen: string;
  minutesAgo: number | null;
  online: boolean;
}

export interface AccountDeviceStatus {
  online: boolean | null;
  error: string | null;
  devices: DeviceInfo[];
}
