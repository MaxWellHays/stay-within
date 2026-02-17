import { Component, signal, computed } from '@angular/core';
import { ConfigBar } from './components/config-bar/config-bar';
import { TripInput } from './components/trip-input/trip-input';
import { StatusCard } from './components/status-card/status-card';
import { TripTable } from './components/trip-table/trip-table';
import { Config, Trip, AnalysisRow, StatusResult } from './models/trip.model';
import { CsvParserService } from './services/csv-parser.service';
import { CalculatorService } from './services/calculator.service';

@Component({
  selector: 'app-root',
  imports: [ConfigBar, TripInput, StatusCard, TripTable],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private config = signal<Config>({ windowMonths: 12, absenceLimit: 180 });
  private tripText = signal('');

  constructor(
    private csvParser: CsvParserService,
    private calculator: CalculatorService,
  ) {}

  protected trips = computed<Trip[]>(() => {
    const text = this.tripText();
    if (!text.trim()) return [];
    return this.csvParser.parseTripsFromText(text);
  });

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
