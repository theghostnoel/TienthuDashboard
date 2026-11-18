import type { GoogleSheetReferenceResponse } from '../types/inventory';

async function fetchJsonStrict<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      throw new Error(`Lỗi máy chủ (HTTP ${res.status})`);
    }
    throw new Error(
      'Máy chủ đang khởi động hoặc phản hồi không phải JSON hợp lệ. Vui lòng thử lại.'
    );
  }

  if (!res.ok) {
    const errMsg =
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Lỗi máy chủ (HTTP ${res.status})`;
    throw new Error(errMsg);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Dữ liệu phản hồi từ máy chủ không hợp lệ.');
  }

  return parsed as T;
}

function isValidSheetReference(
  data: unknown
): data is GoogleSheetReferenceResponse {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<GoogleSheetReferenceResponse>;
  return (
    Array.isArray(candidate.sheetCatalog) &&
    Array.isArray(candidate.sheetInitialTransactions) &&
    Boolean(candidate.thamSo && typeof candidate.thamSo === 'object')
  );
}

export const api = {
  getSheetReference: async (
    spreadsheetId?: string | null
  ): Promise<GoogleSheetReferenceResponse> => {
    const queryStr = spreadsheetId?.trim()
      ? `?spreadsheetId=${encodeURIComponent(spreadsheetId.trim())}`
      : '';
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await fetchJsonStrict<unknown>(
          `/api/sheets/reference${queryStr}`
        );
        if (!isValidSheetReference(data)) {
          throw new Error(
            'Dữ liệu Google Sheets chưa sẵn sàng (thiếu danh mục hoặc tham số).'
          );
        }
        return data;
      } catch (err) {
        lastError = err;
        // Do not retry 4xx/validation errors like wrong sheet structure or invalid link
        if (
          err instanceof Error &&
          (err.message.includes('không hợp lệ') ||
            err.message.includes('Không tìm thấy trang tính') ||
            err.message.includes('không đúng cấu trúc') ||
            err.message.includes('quyền Xem công khai'))
        ) {
          throw err;
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 700));
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Không thể tải dữ liệu Google Sheets.');
  },
};
