import type {
  CatalogPart,
  GoogleSheetReferenceResponse,
  SheetsStateResponse,
  SheetTransaction,
  ThamSoConfig,
  TransactionType,
} from '../src/types/inventory.ts';
import {
  buildFullInventoryState,
  formatIsoToDisplay,
} from '../src/lib/inventoryCalculator.ts';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

export const SPREADSHEET_ID = '1ymcTmAv-OM19iTKy925DBrifHDlHM60Dof4Svj32YLs';

export function extractSpreadsheetId(raw?: string | null): string {
  if (!raw || !raw.trim()) return SPREADSHEET_ID;
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const candidate = urlMatch ? urlMatch[1] : trimmed;
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(candidate)) {
    throw new Error(
      'Link hoặc ID Google Sheets không hợp lệ. Vui lòng dán đúng link dạng https://docs.google.com/spreadsheets/d/...'
    );
  }
  return candidate;
}

const SHEET_NAMES = {
  CATALOG: 'Danh mục phụ tùng',
  TRANSACTIONS: 'PHU TUNG KHO',
  PARAMS: 'THAM SO',
} as const;

function parseNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const cleaned = String(val).replace(/,/g, '').replace(/\s+/g, '').trim();
  if (!cleaned) return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function parseNullableNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const cleaned = String(val).replace(/,/g, '').replace(/\s+/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function serialToIsoDate(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateCell(
  unformatted: unknown,
  _formatted?: unknown
): { display: string; iso: string } {
  if (typeof unformatted === 'number' && unformatted > 20000 && unformatted < 90000) {
    const iso = serialToIsoDate(unformatted);
    return {
      display: formatIsoToDisplay(iso),
      iso,
    };
  }
  const unfmtStr = String(unformatted ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(unfmtStr)) {
    return {
      display: formatIsoToDisplay(unfmtStr),
      iso: unfmtStr,
    };
  }
  const str = String(_formatted ?? unformatted ?? '').trim();
  if (!str) return { display: '', iso: '' };

  const gvizMatch = str.match(/^Date\((\d+),(\d+),(\d+)\)$/);
  if (gvizMatch) {
    const y = gvizMatch[1];
    const m = String(Number(gvizMatch[2]) + 1).padStart(2, '0');
    const d = String(Number(gvizMatch[3])).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    return { display: `${d}/${m}/${y}`, iso };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return { display: formatIsoToDisplay(str), iso: str };
  }

  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const p1 = Number(slashMatch[1]);
    const p2 = Number(slashMatch[2]);
    const y = slashMatch[3];
    let day = p1;
    let month = p2;
    if (p2 > 12) {
      month = p1;
      day = p2;
    }
    const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { display: formatIsoToDisplay(iso), iso };
  }

  return { display: str, iso: '' };
}

interface RawSheetGrid {
  unformatted: unknown[][];
  formatted: unknown[][];
}

async function fetchSingleGvizSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<RawSheetGrid> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
    sheetName
  )}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Không thể đọc sheet "${sheetName}" (HTTP ${res.status}).`);
  }
  const text = await res.text();
  if (!text.includes('google.visualization.Query.setResponse')) {
    throw new Error(
      `Google Sheet "${sheetName}" chưa bật quyền Xem công khai (Anyone with the link: Viewer).`
    );
  }
  const jsonText = text.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
  const parsed = JSON.parse(jsonText) as {
    status?: string;
    errors?: Array<{ detailed_message?: string; message?: string }>;
    table?: {
      cols?: Array<{ label?: string }>;
      rows?: Array<{ c?: Array<{ v?: unknown; f?: string } | null> }>;
    };
  };

  if (parsed.status === 'error') {
    throw new Error(
      parsed.errors?.[0]?.detailed_message ||
        parsed.errors?.[0]?.message ||
        `Lỗi đọc Google Sheet "${sheetName}".`
    );
  }

  const cols = parsed.table?.cols || [];
  const headerRow = cols.map((c) => c.label ?? '');
  const unformatted: unknown[][] = [headerRow];
  const formatted: unknown[][] = [headerRow];

  for (const row of parsed.table?.rows || []) {
    const cells = row.c || [];
    unformatted.push(cells.map((cell) => (cell ? cell.v ?? '' : '')));
    formatted.push(cells.map((cell) => (cell ? cell.f ?? cell.v ?? '' : '')));
  }
  return { unformatted, formatted };
}

function assertNotFormSheet(grid: RawSheetGrid, expectedSheetName: string): void {
  const headers = (grid.unformatted[0] || [])
    .map((h) => String(h ?? '').trim().toLowerCase())
    .join(' | ');
  if (
    headers.includes('timestamp') &&
    (headers.includes('biển số') || headers.includes('họ và tên') || headers.includes('khung giờ'))
  ) {
    throw new Error(
      `Không tìm thấy trang tính "${expectedSheetName}" trong Google Sheet này (hệ thống đang bị trả về trang Lịch hẹn/Form). Vui lòng kiểm tra file Google Sheets có đủ 3 tab: "Danh mục phụ tùng", "PHU TUNG KHO", "THAM SO".`
    );
  }
}

async function fetchSheetsViaPublicGviz(
  spreadsheetId: string
): Promise<Record<'CATALOG' | 'TRANSACTIONS' | 'PARAMS', RawSheetGrid>> {
  const [CATALOG, TRANSACTIONS, PARAMS] = await Promise.all([
    fetchSingleGvizSheet(spreadsheetId, SHEET_NAMES.CATALOG),
    fetchSingleGvizSheet(spreadsheetId, SHEET_NAMES.TRANSACTIONS),
    fetchSingleGvizSheet(spreadsheetId, SHEET_NAMES.PARAMS),
  ]);
  return { CATALOG, TRANSACTIONS, PARAMS };
}

export async function readGoogleSheetReferenceData(
  customSpreadsheetId?: string | null
): Promise<GoogleSheetReferenceResponse> {
  const spreadsheetId = extractSpreadsheetId(customSpreadsheetId);
  const grids = await fetchSheetsViaPublicGviz(spreadsheetId);

  assertNotFormSheet(grids.CATALOG, SHEET_NAMES.CATALOG);
  assertNotFormSheet(grids.TRANSACTIONS, SHEET_NAMES.TRANSACTIONS);
  assertNotFormSheet(grids.PARAMS, SHEET_NAMES.PARAMS);

  const paramsMap = new Map<string, { v: unknown; f: unknown }>();
  const pUnfmt = grids.PARAMS.unformatted;
  const pFmt = grids.PARAMS.formatted;
  for (let i = 1; i < pUnfmt.length; i++) {
    const label = String(pUnfmt[i]?.[0] ?? '').trim().toLowerCase();
    if (!label) continue;
    paramsMap.set(label, { v: pUnfmt[i]?.[1], f: pFmt[i]?.[1] });
  }

  const findParam = (keyword: string) => {
    for (const [k, val] of paramsMap.entries()) {
      if (k.includes(keyword)) return val;
    }
    return undefined;
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const pTuNgay = findParam('từ ngày');
  const pDenNgay = findParam('đến ngày');
  const pSoNgay = findParam('số ngày của kỳ');
  const pNgayXem = findParam('ngày xem báo cáo');
  const pLeadTime = findParam('thời gian chờ');
  const pDuTru = findParam('đủ dùng thêm');
  const pCanhBao = findParam('cảnh báo trước');

  if (!pTuNgay && !pDenNgay && !pLeadTime && !pDuTru) {
    throw new Error(
      'Trang tính "THAM SO" không đúng cấu trúc hoặc bị thiếu trong Google Sheet.'
    );
  }

  const tuParsed = parseDateCell(pTuNgay?.v, pTuNgay?.f);
  const denParsed = parseDateCell(pDenNgay?.v, pDenNgay?.f);
  const xemParsed = parseDateCell(pNgayXem?.v, pNgayXem?.f);

  const thamSo: ThamSoConfig = {
    tuNgay: tuParsed.display || '—',
    tuNgayIso: tuParsed.iso,
    denNgay: denParsed.display || '—',
    denNgayIso: denParsed.iso,
    soNgayCuaKy: parseNum(pSoNgay?.v, 0),
    ngayXemBaoCao: xemParsed.display || formatIsoToDisplay(todayIso),
    ngayXemBaoCaoIso: xemParsed.iso || todayIso,
    leadTimeMacDinh: parseNum(pLeadTime?.v, 7),
    soNgayDuTruMongMuon: parseNum(pDuTru?.v, 30),
    soNgayCanhBaoTruoc: parseNum(pCanhBao?.v, 7),
  };

  const catUnfmt = grids.CATALOG.unformatted;
  const catFmt = grids.CATALOG.formatted;
  const sheetCatalog: CatalogPart[] = [];
  for (let i = 1; i < catUnfmt.length; i++) {
    const row = catUnfmt[i] || [];
    const ma = String(row[0] ?? '').trim();
    if (!ma) continue;
    sheetCatalog.push({
      rowIndex: i + 1,
      maPhuTung: ma,
      tenPhuTung: String(catFmt[i]?.[1] ?? row[1] ?? '').trim(),
      donViTinh: String(catFmt[i]?.[2] ?? row[2] ?? '').trim() || 'Cái',
      dinhMucToiThieu: parseNum(row[3], 0),
      ghiChu: String(catFmt[i]?.[4] ?? row[4] ?? '').trim(),
      nhomPhuTung: String(catFmt[i]?.[5] ?? row[5] ?? '').trim(),
      giaNhapThamChieu: parseNum(row[6], 0),
      giaBanThamChieu: parseNum(row[7], 0),
      maNhaCungCapMacDinh: String(catFmt[i]?.[8] ?? row[8] ?? 'NCC001').trim() || 'NCC001',
      leadTimeRieng: parseNullableNum(row[9]),
      tonDauKy: parseNum(row[10], 0),
      slDangDatChuaNhan: parseNum(row[11], 0),
      source: 'GOOGLE_SHEET',
    });
  }

  const txUnfmt = grids.TRANSACTIONS.unformatted;
  const txFmt = grids.TRANSACTIONS.formatted;
  const sheetInitialTransactions: SheetTransaction[] = [];
  for (let i = 1; i < txUnfmt.length; i++) {
    const row = txUnfmt[i] || [];
    const fRow = txFmt[i] || [];
    const maGD = String(row[0] ?? '').trim();
    const maPT = String(row[3] ?? '').trim();
    if (!maGD && !maPT) continue;

    const loaiRaw = String(row[2] ?? '').trim().toUpperCase();
    const loaiGiaoDich: TransactionType =
      loaiRaw === 'NHAP_NCC' ? 'NHAP_NCC' : 'XUAT_SUA_CHUA';
    const dateParsed = parseDateCell(row[1], fRow[1]);

    sheetInitialTransactions.push({
      rowIndex: i + 1,
      maGiaoDich: maGD || `ROW-${i + 1}`,
      ngayGiaoDich: dateParsed.display,
      ngayIso: dateParsed.iso,
      loaiGiaoDich,
      maPhuTung: maPT,
      soLuong: parseNum(row[4], 0),
      donGiaGiaoDich: parseNullableNum(row[5]),
      maNhaCungCap: String(fRow[6] ?? row[6] ?? '').trim(),
      nhanVienThucHien: String(fRow[7] ?? row[7] ?? '').trim(),
      maDonDatHang: String(fRow[8] ?? row[8] ?? '').trim(),
      ghiChu: String(fRow[9] ?? row[9] ?? '').trim(),
      clientRequestId: String(row[10] ?? '').trim() || undefined,
      source: 'GOOGLE_SHEET_SEED',
    });
  }

  if (sheetCatalog.length === 0) {
    throw new Error(
      'Trang tính "Danh mục phụ tùng" chưa có dữ liệu mã phụ tùng hợp lệ.'
    );
  }

  return {
    spreadsheetId,
    sheetsReadMode: 'PUBLIC_GVIZ',
    syncedAt: new Date().toISOString(),
    thamSo,
    sheetCatalog,
    sheetInitialTransactions,
  };
}

export async function getReadOnlySheetBaselineState(
  customSpreadsheetId?: string | null
): Promise<SheetsStateResponse> {
  const ref = await readGoogleSheetReferenceData(customSpreadsheetId);
  return buildFullInventoryState({
    spreadsheetId: ref.spreadsheetId,
    sheetsReadMode: ref.sheetsReadMode,
    databaseMode: 'READ_ONLY_SHEET',
    databaseConfigured: false,
    firebaseProjectId: firebaseConfig.projectId,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
    syncedAt: ref.syncedAt,
    thamSo: ref.thamSo,
    sheetCatalog: ref.sheetCatalog,
    customParts: [],
    transactions: ref.sheetInitialTransactions,
  });
}
