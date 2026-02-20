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

const MARGIN = { top: 12, right: 16, bottom: 36, left: 16 };
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

// ── Types ────────────────────────────────────────────────────────────────────

export interface TripBar {
  x: number;
  width: number;
  lane: number;
  inWindow: boolean;
  color: string;
  trip: Trip;
  labelVisible: boolean;
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

  protected chartWidth = signal(600); // updated by ResizeObserver
  protected hoverDate = signal<Date | null>(null);

  // ── Date extent (X domain) ────────────────────────────────────────────────

  private dateExtent = computed<[Date, Date]>(() => {
    const trips = this.trips();
    const today = utcMidnight(new Date());
    const [earliest, latest] = extent(trips, (t) => t.start.getTime());
    const start = earliest != null ? new Date(earliest) : today;
    const end = latest != null ? new Date(Math.max((latest as number), today.getTime())) : today;
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
    return this.hoverDate() ?? this.status().windowEnd;
  });

  protected activeWindowStart = computed<Date>(() => {
    return this.calculator.addMonths(this.activeWindowEnd(), -this.config().windowMonths);
  });

  protected activeStatus = computed(() => {
    const hd = this.hoverDate();
    if (!hd) return this.status();
    return this.calculator.calculateStatus(this.trips(), {
      ...this.config(),
      customDate: hd,
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

  protected svgHeight = computed(() => {
    return MARGIN.top + this.laneCount() * LANE_STEP + MARGIN.bottom;
  });

  protected innerWidth = computed(() => this.chartWidth() - MARGIN.left - MARGIN.right);

  protected MARGIN = MARGIN;
  protected BAR_HEIGHT = BAR_HEIGHT;
  protected LANE_STEP = LANE_STEP;

  // ── Trip bars ─────────────────────────────────────────────────────────────

  protected tripBars = computed<TripBar[]>(() => {
    const scale = this.xScale();
    const lanes = this.tripLanes();
    const wStart = this.activeWindowStart();
    const wEnd = this.activeWindowEnd();
    const status = this.activeStatus();

    return this.trips().map((trip) => {
      const x = scale(trip.start);
      const x2 = scale(trip.end);
      const width = Math.max(x2 - x, 2);
      const lane = lanes.get(trip) ?? 0;

      const inWindow = trip.end >= wStart && trip.start <= wEnd;
      let color: string;
      if (!inWindow) {
        color = '#d1d5db'; // grey
      } else if (status.status === 'exceeded') {
        color = '#dc2626'; // red
      } else if (status.status === 'caution') {
        color = '#d97706'; // amber
      } else {
        color = '#2563eb'; // blue
      }

      return { x, width, lane, inWindow, color, trip, labelVisible: width >= MIN_LABEL_WIDTH };
    });
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
    return s === 'exceeded' ? 'Limit exceeded' : s === 'caution' ? 'Approaching limit' : 'Within limit';
  });

  protected statusDotColor = computed(() => {
    const s = this.infoStatus();
    return s === 'exceeded' ? '#dc2626' : s === 'caution' ? '#d97706' : '#16a34a';
  });

  // ── Hover interaction ─────────────────────────────────────────────────────

  protected onMouseMove(event: MouseEvent): void {
    const raw = event.offsetX - MARGIN.left;
    const scale = this.xScale();
    const date = snapToUTCMidnight(scale.invert(raw));
    this.hoverDate.set(date);
  }

  protected onMouseLeave(): void {
    this.hoverDate.set(null);
  }

  protected onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const raw = touch.clientX - rect.left - MARGIN.left;
    const scale = this.xScale();
    const date = snapToUTCMidnight(scale.invert(raw));
    this.hoverDate.set(date);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) this.chartWidth.set(width);
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
