/**
 * Column Mapper Module
 * Identifies column headers in Zerodha trade exports with flexible alias matching,
 * whitespace/casing normalization, and explicit manual mapping support.
 */

// Canonical logical fields required or optional for trade processing
export const LOGICAL_FIELDS = {
  tradeDate: {
    label: 'Trade Date',
    required: true,
    aliases: [
      'trade date', 'trading date', 'tradedate', 'trade_date', 'date', 
      'order execution time', 'execution date', 'trade time', 'fill date'
    ],
  },
  symbol: {
    label: 'Trading Symbol / Instrument',
    required: true,
    aliases: [
      'symbol', 'trading symbol', 'tradingsymbol', 'stock', 'scrip', 
      'instrument', 'script', 'security', 'instrument name', 'stock symbol'
    ],
  },
  tradeType: {
    label: 'Trade Type / Side (Buy/Sell)',
    required: true,
    aliases: [
      'trade type', 'tradetype', 'trade_type', 'type', 'side', 
      'transaction type', 'transaction_type', 'buy/sell', 'b/s', 'action'
    ],
  },
  quantity: {
    label: 'Quantity',
    required: true,
    aliases: [
      'quantity', 'qty', 'traded qty', 'traded quantity', 'shares', 
      'volume', 'executed qty', 'filled qty'
    ],
  },
  price: {
    label: 'Price',
    required: true,
    aliases: [
      'price', 'trade price', 'tradeprice', 'trade_price', 'avg price', 
      'average price', 'rate', 'execution price', 'traded price'
    ],
  },
  tradeValue: {
    label: 'Trade Value',
    required: false,
    aliases: [
      'trade value', 'tradevalue', 'trade_value', 'value', 'amount', 
      'turnover', 'gross value', 'total amount'
    ],
  },
  exchange: {
    label: 'Exchange',
    required: false,
    aliases: ['exchange', 'exch', 'market', 'segment'],
  },
  orderId: {
    label: 'Order ID',
    required: false,
    aliases: ['order id', 'order_id', 'order no', 'orderno', 'order number'],
  },
  tradeId: {
    label: 'Trade ID / Execution ID',
    required: false,
    aliases: ['trade id', 'trade_id', 'execution id', 'trade no', 'tradeno', 'fill id'],
  },
  segment: {
    label: 'Segment / Product',
    required: false,
    aliases: ['segment', 'product', 'product type', 'series'],
  },
  charges: {
    label: 'Charges / Taxes',
    required: false,
    aliases: ['charges', 'brokerage', 'taxes', 'stt', 'total charges', 'fees'],
  },
};

/**
 * Clean and normalize a header string for alias matching
 * @param {string} header 
 * @returns {string}
 */
export function normalizeHeader(header) {
  if (!header) return '';
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Automatically detects column mapping from raw headers.
 * @param {string[]} headers List of headers present in the file
 * @returns {{ mapping: Record<string, string>, unmappedRequired: string[], confidence: number }}
 */
export function autoDetectColumnMapping(headers) {
  const mapping = {};
  const usedHeaders = new Set();
  const normalizedHeaders = headers.map(h => ({
    raw: h,
    cleaned: normalizeHeader(h),
  }));

  for (const [fieldKey, fieldDef] of Object.entries(LOGICAL_FIELDS)) {
    // 1. Direct match on normalized aliases
    let matchedHeader = null;
    for (const alias of fieldDef.aliases) {
      const cleanAlias = normalizeHeader(alias);
      const found = normalizedHeaders.find(nh => !usedHeaders.has(nh.raw) && nh.cleaned === cleanAlias);
      if (found) {
        matchedHeader = found.raw;
        break;
      }
    }

    // 2. Fallback: substring match if not matched
    if (!matchedHeader) {
      for (const alias of fieldDef.aliases) {
        const cleanAlias = normalizeHeader(alias);
        const found = normalizedHeaders.find(
          nh => !usedHeaders.has(nh.raw) && (nh.cleaned.includes(cleanAlias) || cleanAlias.includes(nh.cleaned))
        );
        if (found) {
          matchedHeader = found.raw;
          break;
        }
      }
    }

    if (matchedHeader) {
      mapping[fieldKey] = matchedHeader;
      usedHeaders.add(matchedHeader);
    }
  }

  const unmappedRequired = Object.entries(LOGICAL_FIELDS)
    .filter(([k, v]) => v.required && !mapping[k])
    .map(([k, v]) => ({ key: k, label: v.label }));

  const requiredCount = Object.values(LOGICAL_FIELDS).filter(f => f.required).length;
  const mappedRequiredCount = requiredCount - unmappedRequired.length;
  const confidence = requiredCount > 0 ? mappedRequiredCount / requiredCount : 0;

  return {
    mapping,
    unmappedRequired,
    isComplete: unmappedRequired.length === 0,
    confidence,
  };
}
