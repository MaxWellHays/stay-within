import { CalculatorService } from './calculator.service';
import { Trip, Config } from '../models/trip.model';

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function makeTrip(startStr: string, endStr: string): Trip {
  const [sd, sm, sy] = startStr.split('.').map(Number);
  const [ed, em, ey] = endStr.split('.').map(Number);
  const start = utc(sy, sm - 1, sd);
  const end = utc(ey, em - 1, ed);
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return { start, end, days };
}

function makeDate(str: string): Date {
  const [d, m, y] = str.split('.').map(Number);
  return utc(y, m - 1, d);
}

describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(() => {
    service = new CalculatorService();
  });

  describe('addMonths', () => {
    const cases: [string, Date, number, Date][] = [
      ['add 3 months', utc(2023, 0, 15), 3, utc(2023, 3, 15)],
      ['subtract 3 months', utc(2023, 5, 15), -3, utc(2023, 2, 15)],
      ['wrap year forward', utc(2023, 10, 15), 3, utc(2024, 1, 15)],
      ['wrap year backward', utc(2024, 1, 15), -3, utc(2023, 10, 15)],
      ['clamp Mar31 - 1mo', utc(2023, 2, 31), -1, utc(2023, 1, 28)],
      ['clamp leap year', utc(2024, 2, 31), -1, utc(2024, 1, 29)],
      ['clamp Jan31 + 1mo', utc(2023, 0, 31), 1, utc(2023, 1, 28)],
      ['add 12 months', utc(2023, 5, 15), 12, utc(2024, 5, 15)],
      ['subtract 12 months', utc(2024, 5, 15), -12, utc(2023, 5, 15)],
      ['add 0 months', utc(2023, 5, 15), 0, utc(2023, 5, 15)],
    ];

    cases.forEach(([label, input, months, expected]) => {
      it(`should ${label}`, () => {
        expect(service.addMonths(input, months)).toEqual(expected);
      });
    });
  });

  describe('calculateDaysInWindow', () => {
    const fullYear = { start: utc(2023, 0, 1), end: utc(2023, 11, 31) };

    const cases: [string, Trip[], Date, Date, number][] = [
      [
        'trip fully within window',
        [makeTrip('15.03.2023', '20.03.2023')],
        fullYear.start,
        fullYear.end,
        6,
      ],
      [
        'trip starts before window (overlap Jan 1-5)',
        [makeTrip('25.12.2022', '05.01.2023')],
        fullYear.start,
        fullYear.end,
        5,
      ],
      [
        'trip ends after window (overlap Dec 28-31)',
        [makeTrip('28.12.2023', '05.01.2024')],
        fullYear.start,
        fullYear.end,
        4,
      ],
      [
        'trip entirely outside window',
        [makeTrip('15.03.2022', '20.03.2022')],
        fullYear.start,
        fullYear.end,
        0,
      ],
      [
        'multiple trips summed',
        [makeTrip('15.03.2023', '20.03.2023'), makeTrip('10.06.2023', '15.06.2023')],
        fullYear.start,
        fullYear.end,
        12,
      ],
      ['single-day trip', [makeTrip('15.03.2023', '15.03.2023')], fullYear.start, fullYear.end, 1],
      [
        'trip exactly on window boundaries',
        [makeTrip('01.01.2023', '31.12.2023')],
        fullYear.start,
        fullYear.end,
        365,
      ],
    ];

    cases.forEach(([label, trips, windowStart, windowEnd, expected]) => {
      it(`should handle ${label}`, () => {
        expect(service.calculateDaysInWindow(trips, windowStart, windowEnd)).toBe(expected);
      });
    });
  });

  describe('analyzeTrips', () => {
    it('should generate correct analysis rows', () => {
      const trips = [makeTrip('25.05.2023', '10.08.2023'), makeTrip('15.09.2023', '20.09.2023')];
      const rows = service.analyzeTrips(trips, { windowMonths: 12, absenceLimit: 180 });

      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual(expect.objectContaining({ daysInWindow: 78, daysRemaining: 102 }));
      expect(rows[1]).toEqual(expect.objectContaining({ daysInWindow: 84, daysRemaining: 96 }));
    });

    it('should show negative remaining when limit exceeded', () => {
      const rows = service.analyzeTrips([makeTrip('01.01.2023', '30.09.2023')], {
        windowMonths: 12,
        absenceLimit: 180,
      });
      expect(rows[0].daysRemaining).toBeLessThan(0);
    });
  });

  describe('calculateStatus', () => {
    const baseTwoTrips = [
      makeTrip('25.05.2023', '10.08.2023'),
      makeTrip('15.09.2023', '20.09.2023'),
    ];

    const statusCases: [
      string,
      Trip[],
      Config,
      Partial<{ totalDaysOutside: number; daysRemaining: number; status: string }>,
    ][] = [
      [
        'ok status with custom date',
        baseTwoTrips,
        { windowMonths: 12, absenceLimit: 180, customDate: makeDate('15.11.2023') },
        { totalDaysOutside: 84, daysRemaining: 96, status: 'ok' },
      ],
      [
        'exceeded status',
        [makeTrip('01.01.2023', '30.09.2023')],
        { windowMonths: 12, absenceLimit: 180, customDate: makeDate('01.10.2023') },
        { status: 'exceeded' },
      ],
      [
        'caution status (close to limit)',
        [makeTrip('01.01.2023', '04.06.2023')],
        { windowMonths: 12, absenceLimit: 180, customDate: makeDate('15.12.2023') },
        { daysRemaining: 25, status: 'caution' },
      ],
      [
        'Schengen config (6mo/90d)',
        [makeTrip('01.03.2023', '30.04.2023'), makeTrip('01.06.2023', '15.06.2023')],
        { windowMonths: 6, absenceLimit: 90, customDate: makeDate('01.08.2023') },
        { totalDaysOutside: 76, daysRemaining: 14, status: 'ok' },
      ],
    ];

    statusCases.forEach(([label, trips, config, expected]) => {
      it(`should calculate ${label}`, () => {
        const status = service.calculateStatus(trips, config);
        if (expected.totalDaysOutside !== undefined)
          expect(status.totalDaysOutside).toBe(expected.totalDaysOutside);
        if (expected.daysRemaining !== undefined)
          expect(status.daysRemaining).toBe(expected.daysRemaining);
        if (expected.status !== undefined) expect(status.status).toBe(expected.status);
      });
    });

    it('should use today when no custom date provided', () => {
      const status = service.calculateStatus([makeTrip('01.01.2023', '05.01.2023')], {
        windowMonths: 12,
        absenceLimit: 180,
      });
      const today = new Date();
      expect(status.targetDate.getUTCFullYear()).toBe(today.getFullYear());
      expect(status.targetDate.getUTCMonth()).toBe(today.getMonth());
      expect(status.targetDate.getUTCDate()).toBe(today.getDate());
      expect(status.isCustomDate).toBe(false);
    });

    it('should calculate days since last trip', () => {
      const status = service.calculateStatus([makeTrip('01.01.2023', '10.01.2023')], {
        windowMonths: 12,
        absenceLimit: 180,
        customDate: makeDate('20.01.2023'),
      });
      expect(status.daysSinceLastTrip).toBe(10);
    });
  });
});
