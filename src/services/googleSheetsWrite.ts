import type {
  CatalogPart,
  MergedInventoryItem,
  SheetTransaction,
  ThamSoOverride,
} from '../types/inventory';
import { clearGoogleAccessToken } from '../lib/googleAuth';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const SHEET_NAMES = {
  CATALOG: 'Danh mục phụ tùng',
  TRANSACTIONS: 'PHU TUNG KHO',
  PARAMS: 'THAM SO',
  INDICATORS: 'TINH CHI SO',
} as const;

export class GoogleSheetsAuthExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSheetsAuthExpiredError';
  }
}

interface ValueRangeResponse {
  range?: string;
  values?: unknown[][];
}

async function sheetsApiRequest<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401) {
    clearGoogleAccessToken();
    throw new GoogleSheetsAuthExpiredError(
      'Phiên đăng nhập Google đã hết hạn. Vui lòng nhấn "Sign in with Google" để kết nối lại quyền ghi Google Sheets.'
    );
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const apiMsg =
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      parsed.error &&
      typeof parsed.error === 'object' &&
      'message' in parsed.error
        ? String((parsed.error as { message?: unknown }).message ?? '')
        : '';

    if (res.status === 403) {
      throw new Error(
        `Tài khoản Google chưa có quyền Chỉnh sửa (Editor) trên Google Sheet này${apiMsg ? ` (${apiMsg})` : ''}. Vui lòng mở quyền Editor cho tài khoản của bạn hoặc dùng link bản sao Google Sheet của bạn.`
      );
    }

    throw new Error(
      apiMsg || `Lỗi Google Sheets API (HTTP ${res.status}).`
    );
  }

  return (parsed ?? {}) as T;
}

