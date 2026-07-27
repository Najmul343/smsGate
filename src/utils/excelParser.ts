import * as XLSX from 'xlsx';
import { normalizePhone } from './normalize';

export async function parseExcelFile(file: File): Promise<{
  numbers: string[];
  totalRaw: number;
  invalidCount: number;
  duplicateCount: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!jsonRows || jsonRows.length === 0) {
          resolve({ numbers: [], totalRaw: 0, invalidCount: 0, duplicateCount: 0 });
          return;
        }

        // Determine phone column: search for header with "phone", or use column index 1 or 0
        let phoneColIdx = -1;
        const headers = jsonRows[0] || [];

        if (Array.isArray(headers)) {
          for (let i = 0; i < headers.length; i++) {
            if (headers[i] && String(headers[i]).toLowerCase().includes('phone')) {
              phoneColIdx = i;
              break;
            }
          }
        }

        // If no 'phone' header found, default to column index 1 (second col) if exists, else 0
        if (phoneColIdx === -1) {
          phoneColIdx = headers.length > 1 ? 1 : 0;
        }

        const rawList: any[] = [];
        const startRow = (headers && headers.length > 0 && typeof headers[phoneColIdx] === 'string' && isNaN(Number(headers[phoneColIdx]))) ? 1 : 0;

        for (let r = startRow; r < jsonRows.length; r++) {
          const row = jsonRows[r];
          if (row && row[phoneColIdx] !== undefined) {
            rawList.push(row[phoneColIdx]);
          }
        }

        const totalRaw = rawList.length;
        const normalizedList: string[] = [];
        let invalidCount = 0;

        for (const rawVal of rawList) {
          const norm = normalizePhone(rawVal);
          if (norm) {
            normalizedList.push(norm);
          } else {
            invalidCount++;
          }
        }

        // Deduplicate
        const uniqueSet = new Set(normalizedList);
        const uniqueNumbers = Array.from(uniqueSet);
        const duplicateCount = normalizedList.length - uniqueNumbers.length;

        resolve({
          numbers: uniqueNumbers,
          totalRaw,
          invalidCount,
          duplicateCount,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
