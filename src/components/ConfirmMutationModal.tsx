import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { SheetsWriteMode } from './Layout';

export interface MutationConfirmDetails {
  title: string;
  description: string;
  sheetName: string;
  details: Array<{ label: string; value: string }>;
  confirmLabel?: string;
  willWriteGoogleSheet?: boolean;
}

interface ConfirmMutationModalProps {
  pending: MutationConfirmDetails | null;
  busy: boolean;
  sheetsWriteMode: SheetsWriteMode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmMutationModal({
  pending,
  busy,
  sheetsWriteMode,
  onConfirm,
  onCancel,
}: ConfirmMutationModalProps) {
  if (!pending) return null;

  const autoSheetsActive = sheetsWriteMode !== 'NONE';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/60">
      <div className="bg-white border border-zinc-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900">{pending.title}</h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="p-1 text-zinc-500 hover:text-zinc-900 rounded"
            aria-label="Hủy"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="text-zinc-700 leading-relaxed">{pending.description}</p>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-1.5">
            <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Lưu trữ đích:{' '}
              <span className="font-mono text-zinc-800">
                {autoSheetsActive && !pending.sheetName.includes('Google Sheets')
                  ? `${pending.sheetName} + Google Sheets (Tự động)`
                  : pending.sheetName}
              </span>
            </div>
            <div className="divide-y divide-zinc-200/70">
              {pending.details.map((row) => (
                <div
                  key={row.label}
                  className="py-1.5 flex items-center justify-between gap-3"
                >
                  <span className="text-zinc-500">{row.label}</span>
                  <span className="font-mono font-semibold text-zinc-900 text-right">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!autoSheetsActive && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex items-start gap-2 text-[11px] text-zinc-600">
              <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <span>
                Thay đổi hiện được lưu trên Firebase Firestore. Để tự động ghi ngược sang Google Sheets mà không cần đăng nhập Google, hãy bật Webhook Apps Script tại mục <strong>Firebase & Đồng bộ</strong>.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="h-9 px-4 rounded-lg border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="h-9 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {busy
                ? 'Đang đồng bộ...'
                : pending.confirmLabel || 'Xác nhận lưu dữ liệu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

