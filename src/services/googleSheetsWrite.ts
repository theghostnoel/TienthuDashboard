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
