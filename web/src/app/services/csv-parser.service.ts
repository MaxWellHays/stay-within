import { Injectable } from '@angular/core';
import { Trip } from '../models/trip.model';
import { DateParserService } from './date-parser.service';

@Injectable({ providedIn: 'root' })
export class CsvParserService {

  constructor(private dateParser: DateParserService) {}

  parseTripsFromText(text: string): Trip[] {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    const trips: Trip[] = [];
    let firstRow = true;

    for (const line of lines) {
      // Split on comma or tab to support both CSV and spreadsheet paste
      const cells = line.split(/[,\t]/).map(c => c.trim());

      if (cells.length < 2) continue;

      if (firstRow) {
        firstRow = false;
        if (this.dateParser.isHeaderRow(cells)) continue;
      }

      const startDate = this.dateParser.parseDate(cells[0]);
      const endDate = this.dateParser.parseDate(cells[1]);

      if (!startDate || !endDate) continue;

      // Calculate days (inclusive), matching Go: int(end.Sub(start).Hours()/24) + 1
      const msPerDay = 24 * 60 * 60 * 1000;
      const days = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;

      trips.push({ start: startDate, end: endDate, days });
    }

    // Sort by end date
    trips.sort((a, b) => a.end.getTime() - b.end.getTime());

    return trips;
  }
}
