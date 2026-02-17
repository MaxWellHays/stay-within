import { CsvParserService } from './csv-parser.service';
import { DateParserService } from './date-parser.service';

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(() => {
    service = new CsvParserService(new DateParserService());
  });

  describe('parseTripsFromText', () => {
    it('should parse CSV with header row', () => {
      const trips = service.parseTripsFromText(
        'Start,End\n25.05.2023,10.08.2023\n15.09.2023,20.09.2023',
      );
      expect(trips.length).toBe(2);
      expect(trips[0]).toEqual({ start: utc(2023, 4, 25), end: utc(2023, 7, 10), days: 78 });
      expect(trips[1]).toEqual({ start: utc(2023, 8, 15), end: utc(2023, 8, 20), days: 6 });
    });

    const twoTripCases: [string, string][] = [
      ['CSV without header', '25.05.2023,10.08.2023\n15.09.2023,20.09.2023'],
      ['tab-separated values', '25.05.2023\t10.08.2023\n15.09.2023\t20.09.2023'],
      ['mixed delimiters', '25.05.2023,10.08.2023\n15.09.2023\t20.09.2023'],
      [
        'rows with invalid dates skipped',
        '25.05.2023,10.08.2023\ninvalid,date\n15.09.2023,20.09.2023',
      ],
      [
        'rows with fewer than 2 cells skipped',
        '25.05.2023,10.08.2023\nsingle-value\n15.09.2023,20.09.2023',
      ],
      ['Windows-style line endings', '25.05.2023,10.08.2023\r\n15.09.2023,20.09.2023\r\n'],
    ];

    twoTripCases.forEach(([label, input]) => {
      it(`should handle ${label}`, () => {
        expect(service.parseTripsFromText(input).length).toBe(2);
      });
    });

    it('should return empty array for empty input', () => {
      expect(service.parseTripsFromText('')).toEqual([]);
      expect(service.parseTripsFromText('   \n  \n  ')).toEqual([]);
    });

    it('should sort trips by end date', () => {
      const trips = service.parseTripsFromText('15.09.2023,20.09.2023\n25.05.2023,10.08.2023');
      expect(trips[0].end).toEqual(utc(2023, 7, 10));
      expect(trips[1].end).toEqual(utc(2023, 8, 20));
    });

    const dayCounts: [string, string, number][] = [
      ['single-day trip', '25.05.2023,25.05.2023', 1],
      ['two-day trip', '25.05.2023,26.05.2023', 2],
      ['78-day trip', '25.05.2023,10.08.2023', 78],
    ];

    dayCounts.forEach(([label, input, expected]) => {
      it(`should calculate days inclusively (${label})`, () => {
        expect(service.parseTripsFromText(input)[0].days).toBe(expected);
      });
    });
  });
});
