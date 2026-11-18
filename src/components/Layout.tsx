import React, { useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Calculator,
  Database,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { ConnectionSyncState } from '../types/inventory';
import { formatDateTime } from '../lib/format';
import { GoogleSignInButton } from './GoogleSignInButton';

export type NavTab = 'dashboard' | 'parts' | 'transactions' | 'kpi' | 'settings';

interface LayoutProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  syncState: ConnectionSyncState;
  lastSyncedAt: string | null;
  onSyncNow: () => void;
  urgentCount: number;
  onQuickTransaction: () => void;
  googleWriteConnected: boolean;
  googleUserEmail: string | null;
  googleAuthBusy: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  children: React.ReactNode;
}

function getSyncBadgeMeta(syncState: ConnectionSyncState): {
  label: string;
  className: string;
} {
  switch (syncState) {
    case 'SYNCING':
      return {
        label: 'Đang đồng bộ...',
        className: 'bg-amber-50 border-amber-300 text-amber-800',
      };
    case 'CONNECTED_RW':
      return {
        label: 'Firebase Firestore · Đồng bộ thời gian thực',
        className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      };
    case 'CONNECTED_RO':
      return {
        label: 'Chỉ đọc Google Sheets',
        className: 'bg-amber-50 border-amber-200 text-amber-800',
      };
    case 'SAVE_ERROR':
      return {
        label: 'Lỗi ghi Firebase',
        className: 'bg-red-50 border-red-200 text-red-800',
      };
    case 'DISCONNECTED':
      return {
        label: 'Mất kết nối dữ liệu',
        className: 'bg-red-50 border-red-300 text-red-800',
      };
  }
}

export function Layout({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  syncState,
  lastSyncedAt,
  onSyncNow,
  urgentCount,
  onQuickTransaction,
  googleWriteConnected,
  googleUserEmail,
  googleAuthBusy,
  onGoogleSignIn,
  onGoogleSignOut,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: 'dashboard',
      label: 'Tổng quan tồn kho',
      icon: BarChart3,
      badge: urgentCount > 0 ? urgentCount : undefined,
    },
    { id: 'parts', label: 'Danh mục phụ tùng', icon: Package },
    { id: 'transactions', label: 'Nhập – Xuất kho', icon: ArrowLeftRight },
    { id: 'kpi', label: 'Chỉ số & Tham số', icon: Calculator },
    { id: 'settings', label: 'Firebase & Đồng bộ', icon: Database },
  ];

  const syncMeta = getSyncBadgeMeta(syncState);

  const handleNavClick = (id: NavTab) => {
    onTabChange(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[#F6F7F9] text-zinc-900">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 text-zinc-100 flex flex-col border-r border-zinc-800 transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shrink-0">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-zinc-950"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white leading-tight">
                TIẾN THU
              </div>
              <div className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                Kho Phụ Tùng · Nội Bộ
              </div>
            </div>
          </button>
          <button
            type="button"
            className="lg:hidden p-1.5 text-zinc-400 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-amber-200' : 'text-zinc-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 shrink-0 space-y-1.5">
          <div className="text-[11px] font-semibold text-zinc-200">
            Trung tâm Dịch vụ Tiến Thu
          </div>
          <div className="text-[11px] text-zinc-400 leading-relaxed">
            Danh mục đọc từ Google Sheets · Giao dịch lưu trên Firebase Firestore & đồng bộ tức thì đa thiết bị.
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-16 py-2 bg-white border-b border-zinc-200 px-4 lg:px-6 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-[220px] max-w-md">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Tìm mã PT001, tên phụ tùng..."
                className="w-full h-9 pl-9 pr-8 text-xs sm:text-sm bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-orange-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div
              className={`h-9 px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-2 ${syncMeta.className}`}
              title={
                lastSyncedAt
                  ? `Cập nhật gần nhất: ${formatDateTime(lastSyncedAt)}`
                  : undefined
              }
            >
              <span className="whitespace-nowrap">{syncMeta.label}</span>
              {lastSyncedAt && (
                <span className="hidden xl:inline text-[11px] opacity-80 font-mono tabular-nums">
                  · {new Date(lastSyncedAt).toLocaleTimeString('vi-VN')}
                </span>
              )}
            </div>

            {googleWriteConnected ? (
              <div className="h-9 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold inline-flex items-center gap-2">
                <span className="whitespace-nowrap">
                  Sheets 2 chiều
                  {googleUserEmail ? ` · ${googleUserEmail.split('@')[0]}` : ''}
                </span>
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  className="p-1 rounded hover:bg-emerald-100 text-emerald-700"
                  title="Ngắt kết nối ghi Google Sheets"
                  aria-label="Đăng xuất Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <GoogleSignInButton
                compact
                disabled={googleAuthBusy}
                label={googleAuthBusy ? 'Đang kết nối...' : 'Sign in with Google'}
                onClick={onGoogleSignIn}
              />
            )}

            <button
              type="button"
              disabled={syncState === 'SYNCING'}
              onClick={onSyncNow}
              className="h-9 px-3 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-60 text-xs font-semibold text-zinc-700 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncState === 'SYNCING' ? 'animate-spin' : ''}`}
              />
              <span>Làm mới dữ liệu</span>
            </button>

            <button
              type="button"
              onClick={onQuickTransaction}
              className="h-9 px-3.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
              <span>Nhập / Xuất kho</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
