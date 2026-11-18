import type {
  CatalogPart,
  DashboardCharts,
  DashboardKPIs,
  DatabaseMode,
  MergedInventoryItem,
  SheetDecisionStatus,
  SheetIndicatorRow,
  SheetsStateResponse,
  SheetTransaction,
  ThamSoConfig,
  ThamSoOverride,
} from '../types/inventory';

export function formatIsoToDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function addDaysToIso(iso: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const next = new Date(ms);
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function computeInclusiveDays(tuNgayIso: string, denNgayIso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuNgayIso) || !/^\d{4}-\d{2}-\d{2}$/.test(denNgayIso)) {
    return 1;
  }
  const [ty, tm, td] = tuNgayIso.split('-').map(Number);
  const [dy, dm, dd] = denNgayIso.split('-').map(Number);
  const diffDays = Math.floor(
    (Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86_400_000
  );
  return Math.max(1, diffDays + 1);
}

export function mergeThamSo(
  base: ThamSoConfig,
  override: ThamSoOverride | null
): ThamSoConfig {
  if (!override || !override.active) return base;
  const tuNgayIso = /^\d{4}-\d{2}-\d{2}$/.test(override.tuNgayIso)
    ? override.tuNgayIso
    : base.tuNgayIso;
  const denNgayIso = /^\d{4}-\d{2}-\d{2}$/.test(override.denNgayIso)
    ? override.denNgayIso
    : base.denNgayIso;
  const ngayXemBaoCaoIso = /^\d{4}-\d{2}-\d{2}$/.test(override.ngayXemBaoCaoIso)
    ? override.ngayXemBaoCaoIso
    : base.ngayXemBaoCaoIso;
  return {
    tuNgay: formatIsoToDisplay(tuNgayIso),
    tuNgayIso,
    denNgay: formatIsoToDisplay(denNgayIso),
    denNgayIso,
    soNgayCuaKy: computeInclusiveDays(tuNgayIso, denNgayIso),
    ngayXemBaoCao: formatIsoToDisplay(ngayXemBaoCaoIso),
    ngayXemBaoCaoIso,
    leadTimeMacDinh: override.leadTimeMacDinh,
    soNgayDuTruMongMuon: override.soNgayDuTruMongMuon,
    soNgayCanhBaoTruoc: override.soNgayCanhBaoTruoc,
  };
}

