/**
 * Cross-implementation e2e test.
 *
 * Runs the Go CLI with --json against each fixture CSV, then runs the same
 * calculations via the TypeScript services, and asserts that every number matches.
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

// Import TS services (they use @Injectable but we just instantiate directly)
import { DateParserService } from '../web/src/app/services/date-parser.service';
import { CsvParserService } from '../web/src/app/services/csv-parser.service';
import { CalculatorService } from '../web/src/app/services/calculator.service';
import { Config } from '../web/src/app/models/trip.model';

// --- Types matching Go JSON output ---

interface GoJsonTrip {
  start: string;
  end: string;
  days: number;
  daysInWindow: number;
  daysRemaining: number;
}

interface GoJsonStatus {
  targetDate: string;
  lastTripEnd: string;
  daysSinceLastTrip: number;
  windowStart: string;
  windowEnd: string;
  totalDaysOutside: number;
  daysRemaining: number;
  status: string;
}

interface GoJsonOutput {
  config: { windowMonths: number; absenceLimit: number };
  trips: GoJsonTrip[];
  status: GoJsonStatus;
}

// --- Helpers ---

/** Format a UTC date as dd.mm.yyyy — matches Go CLI JSON output format. */
function fmtDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

// --- Test infrastructure ---

const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const CLI_DIR = resolve(__dirname, '..', 'cli');

const dateParser = new DateParserService();
const csvParser = new CsvParserService(dateParser);
const calculator = new CalculatorService();

interface TestCase {
  fixture: string;
  date: string;
  window: number;
  limit: number;
}

const testCases: TestCase[] = [
  // Default config (12mo / 180d)
  { fixture: 'basic.csv',          date: '15.11.2025', window: 12, limit: 180 },
  { fixture: 'full-year.csv',      date: '15.11.2025', window: 12, limit: 180 },
  { fixture: 'single-trip.csv',    date: '01.01.2025', window: 12, limit: 180 },
  { fixture: 'year-boundary.csv',  date: '15.03.2025', window: 12, limit: 180 },
  { fixture: 'exceeded-limit.csv', date: '01.11.2024', window: 12, limit: 180 },
  { fixture: 'no-header.csv',      date: '15.02.2025', window: 12, limit: 180 },

  // Schengen config (6mo / 90d)
  { fixture: 'basic.csv',          date: '15.11.2025', window: 6,  limit: 90 },
  { fixture: 'full-year.csv',      date: '15.11.2025', window: 6,  limit: 90 },
  { fixture: 'exceeded-limit.csv', date: '01.11.2024', window: 6,  limit: 90 },

  // Custom config (24mo / 365d)
  { fixture: 'full-year.csv',      date: '15.11.2025', window: 24, limit: 365 },
  { fixture: 'year-boundary.csv',  date: '15.03.2025', window: 24, limit: 365 },
];

function runGoJson(fixture: string, date: string, window: number, limit: number): GoJsonOutput {
  const csvPath = join(FIXTURES_DIR, fixture);
  const cmd = `go run . ${csvPath} --json --date ${date} --window ${window} --limit ${limit}`;
  const stdout = execSync(cmd, { cwd: CLI_DIR, encoding: 'utf-8' });
  return JSON.parse(stdout);
}

function runTs(fixture: string, date: string, window: number, limit: number) {
  const csvPath = join(FIXTURES_DIR, fixture);
  const text = readFileSync(csvPath, 'utf-8');
  const trips = csvParser.parseTripsFromText(text);

  const customDate = dateParser.parseDate(date)!;
  const config: Config = { windowMonths: window, absenceLimit: limit, customDate };

  const analysisRows = calculator.analyzeTrips(trips, config);
  const status = calculator.calculateStatus(trips, config);

  return { trips, analysisRows, status };
}

// --- Comparison ---

let passed = 0;
let failed = 0;

function assertEqual(label: string, goVal: unknown, tsVal: unknown) {
  if (goVal !== tsVal) {
    console.error(`  FAIL: ${label} — Go: ${goVal}, TS: ${tsVal}`);
    failed++;
  } else {
    passed++;
  }
}

console.log(`Running ${testCases.length} e2e test cases...\n`);

for (const tc of testCases) {
  const label = `${tc.fixture} [date=${tc.date}, window=${tc.window}, limit=${tc.limit}]`;
  console.log(`Testing: ${label}`);

  let goResult: GoJsonOutput;
  try {
    goResult = runGoJson(tc.fixture, tc.date, tc.window, tc.limit);
  } catch (err) {
    console.error(`  FAIL: Go CLI failed — ${err}`);
    failed++;
    continue;
  }

  const tsResult = runTs(tc.fixture, tc.date, tc.window, tc.limit);

  // Compare config
  assertEqual('config.windowMonths', goResult.config.windowMonths, tc.window);
  assertEqual('config.absenceLimit', goResult.config.absenceLimit, tc.limit);

  // Compare trip count
  assertEqual('trip count', goResult.trips.length, tsResult.analysisRows.length);

  // Compare each trip
  const tripCount = Math.min(goResult.trips.length, tsResult.analysisRows.length);
  for (let i = 0; i < tripCount; i++) {
    const goTrip = goResult.trips[i];
    const tsRow = tsResult.analysisRows[i];
    const prefix = `trip[${i}]`;

    assertEqual(`${prefix}.start`, goTrip.start, fmtDate(tsRow.trip.start));
    assertEqual(`${prefix}.end`, goTrip.end, fmtDate(tsRow.trip.end));
    assertEqual(`${prefix}.days`, goTrip.days, tsRow.trip.days);
    assertEqual(`${prefix}.daysInWindow`, goTrip.daysInWindow, tsRow.daysInWindow);
    assertEqual(`${prefix}.daysRemaining`, goTrip.daysRemaining, tsRow.daysRemaining);
  }

  // Compare status
  const goStatus = goResult.status;
  const tsStatus = tsResult.status;

  assertEqual('status.targetDate', goStatus.targetDate, fmtDate(tsStatus.targetDate));
  assertEqual('status.lastTripEnd', goStatus.lastTripEnd, fmtDate(tsStatus.lastTripEnd));
  assertEqual('status.daysSinceLastTrip', goStatus.daysSinceLastTrip, tsStatus.daysSinceLastTrip);
  assertEqual('status.windowStart', goStatus.windowStart, fmtDate(tsStatus.windowStart));
  assertEqual('status.windowEnd', goStatus.windowEnd, fmtDate(tsStatus.windowEnd));
  assertEqual('status.totalDaysOutside', goStatus.totalDaysOutside, tsStatus.totalDaysOutside);
  assertEqual('status.daysRemaining', goStatus.daysRemaining, tsStatus.daysRemaining);
  assertEqual('status.status', goStatus.status, tsStatus.status);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}`);

process.exit(failed > 0 ? 1 : 0);
