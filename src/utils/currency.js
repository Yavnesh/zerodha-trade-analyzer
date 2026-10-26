/**
 * Precise currency and number formatting utilities (Indian Numbering System & Paise)
 */

/**
 * Format a number or paise integer as Indian Rupees (₹)
 * E.g. 125000.5 -> "₹1,25,000.50"
 * @param {number|null|undefined} amount 
 * @param {boolean} includeSignPrefix 
 * @returns {string}
 */
export function formatINR(amount, includeSignPrefix = false) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Format with 2 decimal places
  const fixed = absAmount.toFixed(2);
  const [integerPart, decimalPart] = fixed.split('.');

  // Indian numbering system: last 3 digits, then groups of 2 digits
  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  let formattedInteger = lastThree;
  if (otherNumbers !== '') {
    formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  const sign = isNegative ? '-₹' : (includeSignPrefix && amount > 0 ? '+₹' : '₹');
  return `${sign}${formattedInteger}.${decimalPart}`;
}

/**
 * Format numeric quantities cleanly (up to 4 decimal places if fractional, else whole number)
 * @param {number} qty 
 * @returns {string}
 */
export function formatQuantity(qty) {
  if (qty === null || qty === undefined || Number.isNaN(qty)) return '0';
  if (Number.isInteger(qty)) return qty.toLocaleString('en-IN');
  return Number(qty.toFixed(4)).toLocaleString('en-IN', { maximumFractionDigits: 4 });
}

/**
 * Parse monetary or quantity strings (e.g. "1,25,000.50", " ₹ 450.25 ") into clean number
 * @param {any} val 
 * @returns {number|null}
 */
export function parseCleanNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const str = String(val).trim().replace(/₹|,|\s/g, '');
  if (str === '') return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}
