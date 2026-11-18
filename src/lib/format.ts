import type { SheetDecisionStatus, TransactionType } from '../types/inventory';

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getSheetStatusMeta(status: SheetDecisionStatus): {
  textClass: string;
  bgClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'HET_HANG':
      return {
        textClass: 'text-red-800',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-300',
      };
    case 'DAT_NGAY':
      return {
        textClass: 'text-red-700',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
      };
    case 'CHUAN_BI_DAT':
      return {
        textClass: 'text-amber-800',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-300',
      };
    case 'DU_HANG':
      return {
        textClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
      };
  }
}

export function getTransactionTypeLabel(type: TransactionType): string {
  return type === 'NHAP_NCC' ? 'NHAP_NCC (Nhập NCC)' : 'XUAT_SUA_CHUA (Xuất sửa chữa)';
}

export function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function extractSpreadsheetIdFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const candidate = match ? match[1] : trimmed;
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(candidate)) {
    return null;
  }
  return candidate;
}

export class MutationCancelledError extends Error {
  constructor() {
    super('Người dùng đã hủy thao tác lưu dữ liệu.');
    this.name = 'MutationCancelledError';
  }
}

export function isMutationCancelledError(err: unknown): boolean {
  return (
    err instanceof MutationCancelledError ||
    (err instanceof Error && err.name === 'MutationCancelledError')
  );
}

export function formatReadableError(
  err: unknown,
  fallback = 'Đã xảy ra lỗi không xác định.'
): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : fallback;
  if (!raw) return fallback;
  if (raw.startsWith('{') && raw.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      const detail = parsed.error || '';
      if (detail.toLowerCase().includes('permission')) {
        return `Lỗi phân quyền Firebase Firestore (${parsed.operationType || 'read/write'} tại ${parsed.path || 'database'}). Vui lòng kiểm tra Firestore Rules đã được deploy.`;
      }
      if (detail.toLowerCase().includes('offline')) {
        return 'Không thể kết nối Firebase Firestore (thiết bị đang ngoại tuyến hoặc sai cấu hình).';
      }
      return `Lỗi Firebase Firestore (${parsed.path || 'database'}): ${detail || fallback}`;
    } catch {
      return raw;
    }
  }
  return raw;
}
