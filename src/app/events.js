/**
 * Event handling and pipeline orchestration
 */

import { state, notify } from './state.js';
import { parseExcelWorkbook } from '../services/excel-import.js';
import { normalizeTradeRecords } from '../services/trade-normalizer.js';
import { calculateTradeMetrics } from '../services/trade-calculator.js';

export function setupEventHandlers() {
  window.addEventListener('file-selected', async (e) => {
    const file = e.detail?.file;
    if (!file) return;

    try {
      state.isProcessing = true;
      state.fileName = file.name;
      state.fileSize = file.size;
      notify();

      const parsed = await parseExcelWorkbook(file);

      if (parsed.plausibleSheets.length === 0) {
        throw new Error(
          `No valid trade sheets found in "${file.name}". Ensure the Excel file contains columns like Symbol, Trade Date, Quantity, and Price.`
        );
      }

      // Default to first plausible sheet
      const sheet = parsed.plausibleSheets[0];
      state.selectedSheetName = sheet.sheetName;
      state.rawHeaders = sheet.headers;
      state.rawRows = sheet.dataRows;
      state.columnMapping = sheet.mappingResult.mapping;

      if (!sheet.mappingResult.isComplete) {
        // Needs manual mapping
        state.isMappingConfirmed = false;
      } else {
        // Process directly
        state.isMappingConfirmed = true;
        const { validTrades, invalidRecords, warnings } = normalizeTradeRecords(state.rawRows, state.columnMapping);
        state.validTrades = validTrades;
        state.invalidRecords = invalidRecords;
        state.warnings = warnings;

        const metrics = calculateTradeMetrics(validTrades);
        state.stockSummaries = metrics.stockSummaries;
        state.dailySummaries = metrics.dailySummaries;
        state.overallSummary = metrics.overallSummary;
      }

      state.isProcessing = false;
      notify();
    } catch (err) {
      console.error('[Zerodha Trade Analyzer] Error processing file:', err);
      state.isProcessing = false;
      state.fileName = '';
      state.fileSize = 0;
      alert(`Error processing file: ${err.message}`);
      notify();
    }
  });
}
