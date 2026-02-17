import { Component, input } from '@angular/core';
import { AnalysisRow } from '../../models/trip.model';
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

  constructor(private dateParser: DateParserService) {}

  protected fmt(date: Date): string {
    return this.dateParser.formatDate(date);
  }
}
