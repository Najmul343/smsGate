import { SmsRecord, SavedFolder, RunSettings } from '../types/sms';

const STORAGE_KEYS = {
  TRACKING: 'sms_tracking_records',
  CONTROL: 'sms_control_state',
  SETTINGS: 'sms_settings_store',
  SAVED_FOLDERS: 'sms_saved_folders_library',
};

// Initial state helpers
export function loadRecords(): SmsRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRACKING);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRecordsToSave: SmsRecord[] | null = null;

export function flushPendingRecords(): void {
  if (pendingRecordsToSave !== null) {
    try {
      localStorage.setItem(STORAGE_KEYS.TRACKING, JSON.stringify(pendingRecordsToSave));
    } catch (err) {
      console.error('Failed to flush records to localStorage:', err);
    }
    pendingRecordsToSave = null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingRecords);
}

export function saveRecords(records: SmsRecord[], immediate: boolean = false): void {
  pendingRecordsToSave = records;
  if (immediate) {
    if (pendingSaveTimer) {
      clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
    }
    flushPendingRecords();
    return;
  }
  if (!pendingSaveTimer) {
    pendingSaveTimer = setTimeout(() => {
      pendingSaveTimer = null;
      flushPendingRecords();
    }, 250);
  }
}

export function getSetting(key: string, defaultValue: string = ''): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const map = raw ? JSON.parse(raw) : {};
    return map[key] !== undefined ? map[key] : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setSetting(key: string, value: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const map = raw ? JSON.parse(raw) : {};
    map[key] = value;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to set setting:', err);
  }
}

export function getMessageVariants(): string[] {
  const v1 = getSetting('last_message', '');
  const v2 = getSetting('msg_variant_2', '');
  const v3 = getSetting('msg_variant_3', '');
  const v4 = getSetting('msg_variant_4', '');
  return [v1, v2, v3, v4];
}

export function setMessageVariants(variants: string[]): void {
  const [v1 = '', v2 = '', v3 = '', v4 = ''] = variants;
  setSetting('last_message', v1);
  setSetting('msg_variant_2', v2);
  setSetting('msg_variant_3', v3);
  setSetting('msg_variant_4', v4);
}

export function getRandomMessageVariant(fallbackMessage?: string): string {
  const variants = getMessageVariants().filter((v) => v && v.trim().length > 0);
  if (variants.length > 0) {
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
  }
  return fallbackMessage || getSetting('last_message', '');
}

export function loadControlMap(): Record<string, { is_running: boolean; message: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTROL);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setRunning(account: string, isRunning: boolean, message?: string): void {
  const map = loadControlMap();
  const existing = map[account] || { is_running: false, message: '' };
  map[account] = {
    is_running: isRunning,
    message: message !== undefined ? message : existing.message,
  };
  localStorage.setItem(STORAGE_KEYS.CONTROL, JSON.stringify(map));
}

export function getControl(account: string): { is_running: boolean; message: string } {
  const map = loadControlMap();
  return map[account] || { is_running: false, message: '' };
}

// Stats & Queue helpers
export function getGlobalStats(records: SmsRecord[]) {
  const pending = records.filter((r) => r.status === 'PENDING').length;
  const success = records.filter((r) => r.status === 'SUCCESS').length;
  const failed = records.filter((r) => r.status === 'FAILED').length;
  return { PENDING: pending, SUCCESS: success, FAILED: failed, TOTAL: records.length };
}

export function getDeliveryStats(records: SmsRecord[]) {
  const delivered = records.filter((r) => r.delivery_status === 'DELIVERED').length;
  const failed = records.filter((r) => r.delivery_status === 'FAILED').length;
  const awaiting = records.filter(
    (r) =>
      r.status === 'SUCCESS' &&
      (!r.delivery_status || (r.delivery_status !== 'DELIVERED' && r.delivery_status !== 'FAILED'))
  ).length;
  return { delivered, failed, awaiting };
}

