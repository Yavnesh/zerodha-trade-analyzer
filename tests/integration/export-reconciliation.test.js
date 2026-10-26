import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { generateExportWorkbook } from '../../src/services/excel-export.js';
import { calculateTradeMetrics } from '../../src/services/trade-calculator.js';

describe('Excel Export Reconciliation & Integrity (Scenario K, 17)', () => {
  it('generates all 5 required sheets with reconciled totals', () => {
    const trades = [
      { id: '1', tradeDate: '2026-03-24', symbol: 'RELIANCE', exchange: 'NSE', segment: 'EQ', side: 'BUY', quantity: 10, price: 100, tradeValue: 1000, sourceRowNum: 2, orderId: 'ORD1', tradeId: 'TRD1', charges: 5 },
      { id: '2', tradeDate: '2026-03-24', symbol: 'RELIANCE', exchange: 'NSE', segment: 'EQ', side: 'SELL', quantity: 10, price: 110, tradeValue: 1100, sourceRowNum: 3, orderId: 'ORD2', tradeId: 'TRD2', charges: 5 },
      { id: '3', tradeDate: '2026-03-24', symbol: 'INFY', exchange: 'NSE', segment: 'EQ', side: 'BUY', quantity: 5, price: 200, tradeValue: 1000, sourceRowNum: 4, orderId: 'ORD3', tradeId: 'TRD3', charges: 0 },
      { id: '4', tradeDate: '2026-03-25', symbol: 'TCS', exchange: 'NSE', segment: 'EQ', side: 'BUY', quantity: 2, price: 3000, tradeValue: 6000, sourceRowNum: 5, orderId: 'ORD4', tradeId: 'TRD4', charges: 10 },
    ];

    const { stockSummaries, dailySummaries } = calculateTradeMetrics(trades);
    const warnings = [{ sourceRowNum: 5, type: 'AMBIGUOUS_DATE', message: 'Test warning' }];
    const invalidRecords = [{ sourceRowNum: 9, reasons: ['Missing symbol'] }];

    const wb = generateExportWorkbook({
      stockSummaries,
      dailySummaries,
      validTrades: trades,
      invalidRecords,
      warnings,
    });

    // Verify 5 sheets
    expect(wb.SheetNames).toEqual([
      'Stock-wise Summary',
      'Daily Summary',
      'Individual Trades',
      'Validation Report',
      'Methodology',
    ]);

    // Check Stock-wise sheet
    const wsStock = wb.Sheets['Stock-wise Summary'];
    const stockRows = XLSX.utils.sheet_to_json(wsStock, { header: 1 });
    expect(stockRows.length).toBe(4); // 1 header + 3 stock summaries (RELIANCE 24th, INFY 24th, TCS 25th)

    // Check Daily sheet
    const wsDaily = wb.Sheets['Daily Summary'];
    const dailyRows = XLSX.utils.sheet_to_json(wsDaily, { header: 1 });
    expect(dailyRows.length).toBe(3); // 1 header + 2 dates (2026-03-24, 2026-03-25)

    // Reconcile: Sum of stock buy values for 2026-03-24 equals daily buy value
    const stocks24 = stockSummaries.filter(s => s.tradeDate === '2026-03-24');
    const sumStockBuyVal24 = stocks24.reduce((sum, s) => sum + s.totalBuyVal, 0);
    const daily24 = dailySummaries.find(d => d.tradeDate === '2026-03-24');
    expect(sumStockBuyVal24).toBe(daily24.totalBuyVal);

    // Reconcile: Individual trade values equal sum of stock buy and sell values
    const trades24Reliance = trades.filter(t => t.tradeDate === '2026-03-24' && t.symbol === 'RELIANCE');
    const tradeBuyVal = trades24Reliance.filter(t => t.side === 'BUY').reduce((acc, t) => acc + t.tradeValue, 0);
    const relStockSummary = stocks24.find(s => s.symbol === 'RELIANCE');
    expect(tradeBuyVal).toBe(relStockSummary.totalBuyVal);

    // Check Validation Report sheet
    const wsVal = wb.Sheets['Validation Report'];
    const valRows = XLSX.utils.sheet_to_json(wsVal, { header: 1 });
    expect(valRows.length).toBe(3); // 1 header + 1 invalid row + 1 warning

    // Check Methodology sheet
    const wsMethodology = wb.Sheets['Methodology'];
    expect(wsMethodology).toBeDefined();
  });
});
