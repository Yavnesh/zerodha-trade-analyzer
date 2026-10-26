/**
 * Safe DOM rendering functions and view components
 */

import { state, resetState, notify } from './state.js';
import { formatINR, formatQuantity } from '../utils/currency.js';
import { generateExportWorkbook, triggerWorkbookDownload } from '../services/excel-export.js';
import { LOGICAL_FIELDS } from '../services/column-mapper.js';
import { normalizeTradeRecords } from '../services/trade-normalizer.js';
import { calculateTradeMetrics } from '../services/trade-calculator.js';

export function renderApp(container) {
  container.innerHTML = '';

  // App Layout Shell
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  // 1. Header
  shell.appendChild(renderHeader());

  // 2. Main Content
  const main = document.createElement('main');
  main.className = 'main-content';

  if (!state.fileName) {
    // Empty state / Upload prompt
    main.appendChild(renderEmptyState());
  } else {
    // If workbook requires column mapping confirmation
    if (!state.isMappingConfirmed) {
      main.appendChild(renderColumnMappingScreen());
    } else {
      // Main Dashboard
      main.appendChild(renderFileBanner());
      if (state.warnings.length > 0 || state.invalidRecords.length > 0) {
        main.appendChild(renderValidationBanner());
      }
      main.appendChild(renderSummaryCards());
      main.appendChild(renderToolbar());
      main.appendChild(renderStockTable());
    }
  }

  shell.appendChild(main);

  // 3. Footer
  shell.appendChild(renderFooter());

  // 4. Modals (Trade inspection & Help)
  if (state.inspectedStock) {
    shell.appendChild(renderTradeInspectionModal());
  }
  if (state.showHelpModal) {
    shell.appendChild(renderHelpModal());
  }

  container.appendChild(shell);
}

function renderHeader() {
  const header = document.createElement('header');
  header.className = 'app-header';

  const container = document.createElement('div');
  container.className = 'header-container';

  const brand = document.createElement('div');
  brand.className = 'brand-section';
  brand.innerHTML = `
    <span class="brand-badge">ZERODHA</span>
    <div>
      <h1 class="brand-title">Zerodha Trade Analyzer</h1>
      <p class="brand-subtitle">Analyze your trades. Understand your daily performance.</p>
    </div>
  `;

  const actions = document.createElement('div');
  actions.className = 'header-actions';
  actions.innerHTML = `
    <div class="privacy-pill" title="No network transmission. Processing happens 100% in your browser.">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Client-side & Private
    </div>
    <button class="btn btn-secondary btn-sm" id="btn-how-it-works">How It Works</button>
    <a href="https://github.com/yavnesh/zerodha-trade-analyzer" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">GitHub</a>
  `;

  actions.querySelector('#btn-how-it-works').addEventListener('click', () => {
    state.showHelpModal = true;
    notify();
  });

  container.appendChild(brand);
  container.appendChild(actions);
  header.appendChild(container);
  return header;
}

