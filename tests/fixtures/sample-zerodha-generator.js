import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Creates realistic Zerodha sample workbook fixture:
 * - Multiple trading dates (2026-03-23, 2026-03-24, 2026-03-25)
 * - Multiple instruments (RELIANCE, INFY, TCS, HDFCBANK, TATAMOTORS)
 * - Closed intraday positions (profitable and loss-making)
 * - Open position with leftover shares (testing cash flow vs realized P&L)
 * - Sell before buy (testing short/delivery warnings)
 * - Duplicate legitimate order fills with same timestamp/price
 * - Charges column
 */
export function createSyntheticZerodhaWorkbook() {
  const data = [
    // Zerodha typical headers
    ['Trade Date', 'Trading Symbol', 'Exchange', 'Segment', 'Trade Type', 'Quantity', 'Price', 'Trade Value', 'Order ID', 'Trade ID', 'Charges'],
    
    // Day 1: 2026-03-23
    ['2026-03-23', 'RELIANCE', 'NSE', 'EQ', 'BUY', 10, 2500.00, 25000.00, '1100000001', 'TRD001', 15.50],
    ['2026-03-23', 'RELIANCE', 'NSE', 'EQ', 'SELL', 10, 2540.00, 25400.00, '1100000002', 'TRD002', 15.80],
    ['2026-03-23', 'INFY', 'NSE', 'EQ', 'BUY', 20, 1500.00, 30000.00, '1100000003', 'TRD003', 18.00],
    ['2026-03-23', 'INFY', 'NSE', 'EQ', 'SELL', 20, 1485.00, 29700.00, '1100000004', 'TRD004', 18.00],

    // Day 2: 2026-03-24
    // Partial sell leaving open inventory (Buy 100, Sell 60)
    ['2026-03-24', 'TCS', 'NSE', 'EQ', 'BUY', 100, 3800.00, 380000.00, '1200000001', 'TRD005', 120.00],
    ['2026-03-24', 'TCS', 'NSE', 'EQ', 'SELL', 60, 3850.00, 231000.00, '1200000002', 'TRD006', 75.00],
    
    // Multiple fills for HDFCBANK (legitimate identical orders)
    ['2026-03-24', 'HDFCBANK', 'NSE', 'EQ', 'BUY', 25, 1600.00, 40000.00, '1200000003', 'TRD007', 22.00],
    ['2026-03-24', 'HDFCBANK', 'NSE', 'EQ', 'BUY', 25, 1600.00, 40000.00, '1200000003', 'TRD008', 22.00],
    ['2026-03-24', 'HDFCBANK', 'NSE', 'EQ', 'SELL', 50, 1620.00, 81000.00, '1200000004', 'TRD009', 45.00],

    // Day 3: 2026-03-25
    // Sell before buy (e.g. intraday short or delivery sell)
    ['2026-03-25', 'TATAMOTORS', 'NSE', 'EQ', 'SELL', 50, 950.00, 47500.00, '1300000001', 'TRD010', 30.00],
    ['2026-03-25', 'TATAMOTORS', 'NSE', 'EQ', 'BUY', 50, 940.00, 47000.00, '1300000002', 'TRD011', 30.00],
    // Reliance on 3rd date
    ['2026-03-25', 'RELIANCE', 'NSE', 'EQ', 'BUY', 15, 2550.00, 38250.00, '1300000003', 'TRD012', 24.00],
    ['2026-03-25', 'RELIANCE', 'NSE', 'EQ', 'SELL', 15, 2580.00, 38700.00, '1300000004', 'TRD013', 24.00],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'TradeBook');

  return wb;
}

// Generate the sample file on disk for users to download or test
export function writeFixtureFile(destPath) {
  const wb = createSyntheticZerodhaWorkbook();
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(destPath, buf);
}