// Helper to get local date string YYYY-MM-DD
export function getLocalDateString(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper to get local timestamp YYYY-MM-DD HH:mm:ss
export function getLocalTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function getTodaysSuccessCount(records: SmsRecord[], apiUser?: string): number {
  const today = getLocalDateString();
  return records.filter((r) => {
    if (r.status !== 'SUCCESS') return false;
    if (apiUser && r.api_used !== apiUser) return false;
    return r.last_time && r.last_time.startsWith(today);
  }).length;
}

export function getTabStats(records: SmsRecord[], assignedApi: string) {
  const tabRecords = records.filter((r) => r.assigned_api === assignedApi);
  return {
    PENDING: tabRecords.filter((r) => r.status === 'PENDING').length,
    SUCCESS: tabRecords.filter((r) => r.status === 'SUCCESS').length,
    FAILED: tabRecords.filter((r) => r.status === 'FAILED').length,
  };
}

export function insertNumbers(
  records: SmsRecord[],
  numbers: (string | { phone: string; name?: string })[],
  assignedApi: string,
  defaultMessage?: string,
  forceRetarget: boolean = false
): { updatedRecords: SmsRecord[]; newCount: number; skippedCount: number; requeuedCount: number } {
  const existingPhoneMap = new Map<string, SmsRecord>();
  records.forEach((r) => existingPhoneMap.set(r.phone, r));

  const now = getLocalTimestamp();
  let newCount = 0;
  let skippedCount = 0;
  let requeuedCount = 0;

  numbers.forEach((item) => {
    const num = typeof item === 'string' ? item : item.phone;
    const nameVal = typeof item === 'string' ? undefined : item.name;

    if (!existingPhoneMap.has(num)) {
      const newRec: SmsRecord = {
        phone: num,
        name: nameVal,
        status: 'PENDING',
        attempts: 0,
        last_error: '',
        last_time: '',
        created_at: now,
        api_used: '',
        assigned_api: assignedApi,
        message_sent: defaultMessage || '',
        auto_retry_count: 0,
      };
      records.push(newRec);
      existingPhoneMap.set(num, newRec);
      newCount++;
    } else {
      const existing = existingPhoneMap.get(num)!;
      if (existing.status !== 'SUCCESS' || forceRetarget) {
        existing.status = 'PENDING';
        existing.attempts = 0;
        existing.last_error = '';
        delete (existing as any).delivery_status;
        delete (existing as any).delivery_updated_at;
        if (assignedApi) existing.assigned_api = assignedApi;
        if (nameVal) existing.name = nameVal;
        if (defaultMessage) existing.message_sent = defaultMessage;
        existing.auto_retry_count = 0;
        requeuedCount++;
      } else {
        if (nameVal && !existing.name) {
          existing.name = nameVal;
        }
        if (assignedApi && !existing.assigned_api) {
          existing.assigned_api = assignedApi;
        }
        if (defaultMessage && !existing.message_sent) {
          existing.message_sent = defaultMessage;
        }
        skippedCount++;
      }
    }
  });

  saveRecords(records);
  return { updatedRecords: [...records], newCount, skippedCount, requeuedCount };
}

export function unfilterAndPrepareAllRemaining(
  records: SmsRecord[],
  defaultMessage: string,
  activeAccounts: { user: string; pwd: string }[]
): { updatedRecords: SmsRecord[]; totalPending: number } {
  if (!records.length) return { updatedRecords: records, totalPending: 0 };

  let totalPending = 0;
  const nAccounts = activeAccounts.length;

  records.forEach((r) => {
    if (r.status !== 'SUCCESS') {
      r.status = 'PENDING';
      r.attempts = 0;
      r.last_error = '';
      r.next_attempt_at = undefined;
      if (defaultMessage && (!r.message_sent || r.message_sent === 'None')) {
        r.message_sent = defaultMessage;
      }
      if (nAccounts > 0) {
        r.assigned_api = activeAccounts[totalPending % nAccounts].user;
      } else {
        r.assigned_api = '';
      }
      totalPending++;
    }
  });

  saveRecords(records);
  return { updatedRecords: [...records], totalPending };
}

export function splitAndStartAll(
  records: SmsRecord[],
  numbers: (string | { phone: string; name?: string })[],
  message: string,
  activeAccounts: { user: string; pwd: string }[]
): { updatedRecords: SmsRecord[]; summary: { account: string; newCount: number; movedCount: number }[] } {
  if (!numbers.length || !activeAccounts.length) {
    return { updatedRecords: records, summary: [] };
  }

  const existingMap = new Map<string, SmsRecord>();
  records.forEach((r) => existingMap.set(r.phone, r));

  // Extract objects or strings
  const items = numbers.map((item) =>
    typeof item === 'string' ? { phone: item, name: undefined } : item
  );

  // Only redistributable if not already SUCCESS
  const redistributable = items.filter((item) => {
    const rec = existingMap.get(item.phone);
    return !rec || rec.status !== 'SUCCESS';
  });

  const nAccounts = activeAccounts.length;
  const now = getLocalTimestamp();
  const summary: { account: string; newCount: number; movedCount: number }[] = [];

  activeAccounts.forEach((acc, i) => {
    const chunk = redistributable.filter((_, idx) => idx % nAccounts === i);
    let newCount = 0;
    let movedCount = 0;

    chunk.forEach((item) => {
      const existing = existingMap.get(item.phone);
      if (!existing) {
        const newRec: SmsRecord = {
          phone: item.phone,
          name: item.name,
          status: 'PENDING',
          attempts: 0,
          last_error: '',
          last_time: '',
          created_at: now,
          api_used: '',
          assigned_api: acc.user,
          message_sent: message,
          auto_retry_count: 0,
        };
        records.push(newRec);
        existingMap.set(item.phone, newRec);
        newCount++;
      } else if (existing.status !== 'SUCCESS') {
        existing.assigned_api = acc.user;
        existing.status = 'PENDING';
        if (item.name) existing.name = item.name;
        if (message) existing.message_sent = message;
        movedCount++;
      }
    });

    summary.push({ account: acc.user, newCount, movedCount });
    setRunning(acc.user, true, message);
  });

  saveRecords(records);
  return { updatedRecords: [...records], summary };
}

export function getRoutesWithPending(records: SmsRecord[]): { assigned_api: string; count: number }[] {
  const map = new Map<string, number>();
  records.forEach((r) => {
    if (r.status !== 'SUCCESS' && r.assigned_api) {
      map.set(r.assigned_api, (map.get(r.assigned_api) || 0) + 1);
    }
  });

  const res: { assigned_api: string; count: number }[] = [];
  map.forEach((count, assigned_api) => {
    res.push({ assigned_api, count });
  });
  return res;
}

export function reassignNumbers(
  records: SmsRecord[],
  oldApi: string,
  newApi: string
): { updatedRecords: SmsRecord[]; count: number } {
  let count = 0;
  records.forEach((r) => {
    if (r.assigned_api === oldApi && r.status !== 'SUCCESS') {
      r.assigned_api = newApi;
      r.status = 'PENDING';
      r.attempts = 0;
      r.last_error = '';
      count++;
    }
  });
  saveRecords(records);
  return { updatedRecords: [...records], count };
}

// Saved Folders Management
export function loadSavedFolders(): SavedFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_FOLDERS);
    return raw ? JSON.parse(raw) : [
      { name: 'Mumbai_Batch1', files: [] },
      { name: 'Vip_Clients', files: [] }
    ];
  } catch {
    return [];
  }
}

export function saveSavedFolders(folders: SavedFolder[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_FOLDERS, JSON.stringify(folders));
  } catch (err) {
    console.error('Failed to save folders:', err);
  }
}
