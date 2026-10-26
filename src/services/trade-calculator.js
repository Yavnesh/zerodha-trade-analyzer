/**
 * Deterministic Financial Calculations & Accounting Logic
 * Implements FIFO matching for realized P&L when positions close,
 * flags open positions, separates net cash flow from realized P&L,
 * and maintains strict decimal precision.
 */

import { addMoney, subMoney, round } from '../utils/decimal.js';

/**
 * Calculates stock-wise and daily aggregates from normalized trade records.
 * 
 * @param {Array} trades List of normalized trade records
 * @returns {{
 *   stockSummaries: Array,
 *   dailySummaries: Array,
 *   overallSummary: Object
 * }}
 */
export function calculateTradeMetrics(trades) {
  // Sort trades chronologically / by source row index to preserve original execution flow
  const sortedTrades = [...trades].sort((a, b) => {
    if (a.tradeDate !== b.tradeDate) {
      return a.tradeDate.localeCompare(b.tradeDate);
    }
    return (a.sourceRowNum || 0) - (b.sourceRowNum || 0);
  });

  // Group by Date and then by Instrument/Symbol
  const dateMap = new Map();

  for (const trade of sortedTrades) {
    const { tradeDate, symbol } = trade;
    if (!dateMap.has(tradeDate)) {
      dateMap.set(tradeDate, new Map());
    }
    const symbolMap = dateMap.get(tradeDate);
    if (!symbolMap.has(symbol)) {
      symbolMap.set(symbol, []);
    }
    symbolMap.get(symbol).push(trade);
  }

  const stockSummaries = [];
  const dailySummaries = [];

  // Global totals
  let totalBuyValAll = 0;
  let totalSellValAll = 0;
  let totalBuyQtyAll = 0;
  let totalSellQtyAll = 0;
  let totalBuyCountAll = 0;
  let totalSellCountAll = 0;
  let totalRealizedPnLAll = 0;
  let allPositionsFullyClosed = true;
  const allInstrumentsSet = new Set();

  // Iterate over each date
  for (const [date, symbolMap] of dateMap.entries()) {
    let dayBuyVal = 0;
    let daySellVal = 0;
    let dayBuyQty = 0;
    let daySellQty = 0;
    let dayBuyCount = 0;
    let daySellCount = 0;
    let dayRealizedPnL = 0;
    let dayHasOpenPosition = false;
    let dayAttentionCount = 0;

    for (const [symbol, tradeList] of symbolMap.entries()) {
      allInstrumentsSet.add(symbol);

      let buyCount = 0;
      let sellCount = 0;
      let totalBuyQty = 0;
      let totalSellQty = 0;
      let totalBuyVal = 0;
      let totalSellVal = 0;
      let totalCharges = 0;
      let exchange = tradeList[0]?.exchange || 'NSE';
      let segment = tradeList[0]?.segment || '';

      // FIFO queues for realized P&L calculation within the day
      // { qty, price }
      const buyQueue = [];
      const sellQueue = []; // For short sales
      let realizedPnL = 0;
      let requiresOpeningInventory = false;

      for (const t of tradeList) {
        totalCharges = addMoney(totalCharges, t.charges || 0);

        if (t.side === 'BUY') {
          buyCount += 1;
          totalBuyQty += t.quantity;
          totalBuyVal = addMoney(totalBuyVal, t.tradeValue);

          // If there was an open short position, match against it
          let remainingQty = t.quantity;
          while (sellQueue.length > 0 && remainingQty > 0) {
            const shortLot = sellQueue[0];
            const matchedQty = Math.min(shortLot.qty, remainingQty);
            // Short realized PnL = (Short Sell Price - Buy Price) * matchedQty
            const pnl = (shortLot.price - t.price) * matchedQty;
            realizedPnL = addMoney(realizedPnL, pnl);
            shortLot.qty -= matchedQty;
            remainingQty -= matchedQty;
            if (shortLot.qty <= 0) {
              sellQueue.shift();
            }
          }

          if (remainingQty > 0) {
            buyQueue.push({ qty: remainingQty, price: t.price });
          }
        } else if (t.side === 'SELL') {
          sellCount += 1;
          totalSellQty += t.quantity;
          totalSellVal = addMoney(totalSellVal, t.tradeValue);

          // Match against existing buy inventory (FIFO)
          let remainingQty = t.quantity;
          while (buyQueue.length > 0 && remainingQty > 0) {
            const buyLot = buyQueue[0];
            const matchedQty = Math.min(buyLot.qty, remainingQty);
            // Long realized PnL = (Sell Price - Buy Price) * matchedQty
            const pnl = (t.price - buyLot.price) * matchedQty;
            realizedPnL = addMoney(realizedPnL, pnl);
            buyLot.qty -= matchedQty;
            remainingQty -= matchedQty;
            if (buyLot.qty <= 0) {
              buyQueue.shift();
            }
          }

          if (remainingQty > 0) {
            // Sold before buy or sold more than bought intraday
            sellQueue.push({ qty: remainingQty, price: t.price });
            requiresOpeningInventory = true;
          }
        }
      }

      const avgBuyPrice = totalBuyQty > 0 ? round(totalBuyVal / totalBuyQty, 2) : 0;
      const avgSellPrice = totalSellQty > 0 ? round(totalSellVal / totalSellQty, 2) : 0;
      const netQty = totalBuyQty - totalSellQty;
      const netCashFlow = subMoney(totalSellVal, totalBuyVal);

      // Determine Position and P&L Status
      let pnlStatus = 'CLOSED';
      let pnlNotice = 'Position fully squared off';
      let isPnLReliable = false;
      let finalRealizedPnL = null;

      if (netQty === 0 && !requiresOpeningInventory) {
        // Fully closed position within this date!
        pnlStatus = 'CLOSED';
        pnlNotice = 'Fully squared off (Intraday P&L verified)';
        isPnLReliable = true;
        finalRealizedPnL = realizedPnL;
        dayRealizedPnL = addMoney(dayRealizedPnL, realizedPnL);
      } else if (requiresOpeningInventory) {
        pnlStatus = 'OPEN_SHORT_OR_DELIVERY';
        pnlNotice = 'Sell preceded buy or exceeds intraday buy (Requires prior holding cost basis)';
        isPnLReliable = false;
        dayHasOpenPosition = true;
        allPositionsFullyClosed = false;
        dayAttentionCount += 1;
      } else {
        // netQty > 0: Open Long
        pnlStatus = 'OPEN_LONG';
        pnlNotice = `${netQty} share(s) remain open in inventory. Realized P&L cannot be calculated without sale.`;
        isPnLReliable = false;
        dayHasOpenPosition = true;
        allPositionsFullyClosed = false;
        dayAttentionCount += 1;
      }

      stockSummaries.push({
        id: `${date}-${symbol}`,
        tradeDate: date,
        symbol,
        exchange,
        segment,
        buyCount,
        sellCount,
        totalBuyQty,
        totalSellQty,
        totalBuyVal,
        totalSellVal,
        avgBuyPrice,
        avgSellPrice,
        netQty,
        netCashFlow,
        realizedPnL: finalRealizedPnL,
        isPnLReliable,
        pnlStatus,
        pnlNotice,
        charges: totalCharges,
        tradeIds: tradeList.map(t => t.id),
      });

      // Daily totals
      dayBuyVal = addMoney(dayBuyVal, totalBuyVal);
      daySellVal = addMoney(daySellVal, totalSellVal);
      dayBuyQty += totalBuyQty;
      daySellQty += totalSellQty;
      dayBuyCount += buyCount;
      daySellCount += sellCount;
    }

    const dayNetCashFlow = subMoney(daySellVal, dayBuyVal);

    dailySummaries.push({
      tradeDate: date,
      instrumentCount: symbolMap.size,
      buyCount: dayBuyCount,
      sellCount: daySellCount,
      totalBuyQty: dayBuyQty,
      totalSellQty: daySellQty,
      totalBuyVal: dayBuyVal,
      totalSellVal: daySellVal,
      netCashFlow: dayNetCashFlow,
      realizedPnL: dayHasOpenPosition ? null : dayRealizedPnL,
      isPnLReliable: !dayHasOpenPosition,
      attentionCount: dayAttentionCount,
      hasOpenPositions: dayHasOpenPosition,
    });

    totalBuyValAll = addMoney(totalBuyValAll, dayBuyVal);
    totalSellValAll = addMoney(totalSellValAll, daySellVal);
    totalBuyQtyAll += dayBuyQty;
    totalSellQtyAll += daySellQty;
    totalBuyCountAll += dayBuyCount;
    totalSellCountAll += daySellCount;
    totalRealizedPnLAll = addMoney(totalRealizedPnLAll, dayRealizedPnL);
  }

  const overallNetCashFlow = subMoney(totalSellValAll, totalBuyValAll);

  return {
    stockSummaries,
    dailySummaries,
    overallSummary: {
      dateCount: dateMap.size,
      instrumentCount: allInstrumentsSet.size,
      buyCount: totalBuyCountAll,
      sellCount: totalSellCountAll,
      totalBuyQty: totalBuyQtyAll,
      totalSellQty: totalSellQtyAll,
      totalBuyVal: totalBuyValAll,
      totalSellVal: totalSellValAll,
      netCashFlow: overallNetCashFlow,
      realizedPnL: allPositionsFullyClosed ? totalRealizedPnLAll : null,
      isPnLReliable: allPositionsFullyClosed,
      allPositionsClosed: allPositionsFullyClosed,
    },
  };
}
