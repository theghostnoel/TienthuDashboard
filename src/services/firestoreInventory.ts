import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import type {
  CatalogPart,
  SheetTransaction,
  ThamSoConfig,
  ThamSoOverride,
  TransactionType,
} from '../types/inventory';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatIsoToDisplay } from '../lib/inventoryCalculator';

const TX_COLLECTION = 'inventory_transactions';
const PARTS_COLLECTION = 'catalog_parts_custom';
const META_COLLECTION = 'system_metadata';

function sanitizeId(raw: string, maxLen = 100, fallback = 'ID'): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
  return cleaned || fallback;
}

function clampStr(raw: string | undefined, maxLen: number): string {
  return (raw ?? '').trim().slice(0, maxLen);
}

function clampNum(raw: number, min: number, max: number): number {
  if (!Number.isFinite(raw)) return min;
  return Math.min(max, Math.max(min, raw));
}

function parseSeqFromCode(code: string, fallback: number): number {
  const m = code.match(/\d+/);
  if (m) {
    const n = Number(m[0]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function timestampToIso(ts: unknown): string | undefined {
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (typeof ts === 'string') return ts;
  return undefined;
}

export async function ensureInitialSeedFromSheet(
  sheetInitialTransactions: SheetTransaction[]
): Promise<void> {
  const rows = Array.isArray(sheetInitialTransactions)
    ? sheetInitialTransactions
    : [];
  const seedRef = doc(db, META_COLLECTION, 'google_sheet_seed_v1');
  try {
    const existingSeed = await getDoc(seedRef);
    if (existingSeed.exists()) return;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${META_COLLECTION}/google_sheet_seed_v1`);
  }

  try {
    await runTransaction(db, async (tx) => {
      const seedSnap = await tx.get(seedRef);
      if (seedSnap.exists()) return;

      const counterRef = doc(db, META_COLLECTION, 'tx_counter');
      const counterSnap = await tx.get(counterRef);
      let maxSeq = counterSnap.exists()
        ? Number(counterSnap.data().lastSeq ?? 0)
        : 0;

      const seenTxIds = new Set<string>();
      const preparedRows: Array<{
        docRef: ReturnType<typeof doc>;
        payload: Record<string, unknown>;
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const code = sanitizeId(
          row.maGiaoDich || `GD${String(i + 1).padStart(3, '0')}`,
          32
        );
        const txId = sanitizeId(row.clientRequestId || `seed_${code}`, 100);
        if (seenTxIds.has(txId)) continue;
        seenTxIds.add(txId);

        const seq = Math.max(i + 1, parseSeqFromCode(code, i + 1));
        if (seq > maxSeq) maxSeq = seq;

        const ngayIso = /^\d{4}-\d{2}-\d{2}$/.test(row.ngayIso)
          ? row.ngayIso
          : '2026-01-01';
        const ngayGiaoDich =
          clampStr(row.ngayGiaoDich || formatIsoToDisplay(ngayIso), 20) ||
          formatIsoToDisplay(ngayIso);
        const maPhuTung = sanitizeId(row.maPhuTung || 'PT001', 32);
        const soLuong = Math.max(
          1,
          Math.round(clampNum(row.soLuong, 1, 1_000_000))
        );
        const donGia =
          row.donGiaGiaoDich !== null && Number.isFinite(row.donGiaGiaoDich)
            ? clampNum(row.donGiaGiaoDich, 0, 1_000_000_000)
            : null;

        preparedRows.push({
          docRef: doc(db, TX_COLLECTION, txId),
          payload: {
            maGiaoDich: code,
            ngayGiaoDich,
            ngayIso,
            loaiGiaoDich:
              row.loaiGiaoDich === 'NHAP_NCC' ? 'NHAP_NCC' : 'XUAT_SUA_CHUA',
            maPhuTung,
            soLuong,
            donGiaGiaoDich: donGia,
            maNhaCungCap: clampStr(row.maNhaCungCap, 64),
            nhanVienThucHien:
              clampStr(row.nhanVienThucHien, 100) || 'Hệ thống kho',
            maDonDatHang: clampStr(row.maDonDatHang, 64),
            ghiChu: clampStr(row.ghiChu, 500),
            clientRequestId: txId,
            source: 'GOOGLE_SHEET_SEED',
            seq,
            createdAt: serverTimestamp(),
          },
        });
      }

      // All reads MUST execute before any writes in a Firestore transaction
      const existingDocs = await Promise.all(
        preparedRows.map((item) => tx.get(item.docRef))
      );

      let seededCount = 0;
      for (let i = 0; i < preparedRows.length; i++) {
        if (!existingDocs[i].exists()) {
          tx.set(preparedRows[i].docRef, preparedRows[i].payload);
          seededCount++;
        }
      }

      if (counterSnap.exists()) {
        tx.update(counterRef, {
          lastSeq: Math.max(maxSeq, Number(counterSnap.data().lastSeq ?? 0)),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(counterRef, {
          lastSeq: maxSeq,
          updatedAt: serverTimestamp(),
        });
      }

      tx.set(seedRef, {
        initialized: true,
        seededCount,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${META_COLLECTION}/google_sheet_seed_v1`);
  }
}

export function subscribeToInventoryCollections(params: {
  onTransactions: (txs: SheetTransaction[]) => void;
  onCustomParts: (parts: CatalogPart[]) => void;
  onThamSoOverride?: (override: ThamSoOverride | null) => void;
  onGoogleSheetConfig?: (spreadsheetId: string | null) => void;
  onError: (err: Error) => void;
}): () => void {
  const txQuery = query(collection(db, TX_COLLECTION), orderBy('seq', 'desc'));
  const unsubTx = onSnapshot(
    txQuery,
    (snapshot) => {
      const list: SheetTransaction[] = snapshot.docs.map((d, idx) => {
        const data = d.data();
        const ngayIso = String(data.ngayIso ?? '');
        return {
          id: d.id,
          seq: Number(data.seq ?? idx + 1),
          rowIndex: Number(data.seq ?? idx + 1),
          maGiaoDich: String(data.maGiaoDich ?? d.id),
          ngayGiaoDich: String(data.ngayGiaoDich ?? formatIsoToDisplay(ngayIso)),
          ngayIso,
          loaiGiaoDich:
            data.loaiGiaoDich === 'NHAP_NCC' ? 'NHAP_NCC' : 'XUAT_SUA_CHUA',
          maPhuTung: String(data.maPhuTung ?? ''),
          soLuong: Number(data.soLuong ?? 0),
          donGiaGiaoDich:
            data.donGiaGiaoDich === null || data.donGiaGiaoDich === undefined
              ? null
              : Number(data.donGiaGiaoDich),
          maNhaCungCap: String(data.maNhaCungCap ?? ''),
          nhanVienThucHien: String(data.nhanVienThucHien ?? ''),
          maDonDatHang: String(data.maDonDatHang ?? ''),
          ghiChu: String(data.ghiChu ?? ''),
          clientRequestId: String(data.clientRequestId ?? d.id),
          source:
            data.source === 'GOOGLE_SHEET_SEED'
              ? 'GOOGLE_SHEET_SEED'
              : 'WEB_APP',
          createdAt: timestampToIso(data.createdAt),
        };
      });
      params.onTransactions(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, TX_COLLECTION);
      } catch (wrapped) {
        params.onError(
          wrapped instanceof Error ? wrapped : new Error(String(wrapped))
        );
      }
    }
  );

  const unsubParts = onSnapshot(
    collection(db, PARTS_COLLECTION),
    (snapshot) => {
      const list: CatalogPart[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          rowIndex: 0,
          maPhuTung: String(data.maPhuTung ?? d.id),
          tenPhuTung: String(data.tenPhuTung ?? ''),
          donViTinh: String(data.donViTinh ?? 'Cái'),
          dinhMucToiThieu: Number(data.dinhMucToiThieu ?? 0),
          ghiChu: String(data.ghiChu ?? ''),
          nhomPhuTung: String(data.nhomPhuTung ?? ''),
          giaNhapThamChieu: Number(data.giaNhapThamChieu ?? 0),
          giaBanThamChieu: Number(data.giaBanThamChieu ?? 0),
          maNhaCungCapMacDinh: String(data.maNhaCungCapMacDinh ?? 'NCC001'),
          leadTimeRieng:
            data.leadTimeRieng === null || data.leadTimeRieng === undefined
              ? null
              : Number(data.leadTimeRieng),
          tonDauKy: Number(data.tonDauKy ?? 0),
          slDangDatChuaNhan: Number(data.slDangDatChuaNhan ?? 0),
          source: 'WEBSITE_DB',
        };
      });
      params.onCustomParts(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, PARTS_COLLECTION);
      } catch (wrapped) {
        params.onError(
          wrapped instanceof Error ? wrapped : new Error(String(wrapped))
        );
      }
    }
  );

  const unsubThamSo = params.onThamSoOverride
    ? onSnapshot(
        doc(db, META_COLLECTION, 'tham_so_override'),
        (snap) => {
          if (!snap.exists()) {
            params.onThamSoOverride?.(null);
            return;
          }
          const data = snap.data();
          params.onThamSoOverride?.({
            active: Boolean(data.active),
            tuNgayIso: String(data.tuNgayIso ?? ''),
            denNgayIso: String(data.denNgayIso ?? ''),
            ngayXemBaoCaoIso: String(data.ngayXemBaoCaoIso ?? ''),
            leadTimeMacDinh: Number(data.leadTimeMacDinh ?? 7),
            soNgayDuTruMongMuon: Number(data.soNgayDuTruMongMuon ?? 30),
            soNgayCanhBaoTruoc: Number(data.soNgayCanhBaoTruoc ?? 7),
          });
        },
        (err) => {
          try {
            handleFirestoreError(
              err,
              OperationType.GET,
              `${META_COLLECTION}/tham_so_override`
            );
          } catch (wrapped) {
            params.onError(
              wrapped instanceof Error ? wrapped : new Error(String(wrapped))
            );
          }
        }
      )
    : () => {};

  const unsubSheetConfig = params.onGoogleSheetConfig
    ? onSnapshot(
        doc(db, META_COLLECTION, 'google_sheet_config'),
        (snap) => {
          if (!snap.exists()) {
            params.onGoogleSheetConfig?.(null);
            return;
          }
          const data = snap.data();
          const id =
            typeof data.spreadsheetId === 'string' &&
            /^[a-zA-Z0-9_-]{10,128}$/.test(data.spreadsheetId)
              ? data.spreadsheetId
              : null;
          params.onGoogleSheetConfig?.(id);
        },
        (err) => {
          try {
            handleFirestoreError(
              err,
              OperationType.GET,
              `${META_COLLECTION}/google_sheet_config`
            );
          } catch (wrapped) {
            params.onError(
              wrapped instanceof Error ? wrapped : new Error(String(wrapped))
            );
          }
        }
      )
    : () => {};

  return () => {
    unsubTx();
    unsubParts();
    unsubThamSo();
    unsubSheetConfig();
  };
}

