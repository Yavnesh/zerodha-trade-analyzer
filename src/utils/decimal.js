/**
 * Decimal and Paise integer-safe arithmetic
 * Avoids binary floating point errors (e.g. 0.1 + 0.2 !== 0.3)
 */

const SCALE = 10000; // Store intermediate with 4 decimal places precision

export function toFixedPaise(rupees) {
  if (rupees === null || rupees === undefined || Number.isNaN(rupees)) return 0;
  return Math.round(Number(rupees) * 100);
}

export function paiseToRupees(paise) {
  return paise / 100;
}

/**
 * Multiply quantity and price cleanly to 2 decimal places (or exact paise)
 * @param {number} qty 
 * @param {number} price 
 * @returns {number} Value in Rupees rounded to 2 decimal places
 */
export function multiplyMoney(qty, price) {
  if (!qty || !price) return 0;
  // Use integer multiplication scaled
  const val = Math.round(qty * price * 100) / 100;
  return val;
}

/**
 * Safely add two rupee amounts
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
export function addMoney(a, b) {
  const pA = toFixedPaise(a);
  const pB = toFixedPaise(b);
  return paiseToRupees(pA + pB);
}

/**
 * Safely subtract rupee amounts (a - b)
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
export function subMoney(a, b) {
  const pA = toFixedPaise(a);
  const pB = toFixedPaise(b);
  return paiseToRupees(pA - pB);
}

/**
 * Round a number to specified decimal places
 * @param {number} num 
 * @param {number} decimals 
 * @returns {number}
 */
export function round(num, decimals = 2) {
  if (num === null || num === undefined || Number.isNaN(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}
