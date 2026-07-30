import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { SmsRecord, SavedFolder, RunSettings, SmsAccount } from '../types/sms';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use specified custom Firestore database ID if provided, otherwise default
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export interface WorkspaceData {
  licenseKey: string;
  accountsText?: string;
  accounts?: SmsAccount[];
  records?: SmsRecord[];
  folders?: SavedFolder[];
  settings?: RunSettings;
  lastMessage?: string;
  updatedAt?: string;
}

const LICENSE_KEY_STORAGE_KEY = 'app_license_key_active';

export function getActiveLicenseKey(): string {
  try {
    return localStorage.getItem(LICENSE_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setActiveLicenseKey(key: string): void {
  try {
    if (key) {
      localStorage.setItem(LICENSE_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(LICENSE_KEY_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to save license key:', err);
  }
}

/**
 * Fetch full workspace data from cloud Firestore for a given license key.
 */
export async function fetchCloudWorkspace(licenseKey: string): Promise<WorkspaceData | null> {
  const cleanKey = licenseKey.trim().toUpperCase();
  if (!cleanKey) return null;

  try {
    const docRef = doc(db, 'license_data', cleanKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as WorkspaceData;
    }
    return null;
  } catch (err) {
    console.error('Error fetching workspace from cloud:', err);
    return null;
  }
}

let isQuotaExceeded = false;
let quotaExceededResetTime = 0;

/**
 * Save workspace data to cloud Firestore for a given license key.
 */
export async function saveCloudWorkspace(licenseKey: string, data: Partial<WorkspaceData>): Promise<boolean> {
  const cleanKey = licenseKey.trim().toUpperCase();
  if (!cleanKey) return false;

  // If quota was previously exceeded, check if backoff period (5 min) has passed
  if (isQuotaExceeded) {
    if (Date.now() < quotaExceededResetTime) {
      // Quietly return false to prevent spamming Firestore while quota is active
      return false;
    } else {
      isQuotaExceeded = false;
    }
  }

  try {
    const docRef = doc(db, 'license_data', cleanKey);
    const rawPayload: WorkspaceData = {
      licenseKey: cleanKey,
      accountsText: data.accountsText !== undefined ? data.accountsText : '',
      accounts: data.accounts || [],
      records: data.records || [],
      folders: data.folders || [],
      settings: data.settings || {
        dailyLimit: 180,
        delayMin: 5,
        delayMax: 8,
        batchSize: 10,
        batchPause: 120,
        maxRetries: 3,
        autoMode: true,
        scheduleEnabled: false,
        scheduleTime: '10:00',
        scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        scheduleOnlyOnline: true,
        scheduleMessage: '',
        scheduleCount: 50,
        lastScheduleRun: '',
      },
      lastMessage: data.lastMessage !== undefined ? data.lastMessage : '',
      updatedAt: new Date().toISOString(),
    };

    // Deep clean undefined fields since Firestore setDoc throws when encountering undefined values anywhere in the document
    const cleanPayload = JSON.parse(JSON.stringify(rawPayload));

    await setDoc(docRef, cleanPayload, { merge: true });
    return true;
  } catch (err: any) {
    const errMsg = String(err?.message || err?.code || err || '');
    if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded') || err?.code === 'resource-exhausted') {
      console.warn('⚡ Firestore daily free quota reached. Operating safely in local storage mode.');
      isQuotaExceeded = true;
      quotaExceededResetTime = Date.now() + 24 * 60 * 60 * 1000; // 24-hour daily reset backoff
    } else {
      console.error('Error saving workspace to cloud:', err);
    }
    return false;
  }
}

/**
 * Subscribe to real-time changes in Firestore for a given license key.
 */
export function subscribeCloudWorkspace(
  licenseKey: string,
  onDataChange: (data: WorkspaceData) => void
): Unsubscribe | null {
  const cleanKey = licenseKey.trim().toUpperCase();
  if (!cleanKey || isQuotaExceeded) return null;

  try {
    const docRef = doc(db, 'license_data', cleanKey);
    let unsubRef: Unsubscribe | null = null;

    unsubRef = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          onDataChange(snap.data() as WorkspaceData);
        }
      },
      (error) => {
        const errMsg = String(error?.message || error?.code || error || '');
        if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded') || error?.code === 'resource-exhausted') {
          console.warn('⚡ Firestore subscription paused due to daily free quota limits. System running in high-speed local mode.');
          isQuotaExceeded = true;
          quotaExceededResetTime = Date.now() + 24 * 60 * 60 * 1000;
          if (unsubRef) {
            try { unsubRef(); } catch {}
          }
        } else {
          console.error('Firestore real-time subscription error:', error);
        }
      }
    );
    return unsubRef;
  } catch (err: any) {
    console.error('Error subscribing to cloud workspace:', err);
    return null;
  }
}
