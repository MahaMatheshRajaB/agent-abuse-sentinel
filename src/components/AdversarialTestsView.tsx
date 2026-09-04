import React, { useState, useEffect } from 'react';

interface AdversarialSessionRow {
  session_id: string;
  sub_pattern: string;
  num_requests: number;
  mean_inter_request_time: number;
  mouse_or_client_signal_present: boolean;
  status: string;
}

interface AdversarialTestsViewProps {
  onExportReport: () => void;
  searchQuery?: string;
}

export const AdversarialTestsView: React.FC<AdversarialTestsViewProps> = ({
  onExportReport,
  searchQuery = '',
}) => {
  const [patternFilter, setPatternFilter] = useState<'ALL' | 'adv_card_testing' | 'adv_scraper' | 'adv_promo_abuse'>('ALL');
  const [advSessions, setAdvSessions] = useState<AdversarialSessionRow[]>([]);

  useEffect(() => {
    async function loadAdversarialSessions() {
      try {
        const res = await fetch('/adversarial_sessions.csv');
        if (res.ok) {
          const text = await res.text();
          const lines = text.trim().split('\n').slice(1); // skip header
          const parsed: AdversarialSessionRow[] = lines.map((line) => {
            const cols = line.split(',');
            return {
              session_id: cols[0] || '',
              sub_pattern: cols[2] || '',
              num_requests: parseInt(cols[3] || '0', 10),
              mean_inter_request_time: parseFloat(cols[5] || '0'),
              mouse_or_client_signal_present: cols[13] === 'True',
              status: 'EVADED (0% RECALL)',
            };
          });
          setAdvSessions(parsed);
        }
      } catch (err) {
        console.warn('Adversarial CSV fetch info:', err);
      }
    }
    loadAdversarialSessions();
  }, []);

  const filteredSessions = advSessions.filter((s) => {
    const matchesSearch =
      s.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sub_pattern.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPattern = patternFilter === 'ALL' || s.sub_pattern === patternFilter;
    return matchesSearch && matchesPattern;
  });

  return (
    <main
      id="adversarial-tests-container"
      className="flex-1 p-4 md:p-8 max-w-[1440px] mx-auto w-full space-y-4"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              id="incident-ref-label"
              className="font-mono-label text-[12px] text-tertiary uppercase tracking-wider font-semibold"
            >
              STRESS_TEST_SUITE
            </span>
            <span
              id="incident-status-badge"
              className="bg-error-container/30 border border-error/40 text-error px-2 py-0.5 rounded-xs font-mono-label text-[11px] font-semibold tracking-wide"
            >
              RECALL: 0.00% (60/60 EVADED)
            </span>
          </div>
          <h2
            id="adversarial-resolution-title"
            className="font-display-lg text-[32px] md:text-[44px] font-bold text-on-surface leading-tight"
          >
            Adversarial Evasion Stress-Test
          </h2>
          <p
            id="adversarial-resolution-subtitle"
            className="font-body-md text-on-surface-variant mt-2 max-w-3xl text-[15px] leading-relaxed"
          >
            Honest benchmark of static rule thresholds & LightGBM model against 60 human-mimicry bot evasion sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-report-btn"
            onClick={onExportReport}
            className="bg-surface border border-outline text-on-surface px-4 py-2 rounded-xs font-body-sm text-[14px] hover:bg-surface-container transition-colors flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export Adversarial Report</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Baseline State Card (6 cols) */}
        <div
          id="previous-state-card"
          className="col-span-1 md:col-span-6 bg-surface-bright border border-outline rounded-lg flex flex-col relative overflow-hidden shadow-xs"
        >
          <div className="absolute top-0 right-0 p-3 z-10">
            <span className="font-mono-label text-[11px] text-tertiary">sessions_holdout.csv</span>
          </div>
          <div className="p-4 border-b border-outline flex items-center gap-3 bg-primary-container/20">
            <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
            <h3 className="font-headline-sm text-[18px] text-on-surface font-semibold">
              Baseline Holdout Evaluation (Clean Set)
            </h3>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <span
                  id="previous-state-recall"
                  className="text-[64px] leading-none font-light text-primary tracking-tight"
                >
                  98.67%
                </span>
                <span className="font-mono-label text-[12px] text-on-surface-variant uppercase font-medium">
                  LightGBM Recall (74/75 Caught)
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-mono-label text-[11px] text-tertiary mb-1 uppercase tracking-wide">
                    Clean Set Performance
                  </h4>
                  <p className="font-body-sm text-[15px] font-medium text-on-surface">
                    High Baseline Precision (94.87%) & F1 (0.9673)
                  </p>
                </div>
                <div className="bg-surface-container-low p-3.5 rounded-[4px] border border-outline">
                  <p className="font-mono-data text-on-surface-variant text-[13px] leading-relaxed">
                    Evaluated on 300 locked holdout sessions. Hybrid union tiering catches 100% of abusive sessions with a 1.78% False Positive Rate (4 / 225 normal sessions in review queue).
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-outline/50 flex items-center justify-between text-xs font-mono-label text-on-surface-variant">
              <span>HOLDOUT SIZE: 300 SESSIONS</span>
              <span className="text-primary font-bold">1.78% FPR</span>
            </div>
          </div>
        </div>

        {/* Adversarial Evasion Card (6 cols) */}
        <div
          id="current-resolution-card"
          className="col-span-1 md:col-span-6 bg-surface-bright border border-outline rounded-lg flex flex-col relative overflow-hidden shadow-xs"
        >
          <div className="absolute top-0 right-0 p-3 z-10">
            <span className="font-mono-label text-[11px] text-tertiary">adversarial_sessions.csv</span>
          </div>
          <div className="p-4 border-b border-outline flex items-center gap-3 bg-error-container/20">
            <span className="material-symbols-outlined text-status-red text-[20px]">warning</span>
            <h3 className="font-headline-sm text-[18px] text-on-surface font-semibold">
              Adversarial Stress-Test Result
            </h3>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <span
                  id="current-resolution-recall"
                  className="text-[64px] leading-none font-light text-status-red tracking-tight"
                >
                  0.00%
                </span>
                <span className="font-mono-label text-[12px] text-on-surface-variant uppercase font-medium">
                  Adversarial Recall (0/60 Caught)
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-mono-label text-[11px] text-tertiary mb-1 uppercase tracking-wide">
                    Evasion Failure Mode
                  </h4>
                  <p className="font-body-sm text-[15px] font-medium text-on-surface">
                    Human-Mimicry Cadence & Client Signal Spoofing
                  </p>
                </div>
                <div className="bg-error-container/10 p-3.5 rounded-[4px] border border-error/30">
                  <p className="font-mono-data text-on-surface-variant text-[13px] leading-relaxed">
                    Session-aggregate rule thresholds and LightGBM model were both completely bypassed when bots slowed request timing (mean IRT 7–20s), varied inter-request gaps, and injected a fake client signal (mouse_signal=True).
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-outline/50 flex items-center justify-between text-xs font-mono-label text-on-surface-variant">
              <span>STATUS: UNMITIGATED</span>
              <span className="text-status-red font-bold">ALL 60 SESSIONS EVADED</span>
            </div>
          </div>
        </div>

        {/* Technical Analysis Section: Proposed Mitigations (12 cols) */}
        <div
          id="technical-resolution-section"
          className="col-span-1 md:col-span-12 bg-surface-bright border border-outline rounded-lg flex flex-col relative shadow-xs"
        >
          <div className="p-4 border-b border-outline flex justify-between items-center bg-surface-container-low">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-[20px]">
                architecture
              </span>
              <h3 className="font-headline-sm text-[18px] text-on-surface font-semibold">
                Production Readiness: Recommended Architectural Fixes
              </h3>
            </div>
            <span className="font-mono-label text-[11px] text-tertiary font-semibold">TECHNICAL_ROADMAP</span>
          </div>

          <div className="p-6 space-y-4">
            <p className="font-body-sm text-on-surface-variant leading-relaxed text-[14px]">
              The adversarial stress-test demonstrates that session-aggregate metrics (total requests, session duration, average timing) are insufficient when an attacker intentionally slows down request cadence to match human pacing. To mitigate human-mimicry evasion in a live payment gateway, the following architectural upgrades are required:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-surface-container-low p-4 rounded border border-outline space-y-1">
                <div className="flex items-center gap-2 text-primary font-mono-label text-xs font-bold uppercase">
                  <span>1. Rolling Velocity Windows</span>
                </div>
                <p className="font-mono-data text-xs text-on-surface-variant leading-relaxed">
                  Track request density per rolling 60-second and 300-second window rather than static session totals.
                </p>
              </div>

              <div className="bg-surface-container-low p-4 rounded border border-outline space-y-1">
                <div className="flex items-center gap-2 text-primary font-mono-label text-xs font-bold uppercase">
                  <span>2. Burst & Sequence Fingerprinting</span>
                </div>
                <p className="font-mono-data text-xs text-on-surface-variant leading-relaxed">
                  Detect micro-burst patterns and token sequence regularities even when separated by human-paced gaps.
                </p>
              </div>

              <div className="bg-surface-container-low p-4 rounded border border-outline space-y-1">
                <div className="flex items-center gap-2 text-primary font-mono-label text-xs font-bold uppercase">
                  <span>3. Device & Network Identity Signals</span>
                </div>
                <p className="font-mono-data text-xs text-on-surface-variant leading-relaxed">
                  Integrate TLS JA3 hashes, IP subnet clustering, and BGP Autonomous System threat scoring.
                </p>
              </div>

              <div className="bg-surface-container-low p-4 rounded border border-outline space-y-1">
                <div className="flex items-center gap-2 text-primary font-mono-label text-xs font-bold uppercase">
                  <span>4. Graph Risk Scoring</span>
                </div>
                <p className="font-mono-data text-xs text-on-surface-variant leading-relaxed">
                  Track historical account risk graphs and correlate recurring review_queue entries for the same entity.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Log Table (12 cols) */}
        <div
          id="validation-log-table-container"
          className="col-span-1 md:col-span-12 bg-surface-bright border border-outline rounded-lg flex flex-col overflow-hidden shadow-xs"
        >
          <div className="p-4 border-b border-outline flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-[20px]">
                list_alt
              </span>
              <h3 className="font-headline-sm text-[18px] text-on-surface font-semibold">
                Adversarial Test Vectors Log (60 Sessions from adversarial_sessions.csv)
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-surface border border-outline rounded p-0.5">
                {(['ALL', 'adv_card_testing', 'adv_scraper', 'adv_promo_abuse'] as const).map((pat) => (
                  <button
                    key={pat}
                    onClick={() => setPatternFilter(pat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono-label cursor-pointer transition-colors ${
                      patternFilter === pat
                        ? 'bg-primary text-on-primary font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {pat === 'ALL' ? 'ALL (60)' : pat.replace('adv_', '').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-outline font-mono-label text-[11px] text-tertiary font-semibold uppercase tracking-wider">
                  <th className="p-4">SESSION ID</th>
                  <th className="p-4">EVASION SUB-PATTERN</th>
                  <th className="p-4">REQUESTS</th>
                  <th className="p-4">MEAN IRT</th>
                  <th className="p-4">MOUSE SIGNAL</th>
                  <th className="p-4 text-center">DETECTION STATUS</th>
                </tr>
              </thead>
              <tbody className="font-mono-data text-[13px]">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                      No adversarial sessions matching current filter.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((row, idx) => (
                    <tr
                      key={row.session_id || idx}
                      className={`border-b border-outline hover:bg-surface-container transition-colors ${
                        idx % 2 === 0 ? 'bg-surface-bright' : 'bg-surface-container-lowest'
                      }`}
                    >
                      <td className="p-4 text-on-surface-variant whitespace-nowrap">
                        {row.session_id.slice(0, 18)}...
                      </td>
                      <td className="p-4 text-on-surface font-medium whitespace-nowrap">
                        {row.sub_pattern}
                      </td>
                      <td className="p-4 text-on-surface-variant whitespace-nowrap">
                        {row.num_requests} reqs
                      </td>
                      <td className="p-4 text-on-surface-variant whitespace-nowrap">
                        {row.mean_inter_request_time.toFixed(2)}s
                      </td>
                      <td className="p-4 text-on-surface-variant whitespace-nowrap">
                        {row.mouse_or_client_signal_present ? 'True (Spoofed)' : 'False'}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className="bg-error-container/20 text-error border border-error/30 px-2 py-1 rounded-[2px] text-[10px] uppercase tracking-wider font-semibold font-mono-label">
                          EVADED (0% RECALL)
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
};
