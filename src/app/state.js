/**
 * Central State Management
 * Holds imported workbook, normalized records, computed metrics, filters, and UI selections.
 */

export const state = {
  // File metadata
  file: null,
  fileName: '',
  fileSize: 0,
  isProcessing: false,
  error: null,

  // Sheet detection & selection
  sheetAnalyses: [],
  selectedSheetName: '',

  // Column mapping
  rawHeaders: [],
  rawRows: [],
  columnMapping: {},
  isMappingConfirmed: true,

  // Normalized trades & issues
  validTrades: [],
  invalidRecords: [],
  warnings: [],

  // Aggregated calculation results
  stockSummaries: [],
  dailySummaries: [],
  overallSummary: null,

  // UI Filters & State
  selectedDate: 'ALL', // 'ALL' or specific 'YYYY-MM-DD'
  searchSymbol: '',
  sortColumn: 'tradeDate',
  sortDirection: 'asc', // 'asc' or 'desc'

  // Modal / Accordion inspection
  expandedRows: new Set(), // Set of stockSummary id strings
  inspectedStock: null, // { date, symbol, trades: [] }
  showHelpModal: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  for (const fn of listeners) {
    fn(state);
  }
}

export function resetState() {
  state.file = null;
  state.fileName = '';
  state.fileSize = 0;
  state.isProcessing = false;
  state.error = null;
  state.sheetAnalyses = [];
  state.selectedSheetName = '';
  state.rawHeaders = [];
  state.rawRows = [];
  state.columnMapping = {};
  state.isMappingConfirmed = true;
  state.validTrades = [];
  state.invalidRecords = [];
  state.warnings = [];
  state.stockSummaries = [];
  state.dailySummaries = [];
  state.overallSummary = null;
  state.selectedDate = 'ALL';
  state.searchSymbol = '';
  state.sortColumn = 'tradeDate';
  state.sortDirection = 'asc';
  state.expandedRows = new Set();
  state.inspectedStock = null;
  state.showHelpModal = false;
  notify();
}
