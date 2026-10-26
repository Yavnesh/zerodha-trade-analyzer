/**
 * Normalizes trading dates to a consistent YYYY-MM-DD local calendar string.
 * Handles Excel date serials, Date objects, ISO strings, Indian date formats (DD/MM/YYYY, DD-MM-YYYY).
 * Prevents UTC timezone shifts from moving dates across calendar days.
 */

export function normalizeTradingDate(val, options = {}) {
  if (val === null || val === undefined || val === '') {
    return { dateStr: null, error: 'Empty date' };
  }

  // 1. If it's a JavaScript Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      return { dateStr: null, error: 'Invalid Date object' };
    }
    // Extract local year, month, date
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}`, error: null };
  }

  // 2. If it's an Excel date serial (numeric, usually 30000 - 60000)
  if (typeof val === 'number') {
    // Excel epoch starts Dec 30 1899 (due to Lotus 1-2-3 leap year bug)
    // Excel serial 1 = 1900-01-01
    if (val < 1) {
      return { dateStr: null, error: `Invalid Excel date serial: ${val}` };
    }
    // Convert serial days to ms from 1899-12-30
    const msPerDay = 86400000;
    // Excel treats 1900 as a leap year (25569 is 1970-01-01 in Excel epoch)
    const epochOffsetDays = 25569;
    const wholeDays = Math.floor(val);
    const dateMs = (wholeDays - epochOffsetDays) * msPerDay;
    const dObj = new Date(dateMs);
    // Use UTC methods because Excel serials represent whole days from epoch
    const y = dObj.getUTCFullYear();
    const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dObj.getUTCDate()).padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}`, error: null };
  }

  // 3. String date handling
  const rawStr = String(val).trim();
  if (!rawStr) {
    return { dateStr: null, error: 'Empty date string' };
  }

  // Check if string contains timestamp portion e.g. "2026-03-24 09:15:00" or "24-03-2026 10:20:12"
  const dateOnlyPart = rawStr.split(/[ T]/)[0].trim();

  // Pattern A: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = dateOnlyPart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return { dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, error: null };
    }
    return { dateStr: null, error: `Invalid calendar date in ${rawStr}` };
  }

  // Pattern B: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (Common in Indian Zerodha reports)
  const dmyMatch = dateOnlyPart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    let p1 = parseInt(dmyMatch[1], 10);
    let p2 = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);

    // If p1 > 12, it must be day (DD/MM/YYYY)
    // If p2 > 12, p2 must be day (MM/DD/YYYY)
    let d = p1;
    let m = p2;
    if (p1 <= 12 && p2 > 12) {
      m = p1;
      d = p2;
    } else if (p1 <= 12 && p2 <= 12) {
      // Ambiguous date e.g. 03/04/2026
      // In Indian Zerodha reports, default standard is DD/MM/YYYY
      if (options.preferFormat === 'MM/DD/YYYY') {
        m = p1;
        d = p2;
      } else {
        d = p1;
        m = p2;
      }
    }

    if (isValidCalendarDate(y, m, d)) {
      return {
        dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isAmbiguous: (p1 <= 12 && p2 <= 12),
        error: null,
      };
    }
    return { dateStr: null, error: `Invalid calendar date in ${rawStr}` };
  }

  // Pattern C: DD-Mon-YYYY (e.g. 24-Mar-2026, 24-MAR-2026)
  const monthMap = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  const dMonYMatch = dateOnlyPart.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{4})$/);
  if (dMonYMatch) {
    const d = parseInt(dMonYMatch[1], 10);
    const monStr = dMonYMatch[2].slice(0, 3).toLowerCase();
    const y = parseInt(dMonYMatch[3], 10);
    const m = monthMap[monStr];
    if (m && isValidCalendarDate(y, m, d)) {
      return { dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, error: null };
    }
  }

  // Fallback to Date.parse
  const parsed = new Date(rawStr);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}`, error: null };
  }

  return { dateStr: null, error: `Unrecognized date format: "${rawStr}"` };
}

function isValidCalendarDate(year, month, day) {
  if (year < 1970 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}