async function getRangeValues(
  spreadsheetId: string,
  accessToken: string,
  range: string,
  valueRenderOption: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA' = 'FORMATTED_VALUE'
): Promise<unknown[][]> {
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueRenderOption=${valueRenderOption}`;
  const data = await sheetsApiRequest<ValueRangeResponse>(url, accessToken);
  return Array.isArray(data.values) ? data.values : [];
}

function buildTransactionRow(tx: {
  maGiaoDich: string;
  ngayIso: string;
  loaiGiaoDich: 'NHAP_NCC' | 'XUAT_SUA_CHUA';
  maPhuTung: string;
  soLuong: number;
  donGiaGiaoDich: number | null;
  maNhaCungCap: string;
  nhanVienThucHien: string;
  maDonDatHang: string;
  ghiChu: string;
  clientRequestId?: string;
}): (string | number)[] {
  return [
    tx.maGiaoDich,
    tx.ngayIso,
    tx.loaiGiaoDich,
    tx.maPhuTung,
    tx.soLuong,
    tx.donGiaGiaoDich !== null && Number.isFinite(tx.donGiaGiaoDich)
      ? tx.donGiaGiaoDich
      : '',
    tx.maNhaCungCap || '',
    tx.nhanVienThucHien || '',
    tx.maDonDatHang || '',
    tx.ghiChu || '',
    tx.clientRequestId || '',
  ];
}

function buildCatalogPartRow(part: {
  maPhuTung: string;
  tenPhuTung: string;
  donViTinh: string;
  dinhMucToiThieu: number;
  ghiChu: string;
  nhomPhuTung: string;
  giaNhapThamChieu: number;
  giaBanThamChieu: number;
  maNhaCungCapMacDinh: string;
  leadTimeRieng: number | null;
  tonDauKy: number;
  slDangDatChuaNhan: number;
}): (string | number)[] {
  return [
    part.maPhuTung,
    part.tenPhuTung,
    part.donViTinh,
    part.dinhMucToiThieu,
    part.ghiChu || '',
    part.nhomPhuTung || '',
    part.giaNhapThamChieu,
    part.giaBanThamChieu,
    part.maNhaCungCapMacDinh || 'NCC001',
    part.leadTimeRieng !== null && Number.isFinite(part.leadTimeRieng)
      ? part.leadTimeRieng
      : '',
    part.tonDauKy,
    part.slDangDatChuaNhan,
  ];
}

export async function appendTransactionToGoogleSheet(params: {
  spreadsheetId: string;
  accessToken: string;
  tx: {
    maGiaoDich: string;
    ngayIso: string;
    loaiGiaoDich: 'NHAP_NCC' | 'XUAT_SUA_CHUA';
    maPhuTung: string;
    soLuong: number;
    donGiaGiaoDich: number | null;
    maNhaCungCap: string;
    nhanVienThucHien: string;
    maDonDatHang: string;
    ghiChu: string;
    clientRequestId?: string;
  };
}): Promise<{ appended: boolean }> {
  const { spreadsheetId, accessToken, tx } = params;

  // Idempotency check against existing maGiaoDich in column A and clientRequestId in column K
  const existingCols = await getRangeValues(
    spreadsheetId,
    accessToken,
    `${SHEET_NAMES.TRANSACTIONS}!A:K`
  );
  for (let i = 1; i < existingCols.length; i++) {
    const code = String(existingCols[i]?.[0] ?? '').trim();
    const reqId = String(existingCols[i]?.[10] ?? '').trim();
    if (
      (code && code === tx.maGiaoDich) ||
      (tx.clientRequestId && reqId && reqId === tx.clientRequestId)
    ) {
      return { appended: false };
    }
  }

  const range = `${SHEET_NAMES.TRANSACTIONS}!A:K`;
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  await sheetsApiRequest(url, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      values: [buildTransactionRow(tx)],
    }),
  });

  return { appended: true };
}

async function ensurePartInIndicatorSheet(params: {
  spreadsheetId: string;
  accessToken: string;
  maPhuTung: string;
  tenPhuTung: string;
  computedValues?: (string | number)[];
}): Promise<void> {
  const { spreadsheetId, accessToken, maPhuTung, tenPhuTung, computedValues } = params;
  try {
    const rows = await getRangeValues(
      spreadsheetId,
      accessToken,
      `${SHEET_NAMES.INDICATORS}!A:P`,
      'FORMULA'
    );
    const exists = rows.some(
      (row, idx) =>
        idx > 0 &&
        String(row[0] ?? '').trim().toUpperCase() === maPhuTung.toUpperCase()
    );
    if (exists) return;

    const nextRowNum = Math.max(2, rows.length + 1);
    const templateRow = rows[1];
    let rowToAppend: (string | number)[];

    if (
      Array.isArray(templateRow) &&
      templateRow.some((cell) => typeof cell === 'string' && cell.startsWith('='))
    ) {
      rowToAppend = Array.from({ length: 16 }, (_, colIdx) => {
        if (colIdx === 0) return maPhuTung;
        const tpl = templateRow[colIdx];
        if (typeof tpl === 'string' && tpl.startsWith('=')) {
          return tpl.replace(/([A-Z])2(?![0-9])/g, `$1${nextRowNum}`);
        }
        if (colIdx === 1) return tenPhuTung;
        return computedValues?.[colIdx] ?? '';
      });
    } else if (computedValues) {
      rowToAppend = computedValues;
    } else {
      rowToAppend = [maPhuTung, tenPhuTung];
    }

    const url = `${SHEETS_API_BASE}/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(
      `${SHEET_NAMES.INDICATORS}!A:P`
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    await sheetsApiRequest(url, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        values: [rowToAppend],
      }),
    });
  } catch {
    // TINH CHI SO may not exist on minimal custom sheets; ignore gracefully
  }
}

