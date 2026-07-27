import { LicenseData } from '../types/sms';

export const HARDCODED_KEYS: Record<string, number> = {
  'TRIAL-17741-ABCD': 2,
  'TRIAL-2563-ABCD': 2,
  'NAJMUL-WORK-2026': 365,
  'PRO-AAAA-BBBB': 365,
  'PRO-NAJAM-1111': 365,
};

const LICENSE_STORAGE_KEY = '.sms_sys_data';

export interface LicenseStatus {
  isValid: boolean | null; // null = unlock required, false = expired, true = active
  daysLeft: number;
  activeKey: string;
}

export function checkLicense(): LicenseStatus {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!raw) {
      return { isValid: null, daysLeft: 0, activeKey: '' };
    }

    const data: LicenseData = JSON.parse(raw);
    const activeKey = data.key || '';
    const activatedOn = new Date(data.date);
    const daysAllowed = data.days || 365;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activatedOn.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - activatedOn.getTime();
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = daysAllowed - daysPassed;

    if (daysLeft > 0) {
      return { isValid: true, daysLeft, activeKey };
    } else {
      return { isValid: false, daysLeft: 0, activeKey };
    }
  } catch {
    return { isValid: null, daysLeft: 0, activeKey: '' };
  }
}

export function saveLicense(key: string, days: number = 365): boolean {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const data: LicenseData = {
      key: key.trim().toUpperCase(),
      date: todayStr,
      days,
    };
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

