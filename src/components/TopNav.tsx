import React, { useState } from 'react';

interface TopNavProps {
  onToggleMobile: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenDiagnostic: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onToggleMobile,
  searchQuery,
  setSearchQuery,
  onOpenDiagnostic,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <header
      id="top-nav-bar"
      className="w-full h-16 sticky top-0 z-30 bg-surface-container-lowest border-b border-outline flex justify-between items-center px-4 md:px-8 shadow-none select-none"
    >
      {/* Left side: Mobile Menu Toggle + App Brand + Search */}
      <div className="flex items-center gap-3 md:gap-4 flex-1 max-w-md">
        <button
          id="mobile-menu-toggle-btn"
          onClick={onToggleMobile}
          className="md:hidden text-on-surface-variant p-1.5 -ml-1 rounded-md hover:bg-surface-container cursor-pointer"
          aria-label="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <span
          id="brand-title-mobile"
          className="font-headline-md-mobile text-primary font-bold md:hidden tracking-tight text-[18px]"
        >
          Sentinel AI
        </span>

        {/* Global Search */}
        <div className="hidden md:flex items-center w-full">
          <div className="relative w-full max-w-xs">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none"
            >
              search
            </span>
            <input
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs, alerts, models..."
              className="w-full pl-9 pr-7 py-1.5 bg-surface border border-outline rounded-[4px] text-body-sm font-body-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Status Badge + Action Icons + Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* System Status Pill */}
        <div
          id="system-status-indicator"
          className="hidden sm:flex items-center gap-2 bg-surface-container py-1 px-3 rounded-full border border-outline"
        >
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block"></span>
          <span className="font-mono-label text-[11px] text-on-surface-variant uppercase tracking-wide">
            System Status: Healthy
          </span>
        </div>

        {/* Quick Diagnostic Trigger Icon */}
        <button
          id="quick-scan-topbar-btn"
          onClick={onOpenDiagnostic}
          title="Run Sentinel Security Scan"
          className="hidden lg:flex items-center gap-1 text-[12px] font-mono-label text-primary bg-primary-fixed/40 hover:bg-primary-fixed/80 border border-primary-fixed-dim px-2.5 py-1 rounded cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">shield</span>
          <span>QUICK SCAN</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            id="notifications-btn"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowSettings(false);
              setShowHelp(false);
            }}
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer active:opacity-80 relative"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full ring-2 ring-surface-container-lowest" />
          </button>

          {showNotifications && (
            <div
              id="notifications-dropdown"
              className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline rounded-lg shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-1"
            >
              <div className="px-4 py-2 border-b border-outline flex justify-between items-center">
                <span className="font-headline-sm text-sm font-semibold">Security Alerts</span>
                <span className="font-mono-label text-[10px] text-primary bg-primary-fixed/30 px-1.5 py-0.5 rounded">
                  2 NEW
                </span>
              </div>
              <div className="divide-y divide-outline/50 max-h-64 overflow-y-auto">
                <div className="p-3 hover:bg-surface-container-low transition-colors text-left cursor-pointer">
                  <div className="flex items-center justify-between font-mono-label text-[10px] text-on-surface-variant">
                    <span className="text-secondary font-bold">ELEVATED</span>
                    <span>2 mins ago</span>
                  </div>
                  <p className="font-body-sm text-xs font-medium text-on-surface mt-1">
                    Linear Shadow Injection intercepted at node 192.168.1.104
                  </p>
                </div>
                <div className="p-3 hover:bg-surface-container-low transition-colors text-left cursor-pointer">
                  <div className="flex items-center justify-between font-mono-label text-[10px] text-on-surface-variant">
                    <span className="text-primary font-bold">RESOLVED</span>
                    <span>14 mins ago</span>
                  </div>
                  <p className="font-body-sm text-xs font-medium text-on-surface mt-1">
                    Incident INCIDENT_RES-089 marked resolved with Entropy Velocity.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="relative">
          <button
            id="settings-btn"
            onClick={() => {
              setShowSettings(!showSettings);
              setShowNotifications(false);
              setShowHelp(false);
            }}
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer active:opacity-80"
            aria-label="Settings"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>

          {showSettings && (
            <div
              id="settings-dropdown"
              className="absolute right-0 mt-2 w-72 bg-surface-container-lowest border border-outline rounded-lg shadow-lg p-3 z-50"
            >
              <h4 className="font-headline-sm text-xs uppercase tracking-wider text-on-surface-variant mb-2">
                Node Configuration
              </h4>
              <div className="space-y-2 text-xs font-mono-data">
                <div className="flex justify-between py-1 border-b border-outline/50">
                  <span className="text-on-surface-variant">Telemetry Mode</span>
                  <span className="text-primary font-semibold">Real-Time Continuous</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline/50">
                  <span className="text-on-surface-variant">Inference Engine</span>
                  <span className="text-on-surface font-semibold">FP16 Matrix Tensor</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-on-surface-variant">Autopilot Mitigate</span>
                  <span className="text-primary font-semibold">ENABLED</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help */}
        <div className="relative">
          <button
            id="help-btn"
            onClick={() => {
              setShowHelp(!showHelp);
              setShowNotifications(false);
              setShowSettings(false);
            }}
            className="hidden sm:block p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer active:opacity-80"
            aria-label="Help Documentation"
          >
            <span className="material-symbols-outlined text-[20px]">help</span>
          </button>

          {showHelp && (
            <div
              id="help-dropdown"
              className="absolute right-0 mt-2 w-64 bg-surface-container-lowest border border-outline rounded-lg shadow-lg p-3 z-50 text-xs"
            >
              <div className="font-semibold text-on-surface mb-1">Sentinel AI Help & Docs</div>
              <p className="text-on-surface-variant leading-relaxed mb-2">
                Use the top search to quickly filter anomalies and test vectors. Switch tabs in the left sidebar to analyze adversarial recall resolution.
              </p>
              <div className="font-mono-label text-[10px] text-primary">VERSION 4.8.2-PROD</div>
            </div>
          )}
        </div>

        {/* Unknown User Profile Avatar */}
        <div
          id="user-profile-avatar-container"
          className="w-8 h-8 rounded-full border border-outline bg-surface-container-high flex items-center justify-center ml-1 cursor-pointer ring-1 ring-transparent hover:ring-primary transition-all select-none overflow-hidden shadow-xs"
          title="Security Analyst: Unknown / Anonymous"
        >
          <span
            id="unknown-avatar-icon"
            className="material-symbols-outlined text-[20px] text-on-surface-variant"
          >
            person
          </span>
        </div>
      </div>
    </header>
  );
};
