/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActiveTab, AnomalyItem, ValidationLogRow, ModelItem } from './types';
import {
  INITIAL_TELEMETRY,
  INITIAL_ANOMALIES,
  INITIAL_VALIDATION_LOGS,
  INITIAL_MODELS,
} from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { OverviewView } from './components/OverviewView';
import { AdversarialTestsView } from './components/AdversarialTestsView';
import { ModelsView } from './components/ModelsView';
import { LogsView } from './components/LogsView';
import { DiagnosticModal } from './components/DiagnosticModal';
import { InfoModal } from './components/InfoModal';

export default function App() {
  // Active Navigation Tab (defaults to 'adversarial' or 'overview')
  const [activeTab, setActiveTab] = useState<ActiveTab>('adversarial');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // App state
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>(INITIAL_ANOMALIES);
  const [validationLogs, setValidationLogs] = useState<ValidationLogRow[]>(INITIAL_VALIDATION_LOGS);
  const [models, setModels] = useState<ModelItem[]>(INITIAL_MODELS);
  const [apiConnected, setApiConnected] = useState<boolean>(false);

  // Modals & feedback
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [infoModalType, setInfoModalType] = useState<'support' | 'account' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch real scored sessions from demo_fixtures.json or FastAPI server on mount
  React.useEffect(() => {
    async function loadBackendData() {
      try {
        // Try fetching live health check first
        const healthRes = await fetch('http://localhost:8000/health').catch(() => null);
        if (healthRes && healthRes.ok) {
          setApiConnected(true);
        }

        // Fetch demo_fixtures.json
        const fixturesRes = await fetch('/demo_fixtures.json');
        if (fixturesRes.ok) {
          const data = await fixturesRes.json();
          if (data && Array.isArray(data.results)) {
            const mappedAnomalies: AnomalyItem[] = data.results.map((item: any, idx: number) => {
              const subPattern = (item.true_sub_pattern || 'session').replace('_', ' ').toUpperCase();
              const severity = item.tier === 'high_confidence' ? 'CRITICAL' : item.tier === 'review_queue' ? 'ELEVATED' : 'LOW';
              const signals = item.signals_fired && item.signals_fired.length > 0
                ? item.signals_fired.map((s: any) => s.reason).join(' | ')
                : 'Clean traffic session -- no rule anomalies detected.';

              return {
                id: item.session_id || `session-${idx}`,
                timestamp: new Date(Date.now() - idx * 180000).toISOString().replace('T', ' ').slice(0, 19),
                signature: `${subPattern} (${item.tier.toUpperCase()})`,
                severity,
                sourceIp: `Session ${item.session_id ? item.session_id.slice(0, 8) : idx}`,
                detectedBy: `Hybrid Engine (Rule: ${item.rule?.score ?? 0}/9, ML: ${((item.ml?.probability ?? 0) * 100).toFixed(1)}%)`,
                details: signals,
              };
            });
            setAnomalies(mappedAnomalies);
          }
        }
      } catch (err) {
        console.warn('Backend fixture auto-load info:', err);
      }
    }
    loadBackendData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleExportReport = () => {
    // Generate simulated downloadable report
    const reportData = {
      incident: 'INCIDENT_RES-089',
      title: 'Adversarial Recall Resolution',
      resolutionTimestamp: new Date().toISOString(),
      previousRecall: '0%',
      currentRecall: '82%',
      validationLogCount: validationLogs.length,
      logs: validationLogs,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adversarial_recall_resolution_INCIDENT_RES-089.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Report downloaded: adversarial_recall_resolution_INCIDENT_RES-089.json');
  };

  const handleExportLogs = () => {
    const csvContent =
      'Timestamp,Signature,Severity,Source IP,Detected By\n' +
      anomalies
        .map(
          (a) =>
            `"${a.timestamp}","${a.signature}","${a.severity}","${a.sourceIp}","${a.detectedBy}"`
        )
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel_ai_security_logs_24h.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Logs exported: sentinel_ai_security_logs_24h.csv');
  };

  const handleAddValidationVector = (vector: ValidationLogRow) => {
    setValidationLogs((prev) => [vector, ...prev]);
    showToast(`Dispatched test vector: ${vector.testVector}`);
  };

  const handleToggleModelStatus = (id: string) => {
    setModels((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: m.status === 'ACTIVE' ? 'STANDBY' : 'ACTIVE',
            }
          : m
      )
    );
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenSupport={() => setInfoModalType('support')}
        onOpenAccount={() => setInfoModalType('account')}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen relative overflow-x-hidden">
        {/* Top App Bar */}
        <TopNav
          onToggleMobile={() => setMobileOpen(!mobileOpen)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenDiagnostic={() => setDiagnosticOpen(true)}
        />

        {/* View Switcher Banner to ease toggling between both user screenshots */}
        <div className="bg-surface-container-high/40 border-b border-outline/60 px-4 md:px-8 py-2 flex flex-wrap items-center justify-between text-xs font-mono-label">
          <div className="flex items-center gap-2">
            <span className="text-on-surface-variant font-medium">SCREEN TOGGLE:</span>
            <button
              id="toggle-screen-overview-btn"
              onClick={() => setActiveTab('overview')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-primary text-on-primary font-bold shadow-xs'
                  : 'text-on-surface hover:bg-surface-container'
              }`}
            >
              Screen 2: Overview (Sentinel Core)
            </button>
            <button
              id="toggle-screen-adversarial-btn"
              onClick={() => setActiveTab('adversarial')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                activeTab === 'adversarial'
                  ? 'bg-primary text-on-primary font-bold shadow-xs'
                  : 'text-on-surface hover:bg-surface-container'
              }`}
            >
              Screen 1: Adversarial Recall Resolution
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-on-surface-variant">
            <span>FASTAPI BACKEND: {apiConnected ? <span className="text-emerald-400 font-bold">ONLINE (localhost:8000)</span> : <span className="text-amber-400 font-bold">LOADED (demo_fixtures.json)</span>}</span>
            <span className="text-primary font-semibold">ALL SENSORS SYNCED</span>
          </div>
        </div>

        {/* View Router */}
        {activeTab === 'overview' && (
          <OverviewView
            anomalies={anomalies}
            onNavigateTab={setActiveTab}
            onOpenDiagnostic={() => setDiagnosticOpen(true)}
            onExportLogs={handleExportLogs}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'adversarial' && (
          <AdversarialTestsView
            onExportReport={handleExportReport}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'models' && (
          <ModelsView
            models={models}
            onToggleModelStatus={handleToggleModelStatus}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'logs' && (
          <LogsView
            anomalies={anomalies}
            searchQuery={searchQuery}
            onExportLogs={handleExportLogs}
          />
        )}
      </div>

      {/* Diagnostic Scan Modal */}
      <DiagnosticModal
        isOpen={diagnosticOpen}
        onClose={() => setDiagnosticOpen(false)}
      />

      {/* Support / Account Modals */}
      <InfoModal
        type={infoModalType}
        onClose={() => setInfoModalType(null)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="app-toast-notification"
          className="fixed bottom-5 right-5 z-50 bg-inverse-surface text-inverse-on-surface font-body-sm text-xs px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 border border-outline"
        >
          <span className="material-symbols-outlined text-accent-cyan text-[18px]">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