export async function upsertCatalogPartInGoogleSheet(params: {
  spreadsheetId: string;
  accessToken: string;
  part: {
    maPhuTung: string;
    tenPhuTung: string;
    donViTinh: string;
    dinhMucToiThieu: number;
    ghiChu: string;
    nhomPhuTung: string;
    giaNhapThamChieu: number;
    giaBanThamChieu: number;
    maNhaCungCapMacDinh: string;
    leadTimeRieng: number | null;
    tonDauKy: number;
    slDangDatChuaNhan: number;
  };
}): Promise<{ action: 'updated' | 'appended' }> {
  const { spreadsheetId, accessToken, part } = params;
  const colA = await getRangeValues(
    spreadsheetId,
    accessToken,
    `${SHEET_NAMES.CATALOG}!A:A`
  );

  let foundRowIndex: number | null = null;
  for (let i = 1; i < colA.length; i++) {
    const code = String(colA[i]?.[0] ?? '').trim().toUpperCase();
    if (code === part.maPhuTung.toUpperCase()) {
      foundRowIndex = i + 1; // 1-based sheet row
      break;
    }
  }

  const rowValues = buildCatalogPartRow(part);

  if (foundRowIndex !== null) {
    const range = `${SHEET_NAMES.CATALOG}!A${foundRowIndex}:L${foundRowIndex}`;
    const url = `${SHEETS_API_BASE}/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    await sheetsApiRequest(url, accessToken, {
      method: 'PUT',
      body: JSON.stringify({ values: [rowValues] }),
    });
    return { action: 'updated' };
  }

  const appendUrl = `${SHEETS_API_BASE}/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(
    `${SHEET_NAMES.CATALOG}!A:L`
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  await sheetsApiRequest(appendUrl, accessToken, {
    method: 'POST',
    body: JSON.stringify({ values: [rowValues] }),
  });

  await ensurePartInIndicatorSheet({
    spreadsheetId,
    accessToken,
    maPhuTung: part.maPhuTung,
    tenPhuTung: part.tenPhuTung,
  });

  return { action: 'appended' };
}

export async function updateThamSoInGoogleSheet(params: {
  spreadsheetId: string;
  accessToken: string;
  thamSo: Omit<ThamSoOverride, 'active'>;
}): Promise<void> {
  const { spreadsheetId, accessToken, thamSo } = params;
  const rows = await getRangeValues(
    spreadsheetId,
    accessToken,
    `${SHEET_NAMES.PARAMS}!A1:B15`,
    'FORMULA'
  );

  const updates: Array<{ range: string; values: unknown[][] }> = [];
  for (let i = 1; i < rows.length; i++) {
    const label = String(rows[i]?.[0] ?? '').trim().toLowerCase();
    const existingVal = String(rows[i]?.[1] ?? '');
    const sheetRow = i + 1;
    if (!label) continue;

    if (label.includes('từ ngày')) {
      updates.push({
        range: `${SHEET_NAMES.PARAMS}!B${sheetRow}`,
        values: [[thamSo.tuNgayIso]],
      });
    } else if (label.includes('đến ngày')) {
      updates.push({
        range: `${SHEET_NAMES.PARAMS}!B${sheetRow}`,
        values: [[thamSo.denNgayIso]],
      });
    } else if (label.includes('ngày xem báo cáo')) {
      // Only overwrite if user changed date away from today's formula or static
      if (!existingVal.startsWith('=')) {
        updates.push({
          range: `${SHEET_NAMES.PARAMS}!B${sheetRow}`,
          values: [[thamSo.ngayXemBaoCaoIso]],
        });
      }
    } else if (label.includes('thời gian chờ')) {
      updates.push({
        range: `${SHEET_NAMES.PARAMS}!B${sheetRow}`,
        values: [[thamSo.leadTimeMacDinh]],
      });
    } else if (label.includes('đủ dùng thêm')) {
      updates.push({
        range: `${SHEET_NAMES.PARAMS}!B${sheetRow}`,
        values: [[thamSo.soNgayDuTruMongMuon]],
      });
    } else if (label.includes('cảnh báo trước')) {
      updates.push({
        range: `${SHEET_NAMES.PARAMS}!B${sheetRow}`,
        values: [[thamSo.soNgayCanhBaoTruoc]],
      });
    }
  }

  if (updates.length === 0) return;

  const url = `${SHEETS_API_BASE}/${encodeURIComponent(
    spreadsheetId
  )}/values:batchUpdate`;
  await sheetsApiRequest(url, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updates,
    }),
  });
}

