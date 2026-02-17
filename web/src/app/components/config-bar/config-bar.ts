import { Component, output, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Config } from '../../models/trip.model';
import { DateParserService } from '../../services/date-parser.service';

interface Preset {
  label: string;
  window: number;
  limit: number;
}

const PRESETS: Preset[] = [
  { label: 'UK (12mo / 180d)', window: 12, limit: 180 },
  { label: 'Schengen (6mo / 90d)', window: 6, limit: 90 },
  { label: 'US B1/B2 (12mo / 182d)', window: 12, limit: 182 },
];

@Component({
  selector: 'app-config-bar',
  imports: [FormsModule],
  templateUrl: './config-bar.html',
  styleUrl: './config-bar.css',
})
export class ConfigBar {
  windowMonths = model(12);
  absenceLimit = model(180);
  customDateStr = model('');

  configChanged = output<Config>();

  presets = PRESETS;

  constructor(private dateParser: DateParserService) {}

  applyPreset(preset: Preset) {
    this.windowMonths.set(preset.window);
    this.absenceLimit.set(preset.limit);
    this.emitConfig();
  }

  emitConfig() {
    const customDate = this.customDateStr()
      ? (this.dateParser.parseDate(this.customDateStr()) ?? undefined)
      : undefined;

    this.configChanged.emit({
      windowMonths: this.windowMonths(),
      absenceLimit: this.absenceLimit(),
      customDate,
    });
  }
}
