/**
 * Property-based cross-implementation test.
 *
 * Generates 200 random cases (1-60 trips each) and verifies that the Go CLI
 * and TypeScript services produce identical results for every field.
 *
 * The Go binary is compiled once before the run so execution stays fast.
 * When a mismatch is found the full CSV + config is printed for easy reproduction.
 *
 * Run: npx tsx e2e-random.ts   (from the tests/ directory)
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

import { DateParserService } from '../web/src/app/services/date-parser.service';
import { CsvParserService } from '../web/src/app/services/csv-parser.service';
import { CalculatorService } from '../web/src/app/services/calculator.service';
import { Config } from '../web/src/app/models/trip.model';

// ── Types matching Go JSON output ────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a UTC date as dd.mm.yyyy — matches Go CLI JSON output format. */
function fmtDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random UTC midnight date within [minYear, maxYear]. */
function randomDate(minYear: number, maxYear: number): Date {
  const minMs = Date.UTC(minYear, 0, 1);
  const maxMs = Date.UTC(maxYear, 11, 31);
  const ms = minMs + Math.random() * (maxMs - minMs);
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

// ── Random case generation ───────────────────────────────────────────────────

interface CaseInput {
  csv: string;
  dateStr: string;
  windowMonths: number;
  limit: number;
}

function generateCase(): CaseInput {
  const tripCount = randomInt(1, 60);
  const lines = ['Start,End'];

  for (let i = 0; i < tripCount; i++) {
    // Trips can overlap — that is a valid and interesting edge case.
    const start = randomDate(2018, 2025);
    const end = addDays(start, randomInt(0, 120)); // 0 = single-day trip
    lines.push(`${fmtDate(start)},${fmtDate(end)}`);
  }

  return {
    csv: lines.join('\n') + '\n',
    dateStr: fmtDate(randomDate(2019, 2027)),
    windowMonths: randomInt(1, 24),
    limit: randomInt(10, 400),
  };
}

// ── Go CLI runner ────────────────────────────────────────────────────────────

const CLI_DIR = resolve(__dirname, '..', 'cli');
const ext = process.platform === 'win32' ? '.exe' : '';
const BIN = join(tmpdir(), `stay-within-test-${Date.now()}${ext}`);

console.log('Compiling Go binary...');
execSync(`go build -o "${BIN}" .`, { cwd: CLI_DIR, stdio: 'inherit' });
process.on('exit', () => { try { unlinkSync(BIN); } catch { /* ignore */ } });
console.log('Done.\n');

function runGo(tc: CaseInput): GoJsonOutput {
  const tmpCsv = join(tmpdir(), `sw-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
  writeFileSync(tmpCsv, tc.csv);
  try {
    const cmd = `"${BIN}" "${tmpCsv}" --json --date ${tc.dateStr} --window ${tc.windowMonths} --limit ${tc.limit}`;
    const out = execSync(cmd, { encoding: 'utf-8' });
    return JSON.parse(out);
  } finally {
    unlinkSync(tmpCsv);
  }
}

// ── TypeScript runner ────────────────────────────────────────────────────────

const dateParser = new DateParserService();
const csvParser = new CsvParserService(dateParser);
const calculator = new CalculatorService();

function runTs(tc: CaseInput) {
  const trips = csvParser.parseTripsFromText(tc.csv);
  const customDate = dateParser.parseDate(tc.dateStr)!;
  const config: Config = { windowMonths: tc.windowMonths, absenceLimit: tc.limit, customDate };
  return {
    analysisRows: calculator.analyzeTrips(trips, config),
    status: calculator.calculateStatus(trips, config),
  };
}

// ── Comparison ───────────────────────────────────────────────────────────────

const NUM_CASES = 200;
let totalPassed = 0;
let totalFailed = 0;
let totalErrors = 0;

/** Returns true if the assertion passed. */
function assertEqual(label: string, goVal: unknown, tsVal: unknown): boolean {
  if (goVal !== tsVal) {
    console.error(`\n    FAIL  ${label}`);
    console.error(`          Go: ${goVal}`);
    console.error(`          TS: ${tsVal}`);
    totalFailed++;
    return false;
  }
  totalPassed++;
  return true;
}

function runCase(tc: CaseInput, index: number): boolean {
  let goResult: GoJsonOutput;
  try {
    goResult = runGo(tc);
  } catch (err) {
    console.error(`\n  [${index}] ERROR: Go CLI failed — ${err}`);
    totalErrors++;
    return false;
  }

  let tsResult: ReturnType<typeof runTs>;
  try {
    tsResult = runTs(tc);
  } catch (err) {
    console.error(`\n  [${index}] ERROR: TS services failed — ${err}`);
    totalErrors++;
    return false;
  }

  let caseOk = true;

  const countOk = assertEqual('trip count', goResult.trips.length, tsResult.analysisRows.length);
  if (!countOk) caseOk = false;

  const tripCount = Math.min(goResult.trips.length, tsResult.analysisRows.length);
  for (let j = 0; j < tripCount; j++) {
    const go = goResult.trips[j];
    const ts = tsResult.analysisRows[j];
    const p = `trip[${j}]`;
    const ok = [
      assertEqual(`${p}.start`,         go.start,         fmtDate(ts.trip.start)),
      assertEqual(`${p}.end`,           go.end,           fmtDate(ts.trip.end)),
      assertEqual(`${p}.days`,          go.days,          ts.trip.days),
      assertEqual(`${p}.daysInWindow`,  go.daysInWindow,  ts.daysInWindow),
      assertEqual(`${p}.daysRemaining`, go.daysRemaining, ts.daysRemaining),
    ];
    if (ok.some((v) => !v)) caseOk = false;
  }

  const gs = goResult.status;
  const ts = tsResult.status;
  const statusOk = [
    assertEqual('status.targetDate',       gs.targetDate,       fmtDate(ts.targetDate)),
    assertEqual('status.lastTripEnd',      gs.lastTripEnd,      fmtDate(ts.lastTripEnd)),
    assertEqual('status.daysSinceLastTrip',gs.daysSinceLastTrip,ts.daysSinceLastTrip),
    assertEqual('status.windowStart',      gs.windowStart,      fmtDate(ts.windowStart)),
    assertEqual('status.windowEnd',        gs.windowEnd,        fmtDate(ts.windowEnd)),
    assertEqual('status.totalDaysOutside', gs.totalDaysOutside, ts.totalDaysOutside),
    assertEqual('status.daysRemaining',    gs.daysRemaining,    ts.daysRemaining),
    assertEqual('status.status',           gs.status,           ts.status),
  ];
  if (statusOk.some((v) => !v)) caseOk = false;

  if (!caseOk) {
    console.error(`\n  Reproducer for case ${index}:`);
    console.error(`    date=${tc.dateStr}  window=${tc.windowMonths}  limit=${tc.limit}`);
    console.error(`    CSV:\n${tc.csv.split('\n').map((l) => '      ' + l).join('\n')}`);
  }

  return caseOk;
}

// ── Main loop ────────────────────────────────────────────────────────────────

console.log(`Running ${NUM_CASES} random cases (1-60 trips each)...\n`);

for (let i = 1; i <= NUM_CASES; i++) {
  const tc = generateCase();
  const ok = runCase(tc, i);
  process.stdout.write(ok ? '.' : 'F');
  if (i % 50 === 0) process.stdout.write(` ${i}/${NUM_CASES}\n`);
}

process.stdout.write('\n');
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${totalPassed} assertions passed`);
if (totalFailed > 0) console.error(`         ${totalFailed} assertions FAILED`);
if (totalErrors > 0) console.error(`         ${totalErrors} cases ERRORED`);
console.log(`${'='.repeat(60)}`);

process.exit(totalFailed > 0 || totalErrors > 0 ? 1 : 0);