export async function syncAllWebStateToGoogleSheet(params: {
  spreadsheetId: string;
  accessToken: string;
  items: MergedInventoryItem[];
  transactions: SheetTransaction[];
  thamSoOverride: ThamSoOverride | null;
}): Promise<{
  addedTxCount: number;
  syncedPartsCount: number;
  updatedThamSo: boolean;
}> {
  const { spreadsheetId, accessToken, items, transactions, thamSoOverride } = params;

  // 1. Sync custom/edited parts to "Danh mục phụ tùng" + ensure in "TINH CHI SO"
  const catColA = await getRangeValues(
    spreadsheetId,
    accessToken,
    `${SHEET_NAMES.CATALOG}!A:A`
  );
  const existingCatRows = new Map<string, number>();
  for (let i = 1; i < catColA.length; i++) {
    const code = String(catColA[i]?.[0] ?? '').trim().toUpperCase();
    if (code) existingCatRows.set(code, i + 1);
  }

  let syncedPartsCount = 0;
  const partsToAppend: (string | number)[][] = [];
  const batchPartUpdates: Array<{ range: string; values: (string | number)[][] }> = [];

  for (const item of items) {
    const c: CatalogPart = item.catalog;
    const isMissingFromSheet = !existingCatRows.has(c.maPhuTung.toUpperCase());
    if (c.source === 'WEBSITE_DB' || isMissingFromSheet) {
      const rowValues = buildCatalogPartRow(c);
      const rowNum = existingCatRows.get(c.maPhuTung.toUpperCase());
      if (rowNum) {
        batchPartUpdates.push({
          range: `${SHEET_NAMES.CATALOG}!A${rowNum}:L${rowNum}`,
          values: [rowValues],
        });
      } else {
        partsToAppend.push(rowValues);
      }
      syncedPartsCount++;
    }
  }

  if (batchPartUpdates.length > 0) {
    await sheetsApiRequest(
      `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: batchPartUpdates,
        }),
      }
    );
  }

  if (partsToAppend.length > 0) {
    await sheetsApiRequest(
      `${SHEETS_API_BASE}/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(
        `${SHEET_NAMES.CATALOG}!A:L`
      )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ values: partsToAppend }),
      }
    );

    for (const row of partsToAppend) {
      await ensurePartInIndicatorSheet({
        spreadsheetId,
        accessToken,
        maPhuTung: String(row[0]),
        tenPhuTung: String(row[1]),
      });
    }
  }

  // 2. Sync missing transactions (oldest -> newest) to "PHU TUNG KHO"
  const txRows = await getRangeValues(
    spreadsheetId,
    accessToken,
    `${SHEET_NAMES.TRANSACTIONS}!A:K`
  );
  const existingTxCodes = new Set<string>();
  const existingReqIds = new Set<string>();
  for (let i = 1; i < txRows.length; i++) {
    const code = String(txRows[i]?.[0] ?? '').trim().toUpperCase();
    const reqId = String(txRows[i]?.[10] ?? '').trim();
    if (code) existingTxCodes.add(code);
    if (reqId) existingReqIds.add(reqId);
  }

  const missingTx = [...transactions]
    .sort((a, b) => (a.seq ?? a.rowIndex) - (b.seq ?? b.rowIndex))
    .filter((tx) => {
      if (existingTxCodes.has(tx.maGiaoDich.toUpperCase())) return false;
      if (tx.clientRequestId && existingReqIds.has(tx.clientRequestId)) return false;
      return true;
    });

  if (missingTx.length > 0) {
    const txValues = missingTx.map((tx) =>
      buildTransactionRow({
        maGiaoDich: tx.maGiaoDich,
        ngayIso: tx.ngayIso,
        loaiGiaoDich: tx.loaiGiaoDich,
        maPhuTung: tx.maPhuTung,
        soLuong: tx.soLuong,
        donGiaGiaoDich: tx.donGiaGiaoDich,
        maNhaCungCap: tx.maNhaCungCap,
        nhanVienThucHien: tx.nhanVienThucHien,
        maDonDatHang: tx.maDonDatHang,
        ghiChu: tx.ghiChu,
        clientRequestId: tx.clientRequestId,
      })
    );

    await sheetsApiRequest(
      `${SHEETS_API_BASE}/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(
        `${SHEET_NAMES.TRANSACTIONS}!A:K`
      )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ values: txValues }),
      }
    );
  }

  // 3. Sync THAM SO if override active
  let updatedThamSo = false;
  if (thamSoOverride?.active) {
    await updateThamSoInGoogleSheet({
      spreadsheetId,
      accessToken,
      thamSo: thamSoOverride,
    });
    updatedThamSo = true;
  }

  return {
    addedTxCount: missingTx.length,
    syncedPartsCount,
    updatedThamSo,
  };
}

export const APPS_SCRIPT_CODE = `// Dán toàn bộ đoạn mã này vào: Tiện ích mở rộng -> Apps Script -> Lưu -> Triển khai (Web app -> Anyone)
const TABS = {
  CATALOG: 'Danh mục phụ tùng',
  TRANSACTIONS: 'PHU TUNG KHO',
  PARAMS: 'THAM SO',
  INDICATORS: 'TINH CHI SO',
};

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseIsoDate(iso) {
  var m = String(iso || '').match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!m) return iso || '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function appendTxInternal(ss, tx) {
  var sheet = ss.getSheetByName(TABS.TRANSACTIONS);
  if (!sheet) throw new Error('Không tìm thấy trang tính: ' + TABS.TRANSACTIONS);

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var existing = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
    for (var i = 0; i < existing.length; i++) {
      var code = String(existing[i][0] || '').trim();
      var reqId = String(existing[i][10] || '').trim();
      if ((code && code === tx.maGiaoDich) || (tx.clientRequestId && reqId === tx.clientRequestId)) {
        return false;
      }
    }
  }

  sheet.appendRow([
    tx.maGiaoDich || '',
    parseIsoDate(tx.ngayIso),
    tx.loaiGiaoDich || 'XUAT_SUA_CHUA',
    tx.maPhuTung || '',
    Number(tx.soLuong || 0),
    tx.donGiaGiaoDich !== null && tx.donGiaGiaoDich !== undefined && tx.donGiaGiaoDich !== '' ? Number(tx.donGiaGiaoDich) : '',
    tx.maNhaCungCap || '',
    tx.nhanVienThucHien || '',
    tx.maDonDatHang || '',
    tx.ghiChu || '',
    tx.clientRequestId || ''
  ]);
  return true;
}

