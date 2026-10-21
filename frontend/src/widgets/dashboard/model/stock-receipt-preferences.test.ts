import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STOCK_RECEIPT_STORAGE_KEY,
  readStockReceiptPreferences,
  writeStockReceiptPreferences,
} from './stock-receipt-preferences';

describe('stock-receipt-preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('readStockReceiptPreferences', () => {
    it('returns an empty object when storage is empty', () => {
      expect(readStockReceiptPreferences()).toEqual({});
    });

    it('reads partial preferences correctly', () => {
      window.localStorage.setItem(
        STOCK_RECEIPT_STORAGE_KEY,
        JSON.stringify({ autoGenerateSerialNumbers: false }),
      );

      expect(readStockReceiptPreferences()).toEqual({
        autoGenerateSerialNumbers: false,
      });
    });

    it('reads all known valid preferences', () => {
      window.localStorage.setItem(
        STOCK_RECEIPT_STORAGE_KEY,
        JSON.stringify({
          autoGenerateSerialNumbers: false,
          autoGenerateArticles: true,
          printSerialNumbers: false,
          warehouseId: 'wh-123',
          locationId: 'loc-456',
        }),
      );

      expect(readStockReceiptPreferences()).toEqual({
        autoGenerateSerialNumbers: false,
        autoGenerateArticles: true,
        printSerialNumbers: false,
        warehouseId: 'wh-123',
        locationId: 'loc-456',
      });
    });

    it('preserves an empty string locationId', () => {
      window.localStorage.setItem(
        STOCK_RECEIPT_STORAGE_KEY,
        JSON.stringify({
          warehouseId: 'wh-empty-loc',
          locationId: '',
        }),
      );

      expect(readStockReceiptPreferences()).toEqual({
        warehouseId: 'wh-empty-loc',
        locationId: '',
      });
    });

    it('ignores corrupt JSON without throwing or wiping the stored string', () => {
      const corruptData = '{"autoGenerateSerialNumbers": true, corrupt';
      window.localStorage.setItem(STOCK_RECEIPT_STORAGE_KEY, corruptData);

      expect(readStockReceiptPreferences()).toEqual({});
      expect(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY)).toBe(
        corruptData,
      );
    });

    it('ignores non-object JSON values like numbers or arrays', () => {
      window.localStorage.setItem(
        STOCK_RECEIPT_STORAGE_KEY,
        JSON.stringify([1, 2, 3]),
      );
      expect(readStockReceiptPreferences()).toEqual({});

      window.localStorage.setItem(
        STOCK_RECEIPT_STORAGE_KEY,
        JSON.stringify(42),
      );
      expect(readStockReceiptPreferences()).toEqual({});
    });

    it('ignores unknown fields', () => {
      window.localStorage.setItem(
        STOCK_RECEIPT_STORAGE_KEY,
        JSON.stringify({
          autoGenerateSerialNumbers: true,
          unknownOption: 'unexpected',
          anotherUnknown: 999,
        }),
      );

      expect(readStockReceiptPreferences()).toEqual({
        autoGenerateSerialNumbers: true,
      });
    });

    it('ignores invalid types for known fields', () => {
      window.localStorage.setItem(
        STOCK_RECEIPT_STORAGE_KEY,
        JSON.stringify({
          autoGenerateSerialNumbers: 'true',
          autoGenerateArticles: 1,
          printSerialNumbers: null,
          warehouseId: '   ',
          locationId: 12345,
        }),
      );

      expect(readStockReceiptPreferences()).toEqual({});
    });
  });

  describe('writeStockReceiptPreferences', () => {
    it('writes a single preference into empty storage', () => {
      writeStockReceiptPreferences({ autoGenerateSerialNumbers: false });

      expect(
        JSON.parse(
          window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY) ?? '{}',
        ),
      ).toEqual({
        autoGenerateSerialNumbers: false,
      });
    });

    it('merges updates so changing one control keeps the others', () => {
      writeStockReceiptPreferences({
        autoGenerateSerialNumbers: false,
        warehouseId: 'wh-1',
        locationId: 'loc-1',
      });

      writeStockReceiptPreferences({
        printSerialNumbers: false,
      });

      expect(readStockReceiptPreferences()).toEqual({
        autoGenerateSerialNumbers: false,
        printSerialNumbers: false,
        warehouseId: 'wh-1',
        locationId: 'loc-1',
      });

      writeStockReceiptPreferences({
        locationId: 'loc-2',
      });

      expect(readStockReceiptPreferences()).toEqual({
        autoGenerateSerialNumbers: false,
        printSerialNumbers: false,
        warehouseId: 'wh-1',
        locationId: 'loc-2',
      });
    });

    it('writes and preserves empty string locationId', () => {
      writeStockReceiptPreferences({
        warehouseId: 'wh-no-loc',
        locationId: '',
      });

      expect(readStockReceiptPreferences()).toEqual({
        warehouseId: 'wh-no-loc',
        locationId: '',
      });
    });

    it('overwrites corrupt JSON when a valid change is written', () => {
      window.localStorage.setItem(
        STOCK_RECEIPT_STORAGE_KEY,
        'bad-json{{{',
      );

      writeStockReceiptPreferences({ autoGenerateArticles: true });

      expect(readStockReceiptPreferences()).toEqual({
        autoGenerateArticles: true,
      });
    });

    it('ignores storage exceptions gracefully without crashing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => {
        writeStockReceiptPreferences({ autoGenerateArticles: false });
      }).not.toThrow();
    });
  });
});

