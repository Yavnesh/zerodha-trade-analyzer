import { describe, it, expect } from 'vitest';
import { calculateTradeMetrics } from '../../src/services/trade-calculator.js';

describe('Financial Calculations Scenarios', () => {
  // Scenario A: One fully closed position
  // Buy 10 shares at ₹100 and sell 10 shares at ₹110.
  it('Scenario A: One fully closed position', () => {
    const trades = [
      { id: '1', tradeDate: '2026-03-24', symbol: 'RELIANCE', side: 'BUY', quantity: 10, price: 100, tradeValue: 1000, sourceRowNum: 2 },
      { id: '2', tradeDate: '2026-03-24', symbol: 'RELIANCE', side: 'SELL', quantity: 10, price: 110, tradeValue: 1100, sourceRowNum: 3 },
    ];
    const { stockSummaries, dailySummaries, overallSummary } = calculateTradeMetrics(trades);

    expect(stockSummaries).toHaveLength(1);
    const s = stockSummaries[0];
    expect(s.totalBuyQty).toBe(10);
    expect(s.totalSellQty).toBe(10);
    expect(s.totalBuyVal).toBe(1000);
    expect(s.totalSellVal).toBe(1100);
    expect(s.netQty).toBe(0);
    expect(s.netCashFlow).toBe(100);
    expect(s.realizedPnL).toBe(100);
    expect(s.isPnLReliable).toBe(true);

    expect(dailySummaries[0].netCashFlow).toBe(100);
    expect(dailySummaries[0].realizedPnL).toBe(100);
    expect(overallSummary.netCashFlow).toBe(100);
    expect(overallSummary.realizedPnL).toBe(100);
  });

  // Scenario B: Multiple partial sells
  // Buy 10 shares at ₹100, sell 4 shares at ₹110, and sell 6 shares at ₹120.
  it('Scenario B: Multiple partial sells', () => {
    const trades = [
      { id: '1', tradeDate: '2026-03-24', symbol: 'INFY', side: 'BUY', quantity: 10, price: 100, tradeValue: 1000, sourceRowNum: 2 },
      { id: '2', tradeDate: '2026-03-24', symbol: 'INFY', side: 'SELL', quantity: 4, price: 110, tradeValue: 440, sourceRowNum: 3 },
      { id: '3', tradeDate: '2026-03-24', symbol: 'INFY', side: 'SELL', quantity: 6, price: 120, tradeValue: 720, sourceRowNum: 4 },
    ];
    const { stockSummaries } = calculateTradeMetrics(trades);
    const s = stockSummaries[0];
    expect(s.totalBuyVal).toBe(1000);
    expect(s.totalSellVal).toBe(1160);
    expect(s.netCashFlow).toBe(160);
    expect(s.netQty).toBe(0);
    expect(s.realizedPnL).toBe(160);
  });

  // Scenario C: Open position
  // Buy 10 shares at ₹100 and sell 5 shares at ₹110.
  // Buy value: ₹1,000, Sell value: ₹550, Net quantity bought: 5, Net cash flow: -₹450
  // Realized P&L must not be reported as -₹450.
  it('Scenario C: Open position handling', () => {
    const trades = [
      { id: '1', tradeDate: '2026-03-24', symbol: 'TCS', side: 'BUY', quantity: 10, price: 100, tradeValue: 1000, sourceRowNum: 2 },
      { id: '2', tradeDate: '2026-03-24', symbol: 'TCS', side: 'SELL', quantity: 5, price: 110, tradeValue: 550, sourceRowNum: 3 },
    ];
    const { stockSummaries, dailySummaries } = calculateTradeMetrics(trades);
    const s = stockSummaries[0];
    expect(s.totalBuyQty).toBe(10);
    expect(s.totalSellQty).toBe(5);
    expect(s.totalBuyVal).toBe(1000);
    expect(s.totalSellVal).toBe(550);
    expect(s.netQty).toBe(5);
    expect(s.netCashFlow).toBe(-450);
    // Realized P&L cannot be claimed as -450
    expect(s.realizedPnL).toBeNull();
    expect(s.isPnLReliable).toBe(false);
    expect(s.pnlStatus).toBe('OPEN_LONG');
    expect(dailySummaries[0].realizedPnL).toBeNull();
  });

  // Scenario D: Multiple stocks on the same date
  it('Scenario D: Multiple stocks on same date', () => {
    const trades = [
      { id: '1', tradeDate: '2026-03-24', symbol: 'RELIANCE', side: 'BUY', quantity: 10, price: 100, tradeValue: 1000, sourceRowNum: 2 },
      { id: '2', tradeDate: '2026-03-24', symbol: 'RELIANCE', side: 'SELL', quantity: 10, price: 105, tradeValue: 1050, sourceRowNum: 3 },
      { id: '3', tradeDate: '2026-03-24', symbol: 'INFY', side: 'BUY', quantity: 5, price: 200, tradeValue: 1000, sourceRowNum: 4 },
      { id: '4', tradeDate: '2026-03-24', symbol: 'INFY', side: 'SELL', quantity: 5, price: 210, tradeValue: 1050, sourceRowNum: 5 },
    ];
    const { stockSummaries, dailySummaries } = calculateTradeMetrics(trades);
    expect(stockSummaries).toHaveLength(2);
    expect(dailySummaries[0].instrumentCount).toBe(2);
    expect(dailySummaries[0].totalBuyVal).toBe(2000);
    expect(dailySummaries[0].totalSellVal).toBe(2100);
    expect(dailySummaries[0].netCashFlow).toBe(100);
    expect(dailySummaries[0].realizedPnL).toBe(100); // 50 from RELIANCE + 50 from INFY
  });

  // Scenario E: Same stock across multiple dates
  it('Scenario E: Same stock across multiple dates', () => {
    const trades = [
      { id: '1', tradeDate: '2026-03-22', symbol: 'HDFC', side: 'BUY', quantity: 10, price: 100, tradeValue: 1000, sourceRowNum: 2 },
      { id: '2', tradeDate: '2026-03-22', symbol: 'HDFC', side: 'SELL', quantity: 10, price: 102, tradeValue: 1020, sourceRowNum: 3 },
      { id: '3', tradeDate: '2026-03-23', symbol: 'HDFC', side: 'BUY', quantity: 10, price: 105, tradeValue: 1050, sourceRowNum: 4 },
      { id: '4', tradeDate: '2026-03-23', symbol: 'HDFC', side: 'SELL', quantity: 10, price: 107, tradeValue: 1070, sourceRowNum: 5 },
      { id: '5', tradeDate: '2026-03-24', symbol: 'HDFC', side: 'BUY', quantity: 10, price: 110, tradeValue: 1100, sourceRowNum: 6 },
      { id: '6', tradeDate: '2026-03-24', symbol: 'HDFC', side: 'SELL', quantity: 10, price: 115, tradeValue: 1150, sourceRowNum: 7 },
    ];
    const { stockSummaries, dailySummaries } = calculateTradeMetrics(trades);
    expect(stockSummaries).toHaveLength(3);
    expect(dailySummaries).toHaveLength(3);
    expect(stockSummaries[0].tradeDate).toBe('2026-03-22');
    expect(stockSummaries[0].realizedPnL).toBe(20);
    expect(stockSummaries[1].tradeDate).toBe('2026-03-23');
    expect(stockSummaries[1].realizedPnL).toBe(20);
    expect(stockSummaries[2].tradeDate).toBe('2026-03-24');
    expect(stockSummaries[2].realizedPnL).toBe(50);
  });

  // Scenario F: Mixed buy and sell execution order & opening inventory check
  it('Scenario F: Sell before buy (requires opening inventory)', () => {
    const trades = [
      { id: '1', tradeDate: '2026-03-24', symbol: 'ITC', side: 'SELL', quantity: 10, price: 200, tradeValue: 2000, sourceRowNum: 2 },
      { id: '2', tradeDate: '2026-03-24', symbol: 'ITC', side: 'BUY', quantity: 10, price: 195, tradeValue: 1950, sourceRowNum: 3 },
    ];
    const { stockSummaries } = calculateTradeMetrics(trades);
    const s = stockSummaries[0];
    expect(s.netQty).toBe(0);
    expect(s.netCashFlow).toBe(50);
    // When sell precedes buy, it requires prior holding / short-selling cost basis distinction
    expect(s.pnlStatus).toBe('OPEN_SHORT_OR_DELIVERY');
    expect(s.isPnLReliable).toBe(false);
  });
});
