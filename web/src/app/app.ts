import { Component, computed, effect, signal } from '@angular/core';
import { ConfigBar } from './components/config-bar/config-bar';
import { TripInput } from './components/trip-input/trip-input';
import { StatusCard } from './components/status-card/status-card';
import { TripTable } from './components/trip-table/trip-table';
import { TripTimeline } from './components/trip-timeline/trip-timeline';
import { Config, Trip, AnalysisRow, StatusResult } from './models/trip.model';
import { TripColor, computeTripColors } from './utils/trip-colors';
import { CsvParserService } from './services/csv-parser.service';
import { CalculatorService } from './services/calculator.service';
import { FaviconService } from './services/favicon.service';

const STORAGE_KEY = 'stay-within-trip-data';

// ── URL share encoding ───────────────────────────────────────────────────────

/** Encode a UTF-8 string to URL-safe base64 (no padding). */
function encodeShare(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Decode a URL-safe base64 string back to UTF-8. Returns '' on error. */
function decodeShare(encoded: string): string {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function fmtDateParam(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

// ── Shared config type (passed to ConfigBar for one-shot initialization) ────

export interface SharedConfig {
  windowMonths: number;
  absenceLimit: number;
  customDateStr: string;
}

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-root',
  imports: [ConfigBar, TripInput, StatusCard, TripTable, TripTimeline],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected config = signal<Config>({ windowMonths: 12, absenceLimit: 180 });
  protected tripText = signal(localStorage.getItem(STORAGE_KEY) ?? '');
  protected hoveredTrip = signal<Trip | null>(null);

  // Parse the URL hash once on startup.
  private readonly urlShare = (() => {
    const hash = location.hash.slice(1);
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const csv = params.get('csv');
    if (!csv) return null;
    return {
      csv: decodeShare(csv),
      windowMonths: Number(params.get('w')) || null,
      absenceLimit: Number(params.get('l')) || null,
      customDateStr: params.get('d') ?? '',
    };
  })();

  // Passed to ConfigBar so it can pre-fill its fields when opened via a shared link.
  protected readonly sharedConfig: SharedConfig | null =
    this.urlShare
      ? {
          windowMonths: this.urlShare.windowMonths ?? 12,
          absenceLimit: this.urlShare.absenceLimit ?? 180,
          customDateStr: this.urlShare.customDateStr,
        }
      : null;

  // Full shareable URL, or null when there is no data to share.
  protected shareUrl = computed<string | null>(() => {
    const text = this.tripText();
    if (!text.trim()) return null;

    const params = new URLSearchParams();
    params.set('csv', encodeShare(text));

    const config = this.config();
    params.set('w', String(config.windowMonths));
    params.set('l', String(config.absenceLimit));
    if (config.customDate) params.set('d', fmtDateParam(config.customDate));

    return `${location.origin}${location.pathname}#${params}`;
  });

  constructor(
    private csvParser: CsvParserService,
    private calculator: CalculatorService,
    faviconService: FaviconService,
  ) {
    faviconService.init();

    // If the page was opened via a shared link, prefer that data over localStorage.
    if (this.urlShare?.csv) {
      this.tripText.set(this.urlShare.csv);
      // Remove the hash from the URL so it doesn't persist after the data is loaded.
      history.replaceState(null, '', location.pathname);
    }

    // Persist trip text to localStorage whenever it changes.
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.tripText());
    });
  }

  private parsedResult = computed<{ trips: Trip[]; error: string | null }>(() => {
    const text = this.tripText();
    if (!text.trim()) return { trips: [], error: null };
    const trips = this.csvParser.parseTripsFromText(text);
    if (trips.length === 0) {
      return {
        trips: [],
        error:
          'No valid trips found. Make sure each row has a start and end date ' +
          '(e.g. 25.05.2023,10.08.2023). Supported formats: dd.mm.yyyy, yyyy-mm-dd, mm/dd/yyyy and more.',
      };
    }
    return { trips, error: null };
  });

  protected trips = computed(() => this.parsedResult().trips);
  protected parseError = computed(() => this.parsedResult().error);

  protected analysisRows = computed<AnalysisRow[]>(() => {
    const trips = this.trips();
    if (trips.length === 0) return [];
    return this.calculator.analyzeTrips(trips, this.config());
  });

  protected statusResult = computed<StatusResult | null>(() => {
    const trips = this.trips();
    if (trips.length === 0) return null;
    return this.calculator.calculateStatus(trips, this.config());
  });

  protected windowMonths = computed(() => this.config().windowMonths);
  protected tripColors = computed<Map<Trip, TripColor>>(() => computeTripColors(this.trips()));

  onConfigChanged(config: Config) {
    this.config.set(config);
  }

  onTextChanged(text: string) {
    this.tripText.set(text);
  }
}
