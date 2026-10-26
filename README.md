# Zerodha Trade Analyzer

> **Analyze your trades. Understand your daily performance.**  
> A browser-native financial processing application for Zerodha Console tradebook Excel exports (`.xlsx`, `.xls`).

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()
[![Privacy](https://img.shields.io/badge/privacy-100%25%20client--side-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview

**Zerodha Trade Analyzer** parses tradebook files downloaded directly from Zerodha Console, computes stock-wise buy/sell quantities and values, distinguishes cash flows from true realized trading P&L, identifies open inventory, allows drill-down inspection into individual execution records, and exports clean, formatted 5-sheet audit workbooks.

All computations occur **100% client-side** inside the browser. No spreadsheets, trade IDs, or personal records are ever transmitted over the network.

---

## Key Features

1. **Local & Private Execution**: Works completely offline after page load without server-side dependencies or database storage.
2. **Multi-Date Intelligence**: Handles multi-day reports effortlessly. Computes daily aggregates and stock-wise summaries for each trading date independently without leaking trades across dates.
3. **Deterministic Financial Accounting**:
   - Distinguishes **Net Cash Flow** from **Realized P&L**.
   - Uses **First-In, First-Out (FIFO)** matching for intraday square-offs.
   - Detects **Open Long** inventory and flags unclosed positions rather than misreporting leftover capital as trading loss.
   - Identifies **Short Sales / Delivery Trades** where sell execution precedes intraday buy, warning that prior cost-basis inventory is required.
   - Avoids binary floating-point round-off errors using decimal/paise arithmetic.
4. **Flexible Column Mapping**: Automatically recognizes standard Zerodha headers and aliases, with a manual mapping fallback screen for customized or non-standard workbooks.
5. **Interactive Trading Dashboard**:
   - Trading Date Selector (`All Dates` or specific single days).
   - Real-time stock search and column sorting (By Date, Symbol, Buy Value, Net Cash Flow, etc.).
   - Execution drill-down modal to inspect the exact trades and order IDs contributing to any stock row.
   - Validation report highlighting ignored blanks, ambiguous date formats, and possible duplicate order fills.
6. **Comprehensive 5-Sheet Excel Export**:
   - **Sheet 1**: Stock-wise Summary (Date, Symbol, Buy/Sell Counts, Qty, Values, Average Prices, Cash Flow, Realized P&L, Status)
   - **Sheet 2**: Daily Summary (Trading Date, Scrip Count, Daily Totals, Net Cash Flow, P&L)
   - **Sheet 3**: Individual Trades (Normalized execution records with Order/Trade IDs and Source Row trace)
   - **Sheet 4**: Validation Report (Full audit trail of invalid rows and warnings)
   - **Sheet 5**: Methodology (Transparent documentation of formulas and accounting limitations)

---

## How to Get Your Zerodha Tradebook

1. Go to [Zerodha Console](https://console.zerodha.com).
2. Navigate to **Reports** → **Tradebook**.
3. Choose your desired Date Range and click the arrow button.
4. Click **Download: XLSX**.
5. Drag and drop the downloaded file into Zerodha Trade Analyzer or click **Choose File**.

---

## Technology Stack

- **HTML5 & Vanilla CSS3** with curated trading-terminal dark aesthetic (Tokens, Cards, Badges, Modals).
- **Modern JavaScript (ES Modules)** with clean modular separation of concerns.
- **SheetJS (`xlsx`)** for client-side workbook reading and generation.
- **Vite** for zero-config bundling and GitHub Pages compatibility.
- **Vitest** for automated unit and integration tests.
- **GitHub Actions** for CI testing and automated GitHub Pages static deployment.

---

## Local Development & Testing

### Prerequisites
- Node.js (v18+ or v20 LTS recommended)
- npm (v9+)

### Installation
```bash
# Clone the repository
git clone https://github.com/yavnesh/zerodha-trade-analyzer.git
cd zerodha-trade-analyzer

# Install dependencies
npm install
```

### Running Locally
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Running Automated Tests
```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Building for Production
```bash
npm run build
```
The compiled static assets will be located in the `dist/` directory.

### Previewing the Production Build
```bash
npm run preview
```

---

## Deploying to GitHub Pages

The repository includes a ready-to-use GitHub Actions workflow located in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Step-by-step Setup:
1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git
   git branch -M main
   git push -u origin main
   ```
2. In your GitHub repository, navigate to **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. Every push to `main` will automatically trigger the test suite, build the static assets, and deploy to GitHub Pages.

---

## Accounting Methodology & Disclaimers

- **Intraday vs Delivery**: Zerodha's tradebook export contains executed transactions. If you bought shares that were carried forward into overnight holdings, the cash spent is deducted in **Net Cash Flow**, but is **not** a realized loss because the stock asset remains in your demat account.
- **Charges & Brokerage**: When trade-level charges are present in the uploaded report, they are tracked and shown separately. No hypothetical brokerage or STT formulas are assumed.
- **Disclaimer**: This tool is designed strictly for trade visualization and personal recordkeeping. It does not constitute investment advice, accounting certification, or tax advice. Users should independently reconcile totals with their official Zerodha Tax P&L statements before filing tax returns.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
