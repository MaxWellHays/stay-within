import { Component, input, model, computed } from '@angular/core';
import { AnalysisRow, Trip } from '../../models/trip.model';
import { TripColor } from '../../utils/trip-colors';
import { DateParserService } from '../../services/date-parser.service';

@Component({
  selector: 'app-trip-table',
  imports: [],
  templateUrl: './trip-table.html',
  styleUrl: './trip-table.css',
})
export class TripTable {
  rows = input.required<AnalysisRow[]>();
  windowMonths = input.required<number>();
  tripColors = input<Map<Trip, TripColor>>(new Map());
  hoveredTrip = model<Trip | null>(null);

  protected hasNotes = computed(() => this.rows().some((r) => r.trip.notes));

  constructor(private dateParser: DateParserService) {}

  protected fmt(date: Date): string {
    return this.dateParser.formatDate(date);
  }

  protected getRowStyle(trip: Trip): Record<string, string> {
    const color = this.tripColors().get(trip);
    if (!color || this.hoveredTrip() !== trip) return {};
    return { 'background-color': color.badgeBg, 'border-left-color': color.bar };
  }

  protected onRowMouseEnter(trip: Trip): void {
    this.hoveredTrip.set(trip);
  }

  protected onRowMouseLeave(): void {
    this.hoveredTrip.set(null);
  }
}
