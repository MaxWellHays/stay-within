import { DateParserService } from './date-parser.service';

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

describe('DateParserService', () => {
  let service: DateParserService;

  beforeEach(() => {
    service = new DateParserService();
  });

  describe('parseDate', () => {
    const validCases: [string, string, Date][] = [
      ['dd.mm.yyyy', '25.05.2023', utc(2023, 4, 25)],
      ['dd/mm/yyyy', '25/05/2023', utc(2023, 4, 25)],
      ['dd-mm-yyyy', '25-05-2023', utc(2023, 4, 25)],
      ['yyyy-mm-dd', '2023-05-25', utc(2023, 4, 25)],
      ['yyyy/mm/dd', '2023/05/25', utc(2023, 4, 25)],
      ['yyyy.mm.dd', '2023.05.25', utc(2023, 4, 25)],
      ['dd Mon yyyy', '25 May 2023', utc(2023, 4, 25)],
      ['dd Month yyyy', '25 January 2024', utc(2024, 0, 25)],
      ['whitespace', '  25.05.2023  ', utc(2023, 4, 25)],
      ['leap year Feb 29', '29.02.2024', utc(2024, 1, 29)],
    ];

    validCases.forEach(([label, input, expected]) => {
      it(`should parse ${label} format: ${input}`, () => {
        expect(service.parseDate(input)).toEqual(expected);
      });
    });

    const invalidCases: [string, string][] = [
      ['empty string', ''],
      ['non-date text', 'not-a-date'],
      ['invalid day (Feb 30)', '30.02.2023'],
      ['non-leap year Feb 29', '29.02.2023'],
    ];

    invalidCases.forEach(([label, input]) => {
      it(`should return null for ${label}`, () => {
        expect(service.parseDate(input)).toBeNull();
      });
    });

    it('should prioritize European format over US format for dd/mm/yyyy', () => {
      // 05/12/2023 parses as Dec 5 (European dd/mm), not May 12 (US mm/dd)
      expect(service.parseDate('05/12/2023')).toEqual(utc(2023, 11, 5));
    });
  });

  describe('isHeaderRow', () => {
    const headerCases: [string, string[]][] = [
      ['Start/End', ['Start', 'End']],
      ['case-insensitive', ['START', 'END']],
      ['Departure/Arrival', ['Departure', 'Arrival']],
      ['From/To', ['From', 'To']],
      ['non-parseable values', ['foo', 'bar']],
    ];

    headerCases.forEach(([label, row]) => {
      it(`should detect header: ${label}`, () => {
        expect(service.isHeaderRow(row)).toBe(true);
      });
    });

    it('should not detect valid date row as header', () => {
      expect(service.isHeaderRow(['25.05.2023', '10.08.2023'])).toBe(false);
    });

    it('should return false for row with fewer than 2 cells', () => {
      expect(service.isHeaderRow(['Start'])).toBe(false);
    });
  });

  describe('formatDate', () => {
    const cases: [Date, string][] = [
      [utc(2023, 4, 25), '25.05.2023'],
      [utc(2023, 0, 5), '05.01.2023'],
    ];

    cases.forEach(([input, expected]) => {
      it(`should format ${expected}`, () => {
        expect(service.formatDate(input)).toBe(expected);
      });
    });
  });
});
