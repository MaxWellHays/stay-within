import {
  Component,
  OnInit,
  model,
  output,
  input,
  ElementRef,
  viewChild,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CsvParserService } from '../../services/csv-parser.service';
import { Trip } from '../../models/trip.model';
import { TripColor } from '../../utils/trip-colors';

type InputMode = 'text' | 'table' | 'file';

interface TableRow {
  startStr: string; // YYYY-MM-DD for <input type="date">
  endStr: string;
  notes: string;
}

function emptyRow(): TableRow {
  return { startStr: '', endStr: '', notes: '' };
}

function tripToRow(trip: Trip): TableRow {
  return {
    startStr: trip.start.toISOString().slice(0, 10),
    endStr: trip.end.toISOString().slice(0, 10),
    notes: trip.notes ?? '',
  };
}

function rowDays(row: TableRow): number | null {
  if (!row.startStr || !row.endStr) return null;
  const start = new Date(row.startStr + 'T00:00:00Z').getTime();
  const end = new Date(row.endStr + 'T00:00:00Z').getTime();
  const days = Math.floor((end - start) / 86400000) + 1;
  return days > 0 ? days : null;
}

// Convert YYYY-MM-DD (date input value) to dd.mm.yyyy (CSV format)
function inputToDisplay(str: string): string {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

const EXAMPLE_DATA = `Start,End,Notes
25.05.2023,10.08.2023,Summer holiday
15.09.2023,20.09.2023,Business trip
24.12.2023,04.01.2024,Christmas & New Year
05.01.2024,15.01.2024,Winter break
30.03.2024,03.04.2024,Easter weekend
07.04.2024,20.04.2024,Spring holiday
10.05.2024,12.05.2024,Long weekend
24.05.2024,01.06.2024,Lisbon conference
10.06.2024,16.06.2024,Family visit
05.07.2024,08.08.2024,Summer vacation 2024
14.08.2024,20.08.2024,Late summer trip
14.12.2024,24.12.2024,Pre-Christmas
26.12.2024,05.01.2025,New Year break
17.01.2025,20.01.2025,Weekend away
06.04.2025,28.04.2025,Easter & spring
16.06.2025,08.08.2025,Summer 2025
06.09.2025,13.09.2025,Autumn break
12.10.2025,30.10.2025,Autumn trip`;

@Component({
  selector: 'app-trip-input',
  imports: [],
  templateUrl: './trip-input.html',
  styleUrl: './trip-input.css',
})
export class TripInput implements OnInit {
  tripText = model('');
  textChanged = output<string>();
  shareUrl = input<string | null>(null);
  trips = input<Trip[]>([]);
  tripColors = input<Map<Trip, TripColor>>(new Map());
  hoveredTrip = model<Trip | null>(null);

  protected copyUrlLabel = signal('Copy URL');

  private static readonly MODE_KEY = 'stay-within-input-mode';

  protected mode = signal<InputMode>(
    (localStorage.getItem(TripInput.MODE_KEY) as InputMode | null) ?? 'table',
  );
  protected tableRows = signal<TableRow[]>([emptyRow()]);
  protected dragging = signal(false);
  protected computeRowDays = rowDays;
  protected isRowInvalid = (row: TableRow) =>
    !!row.startStr && !!row.endStr && rowDays(row) === null;

  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');
  private csvParser = inject(CsvParserService);

  constructor() {
    // Sync tripText → textarea DOM value when an external change arrives
    // (e.g. initial load from localStorage, Load Example, Clear).
    // Direct DOM assignment avoids resetting cursor position on user keystrokes
    // because we only write when the value actually differs.
    effect(() => {
      const el = this.textareaEl()?.nativeElement;
      const text = this.tripText();
      if (el && el.value !== text) {
        el.value = text;
      }
    });
  }

  ngOnInit(): void {
    // If the persisted mode is 'table', populate tableRows from the tripText
    // that the parent has already restored from localStorage. Without this,
    // tableRows stays at [emptyRow()] because setMode('table') is never called
    // when the mode hasn't changed.
    if (this.mode() === 'table') {
      const trips = this.csvParser.parseTripsFromText(this.tripText());
      if (trips.length > 0) {
        this.tableRows.set(trips.map(tripToRow));
      }
    }
  }

  // ── Mode switching ────────────────────────────────────────────────────────

  setMode(newMode: InputMode): void {
    if (newMode === this.mode()) return;

    if (newMode === 'table') {
      // Parse current text into table rows
      const trips = this.csvParser.parseTripsFromText(this.tripText());
      this.tableRows.set(trips.length > 0 ? trips.map(tripToRow) : [emptyRow()]);
    } else if (this.mode() === 'table') {
      // Serialize table back to text before leaving table mode
      const text = this.serializeRows();
      this.tripText.set(text);
      this.textChanged.emit(text);
    }

    this.mode.set(newMode);
    localStorage.setItem(TripInput.MODE_KEY, newMode);
  }

  // ── Toolbar actions ───────────────────────────────────────────────────────

  loadExample(): void {
    const trips = this.csvParser.parseTripsFromText(EXAMPLE_DATA);
    this.tripText.set(EXAMPLE_DATA);
    this.textChanged.emit(EXAMPLE_DATA);
    if (this.mode() === 'table') {
      this.tableRows.set(trips.map(tripToRow));
    } else if (this.mode() === 'file') {
      this.mode.set('text');
    }
  }

  clear(): void {
    this.tableRows.set([emptyRow()]);
    this.tripText.set('');
    this.textChanged.emit('');
  }

  copyUrl(): void {
    const url = this.shareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => {
        this.copyUrlLabel.set('Copied!');
        setTimeout(() => this.copyUrlLabel.set('Copy URL'), 2000);
      },
      () => prompt('Copy this link to share your trips:', url),
    );
  }

  exportCsv(): void {
    const text = this.mode() === 'table' ? this.serializeRows() : this.tripText();
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trips.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  protected hasData = computed(() => {
    if (this.mode() === 'table') return this.tableRows().some((r) => r.startStr && r.endStr);
    return this.tripText().trim().length > 0;
  });

  // ── Text mode ─────────────────────────────────────────────────────────────

  onTextInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    // Notify parent directly — don't call tripText.set() here to avoid a
    // signal write that would re-trigger the textarea effect mid-keystroke.
    this.textChanged.emit(value);
  }

  // ── Table editing ─────────────────────────────────────────────────────────

  addRow(): void {
    this.tableRows.update((rows) => [...rows, emptyRow()]);
  }

  deleteRow(index: number): void {
    this.tableRows.update((rows) => {
      const updated = rows.filter((_, i) => i !== index);
      return updated.length > 0 ? updated : [emptyRow()];
    });
    this.emitFromTable();
  }

  onDateChange(index: number, field: 'startStr' | 'endStr', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tableRows.update((rows) => {
      const updated = [...rows];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    this.emitFromTable();
  }

  onNotesChange(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tableRows.update((rows) => {
      const updated = [...rows];
      updated[index] = { ...updated[index], notes: value };
      return updated;
    });
    this.emitFromTable();
  }

  // ── File handling ─────────────────────────────────────────────────────────

  onFileClick(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.readFile(input.files[0]);
      input.value = ''; // Allow re-selecting the same file
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(): void {
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.readFile(file);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const trips = this.csvParser.parseTripsFromText(text);
      this.tableRows.set(trips.length > 0 ? trips.map(tripToRow) : [emptyRow()]);
      this.tripText.set(text);
      this.textChanged.emit(text);
      this.mode.set('table');
    };
    reader.readAsText(file);
  }

  private serializeRows(): string {
    const validRows = this.tableRows().filter((r) => r.startStr && r.endStr);
    if (validRows.length === 0) return '';
    const hasNotes = validRows.some((r) => r.notes.trim());
    const header = hasNotes ? 'Start,End,Notes' : 'Start,End';
    const lines = validRows.map((r) => {
      const start = inputToDisplay(r.startStr);
      const end = inputToDisplay(r.endStr);
      return hasNotes ? `${start},${end},${r.notes}` : `${start},${end}`;
    });
    return [header, ...lines].join('\n');
  }

  // ── Row hover (bidirectional highlight with timeline) ─────────────────────

  /** Returns the Trip corresponding to tableRows()[rowIndex], or null if the row is invalid. */
  protected getTripForRow(rowIndex: number): Trip | null {
    const rows = this.tableRows();
    if (!rows[rowIndex]?.startStr || !rows[rowIndex]?.endStr) return null;
    // Count valid rows before this index to get the trip index
    let tripIdx = 0;
    for (let i = 0; i < rowIndex; i++) {
      if (rows[i].startStr && rows[i].endStr) tripIdx++;
    }
    return this.trips()[tripIdx] ?? null;
  }

  protected getRowStyle(rowIndex: number): Record<string, string> {
    const trip = this.getTripForRow(rowIndex);
    if (!trip || this.hoveredTrip() !== trip) return {};
    const color = this.tripColors().get(trip);
    if (!color) return {};
    return { 'background-color': color.badgeBg, 'border-left-color': color.bar };
  }

  protected onRowMouseEnter(rowIndex: number): void {
    this.hoveredTrip.set(this.getTripForRow(rowIndex));
  }

  protected onRowMouseLeave(): void {
    this.hoveredTrip.set(null);
  }

  private emitFromTable(): void {
    const text = this.serializeRows();
    this.tripText.set(text);
    this.textChanged.emit(text);
  }
}
