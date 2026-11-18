import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-react';
import type {
  MergedInventoryItem,
  SheetDecisionStatus,
  SheetsStateResponse,
} from '../types/inventory';
import { formatCurrency, formatNumber, getSheetStatusMeta } from '../lib/format';

interface DashboardPageProps {
  state: SheetsStateResponse;
  searchQuery: string;
  onSelectItem: (item: MergedInventoryItem) => void;
}

export function DashboardPage({
  state,
  searchQuery,
  onSelectItem,
}: DashboardPageProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'URGENT' | SheetDecisionStatus>(
    'ALL'
  );
  const [sortMode, setSortMode] = useState<'priority' | 'code'>('priority');

  const { kpis, charts, thamSo, items } = state;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((it) => {
      if (statusFilter === 'URGENT') {
        if (it.trangThai !== 'HET_HANG' && it.trangThai !== 'DAT_NGAY') return false;
      } else if (statusFilter !== 'ALL' && it.trangThai !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        it.catalog.maPhuTung.toLowerCase().includes(q) ||
        it.catalog.tenPhuTung.toLowerCase().includes(q) ||
        it.catalog.maNhaCungCapMacDinh.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'priority') {
        if (a.uuTien !== b.uuTien) return a.uuTien - b.uuTien;
        return a.indicator.tonHienTai - b.indicator.tonHienTai;
      }
      return a.catalog.rowIndex - b.catalog.rowIndex;
    });
  }, [items, searchQuery, statusFilter, sortMode]);

  return (
    <div className="space-y-6">
      {/* Header & Live THAM SO Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
            Dashboard Quản lý Tồn kho Phụ tùng Tiến Thu
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Danh mục & Tham số từ Google Sheets · Giao dịch & đồng bộ thời gian thực trên Firebase Firestore
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
          <span>
            Kỳ thống kê:{' '}
            <strong className="font-mono text-zinc-900">
              {thamSo.tuNgay} – {thamSo.denNgay} ({thamSo.soNgayCuaKy} ngày)
            </strong>
          </span>
          <span className="text-zinc-300">|</span>
          <span>
            Ngày báo cáo:{' '}
            <strong className="font-mono text-zinc-900">{thamSo.ngayXemBaoCao}</strong>
          </span>
          <span className="text-zinc-300">|</span>
          <span>
            LT mặc định:{' '}
            <strong className="font-mono text-zinc-900">{thamSo.leadTimeMacDinh} ngày</strong>
          </span>
        </div>
      </div>

      {/* 8 Overview KPI Cards (Section 2.A) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">
            1. Tổng số loại phụ tùng đang quản lý
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 mt-1.5">
            {formatNumber(kpis.tongLoaiPhuTung)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Đọc từ sheet Danh mục phụ tùng
          </div>
        </div>

        {/* 2 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">
            2. Tổng số lượng phụ tùng tồn kho
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 mt-1.5">
            {formatNumber(kpis.tongSoLuongTonKho)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Tổng tồn thực tế tính từ Firebase & tồn đầu kỳ
          </div>
        </div>

        {/* 3 */}
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <div className="text-xs font-medium text-red-700">
            3. Cần đặt hàng ngay
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1.5">
            {formatNumber(kpis.soLoaiCanDatNgay)} loại
          </div>
          <div className="text-xs text-red-600/80 mt-1">
            Quyết định ĐẶT NGAY hoặc HẾT HÀNG
          </div>
        </div>

        {/* 4 */}
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <div className="text-xs font-medium text-amber-800">
            4. Sắp đến điểm đặt hàng
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1.5">
            {formatNumber(kpis.soLoaiSapDenDiemDat)} loại
          </div>
          <div className="text-xs text-amber-700/80 mt-1">
            Trạng thái CHUẨN BỊ ĐẶT (cảnh báo {thamSo.soNgayCanhBaoTruoc}N)
          </div>
        </div>

        {/* 5 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">
            5. Số loại phụ tùng hết hàng
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1.5">
            {formatNumber(kpis.soLoaiHetHang)} loại
          </div>
          <div className="text-xs text-zinc-500 mt-1">Tồn hiện tại ≤ 0</div>
        </div>

        {/* 6 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">
            6. Tổng giá trị tồn kho (giá nhập TK)
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 mt-1.5">
            {formatCurrency(kpis.tongGiaTriTonKho)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Σ (Tồn hiện tại × Giá nhập tham chiếu)
          </div>
        </div>

        {/* 7 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">
            7. Đang đặt nhưng chưa nhận
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-orange-700 mt-1.5">
            {formatNumber(kpis.tongSoLuongDangDat)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Không cộng vào tồn thực tế
          </div>
        </div>

        {/* 8 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">
            8. Số ngày tồn kho trung bình
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 mt-1.5">
            {kpis.soNgayTonKhoTrungBinh !== null
              ? `${kpis.soNgayTonKhoTrungBinh} ngày`
              : 'Chưa đủ dữ liệu'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Trung bình các mã có phát sinh tiêu thụ
          </div>
        </div>
      </div>

      {/* Charts Row 1: Top Consumption + Current Stock vs ROP + Status Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Top phụ tùng tiêu thụ nhiều nhất */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-zinc-900">
            Top phụ tùng tiêu thụ nhiều nhất
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 mb-4">
            Số lượng xuất trong kỳ từ lịch sử giao dịch
          </p>
          {charts.topTieuThu.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.topTieuThu}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 6, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#71717A' }} />
                  <YAxis
                    type="category"
                    dataKey="maPhuTung"
                    width={58}
                    tick={{ fontSize: 11, fill: '#18181B', fontWeight: 600 }}
                  />
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${value ?? 0} (${(props?.payload as { tenPhuTung?: string } | undefined)?.tenPhuTung ?? ''})`,
                      'Xuất trong kỳ',
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar
                    dataKey="xuatTrongKy"
                    name="Xuất trong kỳ"
                    fill="#EA580C"
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
              Chưa có dữ liệu tiêu thụ trong kỳ trên Google Sheets.
            </div>
          )}
        </div>

        {/* Chart 2: Tồn hiện tại so với ROP */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-zinc-900">Tồn hiện tại so với ROP</h2>
          <p className="text-xs text-zinc-500 mt-0.5 mb-4">
            So sánh Tồn hiện tại và Điểm đặt hàng (ROP) từng mã
          </p>
          {charts.tonSoVoiRop.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.tonSoVoiRop}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="maPhuTung" tick={{ fontSize: 10, fill: '#52525B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717A' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="tonHienTai"
                    name="Tồn hiện tại"
                    fill="#18181B"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="rop"
                    name="Điểm đặt hàng (ROP)"
                    fill="#F59E0B"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
              Chưa có dữ liệu tồn kho.
            </div>
          )}
        </div>

        {/* Chart 3: Tỷ lệ phụ tùng theo trạng thái */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col">
          <h2 className="text-sm font-bold text-zinc-900">Tỷ lệ phụ tùng theo trạng thái</h2>
          <p className="text-xs text-zinc-500 mt-0.5 mb-2">
            Phân bổ {kpis.tongLoaiPhuTung} mã theo ngưỡng ROP & Safety Stock
          </p>
          {items.length > 0 ? (
            <>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.phanBoTrangThai.filter((s) => s.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={44}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {charts.phanBoTrangThai
                        .filter((s) => s.count > 0)
                        .map((entry) => (
                          <Cell key={entry.status} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-auto space-y-1.5 pt-2 border-t border-zinc-100">
                {charts.phanBoTrangThai.map((s) => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-700 font-medium">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.label}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-zinc-900">
                      {s.count} mã
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
              Chưa có dữ liệu.
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2: Stock Value per Part + Inbound/Outbound Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 4: Giá trị tồn kho theo từng phụ tùng */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-zinc-900">
            Giá trị tồn kho theo từng phụ tùng
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 mb-4">
            Tính theo Tồn hiện tại × Giá nhập tham chiếu (VNĐ)
          </p>
          {charts.giaTriTonTheoPhuTung.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.giaTriTonTheoPhuTung}
                  margin={{ top: 4, right: 12, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="maPhuTung" tick={{ fontSize: 10, fill: '#52525B' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#71717A' }}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrency(Number(v)), 'Giá trị tồn']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar
                    dataKey="giaTriTon"
                    name="Giá trị tồn kho"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
              Chưa có dữ liệu giá trị tồn kho.
            </div>
          )}
        </div>

        {/* Chart 5: Xu hướng nhập và xuất theo thời gian */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-zinc-900">
            Xu hướng nhập và xuất theo thời gian
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 mb-4">
            Tổng hợp giao dịch NHAP_NCC và XUAT_SUA_CHUA từ Firebase Firestore
          </p>
          {charts.xuHuongNhapXuat.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={charts.xuHuongNhapXuat}
                  margin={{ top: 4, right: 12, left: -14, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="ngay" tick={{ fontSize: 10, fill: '#71717A' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717A' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="nhap"
                    name="Nhập NCC"
                    stroke="#16A34A"
                    fill="#DCFCE7"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="xuat"
                    name="Xuất sửa chữa"
                    stroke="#EA580C"
                    fill="#FFEDD5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
              Chưa có lịch sử giao dịch trên PHU TUNG KHO.
            </div>
          )}
        </div>
      </div>

      {/* 16-Column Inventory Tracking Table (Section 2.B) */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              Bảng theo dõi tồn kho & Cảnh báo đặt hàng ({filteredItems.length})
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Nhấn vào từng dòng để xem hồ sơ chi tiết và lịch sử giao dịch trên Firebase Firestore
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 bg-zinc-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'URGENT', label: 'Đặt ngay / Hết hàng' },
                  { id: 'CHUAN_BI_DAT', label: 'Chuẩn bị đặt' },
                  { id: 'DU_HANG', label: 'Đủ hàng' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setSortMode((m) => (m === 'priority' ? 'code' : 'priority'))
              }
              className="h-8 px-3 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortMode === 'priority' ? 'Ưu tiên đặt hàng' : 'Theo thứ tự mã'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Mã PT</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Tên phụ tùng</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">ĐVT</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Tồn hiện tại</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Định mức TT</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">TB/ngày</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Safety Stock</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">ROP</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Lead Time</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Còn đủ dùng</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Ngày cần đặt</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Đề xuất đặt</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Giá nhập TK</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Giá bán TK</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">NCC</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredItems.map((it) => {
                const { catalog, indicator } = it;
                const meta = getSheetStatusMeta(it.trangThai);
                return (
                  <tr
                    key={catalog.maPhuTung}
                    onClick={() => onSelectItem(it)}
                    className="hover:bg-amber-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                      {catalog.maPhuTung}
                    </td>
                    <td className="px-3 py-3 font-semibold text-zinc-900 min-w-[150px]">
                      {catalog.tenPhuTung}
                    </td>
                    <td className="px-3 py-3 text-zinc-600 whitespace-nowrap">
                      {catalog.donViTinh}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-zinc-900">
                      {formatNumber(indicator.tonHienTai)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-600">
                      {formatNumber(catalog.dinhMucToiThieu)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {formatNumber(indicator.tieuThuTBNgay, 2)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {formatNumber(indicator.tonAnToan)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-orange-700">
                      {formatNumber(indicator.diemDatHang)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                      {it.leadTimeApDung}N
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {indicator.soNgayConDuDung !== null
                        ? `${formatNumber(indicator.soNgayConDuDung, 1)}N`
                        : '—'}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {indicator.ngayDatMuonNhat || '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-red-700">
                      {indicator.slDeXuatDat > 0 ? formatNumber(indicator.slDeXuatDat) : '0'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {formatCurrency(catalog.giaNhapThamChieu)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {formatCurrency(catalog.giaBanThamChieu)}
                    </td>
                    <td className="px-3 py-3 font-mono text-zinc-600 whitespace-nowrap">
                      {catalog.maNhaCungCapMacDinh}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                      >
                        {it.trangThai === 'HET_HANG' ? (
                          <AlertOctagon className="w-3 h-3" />
                        ) : it.trangThai === 'DU_HANG' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {it.trangThaiLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-zinc-500">
                    Không có phụ tùng nào khớp điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
