import {
  Component,
  input,
  signal,
  computed,
  inject,
  AfterViewInit,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import { scaleTime } from 'd3-scale';
import { extent } from 'd3-array';
import { timeFormat } from 'd3-time-format';
import { Trip, Config, StatusResult } from '../../models/trip.model';
import { CalculatorService } from '../../services/calculator.service';

// ── Layout constants ──────────────────────────────────────────────────────────

const MARGIN_TOP_BASE = 12;
const NOTE_ANGLE = -45; // degrees
const SIN45 = Math.sin(Math.PI / 4); // ≈ 0.707
const NOTE_BADGE_HEIGHT = 14;
const WINDOW_LABEL_ROW = 38; // vertical space for first badge row (includes 2-line stats badge)
const STATS_ROW_HEIGHT = 34; // extra row when stats don't fit between badges
const MARGIN = { right: 16, bottom: 36, left: 16 };
const BAR_HEIGHT = 20;
const BAR_GAP = 6;
const LANE_STEP = BAR_HEIGHT + BAR_GAP;
const MIN_LABEL_WIDTH = 36; // px; hide label if bar is narrower

// ── Helpers ───────────────────────────────────────────────────────────────────

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function snapToUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// ── Color palette ────────────────────────────────────────────────────────────

interface TripColor {
  bar: string;
  barFaded: string;
  barHover: string;
  badgeBg: string;
  badgeBgFaded: string;
  badgeBgHover: string;
  badgeStroke: string;
  badgeStrokeFaded: string;
  badgeStrokeHover: string;
  badgeText: string;
  badgeTextFaded: string;
  badgeTextHover: string;
}

function makeTripColor(base: string, light: string, lighter: string, faded: string): TripColor {
  return {
    bar: base,
    barFaded: faded,
    barHover: base,
    badgeBg: lighter,
    badgeBgFaded: lighter,
    badgeBgHover: light,
    badgeStroke: light,
    badgeStrokeFaded: faded,
    badgeStrokeHover: base,
    badgeText: base,
    badgeTextFaded: light,
    badgeTextHover: base,
  };
}

// Winter: cold blues & purples
const WINTER_PALETTE: TripColor[] = [
  makeTripColor('#3b82f6', '#93c5fd', '#eff6ff', '#bfdbfe'),
  makeTripColor('#6366f1', '#a5b4fc', '#eef2ff', '#c7d2fe'),
  makeTripColor('#8b5cf6', '#c4b5fd', '#f5f3ff', '#ddd6fe'),
  makeTripColor('#06b6d4', '#67e8f9', '#ecfeff', '#a5f3fc'),
];

// Spring: fresh greens & teals
const SPRING_PALETTE: TripColor[] = [
  makeTripColor('#10b981', '#6ee7b7', '#ecfdf5', '#a7f3d0'),
  makeTripColor('#14b8a6', '#5eead4', '#f0fdfa', '#99f6e4'),
  makeTripColor('#22c55e', '#86efac', '#f0fdf4', '#bbf7d0'),
  makeTripColor('#84cc16', '#bef264', '#f7fee7', '#d9f99d'),
];

// Summer: warm oranges, pinks & yellows
const SUMMER_PALETTE: TripColor[] = [
  makeTripColor('#f59e0b', '#fcd34d', '#fffbeb', '#fde68a'),
  makeTripColor('#f97316', '#fdba74', '#fff7ed', '#fed7aa'),
  makeTripColor('#ef4444', '#fca5a5', '#fef2f2', '#fecaca'),
  makeTripColor('#ec4899', '#f9a8d4', '#fdf2f8', '#fbcfe8'),
];

// Fall: earthy reds, ambers & browns
const FALL_PALETTE: TripColor[] = [
  makeTripColor('#b45309', '#fbbf24', '#fffbeb', '#fde68a'),
  makeTripColor('#dc2626', '#f87171', '#fef2f2', '#fecaca'),
  makeTripColor('#c2410c', '#fb923c', '#fff7ed', '#fed7aa'),
  makeTripColor('#a16207', '#facc15', '#fefce8', '#fef08a'),
];

const SEASON_PALETTES = [WINTER_PALETTE, SPRING_PALETTE, SUMMER_PALETTE, FALL_PALETTE];

function getSeason(date: Date): number {
  const month = date.getUTCMonth(); // 0-11
  if (month >= 2 && month <= 4) return 1; // Spring: Mar-May
  if (month >= 5 && month <= 7) return 2; // Summer: Jun-Aug
  if (month >= 8 && month <= 10) return 3; // Fall: Sep-Nov
  return 0; // Winter: Dec-Feb
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TripBar {
  x: number;
  width: number;
  lane: number;
  inWindow: boolean;
  tripColor: TripColor;
  trip: Trip;
  labelVisible: boolean;
  noteRow: number; // 0-based row index for stacking note labels; -1 = no note
  noteWidth: number; // estimated pixel width of the note badge
  noteX: number; // x position of the badge anchor (may be shifted right to avoid overlap)
}

export interface AxisTick {
  x: number;
  label: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-trip-timeline',
  imports: [],
  templateUrl: './trip-timeline.html',
  styleUrl: './trip-timeline.css',
})
export class TripTimeline implements AfterViewInit, OnDestroy {
  trips = input.required<Trip[]>();
  config = input.required<Config>();
  status = input.required<StatusResult>();

  private calculator = inject(CalculatorService);
  private host = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = null;

  protected chartWidth = signal(0); // updated by ResizeObserver; 0 = not yet measured
  protected hoverDate = signal<Date | null>(null);
  protected hoveredTrip = signal<Trip | null>(null);

  // ── Date extent (X domain) ────────────────────────────────────────────────

  private dateExtent = computed<[Date, Date]>(() => {
    const trips = this.trips();
    const today = utcMidnight(new Date());
    const [earliest, latest] = extent(trips, (t) => t.start.getTime());
    const start = earliest != null ? new Date(earliest) : today;
    const end = latest != null ? new Date(Math.max(latest as number, today.getTime())) : today;
    // Add small padding (2% of range) so bars don't touch the edges
    const range = end.getTime() - start.getTime();
    const pad = Math.max(range * 0.02, 7 * 86400000); // at least 7 days
    return [new Date(start.getTime() - pad), new Date(end.getTime() + pad)];
  });

  // ── D3 scale ──────────────────────────────────────────────────────────────

  protected xScale = computed(() => {
    const w = this.chartWidth();
    const innerW = w - MARGIN.left - MARGIN.right;
    const [start, end] = this.dateExtent();
    return scaleTime().domain([start, end]).range([0, innerW]);
  });

  // ── Active window (hover-driven or status default) ────────────────────────

  protected activeWindowEnd = computed<Date>(() => {
    const hd = this.hoverDate();
    if (!hd) return this.status().windowEnd;
    // Center the rolling window on the cursor: end = hover + half the window
    const halfMonths = this.config().windowMonths / 2;
    return this.calculator.addMonths(hd, Math.ceil(halfMonths));
  });

  protected activeWindowStart = computed<Date>(() => {
    return this.calculator.addMonths(this.activeWindowEnd(), -this.config().windowMonths);
  });

  protected activeStatus = computed(() => {
    const hd = this.hoverDate();
    if (!hd) return this.status();
    return this.calculator.calculateStatus(this.trips(), {
      ...this.config(),
      customDate: this.activeWindowEnd(),
    });
  });

  // ── Lane assignment (greedy stacking) ────────────────────────────────────

  private tripLanes = computed<Map<Trip, number>>(() => {
    const sorted = [...this.trips()].sort(
      (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
    );
    const laneEndTimes: number[] = [];
    const map = new Map<Trip, number>();

    for (const trip of sorted) {
      let lane = laneEndTimes.findIndex((endTime) => endTime < trip.start.getTime());
      if (lane === -1) {
        lane = laneEndTimes.length;
        laneEndTimes.push(0);
      }
      laneEndTimes[lane] = trip.end.getTime();
      map.set(trip, lane);
    }
    return map;
  });

  protected laneCount = computed(() => {
    const lanes = this.tripLanes();
    if (lanes.size === 0) return 1;
    return Math.max(...lanes.values()) + 1;
  });

  // ── SVG dimensions ────────────────────────────────────────────────────────

  protected marginTop = computed(() => {
    // The top-right corner of a rotated badge extends upward by (noteX - barX + noteWidth) * sin(45°)
    // since the badge is shifted right from the bar, its top corner is higher
    const bars = this.tripBarsWithNotes();
    let maxUpward = 0;
    for (const b of bars) {
      if (b.noteRow < 0) continue;
      // Badge anchor is at noteX; its top-right corner is at noteX + noteWidth * cos45 horizontally
      // and noteWidth * sin45 above the anchor vertically. But since the anchor itself is at
      // -(NOTE_BADGE_HEIGHT * SIN45) above bar area, we need the max noteWidth * SIN45.
      const upward = b.noteWidth * SIN45;
      if (upward > maxUpward) maxUpward = upward;
    }
    const noteHeight = maxUpward > 0 ? maxUpward + 2 : 0;
    return MARGIN_TOP_BASE + noteHeight;
  });

  protected barAreaHeight = computed(() => this.laneCount() * LANE_STEP);

  protected svgHeight = computed(() => {
    return (
      this.marginTop() +
      this.barAreaHeight() +
      WINDOW_LABEL_ROW +
      this.statsBadgeRowOffset() +
      MARGIN.bottom
    );
  });

  protected innerWidth = computed(() => this.chartWidth() - MARGIN.left - MARGIN.right);

  protected MARGIN = MARGIN;
  protected BAR_HEIGHT = BAR_HEIGHT;
  protected LANE_STEP = LANE_STEP;
  protected NOTE_ANGLE = NOTE_ANGLE;
  protected NOTE_BADGE_HEIGHT = NOTE_BADGE_HEIGHT;
  protected NOTE_ANCHOR_Y = Math.round(NOTE_BADGE_HEIGHT * SIN45 * 10) / 10; // badge bottom-left offset
  protected WINDOW_LABEL_ROW = WINDOW_LABEL_ROW;

  // ── Trip bars ─────────────────────────────────────────────────────────────

  protected tripBars = computed<TripBar[]>(() => {
    const scale = this.xScale();
    const lanes = this.tripLanes();
    const wStart = this.activeWindowStart();
    const wEnd = this.activeWindowEnd();

    // Track per-season color index for cycling
    const seasonCounters = [0, 0, 0, 0];

    return this.trips().map((trip) => {
      const x = scale(trip.start);
      const x2 = scale(trip.end);
      const width = Math.max(x2 - x, 2);
      const lane = lanes.get(trip) ?? 0;
      const inWindow = trip.end >= wStart && trip.start <= wEnd;

      const season = getSeason(trip.start);
      const palette = SEASON_PALETTES[season];
      const tripColor = palette[seasonCounters[season] % palette.length];
      seasonCounters[season]++;

      return {
        x,
        width,
        lane,
        inWindow,
        tripColor,
        trip,
        labelVisible: width >= MIN_LABEL_WIDTH,
        noteRow: -1,
        noteWidth: 0,
        noteX: 0,
      };
    });
  });

  // ── Note badge sizing ──────────────────────────────────────────────────────

  private NOTE_CHAR_WIDTH = 6; // approximate px per character at 10px font
  private NOTE_PAD = 12; // horizontal padding inside note badge

  protected tripBarsWithNotes = computed<TripBar[]>(() => {
    const bars = this.tripBars();
    const NOTE_GAP = 4; // minimum horizontal gap between projected badge extents

    // First pass: compute noteWidth for bars with notes
    const withNotes = bars.map((bar) => {
      if (!bar.trip.notes) return bar;
      const noteWidth = bar.trip.notes.length * this.NOTE_CHAR_WIDTH + this.NOTE_PAD;
      return { ...bar, noteRow: 0, noteWidth, noteX: bar.x };
    });

    // Collect only the bars that have notes, sorted by x position
    const noted = withNotes
      .map((b, i) => ({ bar: b, idx: i }))
      .filter(({ bar }) => bar.noteRow >= 0)
      .sort((a, b) => a.bar.noteX - b.bar.noteX);

    // Second pass: shift badges right to avoid overlap
    // The badge rect (0,0)→(W,H) is rotated -45° at the anchor point.
    // Bottom-left corner (0,H) rotated -45° lands at x = H·sin45 right of anchor.
    // Top-left corner (0,0) is at the anchor itself.
    // So the next badge's anchor must be past the previous badge's bottom-left,
    // i.e. spacing = H·sin45 + H·cos45 = H·(sin45+cos45) = H·√2 ≈ H·1.414
    // because the top-right corner of the next badge (at y=0) would touch the
    // bottom-left of the previous badge (at y=H rotated).
    const minSpacing = NOTE_BADGE_HEIGHT * (SIN45 + SIN45) + NOTE_GAP; // H·√2 + gap
    let prevAnchorX = -Infinity;
    for (const { bar, idx } of noted) {
      const minX = prevAnchorX + minSpacing;
      if (bar.noteX < minX) {
        bar.noteX = minX;
        withNotes[idx] = bar;
      }
      prevAnchorX = bar.noteX;
    }

    return withNotes;
  });

  // ── Window rectangle ──────────────────────────────────────────────────────

  protected windowRect = computed(() => {
    const scale = this.xScale();
    const innerW = this.innerWidth();
    const rawX = scale(this.activeWindowStart());
    const rawX2 = scale(this.activeWindowEnd());
    const x = Math.max(0, rawX);
    const x2 = Math.min(innerW, rawX2);
    return { x, width: Math.max(0, x2 - x) };
  });

  // ── Axis ticks ────────────────────────────────────────────────────────────

  protected axisTicks = computed<AxisTick[]>(() => {
    const scale = this.xScale();
    const fmt = timeFormat('%b %Y');
    return scale.ticks(8).map((d) => ({ x: scale(d), label: fmt(d) }));
  });

  // ── Marker lines ──────────────────────────────────────────────────────────

  protected todayX = computed(() => this.xScale()(utcMidnight(new Date())));
  protected windowStartX = computed(() => this.xScale()(this.activeWindowStart()));
  protected windowEndX = computed(() => this.xScale()(this.activeWindowEnd()));

  // ── Badge positions (clamped to visible area) ─────────────────────────────

  private BADGE_W = 72;

  protected startBadgeX = computed(() => {
    const x = this.windowStartX();
    const half = this.BADGE_W / 2;
    return Math.max(half, Math.min(this.innerWidth() - half, x));
  });

  protected endBadgeX = computed(() => {
    const x = this.windowEndX();
    const half = this.BADGE_W / 2;
    return Math.max(half, Math.min(this.innerWidth() - half, x));
  });

  protected startBadgeArrowVisible = computed(() => {
    const x = this.windowStartX();
    return x >= 0 && x <= this.innerWidth();
  });

  protected endBadgeArrowVisible = computed(() => {
    const x = this.windowEndX();
    return x >= 0 && x <= this.innerWidth();
  });

  // ── Stats badge position ──────────────────────────────────────────────────

  private STATS_W = 90;

  protected statsBadgeFitsInline = computed(() => {
    const gap = this.endBadgeX() - this.startBadgeX() - this.BADGE_W;
    return gap >= this.STATS_W;
  });

  protected statsBadgeX = computed(() => {
    if (this.statsBadgeFitsInline()) {
      // Center between the two date badges
      return (this.startBadgeX() + this.endBadgeX()) / 2;
    }
    // Center on the window midpoint, clamped to visible area
    const windowMidX = (this.windowStartX() + this.windowEndX()) / 2;
    const half = this.STATS_W / 2;
    return Math.max(half, Math.min(this.innerWidth() - half, windowMidX));
  });

  protected statsBadgeRowOffset = computed(() => {
    return this.statsBadgeFitsInline() ? 0 : STATS_ROW_HEIGHT;
  });

  // ── Info panel formatting ─────────────────────────────────────────────────

  protected infoDaysOutside = computed(() => this.activeStatus().totalDaysOutside);
  protected infoDaysRemaining = computed(() => this.activeStatus().daysRemaining);
  protected infoStatus = computed(() => this.activeStatus().status);
  protected infoWindowStart = computed(() => this.activeStatus().windowStart);
  protected infoWindowEnd = computed(() => this.activeStatus().windowEnd);
  protected infoLimit = computed(() => this.config().absenceLimit);

  protected progressPct = computed(() => {
    const used = this.infoDaysOutside();
    const limit = this.infoLimit();
    return Math.min(100, Math.round((used / limit) * 100));
  });

  protected progressColor = computed(() => {
    const s = this.infoStatus();
    return s === 'exceeded' ? '#dc2626' : s === 'caution' ? '#d97706' : '#2563eb';
  });

  protected formatDate(d: Date): string {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }

  protected statusLabel = computed(() => {
    const s = this.infoStatus();
    return s === 'exceeded'
      ? 'Limit exceeded'
      : s === 'caution'
        ? 'Approaching limit'
        : 'Within limit';
  });

  protected statusDotColor = computed(() => {
    const s = this.infoStatus();
    return s === 'exceeded' ? '#dc2626' : s === 'caution' ? '#d97706' : '#16a34a';
  });

  protected statsBadgeBg = computed(() => {
    const s = this.infoStatus();
    return s === 'exceeded' ? '#fef2f2' : s === 'caution' ? '#fffbeb' : '#f0fdf4';
  });

  protected statsBadgeStroke = computed(() => {
    const s = this.infoStatus();
    return s === 'exceeded' ? '#fca5a5' : s === 'caution' ? '#fcd34d' : '#86efac';
  });

  protected statsBadgeTextColor = computed(() => {
    const s = this.infoStatus();
    return s === 'exceeded' ? '#dc2626' : s === 'caution' ? '#b45309' : '#16a34a';
  });

  // ── Hover interaction ─────────────────────────────────────────────────────

  private updateHover(x: number, y: number): void {
    const scale = this.xScale();
    const date = snapToUTCMidnight(scale.invert(x));
    this.hoverDate.set(date);

    // Find trip bar or note badge under cursor (y is relative to the <g> transform)
    const bars = this.tripBarsWithNotes();

    // Check trip bars first (when cursor is in the bar area)
    if (y >= 0) {
      const hit = bars.find((bar) => {
        const barY = bar.lane * LANE_STEP;
        return x >= bar.x && x <= bar.x + bar.width && y >= barY && y <= barY + BAR_HEIGHT;
      });
      this.hoveredTrip.set(hit?.trip ?? null);
      return;
    }

    // Above the bar area: check rotated note badges
    // The badge is placed at translate(noteX, -NOTE_ANCHOR_Y) rotate(-45).
    // To test if cursor is inside, apply inverse transform: translate then rotate(+45).
    const badgeHit = bars.find((bar) => {
      if (bar.noteRow < 0) return false;
      const dx = x - bar.noteX;
      const dy = y + this.NOTE_ANCHOR_Y; // y - (-NOTE_ANCHOR_Y)
      // Inverse of rotate(-45°): localX = (dx - dy) * SIN45, localY = (dx + dy) * SIN45
      const localX = (dx - dy) * SIN45;
      const localY = (dx + dy) * SIN45;
      return localX >= 0 && localX <= bar.noteWidth && localY >= 0 && localY <= NOTE_BADGE_HEIGHT;
    });
    this.hoveredTrip.set(badgeHit?.trip ?? null);
  }

  protected onMouseMove(event: MouseEvent): void {
    const svg = (event.currentTarget as SVGElement).closest('svg')!;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left - MARGIN.left;
    const y = event.clientY - rect.top - this.marginTop();
    this.updateHover(x, y);
  }

  protected onDebugClick(event: MouseEvent): void {
    const svg = (event.currentTarget as SVGElement).closest('svg')!;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left - MARGIN.left;
    const y = event.clientY - rect.top - this.marginTop();
    console.log(`Click at g-space: (${x.toFixed(1)}, ${y.toFixed(1)})`);
    const bars = this.tripBarsWithNotes();
    for (const bar of bars) {
      if (bar.noteRow < 0) continue;
      const dx = x - bar.noteX;
      const dy = y + this.NOTE_ANCHOR_Y;
      const localX = (dx - dy) * SIN45;
      const localY = (dx + dy) * SIN45;
      const hit =
        localX >= 0 && localX <= bar.noteWidth && localY >= 0 && localY <= NOTE_BADGE_HEIGHT;
      console.log(
        `  "${bar.trip.notes}" noteX=${bar.noteX.toFixed(1)} anchorY=${(-this.NOTE_ANCHOR_Y).toFixed(1)} dx=${dx.toFixed(1)} dy=${dy.toFixed(1)} local=(${localX.toFixed(1)},${localY.toFixed(1)}) bounds=(${bar.noteWidth},${NOTE_BADGE_HEIGHT}) ${hit ? 'HIT' : ''}`,
      );
    }
  }

  protected onMouseLeave(): void {
    this.hoverDate.set(null);
    this.hoveredTrip.set(null);
  }

  protected onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const x = touch.clientX - rect.left - MARGIN.left;
    const y = touch.clientY - rect.top - this.marginTop();
    this.updateHover(x, y);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    const container = this.host.nativeElement.querySelector('.timeline-container');
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) this.chartWidth.set(width);
    });
    this.resizeObserver.observe(container);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