export function computePartIndicators(
  catalog: CatalogPart,
  transactions: SheetTransaction[],
  thamSo: ThamSoConfig
): {
  indicator: SheetIndicatorRow;
  leadTimeApDung: number;
  giaTriTonKho: number;
  trangThai: SheetDecisionStatus;
  trangThaiLabel: string;
  uuTien: number;
} {
  const partTx = transactions.filter((t) => t.maPhuTung === catalog.maPhuTung);

  const tongNhap = partTx
    .filter((t) => t.loaiGiaoDich === 'NHAP_NCC')
    .reduce((s, t) => s + t.soLuong, 0);
  const tongXuat = partTx
    .filter((t) => t.loaiGiaoDich === 'XUAT_SUA_CHUA')
    .reduce((s, t) => s + t.soLuong, 0);

  const tonHienTai = catalog.tonDauKy + tongNhap - tongXuat;

  const xuatTrongKy = partTx
    .filter((t) => {
      if (t.loaiGiaoDich !== 'XUAT_SUA_CHUA') return false;
      if (!thamSo.tuNgayIso || !thamSo.denNgayIso || !t.ngayIso) return true;
      return t.ngayIso >= thamSo.tuNgayIso && t.ngayIso <= thamSo.denNgayIso;
    })
    .reduce((s, t) => s + t.soLuong, 0);

  const leadTimeApDung = catalog.leadTimeRieng ?? thamSo.leadTimeMacDinh;
  const tieuThuTBNgay =
    thamSo.soNgayCuaKy > 0 ? xuatTrongKy / thamSo.soNgayCuaKy : 0;

  const soNgayConDuDung =
    tieuThuTBNgay > 0 ? tonHienTai / tieuThuTBNgay : null;

  const nhuCauLucChoHang = Math.ceil(tieuThuTBNgay * leadTimeApDung);
  const duDungLucCho = tonHienTai >= nhuCauLucChoHang ? 'Đủ' : 'Thiếu';

  const tonAnToan = catalog.dinhMucToiThieu;
  const diemDatHang = tonAnToan + nhuCauLucChoHang;

  const soNgayToiDiemDat =
    tonHienTai <= diemDatHang
      ? 0
      : tieuThuTBNgay > 0
      ? (tonHienTai - diemDatHang) / tieuThuTBNgay
      : null;

  const ngayDatMuonNhatIso =
    soNgayToiDiemDat !== null && thamSo.ngayXemBaoCaoIso
      ? addDaysToIso(thamSo.ngayXemBaoCaoIso, Math.floor(soNgayToiDiemDat))
      : '';
  const ngayDatMuonNhat = ngayDatMuonNhatIso
    ? formatIsoToDisplay(ngayDatMuonNhatIso)
    : '';

  let trangThai: SheetDecisionStatus = 'DU_HANG';
  let trangThaiLabel = 'Tồn kho đang đủ';
  let uuTien = 3;
  let quyetDinhRaw = 'Chưa cần đặt';

  if (tonHienTai <= 0) {
    trangThai = 'HET_HANG';
    trangThaiLabel = 'HẾT HÀNG';
    quyetDinhRaw = 'HẾT HÀNG';
    uuTien = 0;
  } else if (tonHienTai <= diemDatHang) {
    trangThai = 'DAT_NGAY';
    trangThaiLabel = 'ĐẶT NGAY';
    quyetDinhRaw = 'ĐẶT NGAY';
    uuTien = 1;
  } else if (
    soNgayToiDiemDat !== null &&
    soNgayToiDiemDat <= thamSo.soNgayCanhBaoTruoc
  ) {
    trangThai = 'CHUAN_BI_DAT';
    trangThaiLabel = 'CHUẨN BỊ ĐẶT';
    quyetDinhRaw = 'CHUẨN BỊ ĐẶT';
    uuTien = 2;
  }

  let slDeXuatDat = 0;
  if (tonHienTai <= diemDatHang) {
    if (tieuThuTBNgay > 0) {
      const targetQty =
        tieuThuTBNgay * (thamSo.soNgayDuTruMongMuon + leadTimeApDung) + tonAnToan;
      slDeXuatDat = Math.max(
        0,
        Math.ceil(targetQty - tonHienTai - catalog.slDangDatChuaNhan)
      );
    } else {
      slDeXuatDat = Math.max(
        0,
        diemDatHang - tonHienTai - catalog.slDangDatChuaNhan
      );
    }
  }

  const giaTriTonKho = Math.max(0, tonHienTai) * catalog.giaNhapThamChieu;

  return {
    indicator: {
      maPhuTung: catalog.maPhuTung,
      tenPhuTung: catalog.tenPhuTung,
      tongNhap,
      tongXuat,
      tonHienTai,
      xuatTrongKy,
      tieuThuTBNgay,
      soNgayConDuDung,
      nhuCauLucChoHang,
      duDungLucCho,
      tonAnToan,
      diemDatHang,
      soNgayToiDiemDat,
      ngayDatMuonNhat,
      slDeXuatDat,
      quyetDinhRaw,
    },
    leadTimeApDung,
    giaTriTonKho,
    trangThai,
    trangThaiLabel,
    uuTien,
  };
}