function renderEmptyState() {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state-wrapper';
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '1.5rem';

  // Upload card
  const card = document.createElement('div');
  card.className = 'card';

  const dropzone = document.createElement('div');
  dropzone.className = 'upload-dropzone';
  dropzone.id = 'upload-dropzone';
  dropzone.innerHTML = `
    <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
    <h2 class="upload-title">Drop your Zerodha Tradebook here</h2>
    <p class="upload-desc">Select or drag & drop your tradebook Excel export (.xlsx, .xls) downloaded from Zerodha Console (Reports → Tradebook).</p>
    <div style="display:flex; gap:0.75rem; margin-top:0.5rem; flex-wrap:wrap; justify-content:center;">
      <button class="btn btn-primary" id="btn-browse-file">Choose File</button>
      <a href="./sample-zerodha-tradebook.xlsx" download="sample-zerodha-tradebook.xlsx" class="btn btn-secondary">
        Download Sample Workbook
      </a>
    </div>
    <input type="file" id="file-input" accept=".xlsx,.xls" style="display: none;" />
  `;

  // Attach file upload listeners
  const fileInput = dropzone.querySelector('#file-input');
  dropzone.querySelector('#btn-browse-file').addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      window.dispatchEvent(new CustomEvent('file-selected', { detail: { file: e.target.files[0] } }));
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-active');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      window.dispatchEvent(new CustomEvent('file-selected', { detail: { file: e.dataTransfer.files[0] } }));
    }
  });

  card.appendChild(dropzone);
  wrapper.appendChild(card);

  // Informative sample format guidance
  const guideCard = document.createElement('div');
  guideCard.className = 'card';
  guideCard.innerHTML = `
    <h3 style="font-size:1rem; font-weight:600; margin-bottom:0.75rem;">How to download your Zerodha Tradebook:</h3>
    <ol style="padding-left:1.25rem; font-size:0.85rem; color:var(--text-muted); line-height:1.7;">
      <li>Log in to <strong style="color:var(--text-main);">Zerodha Console</strong> (console.zerodha.com).</li>
      <li>Navigate to <strong style="color:var(--text-main);">Reports</strong> → <strong style="color:var(--text-main);">Tradebook</strong>.</li>
      <li>Select your desired Date Range (single day or multiple dates) and click the arrow button.</li>
      <li>Click <strong style="color:var(--text-main);">Download: XLSX</strong>.</li>
      <li>Upload the downloaded file directly into this tool. Zero data leaves your computer.</li>
    </ol>
  `;
  wrapper.appendChild(guideCard);

  return wrapper;
}

