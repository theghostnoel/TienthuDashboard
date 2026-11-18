import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import type { SheetsStateResponse, TransactionType } from '../types/inventory';
import {
  formatCurrency,
  formatNumber,
  formatReadableError,
  getLocalTodayIso,
  getSheetStatusMeta,
  getTransactionTypeLabel,
  isMutationCancelledError,
} from '../lib/format';

interface TransactionsPageProps {
  state: SheetsStateResponse;
  searchQuery: string;
  preselectedPartCode?: string | null;
  preselectedMode?: TransactionType;
  onInbound: (payload: {
    maPhuTung: string;
    soLuong: number;
    ngayGiaoDichIso: string;
    donGia: number;
    maNhaCungCap: string;
    nhanVienThucHien: string;
    maDonDatHang?: string;
    ghiChu?: string;
    clientRequestId: string;
  }) => Promise<{ transactionCode: string; duplicatePrevented: boolean }>;
  onOutbound: (payload: {
    maPhuTung: string;
    soLuong: number;
    ngayGiaoDichIso: string;
    nhanVienThucHien: string;
    ghiChu?: string;
    clientRequestId: string;
  }) => Promise<{ transactionCode: string; duplicatePrevented: boolean }>;
}

function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function TransactionsPage({
  state,
  searchQuery,
  preselectedPartCode,
  preselectedMode,
  onInbound,
  onOutbound,
}: TransactionsPageProps) {
  const [mode, setMode] = useState<TransactionType>(
    preselectedMode || 'XUAT_SUA_CHUA'
  );
  const [maPhuTung, setMaPhuTung] = useState<string>(
    preselectedPartCode || state.items[0]?.catalog.maPhuTung || 'PT001'
  );
  const [soLuong, setSoLuong] = useState<number>(1);
  const [ngayIso, setNgayIso] = useState<string>(() => getLocalTodayIso());
  const [donGia, setDonGia] = useState<number>(0);
  const [maNhaCungCap, setMaNhaCungCap] = useState<string>('NCC001');
  const [nhanVienThucHien, setNhanVienThucHien] = useState<string>('');
  const [maDonDatHang, setMaDonDatHang] = useState<string>('');
  const [ghiChu, setGhiChu] = useState<string>('');
  const [clientRequestId, setClientRequestId] = useState<string>(() =>
    makeRequestId()
  );

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [txFilter, setTxFilter] = useState<'ALL' | TransactionType>('ALL');

  useEffect(() => {
    if (preselectedPartCode) {
      setMaPhuTung(preselectedPartCode);
      setClientRequestId(makeRequestId());
    }
  }, [preselectedPartCode]);

  useEffect(() => {
    if (preselectedMode) {
      setMode(preselectedMode);
      setClientRequestId(makeRequestId());
    }
  }, [preselectedMode]);

  const selectedItem = useMemo(
    () =>
      state.items.find((it) => it.catalog.maPhuTung === maPhuTung) ||
      state.items[0] ||
      null,
    [state.items, maPhuTung]
  );

  const selectedPartCode = selectedItem?.catalog.maPhuTung;
  useEffect(() => {
    if (selectedItem) {
      setDonGia(selectedItem.catalog.giaNhapThamChieu);
      setMaNhaCungCap(selectedItem.catalog.maNhaCungCapMacDinh || 'NCC001');
    }
    // Only reset default unit price & supplier when switching part code, not on background refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartCode]);

  const invalidateReqId = () => {
    setClientRequestId(makeRequestId());
    setFeedback(null);
  };

  const currentStock = selectedItem?.indicator.tonHienTai ?? 0;
  const projectedStock =
    mode === 'NHAP_NCC'
      ? currentStock + (Number(soLuong) || 0)
      : currentStock - (Number(soLuong) || 0);
  const isInsufficientOutbound =
    mode === 'XUAT_SUA_CHUA' && (Number(soLuong) || 0) > currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const qty = Number(soLuong);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFeedback({ type: 'error', message: 'Số lượng giao dịch phải lớn hơn 0.' });
      return;
    }

    if (mode === 'XUAT_SUA_CHUA' && qty > currentStock) {
      setFeedback({
        type: 'error',
        message: `Không đủ tồn kho khả dụng! "${selectedItem.catalog.tenPhuTung}" hiện chỉ còn ${currentStock} ${selectedItem.catalog.donViTinh}.`,
      });
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const staffName = nhanVienThucHien.trim() || 'Nhân viên kho';
      if (mode === 'NHAP_NCC') {
        const res = await onInbound({
          maPhuTung: selectedItem.catalog.maPhuTung,
          soLuong: qty,
          ngayGiaoDichIso: ngayIso,
          donGia: Number(donGia),
          maNhaCungCap: maNhaCungCap.trim() || 'NCC001',
          nhanVienThucHien: staffName,
          maDonDatHang: maDonDatHang.trim() || undefined,
          ghiChu: ghiChu.trim() || undefined,
          clientRequestId,
        });
        setFeedback({
          type: 'success',
          message: res.duplicatePrevented
            ? `Giao dịch ${res.transactionCode} đã được ghi nhận trước đó trên Firebase Firestore (chống ghi trùng).`
            : `Đã lưu phiếu nhập ${res.transactionCode} (+${qty} ${selectedItem.catalog.donViTinh} ${selectedItem.catalog.maPhuTung}) vào Firebase Firestore và đồng bộ mọi thiết bị.`,
        });
      } else {
        const res = await onOutbound({
          maPhuTung: selectedItem.catalog.maPhuTung,
          soLuong: qty,
          ngayGiaoDichIso: ngayIso,
          nhanVienThucHien: staffName,
          ghiChu: ghiChu.trim() || undefined,
          clientRequestId,
        });
        setFeedback({
          type: 'success',
          message: res.duplicatePrevented
            ? `Giao dịch ${res.transactionCode} đã được ghi nhận trước đó trên Firebase Firestore (chống ghi trùng).`
            : `Đã lưu phiếu xuất ${res.transactionCode} (-${qty} ${selectedItem.catalog.donViTinh} ${selectedItem.catalog.maPhuTung}) vào Firebase Firestore và đồng bộ mọi thiết bị.`,
        });
      }
      setClientRequestId(makeRequestId());
      setGhiChu('');
      setMaDonDatHang('');
    } catch (err) {
      if (!isMutationCancelledError(err)) {
        setFeedback({
          type: 'error',
          message: formatReadableError(
            err,
            'Không thể lưu giao dịch vào Firebase Firestore.'
          ),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const partNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of state.items) {
      map.set(it.catalog.maPhuTung, it.catalog.tenPhuTung);
    }
    return map;
  }, [state.items]);

  const filteredTx = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.transactions.filter((t) => {
      if (txFilter !== 'ALL' && t.loaiGiaoDich !== txFilter) return false;
      if (!q) return true;
      const tenPt = partNameMap.get(t.maPhuTung) || '';
      return (
        t.maGiaoDich.toLowerCase().includes(q) ||
        t.maPhuTung.toLowerCase().includes(q) ||
        tenPt.toLowerCase().includes(q) ||
        t.nhanVienThucHien.toLowerCase().includes(q) ||
        t.ghiChu.toLowerCase().includes(q)
      );
    });
  }, [state.transactions, txFilter, searchQuery, partNameMap]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
          Nhập kho (NHAP_NCC) & Xuất kho (XUAT_SUA_CHUA)
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
          Lưu giao dịch trực tiếp vào <strong>Firebase Firestore</strong> để đồng bộ đa thiết bị và tự động ghi vào tab <code translate="no" className="notranslate font-mono text-zinc-700">PHU TUNG KHO</code> trên Google Sheets (khi bật đồng bộ tự động Apps Script hoặc OAuth) để tồn kho khớp 100%.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Panel */}
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 border-b border-zinc-200 bg-zinc-50">
            <button
              type="button"
              onClick={() => {
                setMode('XUAT_SUA_CHUA');
                invalidateReqId();
              }}
              className={`py-3 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                mode === 'XUAT_SUA_CHUA'
                  ? 'border-orange-600 text-orange-700 bg-white'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Xuất kho (XUAT_SUA_CHUA)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('NHAP_NCC');
                invalidateReqId();
              }}
              className={`py-3 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                mode === 'NHAP_NCC'
                  ? 'border-emerald-600 text-emerald-700 bg-white'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Nhập kho (NHAP_NCC)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            {feedback && (
              <div
                className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Mã phụ tùng *
              </label>
              <select
                value={selectedItem?.catalog.maPhuTung || maPhuTung}
                onChange={(e) => {
                  setMaPhuTung(e.target.value);
                  invalidateReqId();
                }}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white font-medium text-zinc-900"
              >
                {state.items.map((it) => (
                  <option key={it.catalog.maPhuTung} value={it.catalog.maPhuTung}>
                    {it.catalog.maPhuTung} — {it.catalog.tenPhuTung} (Tồn:{' '}
                    {it.indicator.tonHienTai} {it.catalog.donViTinh})
                  </option>
                ))}
              </select>
            </div>

            {selectedItem && (
              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-500">Tồn hiện tại</span>
                  <div className="font-mono font-bold text-zinc-900 text-sm">
                    {formatNumber(selectedItem.indicator.tonHienTai)}{' '}
                    {selectedItem.catalog.donViTinh}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">ROP / SS</span>
                  <div className="font-mono font-bold text-orange-700 text-sm">
                    {formatNumber(selectedItem.indicator.diemDatHang)} /{' '}
                    {formatNumber(selectedItem.indicator.tonAnToan)}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Trạng thái</span>
                  <div
                    className={`font-semibold text-xs ${
                      getSheetStatusMeta(selectedItem.trangThai).textClass
                    }`}
                  >
                    {selectedItem.trangThaiLabel}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  {mode === 'NHAP_NCC' ? 'Số lượng nhập *' : 'Số lượng xuất *'}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={soLuong}
                  onChange={(e) => {
                    setSoLuong(Number(e.target.value));
                    invalidateReqId();
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 font-mono font-bold text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  {mode === 'NHAP_NCC' ? 'Ngày nhập *' : 'Ngày xuất *'}
                </label>
                <input
                  type="date"
                  required
                  value={ngayIso}
                  onChange={(e) => {
                    setNgayIso(e.target.value);
                    invalidateReqId();
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 font-mono"
                />
              </div>
            </div>

            {mode === 'NHAP_NCC' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">
                      Đơn giá nhập thực tế (đ) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={donGia}
                      onChange={(e) => {
                        setDonGia(Number(e.target.value));
                        invalidateReqId();
                      }}
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">
                      Nhà cung cấp
                    </label>
                    <input
                      type="text"
                      value={maNhaCungCap}
                      onChange={(e) => {
                        setMaNhaCungCap(e.target.value);
                        invalidateReqId();
                      }}
                      placeholder="NCC001"
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Mã đơn đặt hàng (không bắt buộc)
                  </label>
                  <input
                    type="text"
                    value={maDonDatHang}
                    onChange={(e) => {
                      setMaDonDatHang(e.target.value);
                      invalidateReqId();
                    }}
                    placeholder="VD: DDH-2026-01"
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 font-mono"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Người thực hiện (tùy chọn)
              </label>
              <input
                type="text"
                value={nhanVienThucHien}
                onChange={(e) => {
                  setNhanVienThucHien(e.target.value);
                  invalidateReqId();
                }}
                placeholder="VD: Nguyễn Văn Nam (mặc định: Nhân viên kho)"
                className="w-full h-10 px-3 rounded-lg border border-zinc-200"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                {mode === 'NHAP_NCC'
                  ? 'Ghi chú phiếu nhập'
                  : 'Ghi chú xuất kho (không bắt buộc)'}
              </label>
              <textarea
                rows={2}
                value={ghiChu}
                onChange={(e) => {
                  setGhiChu(e.target.value);
                  invalidateReqId();
                }}
                placeholder={
                  mode === 'NHAP_NCC'
                    ? 'VD: Nhập bổ sung từ đại lý NCC001'
                    : 'VD: Xuất thay thế sửa chữa định kỳ cho khách'
                }
                className="w-full p-3 rounded-lg border border-zinc-200"
              />
            </div>

            {selectedItem && (
              <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-between text-[11px]">
                <span className="text-zinc-600">Tồn dự kiến sau giao dịch:</span>
                <span
                  className={`font-mono font-bold ${
                    projectedStock < 0 ? 'text-red-700' : 'text-zinc-900'
                  }`}
                >
                  {formatNumber(currentStock)} → {formatNumber(projectedStock)}{' '}
                  {selectedItem.catalog.donViTinh}
                </span>
              </div>
            )}

            {isInsufficientOutbound && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold text-[11px]">
                Số lượng xuất ({soLuong}) vượt quá tồn hiện tại ({currentStock}). Không thể xuất âm kho.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || isInsufficientOutbound}
              className={`w-full h-10 rounded-lg font-bold text-white transition-colors disabled:opacity-50 ${
                mode === 'NHAP_NCC'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {submitting
                ? 'Đang lưu vào Database...'
                : mode === 'NHAP_NCC'
                ? 'Lưu phiếu nhập'
                : 'Lưu phiếu xuất'}
            </button>
          </form>
        </div>

        {/* Live Ledger */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Lịch sử giao dịch kho ({filteredTx.length})
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Lưu trữ vĩnh viễn trên Firebase Firestore · Tự động cập nhật tức thì giữa mọi thiết bị
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'NHAP_NCC', label: 'Nhập NCC' },
                  { id: 'XUAT_SUA_CHUA', label: 'Xuất sửa chữa' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTxFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    txFilter === tab.id
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[650px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 sticky top-0">
                <tr>
                  <th className="px-3.5 py-3 font-semibold">Mã GD</th>
                  <th className="px-3.5 py-3 font-semibold">Ngày</th>
                  <th className="px-3.5 py-3 font-semibold">Phụ tùng</th>
                  <th className="px-3.5 py-3 font-semibold">Loại</th>
                  <th className="px-3.5 py-3 font-semibold text-right">SL</th>
                  <th className="px-3.5 py-3 font-semibold text-right">Đơn giá</th>
                  <th className="px-3.5 py-3 font-semibold">Người TH / NCC</th>
                  <th className="px-3.5 py-3 font-semibold">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredTx.map((tx) => (
                  <tr
                    key={`${tx.id ?? tx.rowIndex}-${tx.maGiaoDich}`}
                    className="hover:bg-zinc-50"
                  >
                    <td className="px-3.5 py-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                      {tx.maGiaoDich}
                    </td>
                    <td className="px-3.5 py-3 tabular-nums text-zinc-600 whitespace-nowrap">
                      {tx.ngayGiaoDich || '—'}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-mono font-semibold text-zinc-900">
                        {tx.maPhuTung}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate max-w-[160px]">
                        {partNameMap.get(tx.maPhuTung) || '—'}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap font-semibold">
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
                    <td className="px-3.5 py-3 text-right font-mono tabular-nums font-bold">
                      {tx.loaiGiaoDich === 'NHAP_NCC'
                        ? `+${tx.soLuong}`
                        : `-${tx.soLuong}`}
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                      {tx.donGiaGiaoDich !== null
                        ? formatCurrency(tx.donGiaGiaoDich)
                        : '—'}
                    </td>
                    <td className="px-3.5 py-3 text-zinc-700">
                      <div>{tx.nhanVienThucHien || '—'}</div>
                      {(tx.maNhaCungCap || tx.maDonDatHang) && (
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {[tx.maNhaCungCap, tx.maDonDatHang]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-zinc-600 min-w-[140px]">
                      {tx.ghiChu || '—'}
                    </td>
                  </tr>
                ))}

                {filteredTx.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                      Chưa có giao dịch phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
