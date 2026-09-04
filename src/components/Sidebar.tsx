import React from 'react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onOpenSupport: () => void;
  onOpenAccount: () => void;
}

const LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBnqPDpHEZLIo3oTyZMiiv7YQ9q_WkPa8Opqjqufi1BATYpCWtoLHpXFwOAHLV1KsCcdNVKZhEIb8iqkW_Ga-b8uOi8AV3hhpr0MidihvVIATKk2ZX2zKIOD6b5EEYRJ5BEbfVwAsG_QS7mHcDRzP3PColjQBY1GfbBUqSF45uPweKszvFQQGhFFvUp9OZyeLUTgy3_wHJ39NFyR79JqzwPEuDkLqsNgkS0yLHKf8sZj-3DaXmJBVouWQ';

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  onOpenSupport,
  onOpenAccount,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: string; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'models', label: 'Models', icon: 'security', badge: '3' },
    { id: 'adversarial', label: 'Adversarial Tests', icon: 'biotech', badge: 'NEW' },
    { id: 'logs', label: 'Logs', icon: 'receipt_long' },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const navContent = (
    <div className="h-full flex flex-col justify-between py-1">
      <div>
        {/* Header Branding */}
        <div className="px-4 pt-4 pb-3 border-b border-outline mb-2">
          <div className="flex items-center gap-3">
            <img
              id="sidebar-brand-logo"
              src={LOGO_URL}
              alt="Sentinel AI Logo"
              className="w-8 h-8 object-cover rounded-[2px] border border-outline/60 shadow-xs"
            />
            <div>
              <h1 className="font-headline-sm text-[18px] leading-tight text-primary font-bold tracking-tight">
                Security Console
              </h1>
              <p className="font-mono-label text-[11px] text-on-surface-variant font-medium">
                AI Monitoring Node
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex flex-col px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-body-sm text-[14px] transition-all duration-150 text-left cursor-pointer ${
                  isActive
                    ? 'bg-primary-fixed text-on-primary-fixed-variant font-bold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-variant font-normal'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-[20px] ${isActive ? 'font-semibold' : ''}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-mono-label px-1.5 py-0.5 rounded font-semibold ${
                      isActive
                        ? 'bg-primary/20 text-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Fixed Navigation */}
      <div className="px-2 pb-3 pt-2 border-t border-outline space-y-1 mt-auto">
        <button
          id="nav-item-support"
          onClick={() => {
            onOpenSupport();
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors font-body-sm text-[14px] text-left cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">support_agent</span>
          <span>Support</span>
        </button>
        <button
          id="nav-item-account"
          onClick={() => {
            onOpenAccount();
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors font-body-sm text-[14px] text-left cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">person</span>
          <span>Account</span>
        </button>

        {/* Node status mini badge */}
        <div className="px-3 py-2 mt-2 rounded bg-surface-container border border-outline/50">
          <div className="flex items-center justify-between text-[11px] font-mono-label text-on-surface-variant">
            <span>NODE_ID</span>
            <span className="text-primary font-semibold">SRC_NODE_BETA</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono-label text-on-surface-variant mt-1">
            <span>CLUSTER</span>
            <span>US-WEST-V2</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed SideNav */}
      <nav
        id="desktop-sidebar"
        className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline z-40"
      >
        {navContent}
      </nav>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            id="mobile-backdrop"
            className="fixed inset-0 bg-on-background/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <nav
            id="mobile-drawer"
            className="relative flex flex-col w-72 max-w-[80vw] h-full bg-surface-container-low border-r border-outline z-10 shadow-xl"
          >
            <div className="absolute top-3 right-3">
              <button
                id="close-mobile-menu-btn"
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {navContent}
          </nav>
        </div>
      )}
    </>
  );
};
