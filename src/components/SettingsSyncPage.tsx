import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Flame,
  Link2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import type { SheetsStateResponse } from '../types/inventory';
import {
  extractSpreadsheetIdFromInput,
  formatDateTime,
  formatReadableError,
  isMutationCancelledError,
} from '../lib/format';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SettingsSyncPageProps {
  state: SheetsStateResponse | null;
  configuredSheetId: string | null;
  googleWriteConnected: boolean;
  googleUserEmail: string | null;
  googleAuthBusy: boolean;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onChangeGoogleSheet: (spreadsheetId: string) => Promise<void>;
  onImportSheetTransactions: () => Promise<void>;
  onPushAllToGoogleSheet: () => Promise<void>;
}

export function SettingsSyncPage({
  state,
  configuredSheetId,
  googleWriteConnected,
  googleUserEmail,
  googleAuthBusy,
  onGoogleSignIn,
  onGoogleSignOut,
  onSyncNow,
  onChangeGoogleSheet,
  onImportSheetTransactions,
  onPushAllToGoogleSheet,
}: SettingsSyncPageProps) {
  const [busy, setBusy] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [importingTx, setImportingTx] = useState(false);
  const [pushingToSheet, setPushingToSheet] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [twoWayMsg, setTwoWayMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const spreadsheetId =
    configuredSheetId ||
    state?.spreadsheetId ||
    '1ymcTmAv-OM19iTKy925DBrifHDlHM60Dof4Svj32YLs';
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  useEffect(() => {
    setLinkInput(sheetUrl);
  }, [sheetUrl]);

  const sys = state?.systemStatus;

  const handleSync = async () => {
    setBusy(true);
    try {
      await onSyncNow();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setLinkSuccess(null);
    const parsedId = extractSpreadsheetIdFromInput(linkInput);
    if (!parsedId) {
      setLinkError(
        'Link hoặc Spreadsheet ID không hợp lệ. Vui lòng dán link dạng https://docs.google.com/spreadsheets/d/...'
      );
      return;
    }

    setSavingLink(true);
    try {
      await onChangeGoogleSheet(parsedId);
      setLinkSuccess(
        `Đã kết nối Google Sheet (${parsedId}) và đồng bộ cấu hình qua Firebase Firestore.`
      );
    } catch (err) {
      setLinkError(
        formatReadableError(
          err,
          'Không thể kết nối Google Sheet mới. Hãy kiểm tra quyền Xem công khai và tên 3 sheet.'
        )
      );
    } finally {
      setSavingLink(false);
    }
  };

  const handleImportTx = async () => {
    setLinkError(null);
    setLinkSuccess(null);
    setImportingTx(true);
    try {
      await onImportSheetTransactions();
    } catch (err) {
      setLinkError(
        formatReadableError(err, 'Không thể nạp giao dịch từ Google Sheets.')
      );
    } finally {
      setImportingTx(false);
    }
  };

  const handlePushAll = async () => {
    setTwoWayMsg(null);
    setPushingToSheet(true);
    try {
      await onPushAllToGoogleSheet();
    } catch (err) {
      if (!isMutationCancelledError(err)) {
        setTwoWayMsg({
          type: 'error',
          text: formatReadableError(
            err,
            'Không thể đồng bộ dữ liệu lên Google Sheets.'
          ),
        });
      }
    } finally {
      setPushingToSheet(false);
    }
  };

  const sheetModeLabel = googleWriteConnected
    ? 'Google Sheets API 2 chiều (Đọc & Ghi trực tiếp)'
    : sys?.sheetsReadMode === 'SERVICE_ACCOUNT_RO'
    ? 'Google Sheets API Chỉ đọc (Service Account)'
    : 'Google Sheets Chỉ đọc công khai (gviz)';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
            Firebase Firestore & Đồng Bộ 2 Chiều Google Sheets
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Đồng bộ đa thiết bị qua <strong>Firebase Firestore</strong> · Cập nhật trực tiếp lên <strong>Google Sheets</strong> khi đã kết nối tài khoản Google
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở Google Sheets (Gốc)
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={handleSync}
            className="h-9 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Làm mới Google Sheets
          </button>
        </div>
      </div>

      {/* 2-Way Google Sheets Write Sync Panel */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-orange-600 shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900">
              Đồng bộ 2 chiều: Web & Firebase → Google Sheets
            </h2>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border self-start sm:self-auto ${
              googleWriteConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {googleWriteConnected ? 'Đã bật Ghi 2 chiều' : 'Đang ở chế độ Chỉ đọc Sheets'}
          </span>
        </div>

        <div className="text-xs text-zinc-600 leading-relaxed space-y-3">
          <p>
            Khi đăng nhập tài khoản Google có quyền <strong>Chỉnh sửa (Editor)</strong> trên file Google Sheets, mọi phiếu <strong>Nhập/Xuất kho</strong> (<code className="font-mono">PHU TUNG KHO</code>), <strong>Thêm/Sửa phụ tùng</strong> (<code className="font-mono">Danh mục phụ tùng</code>) và <strong>Tham số</strong> (<code className="font-mono">THAM SO</code>) trên web sẽ tự động ghi thẳng vào Google Sheets, giúp cột <strong>Tồn hiện tại</strong> trên tab <code className="font-mono">TINH CHI SO</code> nhảy số khớp 100% với web.
          </p>

          {googleWriteConnected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Đang kết nối: <span className="font-mono">{googleUserEmail || 'Tài khoản Google'}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pushingToSheet}
                  onClick={handlePushAll}
                  className="h-9 px-3.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {pushingToSheet
                    ? 'Đang đồng bộ...'
                    : 'Đồng bộ toàn bộ Web → Google Sheets'}
                </button>
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  className="h-9 px-3 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold inline-flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Ngắt kết nối
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-700">
                Đăng nhập bằng tài khoản Google chủ sở hữu / Editor của file Google Sheets để bật đồng bộ ghi trực tiếp.
              </div>
              <GoogleSignInButton
                disabled={googleAuthBusy}
                label={googleAuthBusy ? 'Đang kết nối...' : 'Sign in with Google'}
                onClick={onGoogleSignIn}
              />
            </div>
          )}

          {twoWayMsg && (
            <div
              className={`p-3 rounded-lg border font-medium flex items-start gap-2 ${
                twoWayMsg.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {twoWayMsg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{twoWayMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Change Google Sheet URL & Sync via Firebase */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-orange-600 shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900">
              Cấu hình Link Google Sheets đang liên kết
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            ID hiện tại: {spreadsheetId}
          </span>
        </div>

        <form onSubmit={handleSaveLink} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-zinc-700 mb-1.5">
              Dán link Google Sheets (hoặc Spreadsheet ID) của cửa hàng
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="flex-1 h-10 px-3 rounded-lg border border-zinc-200 font-mono text-xs text-zinc-900 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={savingLink}
                className="h-10 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold whitespace-nowrap"
              >
                {savingLink ? 'Đang kiểm tra & lưu...' : 'Áp dụng & Đồng bộ Firebase'}
              </button>
              <button
                type="button"
                disabled={importingTx}
                onClick={handleImportTx}
                className="h-10 px-3.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-50 text-zinc-700 font-semibold whitespace-nowrap"
              >
                {importingTx ? 'Đang nạp...' : 'Nạp GD từ Sheet vào Firebase'}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Google Sheets mới cần bật quyền <strong>Anyone with the link: Viewer</strong> (hoặc quyền Editor cho tài khoản Google của bạn) và có đủ 3 trang tính:{' '}
            <code className="font-mono text-zinc-700">Danh mục phụ tùng</code>,{' '}
            <code className="font-mono text-zinc-700">PHU TUNG KHO</code>,{' '}
            <code className="font-mono text-zinc-700">THAM SO</code>. Link mới được lưu vào Firebase (<code className="font-mono text-zinc-700">system_metadata/google_sheet_config</code>) để mọi máy tự động cập nhật theo.
          </p>

          {linkError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{linkError}</span>
            </div>
          )}

          {linkSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{linkSuccess}</span>
            </div>
          )}
        </form>
      </div>

      {/* Live Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
            <Flame className="w-4 h-4 text-orange-600" />
            Firebase Firestore (Thời gian thực)
          </div>
          <div className="text-xs text-emerald-700 font-semibold flex items-start gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Đã kết nối tự động · Đồng bộ tức thì mọi thiết bị</span>
          </div>
          <div className="text-[11px] text-zinc-500 space-y-0.5 font-mono break-all">
            <div>Project: {sys?.firebaseProjectId || '—'}</div>
            <div>DB: {sys?.firestoreDatabaseId || '—'}</div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
            <FileSpreadsheet className="w-4 h-4 text-orange-600" />
            Google Sheets ({googleWriteConnected ? '2 Chiều' : 'Chỉ đọc'})
          </div>
          <div className="text-xs text-zinc-800 font-semibold">{sheetModeLabel}</div>
          <div className="text-[11px] text-zinc-500 leading-relaxed">
            {googleWriteConnected
              ? 'Mọi thay đổi trên web được ghi trực tiếp lên Google Sheets và cập nhật tồn kho tự động.'
              : 'Đọc Danh mục phụ tùng, THAM SO và nạp dữ liệu nền ban đầu vào Firestore. Kết nối Google để bật ghi ngược lên Sheets.'}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
            <Database className="w-4 h-4 text-orange-600" />
            Số liệu đang đồng bộ
          </div>
          <div className="text-xs text-zinc-700 space-y-1">
            <div>
              Danh mục đang quản lý:{' '}
              <strong className="font-mono">{state?.items.length ?? 0}</strong> mã phụ tùng
            </div>
            <div>
              Tổng giao dịch lịch sử:{' '}
              <strong className="font-mono">{state?.transactions.length ?? 0}</strong> phiếu
            </div>
            <div className="text-[11px] text-zinc-500">
              Đọc Google Sheets gần nhất: {formatDateTime(state?.syncedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Architecture & Security Overview */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 text-xs leading-relaxed text-zinc-700">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2.5">
          <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
          <h2 className="text-sm font-bold text-zinc-900">
            Cơ chế đồng bộ Firebase & Google Sheets 2 chiều
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1.5">
            <div className="font-bold text-zinc-900">1. Đồng bộ đa thiết bị tức thì</div>
            <p className="text-zinc-600">
              Mọi phiếu nhập/xuất được ghi nguyên tử vào Firestore (<code className="font-mono">inventory_transactions</code>) và đẩy thời gian thực qua <code className="font-mono">onSnapshot</code> tới toàn bộ máy tính/điện thoại khác đang mở web.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1.5">
            <div className="font-bold text-zinc-900">2. Ghi ngược trực tiếp Google Sheets</div>
            <p className="text-zinc-600">
              Khi đăng nhập Google, mỗi thay đổi đã xác nhận trên web đồng thời cập nhật <code className="font-mono">PHU TUNG KHO</code>, <code className="font-mono">Danh mục phụ tùng</code> và <code className="font-mono">THAM SO</code> để bảng tính và web luôn khớp số liệu tồn kho.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1.5">
            <div className="font-bold text-zinc-900">3. Bảo vệ dữ liệu sổ kho</div>
            <p className="text-zinc-600">
              Mọi thao tác ghi đều yêu cầu hộp thoại xác nhận rõ ràng, chống ghi trùng mã giao dịch/mã yêu cầu và kiểm soát chống xuất âm kho.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
