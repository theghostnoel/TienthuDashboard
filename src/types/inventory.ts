export type SheetDecisionStatus =
  | 'HET_HANG'
  | 'DAT_NGAY'
  | 'CHUAN_BI_DAT'
  | 'DU_HANG';

export type TransactionType = 'NHAP_NCC' | 'XUAT_SUA_CHUA';

export type ConnectionSyncState =
  | 'CONNECTED_RW'
  | 'CONNECTED_RO'
  | 'SYNCING'
  | 'DISCONNECTED'
  | 'SAVE_ERROR';

export type DatabaseMode = 'FIREBASE_FIRESTORE' | 'READ_ONLY_SHEET';

export interface SystemStatus {
  spreadsheetId: string;
  sheetsReadMode: 'SERVICE_ACCOUNT_RO' | 'PUBLIC_GVIZ';
  databaseMode: DatabaseMode;
  databaseConfigured: boolean;
  firebaseProjectId: string;
  firestoreDatabaseId: string;
}

export interface ThamSoConfig {
  tuNgay: string;
  tuNgayIso: string;
  denNgay: string;
  denNgayIso: string;
  soNgayCuaKy: number;
  ngayXemBaoCao: string;
  ngayXemBaoCaoIso: string;
  leadTimeMacDinh: number;
  soNgayDuTruMongMuon: number;
  soNgayCanhBaoTruoc: number;
}

export interface ThamSoOverride {
  active: boolean;
  tuNgayIso: string;
  denNgayIso: string;
  ngayXemBaoCaoIso: string;
  leadTimeMacDinh: number;
  soNgayDuTruMongMuon: number;
  soNgayCanhBaoTruoc: number;
}

export interface CatalogPart {
  rowIndex: number; // 1-based row index in "Danh mục phụ tùng" (0 if website custom addition)
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
  source?: 'GOOGLE_SHEET' | 'WEBSITE_DB';
}

export interface SheetTransaction {
  id?: string;
  seq?: number;
  rowIndex: number;
  maGiaoDich: string;
  ngayGiaoDich: string; // display dd/MM/yyyy
  ngayIso: string; // YYYY-MM-DD for sorting & charts
  loaiGiaoDich: TransactionType;
  maPhuTung: string;
  soLuong: number;
  donGiaGiaoDich: number | null;
  maNhaCungCap: string;
  nhanVienThucHien: string;
  maDonDatHang: string;
  ghiChu: string;
  clientRequestId?: string;
  source?: 'GOOGLE_SHEET_SEED' | 'WEB_APP';
  createdAt?: string;
}

export interface SheetIndicatorRow {
  maPhuTung: string;
  tenPhuTung: string;
  tongNhap: number;
  tongXuat: number;
  tonHienTai: number;
  xuatTrongKy: number;
  tieuThuTBNgay: number;
  soNgayConDuDung: number | null;
  nhuCauLucChoHang: number;
  duDungLucCho: string;
  tonAnToan: number;
  diemDatHang: number; // ROP
  soNgayToiDiemDat: number | null;
  ngayDatMuonNhat: string;
  slDeXuatDat: number;
  quyetDinhRaw: string;
}

export interface MergedInventoryItem {
  catalog: CatalogPart;
  indicator: SheetIndicatorRow;
  leadTimeApDung: number;
  giaTriTonKho: number;
  trangThai: SheetDecisionStatus;
  trangThaiLabel: string;
  uuTien: number; // 0 = HET_HANG, 1 = DAT_NGAY, 2 = CHUAN_BI_DAT, 3 = DU_HANG
}

export interface DashboardKPIs {
  tongLoaiPhuTung: number;
  tongSoLuongTonKho: number;
  soLoaiCanDatNgay: number;
  soLoaiSapDenDiemDat: number;
  soLoaiHetHang: number;
  tongGiaTriTonKho: number;
  tongSoLuongDangDat: number;
  soNgayTonKhoTrungBinh: number | null;
}

export interface DashboardCharts {
  topTieuThu: Array<{
    maPhuTung: string;
    tenPhuTung: string;
    xuatTrongKy: number;
    tongXuat: number;
  }>;
  tonSoVoiRop: Array<{
    maPhuTung: string;
    tenPhuTung: string;
    tonHienTai: number;
    rop: number;
  }>;
  phanBoTrangThai: Array<{
    status: SheetDecisionStatus;
    label: string;
    count: number;
    color: string;
  }>;
  giaTriTonTheoPhuTung: Array<{
    maPhuTung: string;
    tenPhuTung: string;
    giaTriTon: number;
  }>;
  xuHuongNhapXuat: Array<{
    ngay: string;
    nhap: number;
    xuat: number;
  }>;
}

export interface GoogleSheetReferenceResponse {
  spreadsheetId: string;
  sheetsReadMode: 'SERVICE_ACCOUNT_RO' | 'PUBLIC_GVIZ';
  syncedAt: string;
  thamSo: ThamSoConfig;
  sheetCatalog: CatalogPart[];
  sheetInitialTransactions: SheetTransaction[];
}

export interface SheetsStateResponse {
  spreadsheetId: string;
  connectionMode: 'DATABASE_RW' | 'READ_ONLY_NO_DB';
  databaseMode: DatabaseMode;
  sheetsReadMode: 'SERVICE_ACCOUNT_RO' | 'PUBLIC_GVIZ';
  thamSoSource?: 'GOOGLE_SHEET' | 'FIRESTORE_OVERRIDE';
  googleSheetSource?: 'DEFAULT' | 'FIRESTORE_CONFIG';
  systemStatus: SystemStatus;
  syncedAt: string;
  thamSo: ThamSoConfig;
  items: MergedInventoryItem[];
  transactions: SheetTransaction[];
  kpis: DashboardKPIs;
  charts: DashboardCharts;
}
