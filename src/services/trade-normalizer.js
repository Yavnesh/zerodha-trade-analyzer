/**
 * Trade Normalizer
 * Validates raw rows against mapped column names, normalizes types,
 * generates unique internal identifiers, flags invalid records with specific errors,
 * and maintains source row indices.
 */

import { normalizeTradingDate } from './date-normalizer.js';
import { parseCleanNumber } from '../utils/currency.js';
import { multiplyMoney } from '../utils/decimal.js';

export function normalizeTradeRecords(rows, mapping, options = {}) {
  const validTrades = [];
  const invalidRecords = [];
  const warnings = [];

  // Used to identify duplicates without deleting legitimate trades
  const tradeSignatureCounts = new Map();

  rows.forEach((row, index) => {
    const sourceRowNum = row.__rowNum__ !== undefined ? row.__rowNum__ : index + 2; // Default 1-based data row after header
    
    // Check if row is entirely empty
    const nonMetaKeys = Object.keys(row).filter(k => !k.startsWith('__'));
    const hasValues = nonMetaKeys.some(k => {
      const val = row[k];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });
    if (!hasValues) {
      // Ignored blank row
      return;
    }

    const rowErrors = [];

    // 1. Symbol
    const rawSymbol = row[mapping.symbol];
    let symbol = rawSymbol ? String(rawSymbol).trim().toUpperCase() : '';
    if (!symbol) {
      rowErrors.push('Missing trading symbol');
    }

    // 2. Date
    const rawDate = row[mapping.tradeDate];
    const dateResult = normalizeTradingDate(rawDate, { preferFormat: options.preferDateFormat });
    if (dateResult.error || !dateResult.dateStr) {
      rowErrors.push(`Invalid trade date: ${dateResult.error || 'Empty'}`);
    }
    if (dateResult.isAmbiguous) {
      warnings.push({
        sourceRowNum,
        type: 'AMBIGUOUS_DATE',
        message: `Date "${rawDate}" is ambiguous between DD/MM and MM/DD. Parsed as ${dateResult.dateStr}.`,
      });
    }
    const tradeDate = dateResult.dateStr;

    // 3. Trade Type (Side: BUY / SELL)
    const rawType = row[mapping.tradeType];
    let side = null;
    if (rawType !== undefined && rawType !== null) {
      const cleanType = String(rawType).trim().toUpperCase();
      if (cleanType === 'BUY' || cleanType === 'B' || cleanType.startsWith('B-') || cleanType.includes('BUY')) {
        side = 'BUY';
      } else if (cleanType === 'SELL' || cleanType === 'S' || cleanType.startsWith('S-') || cleanType.includes('SELL')) {
        side = 'SELL';
      } else {
        rowErrors.push(`Invalid trade side: "${rawType}" (expected Buy or Sell)`);
      }
    } else {
      rowErrors.push('Missing trade side (Buy/Sell)');
    }

    // 4. Quantity
    const rawQty = row[mapping.quantity];
    const qty = parseCleanNumber(rawQty);
    if (qty === null || qty <= 0) {
      rowErrors.push(`Invalid quantity: "${rawQty}" (must be positive number)`);
    }

    // 5. Price
    const rawPrice = row[mapping.price];
    const price = parseCleanNumber(rawPrice);
    if (price === null || price < 0) {
      rowErrors.push(`Invalid price: "${rawPrice}" (must be non-negative)`);
    }

    // 6. Optional Trade Value
    let tradeValue = 0;
    if (qty !== null && price !== null && qty > 0 && price >= 0) {
      const rawVal = mapping.tradeValue ? row[mapping.tradeValue] : null;
      const parsedVal = parseCleanNumber(rawVal);
      // If source value provided and close to computed, we can respect source or computed. 
      // Multiplied value ensures exact mathematical consistency:
      tradeValue = multiplyMoney(qty, price);
    }

    // 7. Optional fields
    const exchange = mapping.exchange && row[mapping.exchange] ? String(row[mapping.exchange]).trim().toUpperCase() : 'NSE';
    const segment = mapping.segment && row[mapping.segment] ? String(row[mapping.segment]).trim() : '';
    const orderId = mapping.orderId && row[mapping.orderId] ? String(row[mapping.orderId]).trim() : '';
    const tradeId = mapping.tradeId && row[mapping.tradeId] ? String(row[mapping.tradeId]).trim() : '';
    const charges = mapping.charges ? (parseCleanNumber(row[mapping.charges]) || 0) : 0;

    // Check for duplicate-looking execution
    const duplicateKey = `${tradeDate}|${symbol}|${side}|${qty}|${price}|${orderId}|${tradeId}`;
    const seenCount = (tradeSignatureCounts.get(duplicateKey) || 0) + 1;
    tradeSignatureCounts.set(duplicateKey, seenCount);
    if (seenCount > 1) {
      warnings.push({
        sourceRowNum,
        type: 'POSSIBLE_DUPLICATE',
        message: `Row matches identical trade parameters (Symbol: ${symbol}, Side: ${side}, Qty: ${qty}, Price: ${price}${tradeId ? ', Trade ID: ' + tradeId : ''}). Included legitimately without deletion.`,
      });
    }

    if (rowErrors.length > 0) {
      invalidRecords.push({
        sourceRowNum,
        rawRow: row,
        reasons: rowErrors,
      });
    } else {
      validTrades.push({
        id: `trade-${sourceRowNum}-${index}`,
        sourceRowNum,
        tradeDate,
        symbol,
        exchange,
        segment,
        side,
        quantity: qty,
        price,
        tradeValue,
        orderId,
        tradeId,
        charges,
        rawRow: row,
      });
    }
  });

  return {
    validTrades,
    invalidRecords,
    warnings,
  };
}
