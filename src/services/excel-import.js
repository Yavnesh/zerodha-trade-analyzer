/**
 * Excel Import Service using SheetJS
 * Reads uploaded ArrayBuffer / File, identifies relevant trade sheets,
 * detects header rows, checks sheet viability, and reports unreadable files.
 */

import * as XLSX from 'xlsx';
import { autoDetectColumnMapping } from './column-mapper.js';

export async function parseExcelWorkbook(file) {
  // Validate file
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  const validExtensions = ['.xlsx', '.xls'];
  const fileName = (file.name || '').toLowerCase();
  const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));
  
  // Read array buffer
  const buffer = await file.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('The uploaded file is empty (0 bytes).');
  }

  // If file doesn't have an explicit extension, verify that it is at least a valid Excel / zip file or attempt reading
  if (!hasValidExt && fileName.includes('.')) {
    throw new Error(`Unsupported file extension for "${file.name}". Please upload an Excel file (.xlsx or .xls).`);
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellNF: true,
      raw: false,
    });
  } catch (err) {
    throw new Error(`Failed to parse Excel workbook: ${err.message || 'Corrupted or password-protected file.'}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The workbook contains no sheets.');
  }

  // Analyze each sheet to find plausible trade sheets
  const sheetAnalyses = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Convert to 2D array of rows
    const rawMatrix = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (!rawMatrix || rawMatrix.length === 0) {
      sheetAnalyses.push({
        sheetName,
        isPlausible: false,
        rowCount: 0,
        headers: [],
        reason: 'Sheet is empty',
      });
      continue;
    }

    // Locate header row: scan first 50 rows for common trade keywords
    let headerRowIdx = -1;
    let bestHeaderMapping = null;

    for (let r = 0; r < Math.min(50, rawMatrix.length); r++) {
      const row = rawMatrix[r].map(c => String(c).trim());
      const mappingResult = autoDetectColumnMapping(row);
      if (mappingResult.confidence >= 0.5) {
        headerRowIdx = r;
        bestHeaderMapping = mappingResult;
        break;
      }
    }

    if (headerRowIdx !== -1 && bestHeaderMapping) {
      const headers = rawMatrix[headerRowIdx].map(c => String(c).trim());
      const dataRows = [];
      for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
        const rowVals = rawMatrix[r];
        const rowObj = { __rowNum__: r + 1 };
        headers.forEach((h, cIdx) => {
          if (h) {
            rowObj[h] = rowVals[cIdx] !== undefined ? rowVals[cIdx] : '';
          }
        });
        dataRows.push(rowObj);
      }

      sheetAnalyses.push({
        sheetName,
        isPlausible: true,
        headerRowIndex: headerRowIdx + 1,
        headers,
        dataRows,
        rowCount: dataRows.length,
        mappingResult: bestHeaderMapping,
      });
    } else {
      sheetAnalyses.push({
        sheetName,
        isPlausible: false,
        rowCount: rawMatrix.length,
        headers: rawMatrix[0] ? rawMatrix[0].map(c => String(c).trim()) : [],
        reason: 'Missing recognizable trade column headers (e.g. Symbol, Trade Date, Quantity, Price)',
      });
    }
  }

  const plausibleSheets = sheetAnalyses.filter(s => s.isPlausible);

  return {
    fileName: file.name,
    fileSize: file.size,
    sheetNames: workbook.SheetNames,
    sheetAnalyses,
    plausibleSheets,
    workbook,
  };
}
