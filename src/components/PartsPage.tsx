import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import type {
  MergedInventoryItem,
  SheetDecisionStatus,
  SheetsStateResponse,
} from '../types/inventory';
import {
  formatCurrency,
  formatNumber,
  formatReadableError,
  getSheetStatusMeta,
  isMutationCancelledError,
} from '../lib/format';

interface PartsPageProps {
  state: SheetsStateResponse;
  searchQuery: string;
  onSelectItem: (item: MergedInventoryItem) => void;
  onUpdatePart: (
    maPhuTung: string,
    payload: {
      tenPhuTung: string;
      donViTinh: string;
      dinhMucToiThieu: number;
      ghiChu: string;
      nhomPhuTung?: string;
      giaNhapThamChieu: number;
      giaBanThamChieu: number;
      maNhaCungCapMacDinh: string;
      leadTimeRieng: number | null;
      slDangDatChuaNhan?: number;
    }
  ) => Promise<void>;
  onCreatePart: (payload: {
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
  }) => Promise<void>;
}

export function PartsPage({
  state,
  searchQuery,
  onSelectItem,
  onUpdatePart,
  onCreatePart,
}: PartsPageProps) {
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SheetDecisionStatus>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MergedInventoryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    maPhuTung: '',
    tenPhuTung: '',
    donViTinh: 'Cái',
    dinhMucToiThieu: 5,
    nhomPhuTung: '',
    giaNhapThamChieu: 0,
    giaBanThamChieu: 0,
    maNhaCungCapMacDinh: 'NCC001',
    leadTimeRieng: '',
    tonDauKy: 0,
    slDangDatChuaNhan: 0,
    ghiChu: '',
  });

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const it of state.items) {
      if (it.catalog.nhomPhuTung) set.add(it.catalog.nhomPhuTung);
    }
    return Array.from(set);
  }, [state.items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.items.filter((it) => {
      if (groupFilter !== 'ALL' && it.catalog.nhomPhuTung !== groupFilter) return false;
      if (statusFilter !== 'ALL' && it.trangThai !== statusFilter) return false;
      if (!q) return true;
      return (
        it.catalog.maPhuTung.toLowerCase().includes(q) ||
        it.catalog.tenPhuTung.toLowerCase().includes(q) ||
        it.catalog.nhomPhuTung.toLowerCase().includes(q) ||
        it.catalog.maNhaCungCapMacDinh.toLowerCase().includes(q)
      );
    });
  }, [state.items, groupFilter, statusFilter, searchQuery]);

  const openAddModal = () => {
    setEditingItem(null);
    setErrorMsg(null);
    const existingCodes = new Set(
      state.items.map((it) => it.catalog.maPhuTung.toUpperCase())
    );
    let nextNum = state.items.length + 1;
    while (existingCodes.has(`PT${String(nextNum).padStart(3, '0')}`)) {
      nextNum++;
    }
    setForm({
      maPhuTung: `PT${String(nextNum).padStart(3, '0')}`,
      tenPhuTung: '',
      donViTinh: 'Cái',
      dinhMucToiThieu: 5,
      nhomPhuTung: groups[0] || 'Phụ tùng bảo dưỡng',
      giaNhapThamChieu: 50000,
      giaBanThamChieu: 75000,
      maNhaCungCapMacDinh: 'NCC001',
      leadTimeRieng: '',
      tonDauKy: 0,
      slDangDatChuaNhan: 0,
      ghiChu: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (it: MergedInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const c = it.catalog;
    setEditingItem(it);
    setErrorMsg(null);
    setForm({
      maPhuTung: c.maPhuTung,
      tenPhuTung: c.tenPhuTung,
      donViTinh: c.donViTinh,
      dinhMucToiThieu: c.dinhMucToiThieu,
      nhomPhuTung: c.nhomPhuTung,
      giaNhapThamChieu: c.giaNhapThamChieu,
      giaBanThamChieu: c.giaBanThamChieu,
      maNhaCungCapMacDinh: c.maNhaCungCapMacDinh || 'NCC001',
      leadTimeRieng: c.leadTimeRieng !== null ? String(c.leadTimeRieng) : '',
      tonDauKy: c.tonDauKy,
      slDangDatChuaNhan: c.slDangDatChuaNhan,
      ghiChu: c.ghiChu,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const leadTimeVal =
        form.leadTimeRieng.trim() === '' ? null : Number(form.leadTimeRieng);
      if (editingItem) {
        await onUpdatePart(editingItem.catalog.maPhuTung, {
          tenPhuTung: form.tenPhuTung,
          donViTinh: form.donViTinh,
          dinhMucToiThieu: Number(form.dinhMucToiThieu),
          ghiChu: form.ghiChu,
          nhomPhuTung: form.nhomPhuTung,
          giaNhapThamChieu: Number(form.giaNhapThamChieu),
          giaBanThamChieu: Number(form.giaBanThamChieu),
          maNhaCungCapMacDinh: form.maNhaCungCapMacDinh || 'NCC001',
          leadTimeRieng: leadTimeVal,
          slDangDatChuaNhan: Number(form.slDangDatChuaNhan),
        });
      } else {
        await onCreatePart({
          maPhuTung: form.maPhuTung,
          tenPhuTung: form.tenPhuTung,
          donViTinh: form.donViTinh,
          dinhMucToiThieu: Number(form.dinhMucToiThieu),
          ghiChu: form.ghiChu,
          nhomPhuTung: form.nhomPhuTung,
          giaNhapThamChieu: Number(form.giaNhapThamChieu),
          giaBanThamChieu: Number(form.giaBanThamChieu),
          maNhaCungCapMacDinh: form.maNhaCungCapMacDinh || 'NCC001',
          leadTimeRieng: leadTimeVal,
          tonDauKy: Number(form.tonDauKy),
        });
      }
      setModalOpen(false);
    } catch (err) {
      if (!isMutationCancelledError(err)) {
        setErrorMsg(
          formatReadableError(err, 'Không thể lưu phụ tùng vào Database máy chủ.')
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
            Danh mục phụ tùng ({filteredItems.length})
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Dữ liệu gốc đọc từ Google Sheets (<span className="font-mono text-zinc-700">Danh mục phụ tùng</span>) · Thêm/sửa trên web lưu vào Firebase Firestore · Nhấn vào dòng để xem hồ sơ chi tiết
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="h-10 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm phụ tùng mới</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3.5 flex flex-wrap items-center gap-3">
        {groups.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-600 whitespace-nowrap">
              Nhóm phụ tùng:
            </label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-800 focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">Tất cả nhóm</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'Tất cả' },
              { id: 'HET_HANG', label: 'Hết hàng' },
              { id: 'DAT_NGAY', label: 'Đặt ngay' },
              { id: 'CHUAN_BI_DAT', label: 'Chuẩn bị đặt' },
              { id: 'DU_HANG', label: 'Đủ hàng' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã PT</th>
                <th className="px-4 py-3 font-semibold">Tên phụ tùng & Ghi chú</th>
                <th className="px-4 py-3 font-semibold">Nhóm / ĐVT</th>
                <th className="px-4 py-3 font-semibold text-right">Giá nhập TK</th>
                <th className="px-4 py-3 font-semibold text-right">Giá bán TK</th>
                <th className="px-4 py-3 font-semibold">NCC</th>
                <th className="px-4 py-3 font-semibold text-right">Định mức TT</th>
                <th className="px-4 py-3 font-semibold text-right">Tồn hiện tại</th>
                <th className="px-4 py-3 font-semibold text-right">Đang đặt</th>
                <th className="px-4 py-3 font-semibold text-right">Lead Time</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredItems.map((it) => {
                const { catalog, indicator } = it;
                const statusMeta = getSheetStatusMeta(it.trangThai);
                return (
                  <tr
                    key={catalog.maPhuTung}
                    onClick={() => onSelectItem(it)}
                    className="hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                      {catalog.maPhuTung}
                    </td>
                    <td className="px-4 py-3 min-w-[190px]">
                      <div className="font-semibold text-zinc-900">{catalog.tenPhuTung}</div>
                      {catalog.ghiChu && (
                        <div className="text-[11px] text-zinc-500 truncate max-w-[220px]">
                          {catalog.ghiChu}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                      <div>{catalog.nhomPhuTung || '—'}</div>
                      <div className="text-[11px] text-zinc-400">ĐVT: {catalog.donViTinh}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {formatCurrency(catalog.giaNhapThamChieu)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {formatCurrency(catalog.giaBanThamChieu)}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 whitespace-nowrap">
                      {catalog.maNhaCungCapMacDinh}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-600">
                      {formatNumber(catalog.dinhMucToiThieu)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-zinc-900">
                      {formatNumber(indicator.tonHienTai)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-orange-700">
                      {formatNumber(catalog.slDangDatChuaNhan)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                      {it.leadTimeApDung}N
                      {catalog.leadTimeRieng === null && (
                        <span className="text-[10px] text-zinc-400 ml-1">(MĐ)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${statusMeta.bgClass} ${statusMeta.textClass} ${statusMeta.borderClass}`}
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
                    <td
                      className="px-4 py-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectItem(it)}
                          className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => openEditModal(it, e)}
                          className="p-1.5 rounded text-zinc-500 hover:text-orange-700 hover:bg-orange-50"
                          title="Chỉnh sửa (Lưu trên Database web)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-zinc-500">
                    Không tìm thấy phụ tùng phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60">
          <div className="bg-white border border-zinc-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <h2 className="text-base font-bold text-zinc-900">
                {editingItem
                  ? `Cập nhật phụ tùng ${editingItem.catalog.maPhuTung} (Lưu Database web)`
                  : 'Thêm phụ tùng mới (Lưu Database web)'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-600">
                Thay đổi tại đây sẽ lưu vào <code className="font-mono text-zinc-800">catalog_parts_custom</code> trên Firebase Firestore, đồng bộ thời gian thực mọi thiết bị và tự động cập nhật tab <code className="font-mono text-zinc-800">Danh mục phụ tùng</code> trên Google Sheets khi đã kết nối tài khoản Google.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Mã phụ tùng *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingItem)}
                    value={form.maPhuTung}
                    onChange={(e) => setForm({ ...form, maPhuTung: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono uppercase disabled:bg-zinc-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Tên phụ tùng *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.tenPhuTung}
                    onChange={(e) => setForm({ ...form, tenPhuTung: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Đơn vị tính *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.donViTinh}
                    onChange={(e) => setForm({ ...form, donViTinh: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Nhóm phụ tùng
                  </label>
                  <input
                    type="text"
                    value={form.nhomPhuTung}
                    onChange={(e) => setForm({ ...form, nhomPhuTung: e.target.value })}
                    placeholder="VD: Hệ thống phanh"
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Mã NCC mặc định
                  </label>
                  <input
                    type="text"
                    value={form.maNhaCungCapMacDinh}
                    onChange={(e) =>
                      setForm({ ...form, maNhaCungCapMacDinh: e.target.value })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Giá nhập TK (đ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.giaNhapThamChieu}
                    onChange={(e) =>
                      setForm({ ...form, giaNhapThamChieu: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Giá bán TK (đ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.giaBanThamChieu}
                    onChange={(e) =>
                      setForm({ ...form, giaBanThamChieu: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Định mức tối thiểu
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.dinhMucToiThieu}
                    onChange={(e) =>
                      setForm({ ...form, dinhMucToiThieu: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Lead Time riêng (ngày)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder={`Mặc định ${state.thamSo.leadTimeMacDinh}N`}
                    value={form.leadTimeRieng}
                    onChange={(e) => setForm({ ...form, leadTimeRieng: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editingItem ? (
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">
                      SL đang đặt chưa nhận
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.slDangDatChuaNhan}
                      onChange={(e) =>
                        setForm({ ...form, slDangDatChuaNhan: Number(e.target.value) })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">
                      Tồn đầu kỳ (nếu có)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.tonDauKy}
                      onChange={(e) => setForm({ ...form, tonDauKy: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={form.ghiChu}
                    onChange={(e) => setForm({ ...form, ghiChu: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-9 px-4 rounded-lg border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold"
                >
                  {submitting
                    ? 'Đang lưu vào Firebase...'
                    : editingItem
                    ? 'Lưu vào Firebase'
                    : 'Thêm vào Firebase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