export async function recordTransactionInFirestore(input: {
  loaiGiaoDich: TransactionType;
  maPhuTung: string;
  soLuong: number;
  ngayGiaoDichIso: string;
  donGiaGiaoDich: number | null;
  maNhaCungCap: string;
  nhanVienThucHien: string;
  maDonDatHang?: string;
  ghiChu?: string;
  clientRequestId: string;
  availableStock?: number;
}): Promise<{ transactionCode: string; duplicatePrevented: boolean }> {
  const txId = sanitizeId(input.clientRequestId, 100);
  const maPhuTung = sanitizeId(input.maPhuTung, 32);
  const qty = Math.round(clampNum(input.soLuong, 1, 1_000_000));
  if (qty <= 0) {
    throw new Error('Số lượng giao dịch phải lớn hơn 0.');
  }
  if (
    input.loaiGiaoDich === 'XUAT_SUA_CHUA' &&
    input.availableStock !== undefined &&
    qty > input.availableStock
  ) {
    throw new Error(
      `Không đủ tồn kho khả dụng! Mã ${maPhuTung} hiện chỉ còn ${input.availableStock}.`
    );
  }

  const ngayIso = /^\d{4}-\d{2}-\d{2}$/.test(input.ngayGiaoDichIso)
    ? input.ngayGiaoDichIso
    : new Date().toISOString().slice(0, 10);
  const ngayGiaoDich = formatIsoToDisplay(ngayIso);

  const txDocRef = doc(db, TX_COLLECTION, txId);
  const counterRef = doc(db, META_COLLECTION, 'tx_counter');

  try {
    return await runTransaction(db, async (tx) => {
      const existingSnap = await tx.get(txDocRef);
      if (existingSnap.exists()) {
        return {
          transactionCode: String(existingSnap.data().maGiaoDich ?? txId),
          duplicatePrevented: true,
        };
      }

      const counterSnap = await tx.get(counterRef);
      const prevSeq = counterSnap.exists()
        ? Number(counterSnap.data().lastSeq ?? 0)
        : 0;
      const nextSeq = prevSeq + 1;
      const maGiaoDich = `GD${String(nextSeq).padStart(3, '0')}`;

      if (counterSnap.exists()) {
        tx.update(counterRef, {
          lastSeq: nextSeq,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(counterRef, {
          lastSeq: nextSeq,
          updatedAt: serverTimestamp(),
        });
      }

      tx.set(txDocRef, {
        maGiaoDich,
        ngayGiaoDich,
        ngayIso,
        loaiGiaoDich: input.loaiGiaoDich,
        maPhuTung,
        soLuong: qty,
        donGiaGiaoDich:
          input.donGiaGiaoDich !== null && Number.isFinite(input.donGiaGiaoDich)
            ? clampNum(input.donGiaGiaoDich, 0, 1_000_000_000)
            : null,
        maNhaCungCap: clampStr(input.maNhaCungCap, 64),
        nhanVienThucHien: clampStr(input.nhanVienThucHien, 100) || 'Nhân viên kho',
        maDonDatHang: clampStr(input.maDonDatHang, 64),
        ghiChu: clampStr(input.ghiChu, 500),
        clientRequestId: txId,
        source: 'WEB_APP',
        seq: nextSeq,
        createdAt: serverTimestamp(),
      });

      return {
        transactionCode: maGiaoDich,
        duplicatePrevented: false,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${TX_COLLECTION}/${txId}`);
  }
}

export async function saveCatalogPartInFirestore(input: {
  isCreate: boolean;
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
}): Promise<void> {
  const partId = sanitizeId(
    input.isCreate ? input.maPhuTung.toUpperCase() : input.maPhuTung,
    32
  );
  const tenPhuTung = clampStr(input.tenPhuTung, 200);
  const donViTinh = clampStr(input.donViTinh, 40) || 'Cái';
  if (!partId || !tenPhuTung) {
    throw new Error('Mã phụ tùng và Tên phụ tùng không được để trống.');
  }

  const docRef = doc(db, PARTS_COLLECTION, partId);
  const payload = {
    maPhuTung: partId,
    tenPhuTung,
    donViTinh,
    dinhMucToiThieu: Math.round(clampNum(input.dinhMucToiThieu, 0, 1_000_000)),
    ghiChu: clampStr(input.ghiChu, 500),
    nhomPhuTung: clampStr(input.nhomPhuTung, 120),
    giaNhapThamChieu: clampNum(input.giaNhapThamChieu, 0, 1_000_000_000),
    giaBanThamChieu: clampNum(input.giaBanThamChieu, 0, 1_000_000_000),
    maNhaCungCapMacDinh: clampStr(input.maNhaCungCapMacDinh, 64) || 'NCC001',
    leadTimeRieng:
      input.leadTimeRieng !== null && Number.isFinite(input.leadTimeRieng)
        ? Math.round(clampNum(input.leadTimeRieng, 0, 365))
        : null,
    tonDauKy: Math.round(clampNum(input.tonDauKy, 0, 1_000_000)),
    slDangDatChuaNhan: Math.round(clampNum(input.slDangDatChuaNhan, 0, 1_000_000)),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PARTS_COLLECTION}/${partId}`);
  }
}

export async function saveThamSoOverrideInFirestore(
  input: Omit<ThamSoOverride, 'active'>
): Promise<void> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.tuNgayIso) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.denNgayIso) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.ngayXemBaoCaoIso)
  ) {
    throw new Error('Định dạng ngày phải hợp lệ (YYYY-MM-DD).');
  }
  if (input.tuNgayIso > input.denNgayIso) {
    throw new Error('Từ ngày không được lớn hơn Đến ngày của kỳ thống kê.');
  }

  const docRef = doc(db, META_COLLECTION, 'tham_so_override');
  const payload = {
    active: true,
    tuNgayIso: input.tuNgayIso,
    denNgayIso: input.denNgayIso,
    ngayXemBaoCaoIso: input.ngayXemBaoCaoIso,
    leadTimeMacDinh: Math.round(clampNum(input.leadTimeMacDinh, 0, 365)),
    soNgayDuTruMongMuon: Math.round(clampNum(input.soNgayDuTruMongMuon, 1, 365)),
    soNgayCanhBaoTruoc: Math.round(clampNum(input.soNgayCanhBaoTruoc, 0, 365)),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.WRITE,
      `${META_COLLECTION}/tham_so_override`
    );
  }
}