function ensureIndicatorRow(ss, maPhuTung, tenPhuTung) {
  var sheet = ss.getSheetByName(TABS.INDICATORS);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < colA.length; i++) {
      if (String(colA[i][0] || '').trim().toUpperCase() === maPhuTung.toUpperCase()) {
        return;
      }
    }
  }
  var nextRow = Math.max(2, lastRow + 1);
  sheet.getRange(nextRow, 1).setValue(maPhuTung);
  if (lastRow >= 2) {
    var formulas = sheet.getRange(2, 2, 1, 15).getFormulas()[0];
    var hasFormula = formulas.some(function (f) { return f && f.indexOf('=') === 0; });
    if (hasFormula) {
      sheet.getRange(2, 2, 1, 15).copyTo(sheet.getRange(nextRow, 2, 1, 15));
      return;
    }
  }
  sheet.getRange(nextRow, 2).setValue(tenPhuTung || '');
}

function upsertPartInternal(ss, part) {
  var sheet = ss.getSheetByName(TABS.CATALOG);
  if (!sheet) throw new Error('Không tìm thấy trang tính: ' + TABS.CATALOG);

  var rowValues = [
    part.maPhuTung,
    part.tenPhuTung,
    part.donViTinh,
    Number(part.dinhMucToiThieu || 0),
    part.ghiChu || '',
    part.nhomPhuTung || '',
    Number(part.giaNhapThamChieu || 0),
    Number(part.giaBanThamChieu || 0),
    part.maNhaCungCapMacDinh || 'NCC001',
    part.leadTimeRieng !== null && part.leadTimeRieng !== undefined && part.leadTimeRieng !== '' ? Number(part.leadTimeRieng) : '',
    Number(part.tonDauKy || 0),
    Number(part.slDangDatChuaNhan || 0)
  ];

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < colA.length; i++) {
      if (String(colA[i][0] || '').trim().toUpperCase() === String(part.maPhuTung || '').toUpperCase()) {
        sheet.getRange(i + 2, 1, 1, 12).setValues([rowValues]);
        return 'updated';
      }
    }
  }

  sheet.appendRow(rowValues);
  ensureIndicatorRow(ss, part.maPhuTung, part.tenPhuTung);
  return 'appended';
}

