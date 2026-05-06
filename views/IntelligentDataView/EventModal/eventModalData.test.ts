import { describe, expect, it } from 'vitest';
import { extractEventModalData } from './eventModalData';

describe('extractEventModalData', () => {
  describe('null event', () => {
    it('returns empty default when event is null', () => {
      const result = extractEventModalData(null, '');
      expect(result.dataObj).toEqual({});
      expect(result.relatedData.organizations).toEqual([]);
      expect(result.relatedData.contacts).toEqual([]);
      expect(result.relatedData.otherEditions).toEqual([]);
      expect(result.relatedData.suppliers).toEqual([]);
      expect(result.statistics.totalEditions).toBe(0);
      expect(result.statistics.cities.size).toBe(0);
    });
  });

  describe('dataObj parsing', () => {
    it('uses rawData when provided, excluding _sheet', () => {
      const result = extractEventModalData(
        {
          name: 'X',
          data: '',
          rawData: { SERIESNAME: 'World Conf', CITY: 'Hanoi', _sheet: 'Editions' },
        },
        '',
      );
      expect(result.dataObj.SERIESNAME).toBe('World Conf');
      expect(result.dataObj.CITY).toBe('Hanoi');
      expect(result.dataObj._sheet).toBeUndefined();
    });

    it('coerces null/undefined values to empty string in dataObj', () => {
      const result = extractEventModalData(
        { name: 'X', data: '', rawData: { CITY: null, COUNTRY: undefined } },
        '',
      );
      expect(result.dataObj.CITY).toBe('');
      expect(result.dataObj.COUNTRY).toBe('');
    });

    it('parses data string format "key: value, key: value"', () => {
      const result = extractEventModalData(
        { name: 'X', data: 'CITY: Hanoi, COUNTRY: Vietnam, YEAR: 2024' },
        '',
      );
      expect(result.dataObj.CITY).toBe('Hanoi');
      expect(result.dataObj.COUNTRY).toBe('Vietnam');
      expect(result.dataObj.YEAR).toBe('2024');
    });
  });

  describe('relatedData from allExcelData', () => {
    const event = {
      name: 'World Conf 2024',
      data: '',
      rawData: { SERIESID: 'WC-001', ECODE: 'WC-2024' },
    };

    it('matches organizations sheet rows by SERIESID', () => {
      const allExcelData = 'Row 1 (Sheet: Organizations): NAME: ICCA, SERIESID: WC-001';
      const result = extractEventModalData(event, allExcelData);
      expect(result.relatedData.organizations).toHaveLength(1);
      expect(result.relatedData.organizations[0]?.NAME).toBe('ICCA');
    });

    it('matches contacts sheet rows by ECODE', () => {
      const allExcelData = 'Row 2 (Sheet: Contacts): NAME: John, ECODE: WC-2024';
      const result = extractEventModalData(event, allExcelData);
      expect(result.relatedData.contacts).toHaveLength(1);
      expect(result.relatedData.contacts[0]?.NAME).toBe('John');
    });

    it('puts other editions (different ECODE) into otherEditions', () => {
      const allExcelData = 'Row 3 (Sheet: Editions): SERIESID: WC-001, ECODE: WC-2023, CITY: Tokyo';
      const result = extractEventModalData(event, allExcelData);
      expect(result.relatedData.otherEditions).toHaveLength(1);
      expect(result.relatedData.otherEditions[0]?.CITY).toBe('Tokyo');
    });

    it('puts supplier rows into suppliers', () => {
      const allExcelData = 'Row 4 (Sheet: Suppliers): NAME: ACo, SERIESID: WC-001';
      const result = extractEventModalData(event, allExcelData);
      expect(result.relatedData.suppliers).toHaveLength(1);
      expect(result.relatedData.suppliers[0]?.NAME).toBe('ACo');
    });

    it('returns empty related arrays when allExcelData has no matching rows', () => {
      const result = extractEventModalData(event, 'Row 1 (Sheet: Other): foo: bar');
      expect(result.relatedData.organizations).toEqual([]);
      expect(result.relatedData.contacts).toEqual([]);
      expect(result.relatedData.otherEditions).toEqual([]);
      expect(result.relatedData.suppliers).toEqual([]);
    });

    it('returns empty related arrays when allExcelData is empty', () => {
      const result = extractEventModalData(event, '');
      expect(result.relatedData.organizations).toEqual([]);
    });
  });

  describe('categories', () => {
    it('routes well-known field keys to correct categories', () => {
      const result = extractEventModalData(
        {
          name: 'X',
          data: '',
          rawData: {
            SERIESNAME: 'WC',
            CITY: 'Hanoi',
            START_DATE: '2024',
            EMAIL: 'a@b.com',
            SEQUENCE: 5,
            EVENT: 'WC',
            EXHIBITION: 'big',
            UNRELATED_FIELD: 'foo',
          },
        },
        '',
      );
      expect(result.categories['Organization']).toHaveProperty('SERIESNAME');
      expect(result.categories['Location']).toHaveProperty('CITY');
      expect(result.categories['Dates & Timing']).toHaveProperty('START_DATE');
      expect(result.categories['Contact & Website']).toHaveProperty('EMAIL');
      expect(result.categories['Statistics']).toHaveProperty('SEQUENCE');
      expect(result.categories['Event Information']).toHaveProperty('EVENT');
      expect(result.categories['Event Details']).toHaveProperty('EXHIBITION');
      expect(result.categories['Other']).toHaveProperty('UNRELATED_FIELD');
    });

    // Documents an existing quirk: 'TOTATTEND' contains 'END' which matches the
    // Dates & Timing condition (looking for START/END/DATE/YEAR/TIME) BEFORE the
    // Statistics condition (looking for ATTEND/DELEGATE/...). Real ICCA data
    // uses TOTATTEND for delegate counts, which means it currently ends up in
    // the wrong category. Cementing the current behavior here so any future
    // fix to the categorization heuristic surfaces this regression test for
    // explicit reconsideration.
    it('quirk: TOTATTEND lands in Dates & Timing because of the "END" substring match', () => {
      const result = extractEventModalData(
        { name: 'X', data: '', rawData: { TOTATTEND: 500 } },
        '',
      );
      expect(result.categories['Dates & Timing']).toHaveProperty('TOTATTEND');
      expect(result.categories['Statistics']).not.toHaveProperty('TOTATTEND');
    });
  });

  describe('statistics', () => {
    it('totalEditions = otherEditions.length + 1', () => {
      const event = { name: 'X', data: '', rawData: { SERIESID: 'S1' } };
      const data = [
        'Row 1 (Sheet: Editions): SERIESID: S1, ECODE: E1, CITY: A',
        'Row 2 (Sheet: Editions): SERIESID: S1, ECODE: E2, CITY: B',
      ].join('\n');
      const result = extractEventModalData(event, data);
      expect(result.statistics.totalEditions).toBe(3); // 2 other + current
    });

    it('aggregates city/country/location across current event + other editions', () => {
      const event = { name: 'X', data: '', rawData: { SERIESID: 'S1', CITY: 'Hanoi' } };
      const data = 'Row 1 (Sheet: Editions): SERIESID: S1, ECODE: E1, CITY: Tokyo, COUNTRY: Japan';
      const result = extractEventModalData(event, data);
      expect(result.statistics.cities).toEqual(new Set(['Hanoi', 'Tokyo']));
      expect(result.statistics.countries).toEqual(new Set(['Japan']));
    });
  });
});