export function buildFullInventoryState(params: {
  spreadsheetId: string;
  sheetsReadMode: 'SERVICE_ACCOUNT_RO' | 'PUBLIC_GVIZ';
  databaseMode: DatabaseMode;
  databaseConfigured: boolean;
  firebaseProjectId: string;
  firestoreDatabaseId: string;
  thamSoSource?: 'GOOGLE_SHEET' | 'FIRESTORE_OVERRIDE';
  syncedAt?: string;
  thamSo: ThamSoConfig;
  sheetCatalog: CatalogPart[];
  customParts: CatalogPart[];
  transactions: SheetTransaction[];
}): SheetsStateResponse {
  const safeCustomParts = Array.isArray(params.customParts) ? params.customParts : [];
  const safeSheetCatalog = Array.isArray(params.sheetCatalog) ? params.sheetCatalog : [];
  const safeTransactions = Array.isArray(params.transactions) ? params.transactions : [];

  const customMap = new Map<string, CatalogPart>();
  for (const cp of safeCustomParts) {
    customMap.set(cp.maPhuTung.toUpperCase(), cp);
  }

  const mergedCatalog: CatalogPart[] = safeSheetCatalog.map((sc) => {
    const override = customMap.get(sc.maPhuTung.toUpperCase());
    if (!override) return sc;
    customMap.delete(sc.maPhuTung.toUpperCase());
    return {
      ...override,
      rowIndex: sc.rowIndex,
      tonDauKy: sc.tonDauKy,
      source: 'WEBSITE_DB',
    };
  });

  let extraIdx = mergedCatalog.length + 100;
  for (const extra of customMap.values()) {
    mergedCatalog.push({ ...extra, rowIndex: extraIdx++ });
  }

  const items: MergedInventoryItem[] = mergedCatalog.map((cat) => {
    const calc = computePartIndicators(cat, safeTransactions, params.thamSo);
    return {
      catalog: cat,
      indicator: calc.indicator,
      leadTimeApDung: calc.leadTimeApDung,
      giaTriTonKho: calc.giaTriTonKho,
      trangThai: calc.trangThai,
      trangThaiLabel: calc.trangThaiLabel,
      uuTien: calc.uuTien,
    };
  });

  items.sort((a, b) => a.uuTien - b.uuTien || a.catalog.rowIndex - b.catalog.rowIndex);

  const tongLoaiPhuTung = items.length;
  const tongSoLuongTonKho = items.reduce((s, it) => s + it.indicator.tonHienTai, 0);
  const soLoaiHetHang = items.filter((it) => it.trangThai === 'HET_HANG').length;
  const soLoaiCanDatNgay = items.filter(
    (it) => it.trangThai === 'DAT_NGAY' || it.trangThai === 'HET_HANG'
  ).length;
  const soLoaiSapDenDiemDat = items.filter(
    (it) => it.trangThai === 'CHUAN_BI_DAT'
  ).length;
  const tongGiaTriTonKho = items.reduce((s, it) => s + it.giaTriTonKho, 0);
  const tongSoLuongDangDat = items.reduce(
    (s, it) => s + it.catalog.slDangDatChuaNhan,
    0
  );

  const validDays = items
    .map((it) => it.indicator.soNgayConDuDung)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const soNgayTonKhoTrungBinh =
    validDays.length > 0
      ? Number((validDays.reduce((a, b) => a + b, 0) / validDays.length).toFixed(1))
      : null;

  const kpis: DashboardKPIs = {
    tongLoaiPhuTung,
    tongSoLuongTonKho,
    soLoaiCanDatNgay,
    soLoaiSapDenDiemDat,
    soLoaiHetHang,
    tongGiaTriTonKho,
    tongSoLuongDangDat,
    soNgayTonKhoTrungBinh,
  };

  const topTieuThu = [...items]
    .filter((it) => it.indicator.xuatTrongKy > 0 || it.indicator.tongXuat > 0)
    .sort((a, b) => b.indicator.xuatTrongKy - a.indicator.xuatTrongKy)
    .slice(0, 7)
    .map((it) => ({
      maPhuTung: it.catalog.maPhuTung,
      tenPhuTung: it.catalog.tenPhuTung,
      xuatTrongKy: it.indicator.xuatTrongKy,
      tongXuat: it.indicator.tongXuat,
    }));

  const tonSoVoiRop = [...items]
    .sort((a, b) => a.catalog.rowIndex - b.catalog.rowIndex)
    .map((it) => ({
      maPhuTung: it.catalog.maPhuTung,
      tenPhuTung: it.catalog.tenPhuTung,
      tonHienTai: it.indicator.tonHienTai,
      rop: it.indicator.diemDatHang,
    }));

  const phanBoTrangThai = [
    {
      status: 'HET_HANG' as const,
      label: 'Hết hàng',
      count: items.filter((i) => i.trangThai === 'HET_HANG').length,
      color: '#B91C1C',
    },
    {
      status: 'DAT_NGAY' as const,
      label: 'Đặt ngay',
      count: items.filter((i) => i.trangThai === 'DAT_NGAY').length,
      color: '#DC2626',
    },
    {
      status: 'CHUAN_BI_DAT' as const,
      label: 'Chuẩn bị đặt',
      count: items.filter((i) => i.trangThai === 'CHUAN_BI_DAT').length,
      color: '#F59E0B',
    },
    {
      status: 'DU_HANG' as const,
      label: 'Đủ hàng',
      count: items.filter((i) => i.trangThai === 'DU_HANG').length,
      color: '#16A34A',
    },
  ];

  const giaTriTonTheoPhuTung = [...items]
    .sort((a, b) => b.giaTriTonKho - a.giaTriTonKho)
    .map((it) => ({
      maPhuTung: it.catalog.maPhuTung,
      tenPhuTung: it.catalog.tenPhuTung,
      giaTriTon: it.giaTriTonKho,
    }));

  const dailyMap = new Map<string, { display: string; nhap: number; xuat: number }>();
  for (const tx of safeTransactions) {
    const key = tx.ngayIso || tx.ngayGiaoDich;
    if (!key) continue;
    const prev = dailyMap.get(key) ?? {
      display: tx.ngayGiaoDich || key,
      nhap: 0,
      xuat: 0,
    };
    if (tx.loaiGiaoDich === 'NHAP_NCC') prev.nhap += tx.soLuong;
    else prev.xuat += tx.soLuong;
    dailyMap.set(key, prev);
  }
  const xuHuongNhapXuat = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => ({
      ngay: val.display,
      nhap: val.nhap,
      xuat: val.xuat,
    }));

  const sortedTransactions = [...safeTransactions].sort((a, b) => {
    const cmp = (b.ngayIso || '').localeCompare(a.ngayIso || '');
    if (cmp !== 0) return cmp;
    return (b.seq ?? b.rowIndex) - (a.seq ?? a.rowIndex);
  });

  const charts: DashboardCharts = {
    topTieuThu,
    tonSoVoiRop,
    phanBoTrangThai,
    giaTriTonTheoPhuTung,
    xuHuongNhapXuat,
  };

  return {
    spreadsheetId: params.spreadsheetId,
    connectionMode: params.databaseConfigured ? 'DATABASE_RW' : 'READ_ONLY_NO_DB',
    databaseMode: params.databaseMode,
    sheetsReadMode: params.sheetsReadMode,
    thamSoSource: params.thamSoSource ?? 'GOOGLE_SHEET',
    systemStatus: {
      spreadsheetId: params.spreadsheetId,
      sheetsReadMode: params.sheetsReadMode,
      databaseMode: params.databaseMode,
      databaseConfigured: params.databaseConfigured,
      firebaseProjectId: params.firebaseProjectId,
      firestoreDatabaseId: params.firestoreDatabaseId,
    },
    syncedAt: params.syncedAt || new Date().toISOString(),
    thamSo: params.thamSo,
    items,
    transactions: sortedTransactions,
    kpis,
    charts,
  };
}
