import { Component, input, computed } from '@angular/core';
import { StatusResult } from '../../models/trip.model';
import { DateParserService } from '../../services/date-parser.service';

@Component({
  selector: 'app-status-card',
  imports: [],
  templateUrl: './status-card.html',
  styleUrl: './status-card.css',
})
export class StatusCard {
  status = input.required<StatusResult>();

  constructor(private dateParser: DateParserService) {}

  protected fmt(date: Date): string {
    return this.dateParser.formatDate(date);
  }

  protected progressPercent = computed(() => {
    const s = this.status();
    const used = s.totalDaysOutside;
    const limit = used + s.daysRemaining;
    if (limit <= 0) return 100;
    return Math.min(100, Math.max(0, (used / limit) * 100));
  });
}
