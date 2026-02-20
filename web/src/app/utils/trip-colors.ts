import { Trip } from '../models/trip.model';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TripColor {
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

// ── Palettes ──────────────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

/** Assigns a TripColor to each trip using seasonal palettes, cycling within each season. */
export function computeTripColors(trips: Trip[]): Map<Trip, TripColor> {
  const seasonCounters = [0, 0, 0, 0];
  const map = new Map<Trip, TripColor>();
  for (const trip of trips) {
    const season = getSeason(trip.start);
    const palette = SEASON_PALETTES[season];
    map.set(trip, palette[seasonCounters[season] % palette.length]);
    seasonCounters[season]++;
  }
  return map;
}