function renderFileBanner() {
  const banner = document.createElement('div');
  banner.className = 'card';
  banner.style.display = 'flex';
  banner.style.justifyContent = 'space-between';
  banner.style.alignItems = 'center';
  banner.style.flexWrap = 'wrap';
  banner.style.gap = '1rem';

  const info = document.createElement('div');
  const sizeKb = (state.fileSize / 1024).toFixed(1);
  const detectedDates = state.dailySummaries.map(d => d.tradeDate).sort();
  const dateRangeStr = detectedDates.length > 0 
    ? (detectedDates.length === 1 ? detectedDates[0] : `${detectedDates[0]} to ${detectedDates[detectedDates.length - 1]}`)
    : 'None';

  info.innerHTML = `
    <div style="font-weight:600; font-size:1rem; color:var(--text-main);">${escapeHtml(state.fileName)}</div>
    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
      Size: ${sizeKb} KB | Valid Trades: <strong style="color:var(--text-main);">${state.validTrades.length}</strong> | 
      Dates: <strong style="color:var(--text-main);">${dateRangeStr}</strong> (${detectedDates.length} trading day${detectedDates.length > 1 ? 's' : ''})
    </div>
  `;

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '0.5rem';

  // Download Excel
  const btnExport = document.createElement('button');
  btnExport.className = 'btn btn-success';
  btnExport.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Download Excel
  `;
  btnExport.addEventListener('click', () => {
    const wb = generateExportWorkbook({
      stockSummaries: state.stockSummaries,
      dailySummaries: state.dailySummaries,
      validTrades: state.validTrades,
      invalidRecords: state.invalidRecords,
      warnings: state.warnings,
    });
    const prefix = detectedDates.length === 1 ? detectedDates[0] : `${detectedDates[0]}-to-${detectedDates[detectedDates.length - 1]}`;
    triggerWorkbookDownload(wb, `zerodha-trade-analysis-${prefix}.xlsx`);
  });

  // Clear / Reset
  const btnReset = document.createElement('button');
  btnReset.className = 'btn btn-danger-outline';
  btnReset.textContent = 'Clear Data';
  btnReset.addEventListener('click', () => {
    if (confirm('Clear current session and reset all imported data?')) {
      resetState();
    }
  });

  btnGroup.appendChild(btnExport);
  btnGroup.appendChild(btnReset);

  banner.appendChild(info);
  banner.appendChild(btnGroup);
  return banner;
}

function renderValidationBanner() {
  const container = document.createElement('div');
  const hasErrors = state.invalidRecords.length > 0;
  
  const alert = document.createElement('div');
  alert.className = hasErrors ? 'alert alert-warning' : 'alert alert-info';
  
  alert.innerHTML = `
    <div>
      <strong>Import Validation Notice:</strong> 
      ${hasErrors ? `${state.invalidRecords.length} row(s) had errors and were excluded from financial calculations.` : ''}
      ${state.warnings.length > 0 ? `${state.warnings.length} warning(s) detected (e.g. possible duplicate fills or ambiguous dates). All valid records were retained.` : ''}
      <button class="btn btn-secondary btn-sm" id="btn-view-validation" style="margin-left:0.75rem;">View Validation Report</button>
    </div>
  `;

  alert.querySelector('#btn-view-validation').addEventListener('click', () => {
    showValidationModal();
  });

  container.appendChild(alert);
  return container;
}

function renderSummaryCards() {
  const grid = document.createElement('div');
  grid.className = 'summary-grid';

  // Calculate numbers based on selected date
  let buyVal = 0;
  let sellVal = 0;
  let netCash = 0;
  let buyCount = 0;
  let sellCount = 0;
  let instCount = 0;
  let realizedPnL = null;
  let isPnLReliable = false;
  let hasOpenPositions = false;

  if (state.selectedDate === 'ALL') {
    const o = state.overallSummary;
    buyVal = o.totalBuyVal;
    sellVal = o.totalSellVal;
    netCash = o.netCashFlow;
    buyCount = o.buyCount;
    sellCount = o.sellCount;
    instCount = o.instrumentCount;
    realizedPnL = o.realizedPnL;
    isPnLReliable = o.isPnLReliable;
    hasOpenPositions = !o.allPositionsClosed;
  } else {
    const d = state.dailySummaries.find(item => item.tradeDate === state.selectedDate);
    if (d) {
      buyVal = d.totalBuyVal;
      sellVal = d.totalSellVal;
      netCash = d.netCashFlow;
      buyCount = d.buyCount;
      sellCount = d.sellCount;
      instCount = d.instrumentCount;
      realizedPnL = d.realizedPnL;
      isPnLReliable = d.isPnLReliable;
      hasOpenPositions = d.hasOpenPositions;
    }
  }

  // Card 1: Instruments & Executions
  grid.appendChild(createMetricCard(
    state.selectedDate === 'ALL' ? 'Total Instruments' : 'Instruments Traded',
    `${instCount} Scrips`,
    `${buyCount} Buys • ${sellCount} Sells`
  ));

  // Card 2: Total Buy Value
  grid.appendChild(createMetricCard(
    'Total Buy Value',
    formatINR(buyVal),
    `Across ${buyCount} execution${buyCount === 1 ? '' : 's'}`
  ));

  // Card 3: Total Sell Value
  grid.appendChild(createMetricCard(
    'Total Sell Value',
    formatINR(sellVal),
    `Across ${sellCount} execution${sellCount === 1 ? '' : 's'}`
  ));

  // Card 4: Net Cash Flow
  const netCashClass = netCash > 0 ? 'pnl-pos' : (netCash < 0 ? 'pnl-neg' : 'pnl-zero');
  grid.appendChild(createMetricCard(
    'Net Cash Flow',
    formatINR(netCash, true),
    'Total Sell Value minus Buy Value',
    netCashClass
  ));

  // Card 5: Realized P&L (Strict Accounting)
  let pnlDisplay = '—';
  let pnlSub = 'Open inventory / Prior cost basis needed';
  let pnlClass = 'pnl-zero';

  if (isPnLReliable && realizedPnL !== null) {
    pnlDisplay = formatINR(realizedPnL, true);
    pnlClass = realizedPnL > 0 ? 'pnl-pos' : (realizedPnL < 0 ? 'pnl-neg' : 'pnl-zero');
    pnlSub = 'All positions squared off';
  } else {
    pnlDisplay = 'N/A';
    pnlSub = hasOpenPositions ? 'Contains open or delivery positions' : 'P&L requires opening cost basis';
  }

  grid.appendChild(createMetricCard(
    'Realized Trading P&L',
    pnlDisplay,
    pnlSub,
    pnlClass
  ));

  return grid;
}

function createMetricCard(label, value, sub, valueClass = '') {
  const card = document.createElement('div');
  card.className = 'metric-card';
  card.innerHTML = `
    <div class="metric-label">${escapeHtml(label)}</div>
    <div class="metric-value ${valueClass}">${escapeHtml(value)}</div>
    <div class="metric-sub">${escapeHtml(sub)}</div>
  `;
  return card;
}

function renderToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar-section';

  // Date Filter Selector
  const dateGroup = document.createElement('div');
  dateGroup.className = 'filter-group';
  dateGroup.innerHTML = `<label style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">Trading Date:</label>`;
  
  const dateSelect = document.createElement('select');
  dateSelect.className = 'form-select';
  dateSelect.id = 'date-filter-select';
  
  const optAll = document.createElement('option');
  optAll.value = 'ALL';
  optAll.textContent = `All Dates (${state.dailySummaries.length} days)`;
  optAll.selected = state.selectedDate === 'ALL';
  dateSelect.appendChild(optAll);

  state.dailySummaries.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.tradeDate;
    opt.textContent = `${d.tradeDate} (${d.instrumentCount} stocks)`;
    opt.selected = state.selectedDate === d.tradeDate;
    dateSelect.appendChild(opt);
  });

  dateSelect.addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    notify();
  });
  dateGroup.appendChild(dateSelect);

  // Search input
  const searchGroup = document.createElement('div');
  searchGroup.className = 'filter-group';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'form-input';
  searchInput.placeholder = 'Search stock symbol...';
  searchInput.value = state.searchSymbol;
  searchInput.addEventListener('input', (e) => {
    state.searchSymbol = e.target.value.trim().toUpperCase();
    notify();
  });
  searchGroup.appendChild(searchInput);

  toolbar.appendChild(dateGroup);
  toolbar.appendChild(searchGroup);
  return toolbar;
}

