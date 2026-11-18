import React, { useEffect, useState } from 'react';
import { Calculator, Pencil, RotateCcw, Save, Sliders, X } from 'lucide-react';
import type {
  MergedInventoryItem,
  SheetsStateResponse,
  ThamSoOverride,
} from '../types/inventory';
import {
  formatNumber,
  formatReadableError,
  getSheetStatusMeta,
  isMutationCancelledError,
} from '../lib/format';
import { computeInclusiveDays } from '../lib/inventoryCalculator';

interface KpiAnalysisPageProps {
  state: SheetsStateResponse;
  onSelectItem: (item: MergedInventoryItem) => void;
  onSaveThamSo: (payload: Omit<ThamSoOverride, 'active'>) => Promise<void>;
  onResetThamSo: () => Promise<void>;
}

export function KpiAnalysisPage({
  state,
  onSelectItem,
  onSaveThamSo,
  onResetThamSo,
}: KpiAnalysisPageProps) {
  const { thamSo, items } = state;
  const isCustomOverride = state.thamSoSource === 'FIRESTORE_OVERRIDE';

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    tuNgayIso: thamSo.tuNgayIso,
    denNgayIso: thamSo.denNgayIso,
    ngayXemBaoCaoIso: thamSo.ngayXemBaoCaoIso,
    leadTimeMacDinh: thamSo.leadTimeMacDinh,
    soNgayDuTruMongMuon: thamSo.soNgayDuTruMongMuon,
    soNgayCanhBaoTruoc: thamSo.soNgayCanhBaoTruoc,
  });

  useEffect(() => {
    if (!editing) {
      setForm({
        tuNgayIso: thamSo.tuNgayIso,
        denNgayIso: thamSo.denNgayIso,
        ngayXemBaoCaoIso: thamSo.ngayXemBaoCaoIso,
        leadTimeMacDinh: thamSo.leadTimeMacDinh,
        soNgayDuTruMongMuon: thamSo.soNgayDuTruMongMuon,
        soNgayCanhBaoTruoc: thamSo.soNgayCanhBaoTruoc,
      });
    }
  }, [editing, thamSo]);

  const previewPeriodDays = computeInclusiveDays(form.tuNgayIso, form.denNgayIso);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (form.tuNgayIso > form.denNgayIso) {
      setErrorMsg('Từ ngày không được lớn hơn Đến ngày của kỳ thống kê.');
      return;
    }
    setSaving(true);
    try {
      await onSaveThamSo({
        tuNgayIso: form.tuNgayIso,
        denNgayIso: form.denNgayIso,
        ngayXemBaoCaoIso: form.ngayXemBaoCaoIso,
        leadTimeMacDinh: Number(form.leadTimeMacDinh),
        soNgayDuTruMongMuon: Number(form.soNgayDuTruMongMuon),
        soNgayCanhBaoTruoc: Number(form.soNgayCanhBaoTruoc),
      });
      setEditing(false);
    } catch (err) {
      if (!isMutationCancelledError(err)) {
        setErrorMsg(
          formatReadableError(err, 'Không thể lưu tham số vào Firebase.')
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setErrorMsg(null);
    setSaving(true);
    try {
      await onResetThamSo();
      setEditing(false);
    } catch (err) {
      if (!isMutationCancelledError(err)) {
        setErrorMsg(
          formatReadableError(
            err,
            'Không thể khôi phục tham số từ Google Sheets.'
          )
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const paramRows = [
    { label: 'Từ ngày (bắt đầu kỳ thống kê)', value: thamSo.tuNgay },
    { label: 'Đến ngày (kết thúc kỳ thống kê)', value: thamSo.denNgay },
    { label: 'Số ngày của kỳ', value: `${thamSo.soNgayCuaKy} ngày` },
    { label: 'Ngày xem báo cáo', value: thamSo.ngayXemBaoCao },
    { label: 'Thời gian chờ hàng mặc định (Lead Time)', value: `${thamSo.leadTimeMacDinh} ngày` },
    { label: 'Số ngày dự trữ mong muốn', value: `${thamSo.soNgayDuTruMongMuon} ngày` },
    { label: 'Số ngày cảnh báo trước điểm đặt', value: `${thamSo.soNgayCanhBaoTruoc} ngày` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
          Bảng Tính Chỉ Số Tồn Kho & Tham Số (THAM SO)
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
          Nhân viên có thể chỉnh các tham số vận hành tại đây (lưu trên Firebase Firestore), còn toàn bộ chỉ số ROP, Safety Stock & SL đề xuất đặt sẽ được hệ thống tự động tính toán.
        </p>
      </div>

      {/* Live THAM SO Table / Editor */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 bg-zinc-50">
          <div className="flex flex-wrap items-center gap-2">
            <Sliders className="w-4 h-4 text-orange-600" />
            <h2 className="text-sm font-bold text-zinc-900">
              Tham số vận hành (THAM SO)
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                isCustomOverride
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {isCustomOverride
                ? 'Đang dùng tham số chỉnh trên Web (Firebase)'
                : 'Đang đồng bộ theo Google Sheets'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isCustomOverride && !editing && (
              <button
                type="button"
                disabled={saving}
                onClick={handleReset}
                className="h-8 px-3 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục theo Google Sheets
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setEditing((prev) => !prev);
              }}
              className="h-8 px-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              {editing ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  Đóng chỉnh sửa
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  Nhập / Chỉnh sửa tham số
                </>
              )}
            </button>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-medium">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Từ ngày (bắt đầu kỳ thống kê) *
                </label>
                <input
                  type="date"
                  required
                  value={form.tuNgayIso}
                  onChange={(e) => setForm({ ...form, tuNgayIso: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Đến ngày (kết thúc kỳ thống kê) *
                </label>
                <input
                  type="date"
                  required
                  value={form.denNgayIso}
                  onChange={(e) => setForm({ ...form, denNgayIso: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Ngày xem báo cáo *
                </label>
                <input
                  type="date"
                  required
                  value={form.ngayXemBaoCaoIso}
                  onChange={(e) =>
                    setForm({ ...form, ngayXemBaoCaoIso: e.target.value })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Lead Time mặc định (ngày) *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={365}
                  value={form.leadTimeMacDinh}
                  onChange={(e) =>
                    setForm({ ...form, leadTimeMacDinh: Number(e.target.value) })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Số ngày dự trữ mong muốn *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={365}
                  value={form.soNgayDuTruMongMuon}
                  onChange={(e) =>
                    setForm({ ...form, soNgayDuTruMongMuon: Number(e.target.value) })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Số ngày cảnh báo trước điểm đặt *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={365}
                  value={form.soNgayCanhBaoTruoc}
                  onChange={(e) =>
                    setForm({ ...form, soNgayCanhBaoTruoc: Number(e.target.value) })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-zinc-600">
                Số ngày của kỳ sẽ tự động tính:{' '}
                <strong className="font-mono text-zinc-900">{previewPeriodDays} ngày</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-9 px-3.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Đang lưu...' : 'Lưu tham số lên Firebase'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
            {paramRows.map((row) => (
              <div key={row.label} className="p-4 border-b border-zinc-100 lg:border-b-0">
                <div className="text-[11px] text-zinc-500 font-medium">{row.label}</div>
                <div className="text-base font-bold font-mono tabular-nums text-zinc-900 mt-1">
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full 16-column TINH CHI SO Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-orange-600" />
            <h2 className="text-sm font-bold text-zinc-900">
              Bảng chỉ số tự động tính toán ({items.length} mã phụ tùng)
            </h2>
          </div>
          <span className="text-xs text-zinc-500">
            Nhấn vào từng dòng để xem chi tiết & giao dịch
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Mã PT</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Tên phụ tùng</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Tổng nhập</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Tổng xuất</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Tồn hiện tại</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Xuất trong kỳ</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Tiêu thụ TB/ngày</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Còn dùng (ngày)</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Nhu cầu lúc chờ</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Đủ dùng lúc chờ</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Tồn an toàn</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Điểm đặt hàng</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Số ngày tới ROP</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Đặt muộn nhất</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">SL đề xuất đặt</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">Quyết định</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((it) => {
                const ind = it.indicator;
                const meta = getSheetStatusMeta(it.trangThai);
                return (
                  <tr
                    key={ind.maPhuTung}
                    onClick={() => onSelectItem(it)}
                    className="hover:bg-zinc-50 cursor-pointer"
                  >
                    <td className="px-3 py-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                      {ind.maPhuTung}
                    </td>
                    <td className="px-3 py-3 font-medium text-zinc-900 min-w-[160px]">
                      {ind.tenPhuTung}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {formatNumber(ind.tongNhap)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {formatNumber(ind.tongXuat)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-zinc-900">
                      {formatNumber(ind.tonHienTai)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {formatNumber(ind.xuatTrongKy)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {formatNumber(ind.tieuThuTBNgay, 4)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {ind.soNgayConDuDung !== null ? formatNumber(ind.soNgayConDuDung, 1) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {formatNumber(ind.nhuCauLucChoHang, 2)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap font-semibold">
                      <span
                        className={
                          ind.duDungLucCho === 'Thiếu' ? 'text-red-700' : 'text-emerald-700'
                        }
                      >
                        {ind.duDungLucCho || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {formatNumber(ind.tonAnToan)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-orange-700">
                      {formatNumber(ind.diemDatHang)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-700">
                      {ind.soNgayToiDiemDat !== null ? formatNumber(ind.soNgayToiDiemDat, 1) : '—'}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {ind.ngayDatMuonNhat || '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-red-700">
                      {formatNumber(ind.slDeXuatDat)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-bold ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                      >
                        {ind.quyetDinhRaw || it.trangThaiLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
