import { describe, it, expect } from 'vitest';
import { normalizeTradingDate } from '../../src/services/date-normalizer.js';
import { autoDetectColumnMapping } from '../../src/services/column-mapper.js';
import { normalizeTradeRecords } from '../../src/services/trade-normalizer.js';
import { formatINR } from '../../src/utils/currency.js';
import { addMoney, subMoney, multiplyMoney } from '../../src/utils/decimal.js';

describe('Date Normalization (Scenario H)', () => {
  it('parses Excel serial dates', () => {
    // 46105 in Excel = 2026-03-24
    const res = normalizeTradingDate(46105);
    expect(res.dateStr).toBe('2026-03-24');
    expect(res.error).toBeNull();
  });

  it('parses JavaScript Date objects preserving local calendar date', () => {
    const d = new Date(2026, 2, 24); // March 24, 2026
    const res = normalizeTradingDate(d);
    expect(res.dateStr).toBe('2026-03-24');
  });

  it('parses YYYY-MM-DD ISO strings', () => {
    const res = normalizeTradingDate('2026-03-24 10:15:00');
    expect(res.dateStr).toBe('2026-03-24');
  });

  it('parses DD-MM-YYYY Indian date format', () => {
    const res = normalizeTradingDate('24-03-2026');
    expect(res.dateStr).toBe('2026-03-24');
  });

  it('detects ambiguous date strings e.g. 03/04/2026', () => {
    const res = normalizeTradingDate('03/04/2026');
    expect(res.isAmbiguous).toBe(true);
    // Defaults to DD/MM/YYYY -> 2026-04-03
    expect(res.dateStr).toBe('2026-04-03');
  });

  it('returns error on invalid date', () => {
    const res = normalizeTradingDate('invalid-date-token');
    expect(res.dateStr).toBeNull();
    expect(res.error).toBeDefined();
  });
});

describe('Column Mapper and Aliases', () => {
  it('auto-detects Zerodha standard column headers', () => {
    const headers = ['Trade Date', 'Trading Symbol', 'Trade Type', 'Quantity', 'Price', 'Exchange', 'Order ID'];
    const result = autoDetectColumnMapping(headers);
    expect(result.isComplete).toBe(true);
    expect(result.mapping.tradeDate).toBe('Trade Date');
    expect(result.mapping.symbol).toBe('Trading Symbol');
    expect(result.mapping.tradeType).toBe('Trade Type');
    expect(result.mapping.quantity).toBe('Quantity');
    expect(result.mapping.price).toBe('Price');
  });

  it('identifies unmapped required columns', () => {
    const headers = ['Trading Symbol', 'Quantity'];
    const result = autoDetectColumnMapping(headers);
    expect(result.isComplete).toBe(false);
    expect(result.unmappedRequired.map(u => u.key)).toContain('tradeDate');
    expect(result.unmappedRequired.map(u => u.key)).toContain('tradeType');
    expect(result.unmappedRequired.map(u => u.key)).toContain('price');
  });
});

describe('Partial Data, Invalid Rows & Duplicates (Scenario G, J)', () => {
  const mapping = {
    tradeDate: 'Date',
    symbol: 'Symbol',
    tradeType: 'Side',
    quantity: 'Qty',
    price: 'Price',
    tradeId: 'TradeID',
  };

  it('Scenario G: separates invalid rows without crashing', () => {
    const rawRows = [
      { Date: '2026-03-24', Symbol: 'TCS', Side: 'BUY', Qty: 10, Price: 3000, __rowNum__: 2 },
      { Date: 'invalid', Symbol: 'INFY', Side: 'BUY', Qty: 10, Price: 1500, __rowNum__: 3 }, // invalid date
      { Date: '2026-03-24', Symbol: '', Side: 'BUY', Qty: 10, Price: 1500, __rowNum__: 4 }, // missing symbol
      { Date: '2026-03-24', Symbol: 'WIPRO', Side: 'BUY', Qty: -5, Price: 500, __rowNum__: 5 }, // negative qty
      { Date: '2026-03-24', Symbol: 'WIPRO', Side: 'INVALID_SIDE', Qty: 5, Price: 500, __rowNum__: 6 }, // bad side
      { Date: '', Symbol: '', Side: '', Qty: '', Price: '', __rowNum__: 7 }, // empty row
    ];

    const { validTrades, invalidRecords } = normalizeTradeRecords(rawRows, mapping);
    expect(validTrades).toHaveLength(1);
    expect(validTrades[0].symbol).toBe('TCS');
    expect(invalidRecords).toHaveLength(4); // 4 invalid data rows (empty row is ignored)
    expect(invalidRecords.map(r => r.sourceRowNum)).toEqual([3, 4, 5, 6]);
  });

  it('Scenario J: preserves legitimate duplicates while warning', () => {
    const rawRows = [
      { Date: '2026-03-24', Symbol: 'RELIANCE', Side: 'BUY', Qty: 10, Price: 2500, TradeID: 'T101', __rowNum__: 2 },
      { Date: '2026-03-24', Symbol: 'RELIANCE', Side: 'BUY', Qty: 10, Price: 2500, TradeID: 'T101', __rowNum__: 3 },
    ];
    const { validTrades, warnings } = normalizeTradeRecords(rawRows, mapping);
    expect(validTrades).toHaveLength(2); // Retained
    expect(warnings.some(w => w.type === 'POSSIBLE_DUPLICATE')).toBe(true);
  });
});

describe('Decimal Precision & Currency Formatting (Scenario I)', () => {
  it('Scenario I: avoids floating point addition inaccuracies', () => {
    // In IEEE 754: 0.1 + 0.2 = 0.30000000000000004
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(subMoney(0.3, 0.1)).toBe(0.2);
    expect(multiplyMoney(33, 10.33)).toBe(340.89);
  });

  it('formats currency in Indian style', () => {
    expect(formatINR(125000.5)).toBe('₹1,25,000.50');
    expect(formatINR(-4500)).toBe('-₹4,500.00');
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(null)).toBe('—');
  });
});
