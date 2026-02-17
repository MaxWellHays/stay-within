import { Injectable } from '@angular/core';

interface DateFormat {
  regex: RegExp;
  extract: (match: RegExpMatchArray) => { year: number; month: number; day: number } | null;
}

const MONTHS_SHORT: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTHS_LONG: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/**
 * Date formats in priority order matching Go implementation:
 * 1. dd.mm.yyyy  2. dd/mm/yyyy  3. dd-mm-yyyy
 * 4. yyyy-mm-dd  5. yyyy/mm/dd  6. yyyy.mm.dd
 * 7. mm/dd/yyyy  8. mm-dd-yyyy
 * 9. dd Mon yyyy  10. dd Month yyyy
 */
const DATE_FORMATS: DateFormat[] = [
  // dd.mm.yyyy
  {
    regex: /^(\d{2})\.(\d{2})\.(\d{4})$/,
    extract: (m) => ({ day: +m[1], month: +m[2], year: +m[3] }),
  },
  // dd/mm/yyyy
  {
    regex: /^(\d{2})\/(\d{2})\/(\d{4})$/,
    extract: (m) => ({ day: +m[1], month: +m[2], year: +m[3] }),
  },
  // dd-mm-yyyy
  {
    regex: /^(\d{2})-(\d{2})-(\d{4})$/,
    extract: (m) => ({ day: +m[1], month: +m[2], year: +m[3] }),
  },
  // yyyy-mm-dd
  {
    regex: /^(\d{4})-(\d{2})-(\d{2})$/,
    extract: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }),
  },
  // yyyy/mm/dd
  {
    regex: /^(\d{4})\/(\d{2})\/(\d{2})$/,
    extract: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }),
  },
  // yyyy.mm.dd
  {
    regex: /^(\d{4})\.(\d{2})\.(\d{2})$/,
    extract: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }),
  },
  // mm/dd/yyyy (US)
  {
    regex: /^(\d{2})\/(\d{2})\/(\d{4})$/,
    extract: (m) => ({ month: +m[1], day: +m[2], year: +m[3] }),
  },
  // mm-dd-yyyy (US)
  {
    regex: /^(\d{2})-(\d{2})-(\d{4})$/,
    extract: (m) => ({ month: +m[1], day: +m[2], year: +m[3] }),
  },
  // dd Mon yyyy
  {
    regex: /^(\d{2})\s+([A-Za-z]{3})\s+(\d{4})$/,
    extract: (m) => {
      const month = MONTHS_SHORT[m[2].toLowerCase()];
      return month ? { day: +m[1], month, year: +m[3] } : null;
    },
  },
  // dd Month yyyy
  {
    regex: /^(\d{2})\s+([A-Za-z]+)\s+(\d{4})$/,
    extract: (m) => {
      const month = MONTHS_LONG[m[2].toLowerCase()];
      return month ? { day: +m[1], month, year: +m[3] } : null;
    },
  },
];

const HEADER_KEYWORDS = ['start', 'end', 'begin', 'from', 'to', 'departure', 'arrival', 'date'];

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  // Use UTC Date to check day validity, avoiding DST issues
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

@Injectable({ providedIn: 'root' })
export class DateParserService {
  parseDate(dateStr: string): Date | null {
    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    for (const fmt of DATE_FORMATS) {
      const match = trimmed.match(fmt.regex);
      if (!match) continue;

      const parts = fmt.extract(match);
      if (!parts) continue;

      const { year, month, day } = parts;
      if (!isValidDate(year, month, day)) continue;

      // Always construct as UTC to avoid DST issues in day arithmetic
      return new Date(Date.UTC(year, month - 1, day));
    }

    return null;
  }

  isHeaderRow(row: string[]): boolean {
    if (row.length < 2) return false;

    const firstCell = row[0].trim().toLowerCase();
    const secondCell = row[1].trim().toLowerCase();

    for (const keyword of HEADER_KEYWORDS) {
      if (firstCell.includes(keyword) || secondCell.includes(keyword)) {
        return true;
      }
    }

    // If we can't parse either cell as a date, it's likely a header
    const date1 = this.parseDate(row[0]);
    const date2 = this.parseDate(row[1]);

    return date1 === null || date2 === null;
  }

  formatDate(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}.${month}.${year}`;
  }
}
