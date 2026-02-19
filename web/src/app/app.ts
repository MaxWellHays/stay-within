import { Component, computed, effect, signal } from '@angular/core';
import { ConfigBar } from './components/config-bar/config-bar';
import { TripInput } from './components/trip-input/trip-input';
import { StatusCard } from './components/status-card/status-card';
import { TripTable } from './components/trip-table/trip-table';
import { Config, Trip, AnalysisRow, StatusResult } from './models/trip.model';
import { CsvParserService } from './services/csv-parser.service';
import { CalculatorService } from './services/calculator.service';
import { FaviconService } from './services/favicon.service';

const STORAGE_KEY = 'stay-within-trip-data';

@Component({
  selector: 'app-root',
  imports: [ConfigBar, TripInput, StatusCard, TripTable],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private config = signal<Config>({ windowMonths: 12, absenceLimit: 180 });
  protected tripText = signal(localStorage.getItem(STORAGE_KEY) ?? '');

  constructor(
    private csvParser: CsvParserService,
    private calculator: CalculatorService,
    faviconService: FaviconService,
  ) {
    faviconService.init();
    // Persist trip text to localStorage whenever it changes
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

  onConfigChanged(config: Config) {
    this.config.set(config);
  }

  onTextChanged(text: string) {
    this.tripText.set(text);
  }
}