export async function resetThamSoOverrideInFirestore(
  sheetBase: ThamSoConfig
): Promise<void> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const docRef = doc(db, META_COLLECTION, 'tham_so_override');
  const payload = {
    active: false,
    tuNgayIso: /^\d{4}-\d{2}-\d{2}$/.test(sheetBase.tuNgayIso)
      ? sheetBase.tuNgayIso
      : todayIso,
    denNgayIso: /^\d{4}-\d{2}-\d{2}$/.test(sheetBase.denNgayIso)
      ? sheetBase.denNgayIso
      : todayIso,
    ngayXemBaoCaoIso: /^\d{4}-\d{2}-\d{2}$/.test(sheetBase.ngayXemBaoCaoIso)
      ? sheetBase.ngayXemBaoCaoIso
      : todayIso,
    leadTimeMacDinh: Math.round(clampNum(sheetBase.leadTimeMacDinh, 0, 365)),
    soNgayDuTruMongMuon: Math.round(
      clampNum(sheetBase.soNgayDuTruMongMuon, 1, 365)
    ),
    soNgayCanhBaoTruoc: Math.round(
      clampNum(sheetBase.soNgayCanhBaoTruoc, 0, 365)
    ),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.WRITE,
      `${META_COLLECTION}/tham_so_override`
    );
  }
}