function renderStockTable() {
  const container = document.createElement('div');
  container.className = 'table-container';

  // Filter stock summaries
  let filtered = state.stockSummaries.filter(s => {
    if (state.selectedDate !== 'ALL' && s.tradeDate !== state.selectedDate) {
      return false;
    }
    if (state.searchSymbol && !s.symbol.includes(state.searchSymbol)) {
      return false;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let vA = a[state.sortColumn];
    let vB = b[state.sortColumn];
    if (vA === null || vA === undefined) vA = '';
    if (vB === null || vB === undefined) vB = '';
    if (typeof vA === 'string') {
      return state.sortDirection === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
    }
    return state.sortDirection === 'asc' ? vA - vB : vB - vA;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
        No stocks match the selected filters.
      </div>
    `;
    return container;
  }

  const table = document.createElement('table');
  table.className = 'data-table';

  // Table Head
  const columns = [
    { key: 'tradeDate', label: 'Date', sortable: true },
    { key: 'symbol', label: 'Symbol', sortable: true },
    { key: 'exchange', label: 'Exch', sortable: false },
    { key: 'buyCount', label: 'Buys', sortable: true, isNum: true },
    { key: 'sellCount', label: 'Sells', sortable: true, isNum: true },
    { key: 'totalBuyQty', label: 'Buy Qty', sortable: true, isNum: true },
    { key: 'totalSellQty', label: 'Sell Qty', sortable: true, isNum: true },
    { key: 'totalBuyVal', label: 'Buy Value', sortable: true, isNum: true },
    { key: 'totalSellVal', label: 'Sell Value', sortable: true, isNum: true },
    { key: 'avgBuyPrice', label: 'Avg Buy', sortable: true, isNum: true },
    { key: 'avgSellPrice', label: 'Avg Sell', sortable: true, isNum: true },
    { key: 'netQty', label: 'Net Qty', sortable: true, isNum: true },
    { key: 'netCashFlow', label: 'Net Cash Flow', sortable: true, isNum: true },
    { key: 'realizedPnL', label: 'Realized P&L', sortable: true, isNum: true },
    { key: 'pnlStatus', label: 'Status', sortable: false },
    { key: 'actions', label: 'Action', sortable: false },
  ];

  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.isNum) th.className = 'text-num';
    if (col.sortable) {
      th.classList.add('sortable');
      if (state.sortColumn === col.key) {
        th.textContent += state.sortDirection === 'asc' ? ' ↑' : ' ↓';
      }
      th.addEventListener('click', () => {
        if (state.sortColumn === col.key) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = col.key;
          state.sortDirection = 'asc';
        }
        notify();
      });
    }
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  // Table Body
  const tbody = document.createElement('tbody');
  filtered.forEach(s => {
    const tr = document.createElement('tr');

    const netCashClass = s.netCashFlow > 0 ? 'pnl-pos' : (s.netCashFlow < 0 ? 'pnl-neg' : 'pnl-zero');
    let pnlDisplay = '—';
    let pnlClass = 'pnl-zero';
    if (s.isPnLReliable && s.realizedPnL !== null) {
      pnlDisplay = formatINR(s.realizedPnL, true);
      pnlClass = s.realizedPnL > 0 ? 'pnl-pos' : (s.realizedPnL < 0 ? 'pnl-neg' : 'pnl-zero');
    }

    let statusBadge = '';
    if (s.pnlStatus === 'CLOSED') {
      statusBadge = `<span class="badge badge-success">Closed</span>`;
    } else if (s.pnlStatus === 'OPEN_LONG') {
      statusBadge = `<span class="badge badge-warning" title="${escapeHtml(s.pnlNotice)}">Open Long</span>`;
    } else {
      statusBadge = `<span class="badge badge-danger" title="${escapeHtml(s.pnlNotice)}">Prior Holding</span>`;
    }

    tr.innerHTML = `
      <td>${s.tradeDate}</td>
      <td><strong>${s.symbol}</strong></td>
      <td><span class="badge badge-neutral">${s.exchange}</span></td>
      <td class="text-num">${s.buyCount}</td>
      <td class="text-num">${s.sellCount}</td>
      <td class="text-num">${formatQuantity(s.totalBuyQty)}</td>
      <td class="text-num">${formatQuantity(s.totalSellQty)}</td>
      <td class="text-num">${formatINR(s.totalBuyVal)}</td>
      <td class="text-num">${formatINR(s.totalSellVal)}</td>
      <td class="text-num">${s.avgBuyPrice ? formatINR(s.avgBuyPrice) : '—'}</td>
      <td class="text-num">${s.avgSellPrice ? formatINR(s.avgSellPrice) : '—'}</td>
      <td class="text-num">${formatQuantity(s.netQty)}</td>
      <td class="text-num ${netCashClass}">${formatINR(s.netCashFlow, true)}</td>
      <td class="text-num ${pnlClass}">${pnlDisplay}</td>
      <td>${statusBadge}</td>
      <td><button class="btn btn-secondary btn-sm btn-inspect-trades">Inspect</button></td>
    `;

    tr.querySelector('.btn-inspect-trades').addEventListener('click', () => {
      const associatedTrades = state.validTrades.filter(t => s.tradeIds.includes(t.id));
      state.inspectedStock = {
        date: s.tradeDate,
        symbol: s.symbol,
        summary: s,
        trades: associatedTrades,
      };
      notify();
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
  return container;
}

function renderTradeInspectionModal() {
  const { date, symbol, summary, trades } = state.inspectedStock;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-content';

  modal.innerHTML = `
    <div class="modal-header">
      <div>
        <h3 style="font-size:1.15rem; font-weight:700;">Individual Execution Records</h3>
        <p style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(symbol)} • Date: ${date} (${trades.length} trades)</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕ Close</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:1rem; padding:0.75rem; background:var(--bg-secondary); border-radius:var(--radius-sm); font-size:0.85rem; display:flex; gap:1.5rem; flex-wrap:wrap;">
        <div>Buy Qty: <strong>${formatQuantity(summary.totalBuyQty)}</strong></div>
        <div>Sell Qty: <strong>${formatQuantity(summary.totalSellQty)}</strong></div>
        <div>Net Cash Flow: <strong>${formatINR(summary.netCashFlow, true)}</strong></div>
        <div>Status: <strong>${summary.pnlStatus}</strong></div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Row #</th>
              <th>Side</th>
              <th class="text-num">Quantity</th>
              <th class="text-num">Price (₹)</th>
              <th class="text-num">Trade Value (₹)</th>
              <th>Order ID</th>
              <th>Trade ID</th>
              <th class="text-num">Charges</th>
            </tr>
          </thead>
          <tbody>
            ${trades.map(t => `
              <tr>
                <td>${t.sourceRowNum}</td>
                <td><span class="badge ${t.side === 'BUY' ? 'badge-success' : 'badge-danger'}">${t.side}</span></td>
                <td class="text-num">${formatQuantity(t.quantity)}</td>
                <td class="text-num">${formatINR(t.price)}</td>
                <td class="text-num">${formatINR(t.tradeValue)}</td>
                <td style="font-family:var(--font-mono); font-size:0.75rem;">${t.orderId || '—'}</td>
                <td style="font-family:var(--font-mono); font-size:0.75rem;">${t.tradeId || '—'}</td>
                <td class="text-num">${t.charges ? formatINR(t.charges) : '₹0.00'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" id="btn-modal-done">Back to Summary Table</button>
    </div>
  `;

  const closeModal = () => {
    state.inspectedStock = null;
    notify();
  };

  modal.querySelector('#btn-close-modal').addEventListener('click', closeModal);
  modal.querySelector('#btn-modal-done').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  overlay.appendChild(modal);
  return overlay;
}

function showValidationModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-content';

  modal.innerHTML = `
    <div class="modal-header">
      <h3 style="font-size:1.15rem; font-weight:700;">Validation & Integrity Report</h3>
      <button class="btn btn-secondary btn-sm" id="btn-close-val-modal">✕ Close</button>
    </div>
    <div class="modal-body">
      ${state.invalidRecords.length > 0 ? `
        <h4 style="color:var(--pnl-negative); margin-bottom:0.5rem; font-size:0.95rem;">Excluded Invalid Rows (${state.invalidRecords.length})</h4>
        <div class="table-container" style="margin-bottom:1.5rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Source Row</th>
                <th>Failure Reasons</th>
              </tr>
            </thead>
            <tbody>
              ${state.invalidRecords.map(r => `
                <tr>
                  <td>Row ${r.sourceRowNum}</td>
                  <td>${escapeHtml(r.reasons.join(', '))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${state.warnings.length > 0 ? `
        <h4 style="color:var(--warning-amber); margin-bottom:0.5rem; font-size:0.95rem;">Warnings / Notices (${state.warnings.length})</h4>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Type</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              ${state.warnings.map(w => `
                <tr>
                  <td>${w.sourceRowNum || '—'}</td>
                  <td><span class="badge badge-warning">${escapeHtml(w.type)}</span></td>
                  <td>${escapeHtml(w.message)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" id="btn-done-val">Close</button>
    </div>
  `;

  const close = () => overlay.remove();
  modal.querySelector('#btn-close-val-modal').addEventListener('click', close);
  modal.querySelector('#btn-done-val').addEventListener('click', close);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function renderHelpModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-content';

  modal.innerHTML = `
    <div class="modal-header">
      <h3 style="font-size:1.15rem; font-weight:700;">How Zerodha Trade Analyzer Works</h3>
      <button class="btn btn-secondary btn-sm" id="btn-close-help">✕ Close</button>
    </div>
    <div class="modal-body" style="line-height:1.6; font-size:0.875rem; color:var(--text-muted);">
      <h4 style="color:var(--text-main); font-size:0.95rem; margin-top:0.5rem;">1. Privacy & Security</h4>
      <p>This application does not transmit any trade data over the network. All spreadsheet parsing, financial calculations, and Excel exports happen entirely in your local browser engine.</p>
      
      <h4 style="color:var(--text-main); font-size:0.95rem; margin-top:1rem;">2. Net Cash Flow vs Realized P&L</h4>
      <p><strong>Net Cash Flow</strong> is the exact currency amount exchanged (Total Sell Value - Total Buy Value). It is <em>not</em> your realized profit if you still hold open inventory or carry forward positions into subsequent days. Realized P&L is only calculated when positions are fully squared off within the day using First-In-First-Out (FIFO) matching.</p>

      <h4 style="color:var(--text-main); font-size:0.95rem; margin-top:1rem;">3. Multi-Sheet Excel Export</h4>
      <p>When you click <strong>Download Excel</strong>, a comprehensive 5-sheet workbook is generated containing your Stock-wise Summary, Daily Summary, Individual Trades, Validation Report, and Accounting Methodology.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" id="btn-done-help">Got it</button>
    </div>
  `;

  const close = () => {
    state.showHelpModal = false;
    notify();
  };

  modal.querySelector('#btn-close-help').addEventListener('click', close);
  modal.querySelector('#btn-done-help').addEventListener('click', close);
  overlay.appendChild(modal);
  return overlay;
}

function renderColumnMappingScreen() {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h2 style="font-size:1.2rem; margin-bottom:0.5rem;">Confirm Column Mapping</h2>
    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem;">
      Some columns in "${escapeHtml(state.fileName)}" need verification. Please map the required trade fields below.
    </p>
    <div id="mapping-fields-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;"></div>
    <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
      <button class="btn btn-secondary" id="btn-cancel-mapping">Cancel</button>
      <button class="btn btn-primary" id="btn-confirm-mapping">Confirm & Analyze</button>
    </div>
  `;

  const container = card.querySelector('#mapping-fields-container');
  Object.entries(LOGICAL_FIELDS).forEach(([fieldKey, fieldDef]) => {
    const fieldBox = document.createElement('div');
    fieldBox.innerHTML = `
      <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem;">
        ${fieldDef.label} ${fieldDef.required ? '<span style="color:var(--pnl-negative)">*</span>' : '(Optional)'}
      </label>
      <select class="form-select" style="width:100%;" data-field="${fieldKey}">
        <option value="">-- Not Mapped --</option>
        ${state.rawHeaders.map(h => `
          <option value="${escapeHtml(h)}" ${state.columnMapping[fieldKey] === h ? 'selected' : ''}>${escapeHtml(h)}</option>
        `).join('')}
      </select>
    `;
    container.appendChild(fieldBox);
  });

  card.querySelector('#btn-cancel-mapping').addEventListener('click', () => resetState());
  card.querySelector('#btn-confirm-mapping').addEventListener('click', () => {
    // Read selections
    const selects = card.querySelectorAll('select[data-field]');
    selects.forEach(sel => {
      const field = sel.getAttribute('data-field');
      if (sel.value) {
        state.columnMapping[field] = sel.value;
      } else {
        delete state.columnMapping[field];
      }
    });

    // Check required
    const missing = Object.entries(LOGICAL_FIELDS).filter(([k, v]) => v.required && !state.columnMapping[k]);
    if (missing.length > 0) {
      alert(`Please map required fields: ${missing.map(m => m[1].label).join(', ')}`);
      return;
    }

    // Process rows
    state.isMappingConfirmed = true;
    const { validTrades, invalidRecords, warnings } = normalizeTradeRecords(state.rawRows, state.columnMapping);
    state.validTrades = validTrades;
    state.invalidRecords = invalidRecords;
    state.warnings = warnings;

    const metrics = calculateTradeMetrics(validTrades);
    state.stockSummaries = metrics.stockSummaries;
    state.dailySummaries = metrics.dailySummaries;
    state.overallSummary = metrics.overallSummary;

    notify();
  });

  return card;
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `
    <div>Zerodha Trade Analyzer • Processed locally in your browser with deterministic accounting</div>
    <div class="footer-links">
      <a href="https://github.com/yavnesh/zerodha-trade-analyzer" target="_blank" rel="noopener">GitHub Repository</a>
      <span>•</span>
      <a href="./sample-zerodha-tradebook.xlsx" download="sample-zerodha-tradebook.xlsx">Download Sample Workbook</a>
    </div>
  `;
  return footer;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
