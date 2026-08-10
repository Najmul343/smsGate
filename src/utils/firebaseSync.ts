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
 * Safely trims SMS records to ensure the overall Firestore document payload stays comfortably under the 1MB limit (~700 KB max for records).
 */
function safeTrimRecordsForCloud(records: SmsRecord[], targetMaxBytes: number = 700000): SmsRecord[] {
  if (!records || records.length === 0) return [];

  // Sanitize heavy strings in records if any
  let cleanList = records.map((r) => {
    const msg = r.message_sent && r.message_sent.length > 500 ? r.message_sent.slice(0, 500) : r.message_sent;
    const err = r.last_error && r.last_error.length > 300 ? r.last_error.slice(0, 300) : r.last_error;
    return {
      ...r,
      message_sent: msg,
      last_error: err,
    };
  });

  let stringified = JSON.stringify(cleanList);
  if (stringified.length <= targetMaxBytes) {
    return cleanList;
  }

  // Keep the most recent records from the end of the array
  while (cleanList.length > 50 && stringified.length > targetMaxBytes) {
    const dropCount = Math.max(10, Math.floor(cleanList.length * 0.15));
    cleanList = cleanList.slice(dropCount);
    stringified = JSON.stringify(cleanList);
  }

  return cleanList;
}

/**
 * Save workspace data to cloud Firestore for a given license key.
 */
export async function saveCloudWorkspace(licenseKey: string, data: Partial<WorkspaceData>): Promise<boolean> {
  const cleanKey = licenseKey.trim().toUpperCase();
  if (!cleanKey) return false;

  // If quota was previously exceeded, check if backoff period has passed
  if (isQuotaExceeded) {
    if (Date.now() < quotaExceededResetTime) {
      return false;
    } else {
      isQuotaExceeded = false;
    }
  }

  const docRef = doc(db, 'license_data', cleanKey);

  try {
    const updatePayload: Record<string, any> = {
      licenseKey: cleanKey,
      updatedAt: new Date().toISOString(),
    };

    if (data.accountsText !== undefined) {
      updatePayload.accountsText = data.accountsText;
    }
    if (data.accounts !== undefined) {
      updatePayload.accounts = data.accounts;
    }
    if (data.records !== undefined) {
      updatePayload.records = safeTrimRecordsForCloud(data.records, 700000);
    }
    if (data.folders !== undefined) {
      updatePayload.folders = data.folders;
    }
    if (data.settings !== undefined) {
      updatePayload.settings = data.settings;
    }
    if (data.lastMessage !== undefined) {
      updatePayload.lastMessage = data.lastMessage;
    }

    // Deep clean undefined fields since Firestore setDoc throws when encountering undefined values
    const cleanPayload = JSON.parse(JSON.stringify(updatePayload));

    await setDoc(docRef, cleanPayload, { merge: true });
    return true;
  } catch (err: any) {
    const errMsg = String(err?.message || err?.code || err || '');

    if (
      errMsg.includes('exceeds the maximum allowed size') ||
      errMsg.includes('1,048,576') ||
      errMsg.includes('1048576') ||
      errMsg.includes('bytes')
    ) {
      console.warn('⚡ Cloud document size exceeded 1MB limit. Performing emergency record trim for cloud sync.');
      if (data.records && data.records.length > 50) {
        try {
          // Emergency retry: keep latest 250 records
          const emergencyRecords = data.records.slice(-250);
          const emergencyPayload: Record<string, any> = {
            licenseKey: cleanKey,
            records: emergencyRecords,
            updatedAt: new Date().toISOString(),
          };
          if (data.accountsText !== undefined) emergencyPayload.accountsText = data.accountsText;
          if (data.accounts !== undefined) emergencyPayload.accounts = data.accounts;
          if (data.folders !== undefined) emergencyPayload.folders = data.folders;
          if (data.settings !== undefined) emergencyPayload.settings = data.settings;
          if (data.lastMessage !== undefined) emergencyPayload.lastMessage = data.lastMessage;

          const cleanEmergency = JSON.parse(JSON.stringify(emergencyPayload));
          await setDoc(docRef, cleanEmergency, { merge: true });
          return true;
        } catch (retryErr) {
          console.error('Error during emergency trim retry:', retryErr);
        }
      }
    } else if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded') || err?.code === 'resource-exhausted') {
      console.warn('⚡ Firestore daily free quota reached. Operating safely in local storage mode.');
      isQuotaExceeded = true;
      quotaExceededResetTime = Date.now() + 24 * 60 * 60 * 1000;
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
