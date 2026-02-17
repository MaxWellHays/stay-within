import { Injectable } from '@angular/core';
import { Trip, Config, AnalysisRow, StatusResult, StatusLevel } from '../models/trip.model';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class CalculatorService {

  /**
   * Add months to a date with day-overflow clamping.
   * Matches Go implementation exactly — does NOT use Date.setMonth().
   */
  addMonths(date: Date, months: number): Date {
    let year = date.getFullYear();
    let month = date.getMonth() + 1 + months; // 1-based month
    const day = date.getDate();

    // Normalize year and month (matching Go's loop logic)
    while (month > 12) {
      month -= 12;
      year++;
    }
    while (month < 1) {
      month += 12;
      year--;
    }

    // Get max days in target month (day 0 of next month = last day of this month)
    const maxDay = new Date(year, month, 0).getDate();
    const clampedDay = Math.min(day, maxDay);

    return new Date(year, month - 1, clampedDay);
  }

  /**
   * Calculate total absence days within a rolling window.
   * For each trip, counts overlapping days (inclusive) with the window.
   */
  calculateDaysInWindow(trips: Trip[], windowStart: Date, windowEnd: Date): number {
    let totalDays = 0;

    for (const trip of trips) {
      // Check if trip overlaps with window
      if (trip.end < windowStart || trip.start > windowEnd) continue;

      // Calculate overlap
      const overlapStart = trip.start > windowStart ? trip.start : windowStart;
      const overlapEnd = trip.end < windowEnd ? trip.end : windowEnd;

      // Inclusive day count
      const daysInOverlap = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY) + 1;

      totalDays += daysInOverlap;
    }

    return totalDays;
  }

  /**
   * Generate per-trip analysis rows.
   * For each trip, calculates days in the rolling window ending on that trip's end date.
   */
  analyzeTrips(trips: Trip[], config: Config): AnalysisRow[] {
    return trips.map(trip => {
      const windowStart = this.addMonths(trip.end, -config.windowMonths);
      const daysInWindow = this.calculateDaysInWindow(trips, windowStart, trip.end);
      const daysRemaining = config.absenceLimit - daysInWindow;

      return { trip, daysInWindow, daysRemaining };
    });
  }

  /**
   * Calculate current or estimated status.
   * Matches Go's displayCurrentStatus logic.
   */
  calculateStatus(trips: Trip[], config: Config): StatusResult {
    const targetDate = config.customDate ?? new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    );

    const windowStart = this.addMonths(targetDate, -config.windowMonths);
    const lastTrip = trips[trips.length - 1];

    // Days since last trip: int(targetDate.Sub(lastTrip.End).Hours() / 24)
    const daysSinceLastTrip = Math.floor(
      (targetDate.getTime() - lastTrip.end.getTime()) / MS_PER_DAY
    );

    const totalDaysOutside = this.calculateDaysInWindow(trips, windowStart, targetDate);
    const daysRemaining = config.absenceLimit - totalDaysOutside;

    // Warning threshold: min(30, ceil(limit * 0.15))
    const warningThreshold = Math.min(30, Math.ceil(config.absenceLimit * 0.15));

    let status: StatusLevel;
    if (daysRemaining < 0) {
      status = 'exceeded';
    } else if (daysRemaining < warningThreshold) {
      status = 'caution';
    } else {
      status = 'ok';
    }

    return {
      targetDate,
      isCustomDate: !!config.customDate,
      lastTripEnd: lastTrip.end,
      daysSinceLastTrip,
      windowStart,
      windowEnd: targetDate,
      totalDaysOutside,
      daysRemaining,
      status,
    };
  }
}