function updateThamSoInternal(ss, thamSo) {
  var sheet = ss.getSheetByName(TABS.PARAMS);
  if (!sheet) throw new Error('Không tìm thấy trang tính: ' + TABS.PARAMS);
  var lastRow = Math.max(8, sheet.getLastRow());
  var labels = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var formulas = sheet.getRange(2, 2, lastRow - 1, 1).getFormulas();

  for (var i = 0; i < labels.length; i++) {
    var label = String(labels[i][0] || '').trim().toLowerCase();
    var rowNum = i + 2;
    if (!label) continue;
    if (label.indexOf('từ ngày') !== -1) {
      sheet.getRange(rowNum, 2).setValue(parseIsoDate(thamSo.tuNgayIso));
    } else if (label.indexOf('đến ngày') !== -1) {
      sheet.getRange(rowNum, 2).setValue(parseIsoDate(thamSo.denNgayIso));
    } else if (label.indexOf('ngày xem báo cáo') !== -1 && !formulas[i][0]) {
      sheet.getRange(rowNum, 2).setValue(parseIsoDate(thamSo.ngayXemBaoCaoIso));
    } else if (label.indexOf('thời gian chờ') !== -1) {
      sheet.getRange(rowNum, 2).setValue(Number(thamSo.leadTimeMacDinh || 0));
    } else if (label.indexOf('đủ dùng thêm') !== -1) {
      sheet.getRange(rowNum, 2).setValue(Number(thamSo.soNgayDuTruMongMuon || 30));
    } else if (label.indexOf('cảnh báo trước') !== -1) {
      sheet.getRange(rowNum, 2).setValue(Number(thamSo.soNgayCanhBaoTruoc || 7));
    }
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (body.action === 'ping') {
      return jsonOut({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName()
      });
    }

    if (body.action === 'appendTransaction') {
      var appended = appendTxInternal(ss, body.tx || {});
      SpreadsheetApp.flush();
      return jsonOut({ ok: true, appended: appended });
    }

    if (body.action === 'upsertCatalogPart') {
      var res = upsertPartInternal(ss, body.part || {});
      SpreadsheetApp.flush();
      return jsonOut({ ok: true, action: res });
    }

    if (body.action === 'updateThamSo') {
      updateThamSoInternal(ss, body.thamSo || {});
      SpreadsheetApp.flush();
      return jsonOut({ ok: true });
    }

    if (body.action === 'syncAll') {
      var parts = body.parts || [];
      var txs = body.transactions || [];
      var syncedPartsCount = 0;
      for (var p = 0; p < parts.length; p++) {
        upsertPartInternal(ss, parts[p]);
        syncedPartsCount++;
      }
      var addedTxCount = 0;
      for (var t = 0; t < txs.length; t++) {
        if (appendTxInternal(ss, txs[t])) addedTxCount++;
      }
      var updatedThamSo = false;
      if (body.thamSo && body.thamSo.active) {
        updateThamSoInternal(ss, body.thamSo);
        updatedThamSo = true;
      }
      SpreadsheetApp.flush();
      return jsonOut({
        ok: true,
        syncedPartsCount: syncedPartsCount,
        addedTxCount: addedTxCount,
        updatedThamSo: updatedThamSo
      });
    }

    return jsonOut({ ok: false, error: 'Action không hỗ trợ: ' + body.action });
  } catch (err) {
    return jsonOut({ ok: false, error: err && err.message ? err.message : String(err) });
  } finally {
    lock.releaseLock();
  }
}`;

async function callAppsScriptWebhook<T extends Record<string, unknown>>(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<T> {
  const res = await fetch('/api/sheets/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl, payload }),
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  if (!res.ok || parsed.ok === false) {
    throw new Error(
      typeof parsed.error === 'string' && parsed.error
        ? parsed.error
        : `Không thể đồng bộ Google Sheets qua Apps Script (HTTP ${res.status}).`
    );
  }
  return parsed as T;
}

export async function pingAppsScriptWebhook(webhookUrl: string): Promise<{
  ok: boolean;
  spreadsheetId?: string;
  spreadsheetName?: string;
}> {
  return callAppsScriptWebhook(webhookUrl, { action: 'ping' });
}

export async function appendTransactionViaWebhook(params: {
  webhookUrl: string;
  tx: {
    maGiaoDich: string;
    ngayIso: string;
    loaiGiaoDich: 'NHAP_NCC' | 'XUAT_SUA_CHUA';
    maPhuTung: string;
    soLuong: number;
    donGiaGiaoDich: number | null;
    maNhaCungCap: string;
    nhanVienThucHien: string;
    maDonDatHang: string;
    ghiChu: string;
    clientRequestId?: string;
  };
}): Promise<void> {
  await callAppsScriptWebhook(params.webhookUrl, {
    action: 'appendTransaction',
    tx: params.tx,
  });
}

export async function upsertCatalogPartViaWebhook(params: {
  webhookUrl: string;
  part: {
    maPhuTung: string;
    tenPhuTung: string;
    donViTinh: string;
    dinhMucToiThieu: number;
    ghiChu: string;
    nhomPhuTung: string;
    giaNhapThamChieu: number;
    giaBanThamChieu: number;
    maNhaCungCapMacDinh: string;
    leadTimeRieng: number | null;
    tonDauKy: number;
    slDangDatChuaNhan: number;
  };
}): Promise<void> {
  await callAppsScriptWebhook(params.webhookUrl, {
    action: 'upsertCatalogPart',
    part: params.part,
  });
}

export async function updateThamSoViaWebhook(params: {
  webhookUrl: string;
  thamSo: Omit<ThamSoOverride, 'active'>;
}): Promise<void> {
  await callAppsScriptWebhook(params.webhookUrl, {
    action: 'updateThamSo',
    thamSo: params.thamSo,
  });
}

export async function syncAllViaWebhook(params: {
  webhookUrl: string;
  items: MergedInventoryItem[];
  transactions: SheetTransaction[];
  thamSoOverride: ThamSoOverride | null;
}): Promise<{
  addedTxCount: number;
  syncedPartsCount: number;
  updatedThamSo: boolean;
}> {
  const partsToSync = params.items
    .filter((it) => it.catalog.source === 'WEBSITE_DB')
    .map((it) => ({
      maPhuTung: it.catalog.maPhuTung,
      tenPhuTung: it.catalog.tenPhuTung,
      donViTinh: it.catalog.donViTinh,
      dinhMucToiThieu: it.catalog.dinhMucToiThieu,
      ghiChu: it.catalog.ghiChu,
      nhomPhuTung: it.catalog.nhomPhuTung,
      giaNhapThamChieu: it.catalog.giaNhapThamChieu,
      giaBanThamChieu: it.catalog.giaBanThamChieu,
      maNhaCungCapMacDinh: it.catalog.maNhaCungCapMacDinh,
      leadTimeRieng: it.catalog.leadTimeRieng,
      tonDauKy: it.catalog.tonDauKy,
      slDangDatChuaNhan: it.catalog.slDangDatChuaNhan,
    }));

  const sortedTxs = [...params.transactions]
    .sort((a, b) => (a.seq ?? a.rowIndex) - (b.seq ?? b.rowIndex))
    .map((tx) => ({
      maGiaoDich: tx.maGiaoDich,
      ngayIso: tx.ngayIso,
      loaiGiaoDich: tx.loaiGiaoDich,
      maPhuTung: tx.maPhuTung,
      soLuong: tx.soLuong,
      donGiaGiaoDich: tx.donGiaGiaoDich,
      maNhaCungCap: tx.maNhaCungCap,
      nhanVienThucHien: tx.nhanVienThucHien,
      maDonDatHang: tx.maDonDatHang,
      ghiChu: tx.ghiChu,
      clientRequestId: tx.clientRequestId,
    }));

  const res = await callAppsScriptWebhook<{
    addedTxCount?: number;
    syncedPartsCount?: number;
    updatedThamSo?: boolean;
  }>(params.webhookUrl, {
    action: 'syncAll',
    parts: partsToSync,
    transactions: sortedTxs,
    thamSo: params.thamSoOverride?.active ? params.thamSoOverride : null,
  });

  return {
    addedTxCount: Number(res.addedTxCount ?? 0),
    syncedPartsCount: Number(res.syncedPartsCount ?? 0),
    updatedThamSo: Boolean(res.updatedThamSo),
  };
}