export async function getSavedGoogleSheetIdFromFirestore(): Promise<string | null> {
  const docRef = doc(db, META_COLLECTION, 'google_sheet_config');
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const raw = snap.data().spreadsheetId;
    return typeof raw === 'string' && /^[a-zA-Z0-9_-]{10,128}$/.test(raw)
      ? raw
      : null;
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.GET,
      `${META_COLLECTION}/google_sheet_config`
    );
  }
}

export async function saveGoogleSheetIdInFirestore(
  spreadsheetId: string
): Promise<void> {
  const cleaned = spreadsheetId.trim();
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(cleaned)) {
    throw new Error('Spreadsheet ID không hợp lệ.');
  }
  const docRef = doc(db, META_COLLECTION, 'google_sheet_config');
  try {
    await setDoc(docRef, {
      spreadsheetId: cleaned,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.WRITE,
      `${META_COLLECTION}/google_sheet_config`
    );
  }
}

export async function syncMissingSheetTransactionsToFirestore(
  sheetInitialTransactions: SheetTransaction[]
): Promise<{ addedCount: number }> {
  const rows = Array.isArray(sheetInitialTransactions)
    ? sheetInitialTransactions
    : [];
  if (rows.length === 0) return { addedCount: 0 };

  try {
    return await runTransaction(db, async (tx) => {
      const counterRef = doc(db, META_COLLECTION, 'tx_counter');
      const counterSnap = await tx.get(counterRef);
      let maxSeq = counterSnap.exists()
        ? Number(counterSnap.data().lastSeq ?? 0)
        : 0;

      const seenTxIds = new Set<string>();
      const preparedRows: Array<{
        docRef: ReturnType<typeof doc>;
        payload: Record<string, unknown>;
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const code = sanitizeId(
          row.maGiaoDich || `GD${String(i + 1).padStart(3, '0')}`,
          32
        );
        const txId = sanitizeId(row.clientRequestId || `seed_${code}`, 100);
        if (seenTxIds.has(txId)) continue;
        seenTxIds.add(txId);

        const seq = Math.max(maxSeq + 1, parseSeqFromCode(code, i + 1));
        if (seq > maxSeq) maxSeq = seq;

        const ngayIso = /^\d{4}-\d{2}-\d{2}$/.test(row.ngayIso)
          ? row.ngayIso
          : '2026-01-01';
        const ngayGiaoDich =
          clampStr(row.ngayGiaoDich || formatIsoToDisplay(ngayIso), 20) ||
          formatIsoToDisplay(ngayIso);
        const maPhuTung = sanitizeId(row.maPhuTung || 'PT001', 32);
        const soLuong = Math.max(
          1,
          Math.round(clampNum(row.soLuong, 1, 1_000_000))
        );
        const donGia =
          row.donGiaGiaoDich !== null && Number.isFinite(row.donGiaGiaoDich)
            ? clampNum(row.donGiaGiaoDich, 0, 1_000_000_000)
            : null;

        preparedRows.push({
          docRef: doc(db, TX_COLLECTION, txId),
          payload: {
            maGiaoDich: code,
            ngayGiaoDich,
            ngayIso,
            loaiGiaoDich:
              row.loaiGiaoDich === 'NHAP_NCC' ? 'NHAP_NCC' : 'XUAT_SUA_CHUA',
            maPhuTung,
            soLuong,
            donGiaGiaoDich: donGia,
            maNhaCungCap: clampStr(row.maNhaCungCap, 64),
            nhanVienThucHien:
              clampStr(row.nhanVienThucHien, 100) || 'Hệ thống kho',
            maDonDatHang: clampStr(row.maDonDatHang, 64),
            ghiChu: clampStr(row.ghiChu, 500),
            clientRequestId: txId,
            source: 'GOOGLE_SHEET_SEED',
            seq,
            createdAt: serverTimestamp(),
          },
        });
      }

      const existingDocs = await Promise.all(
        preparedRows.map((item) => tx.get(item.docRef))
      );

      let addedCount = 0;
      for (let i = 0; i < preparedRows.length; i++) {
        if (!existingDocs[i].exists()) {
          tx.set(preparedRows[i].docRef, preparedRows[i].payload);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        if (counterSnap.exists()) {
          tx.update(counterRef, {
            lastSeq: Math.max(maxSeq, Number(counterSnap.data().lastSeq ?? 0)),
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(counterRef, {
            lastSeq: maxSeq,
            updatedAt: serverTimestamp(),
          });
        }
      }

      return { addedCount };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, TX_COLLECTION);
  }
}
