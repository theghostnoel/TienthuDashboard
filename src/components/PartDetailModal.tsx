import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { MergedInventoryItem, SheetTransaction } from '../types/inventory';
import {
  formatCurrency,
  formatNumber,
  getSheetStatusMeta,
  getTransactionTypeLabel,
} from '../lib/format';

interface PartDetailModalProps {
  item: MergedInventoryItem | null;
  transactions: SheetTransaction[];
  onClose: () => void;
  onCreateTransaction?: (maPhuTung: string, type: 'NHAP_NCC' | 'XUAT_SUA_CHUA') => void;
}

export function PartDetailModal({
  item,
  transactions,
  onClose,
  onCreateTransaction,
}: PartDetailModalProps) {
  if (!item) return null;

  const { catalog, indicator } = item;
  const statusMeta = getSheetStatusMeta(item.trangThai);
  const partTx = transactions.filter((t) => t.maPhuTung === catalog.maPhuTung);

  const chartTx = [...partTx]
    .reverse()
    .map((t) => ({
      ngay: t.ngayGiaoDich || t.maGiaoDich,
      nhap: t.loaiGiaoDich === 'NHAP_NCC' ? t.soLuong : 0,
      xuat: t.loaiGiaoDich === 'XUAT_SUA_CHUA' ? t.soLuong : 0,
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60">
      <div className="bg-white border border-zinc-200 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-start justify-between gap-4 bg-zinc-50">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="font-mono font-bold text-zinc-900">{catalog.maPhuTung}</span>
              <span aria-hidden="true">·</span>
              <span>ĐVT: {catalog.donViTinh}</span>
              <span aria-hidden="true">·</span>
              <span>NCC mặc định: {catalog.maNhaCungCapMacDinh}</span>
              {catalog.nhomPhuTung && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{catalog.nhomPhuTung}</span>
                </>
              )}
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mt-1">{catalog.tenPhuTung}</h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold ${statusMeta.bgClass} ${statusMeta.textClass} ${statusMeta.borderClass}`}
            >
              {item.trangThai === 'DU_HANG' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              {item.trangThaiLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-200/60"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Indicators Strip from TINH CHI SO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-xs text-zinc-500">Tồn hiện tại</div>
              <div className="text-lg font-bold font-mono tabular-nums text-zinc-900 mt-0.5">
                {formatNumber(indicator.tonHienTai)} {catalog.donViTinh}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-xs text-zinc-500">Tổng nhập / xuất</div>
              <div className="text-base font-bold font-mono tabular-nums text-zinc-900 mt-0.5">
                +{formatNumber(indicator.tongNhap)} / -{formatNumber(indicator.tongXuat)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-xs text-zinc-500">Tiêu thụ TB/ngày</div>
              <div className="text-lg font-bold font-mono tabular-nums text-zinc-900 mt-0.5">
                {formatNumber(indicator.tieuThuTBNgay, 2)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-xs text-zinc-500">Điểm đặt hàng (ROP)</div>
              <div className="text-lg font-bold font-mono tabular-nums text-orange-700 mt-0.5">
                {formatNumber(indicator.diemDatHang)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-xs text-zinc-500">Tồn an toàn (SS)</div>
              <div className="text-lg font-bold font-mono tabular-nums text-zinc-900 mt-0.5">
                {formatNumber(indicator.tonAnToan)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-xs text-zinc-500">SL đề xuất đặt</div>
              <div className="text-lg font-bold font-mono tabular-nums text-red-700 mt-0.5">
                {formatNumber(indicator.slDeXuatDat)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 rounded-lg border border-zinc-200 bg-white text-xs">
            <div className="flex flex-wrap items-center gap-3 text-zinc-600">
              <span>
                Giá nhập TK:{' '}
                <strong className="font-mono text-zinc-900">
                  {formatCurrency(catalog.giaNhapThamChieu)}
                </strong>
              </span>
              <span>·</span>
              <span>
                Giá bán TK:{' '}
                <strong className="font-mono text-zinc-900">
                  {formatCurrency(catalog.giaBanThamChieu)}
                </strong>
              </span>
              <span>·</span>
              <span>
                Lead Time:{' '}
                <strong className="font-mono text-zinc-900">{item.leadTimeApDung} ngày</strong>
              </span>
              <span>·</span>
              <span>
                Đủ dùng lúc chờ:{' '}
                <strong
                  className={
                    indicator.duDungLucCho === 'Thiếu'
                      ? 'text-red-700'
                      : 'text-emerald-700'
                  }
                >
                  {indicator.duDungLucCho || '—'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Đặt muộn nhất:{' '}
                <strong className="font-mono text-zinc-900">
                  {indicator.ngayDatMuonNhat || '—'}
                </strong>
              </span>
            </div>

            {onCreateTransaction && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onCreateTransaction(catalog.maPhuTung, 'NHAP_NCC')}
                  className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-800"
                >
                  Nhập kho mã này
                </button>
                <button
                  type="button"
                  onClick={() => onCreateTransaction(catalog.maPhuTung, 'XUAT_SUA_CHUA')}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-xs font-semibold text-white"
                >
                  Xuất kho mã này
                </button>
              </div>
            )}
          </div>

          {chartTx.length > 0 && (
            <div className="border border-zinc-200 rounded-lg p-4 bg-white">
              <h3 className="text-sm font-bold text-zinc-900 mb-3">
                Lịch sử Nhập / Xuất kho
              </h3>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartTx}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                    <XAxis dataKey="ngay" tick={{ fontSize: 11, fill: '#71717A' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#71717A' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="nhap" name="Nhập NCC" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="xuat"
                      name="Xuất sửa chữa"
                      fill="#EA580C"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-sm font-bold text-zinc-900">
              Giao dịch chi tiết ({partTx.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Mã GD</th>
                    <th className="px-4 py-2.5 font-semibold">Ngày</th>
                    <th className="px-4 py-2.5 font-semibold">Loại giao dịch</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Số lượng</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Đơn giá</th>
                    <th className="px-4 py-2.5 font-semibold">Nhân viên</th>
                    <th className="px-4 py-2.5 font-semibold">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {partTx.map((tx) => (
                    <tr key={`${tx.id ?? tx.rowIndex}-${tx.maGiaoDich}`} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-mono font-semibold text-zinc-900">
                        {tx.maGiaoDich}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-zinc-600">
                        {tx.ngayGiaoDich}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        <span
                          className={
                            tx.loaiGiaoDich === 'NHAP_NCC'
                              ? 'text-emerald-700'
                              : 'text-orange-700'
                          }
                        >
                          {getTransactionTypeLabel(tx.loaiGiaoDich)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold">
                        {tx.loaiGiaoDich === 'NHAP_NCC' ? `+${tx.soLuong}` : `-${tx.soLuong}`}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-600">
                        {tx.donGiaGiaoDich !== null ? formatCurrency(tx.donGiaGiaoDich) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {tx.nhanVienThucHien || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">{tx.ghiChu || '—'}</td>
                    </tr>
                  ))}
                  {partTx.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                        Chưa có giao dịch nào ghi nhận cho mã phụ tùng này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
