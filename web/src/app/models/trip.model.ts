export interface Trip {
  start: Date;
  end: Date;
  days: number;
  notes?: string;
}

export interface Config {
  windowMonths: number;
  absenceLimit: number;
  customDate?: Date;
}

export interface AnalysisRow {
  trip: Trip;
  daysInWindow: number;
  daysRemaining: number;
}

export type StatusLevel = 'ok' | 'caution' | 'exceeded';

export interface StatusResult {
  targetDate: Date;
  isCustomDate: boolean;
  lastTripEnd: Date;
  daysSinceLastTrip: number;
  windowStart: Date;
  windowEnd: Date;
  totalDaysOutside: number;
  daysRemaining: number;
  status: StatusLevel;
}
