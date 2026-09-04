import React from 'react';
import { AnomalyItem, ActiveTab } from '../types';

interface OverviewViewProps {
  anomalies: AnomalyItem[];
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenDiagnostic: () => void;
  onExportLogs: () => void;
  searchQuery?: string;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  anomalies,
  onNavigateTab,
  onExportLogs,
  searchQuery = '',
}) => {
  const filteredAnomalies = anomalies.filter(
    (a) =>
      a.signature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.sourceIp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.severity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.timestamp.includes(searchQuery)
  );

  return (
    <main id="overview-canvas" className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-4 auto-rows-min">
          {/* Hero Panel (Spans 12 cols) */}
          <section
            id="sentinel-hero-panel"
            className="col-span-12 glass-panel rounded-xl overflow-hidden relative mb-2"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-surface-container-lowest to-surface-container-low opacity-50 z-0 pointer-events-none" />
            <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full bg-primary relative">
                    <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
                  </div>
                  <span className="font-mono-label text-[11px] text-primary uppercase tracking-wider font-semibold">
                    System State
                  </span>
                </div>
                <h2
                  id="hero-heading"
                  className="font-display-lg text-[32px] md:text-[44px] font-bold text-on-surface mb-2 leading-tight tracking-tight"
                >
                  Agent-Abuse Sentinel Active
                </h2>
                <p className="font-body-md text-on-surface-variant max-w-2xl text-[15px] leading-relaxed">
                  Real-time threat analysis engaged across payment API endpoints. Distinguishing card-testing, scrapers, and promo abusers from legitimate autonomous AI shopping agents.
                </p>
              </div>

              {/* Key Real Metrics in Hero */}
              <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full md:w-auto">
                <div
                  id="resilience-score-metric"
                  className="bg-surface border border-outline p-4 rounded-lg min-w-[160px] shadow-xs"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono-label text-[11px] text-on-surface-variant font-medium">
                      LightGBM F1 Score
                    </span>
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      verified_user
                    </span>
                  </div>
                  <div className="font-headline-md text-[24px] font-bold text-primary">
                    96.73%
                  </div>
                  <span className="font-mono-label text-[10px] text-on-surface-variant">
                    300-session Holdout
                  </span>
                </div>

                <div
                  id="threat-level-metric"
                  className="bg-surface border border-outline p-4 rounded-lg min-w-[160px] shadow-xs"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono-label text-[11px] text-on-surface-variant font-medium">
                      False Positive Rate
                    </span>
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      shield
                    </span>
                  </div>
                  <div className="font-headline-md text-[24px] font-bold text-primary">
                    1.78%
                  </div>
                  <span className="font-mono-label text-[10px] text-on-surface-variant">
                    4 / 225 Normals Flagged
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Real Metrics Cards Row (4 cols each) */}
          {/* Card 1: LightGBM Model (4 cols) */}
          <div
            id="lgbm-metrics-card"
            className="col-span-12 md:col-span-4 glass-panel rounded-xl p-5 flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="flex justify-between items-center border-b border-outline pb-3 mb-4">
                <h3 className="font-headline-sm text-[17px] text-on-surface font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    smart_toy
                  </span>
                  <span>LightGBM Model</span>
                </h3>
                <span className="font-mono-label text-[11px] text-primary font-bold uppercase">
                  PRIMARY ML
                </span>
              </div>
              <div className="space-y-3 font-mono-data text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Precision:</span>
                  <span className="text-on-surface font-bold">94.87%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Recall:</span>
                  <span className="text-on-surface font-bold">98.67% (74/75)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">F1 Score:</span>
                  <span className="text-primary font-bold">0.9673</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">False Positive Rate:</span>
                  <span className="text-on-surface font-bold">1.78% (4/225)</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline/50 font-mono-label text-[11px] text-on-surface-variant">
              Trained on sessions_train.csv (17 features)
            </div>
          </div>

          {/* Card 2: Rule-Based Scorer (4 cols) */}
          <div
            id="rule-metrics-card"
            className="col-span-12 md:col-span-4 glass-panel rounded-xl p-5 flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="flex justify-between items-center border-b border-outline pb-3 mb-4">
                <h3 className="font-headline-sm text-[17px] text-on-surface font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                    gavel
                  </span>
                  <span>Rule-Based Scorer</span>
                </h3>
                <span className="font-mono-label text-[11px] text-on-surface-variant uppercase">
                  EXPLAINABLE
                </span>
              </div>
              <div className="space-y-3 font-mono-data text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Precision:</span>
                  <span className="text-on-surface font-bold">74.47%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Recall:</span>
                  <span className="text-on-surface font-bold">93.33% (70/75)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">F1 Score:</span>
                  <span className="text-on-surface font-bold">0.8284</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">False Positive Rate:</span>
                  <span className="text-on-surface font-bold">10.67% (24/225)</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline/50 font-mono-label text-[11px] text-on-surface-variant">
              Score threshold ≥ 5 (midpoint logic)
            </div>
          </div>

          {/* Card 3: Sub-Pattern Holdout Recall (4 cols) */}
          <div
            id="subpattern-metrics-card"
            className="col-span-12 md:col-span-4 glass-panel rounded-xl p-5 flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="flex justify-between items-center border-b border-outline pb-3 mb-4">
                <h3 className="font-headline-sm text-[17px] text-on-surface font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                    category
                  </span>
                  <span>Sub-Pattern Recall</span>
                </h3>
                <span className="font-mono-label text-[11px] text-on-surface-variant uppercase">
                  HOLDOUT
                </span>
              </div>
              <div className="space-y-3 font-mono-data text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Card Testing:</span>
                  <span className="text-primary font-bold">100.00% (25/25)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Catalog Scraper:</span>
                  <span className="text-primary font-bold">100.00% (21/21)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Promo Abuse:</span>
                  <span className="text-primary font-bold">96.55% (28/29)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Hybrid Union Recall:</span>
                  <span className="text-primary font-bold">100.00% (75/75)</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline/50 font-mono-label text-[11px] text-on-surface-variant">
              Evaluated on sessions_holdout.csv
            </div>
          </div>

          {/* Recent Scored Session Logs Table (12 cols) */}
          <div
            id="recent-anomalies-section"
            className="col-span-12 glass-panel rounded-xl p-6 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <div>
                <h3 className="font-headline-sm text-[18px] text-on-surface font-semibold">
                  Scored Session Stream
                </h3>
                <p className="font-body-md text-xs text-on-surface-variant">
                  Live session telemetry evaluated by score_session.py & FastAPI backend.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigateTab('logs')}
                  className="text-xs font-mono-label text-primary hover:underline cursor-pointer"
                >
                  View Full Logs →
                </button>
                <button
                  onClick={onExportLogs}
                  className="bg-surface border border-outline text-on-surface px-3 py-1.5 rounded-xs font-body-sm text-[13px] hover:bg-surface-container transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline font-mono-label text-[11px] text-on-surface-variant uppercase">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Session Pattern</th>
                    <th className="py-2.5 px-3">Confidence Tier</th>
                    <th className="py-2.5 px-3">Scoring Engine</th>
                    <th className="py-2.5 px-3 text-right">Session Ref</th>
                  </tr>
                </thead>
                <tbody className="font-mono-data text-[13px] divide-y divide-outline">
                  {filteredAnomalies.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container/50">
                      <td className="py-3 px-3 text-on-surface-variant whitespace-nowrap">
                        {item.timestamp}
                      </td>
                      <td className="py-3 px-3 text-on-surface font-medium whitespace-nowrap">
                        {item.signature}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.severity === 'CRITICAL' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] bg-error-container/20 border border-error text-error font-mono-label text-[10px] font-semibold">
                            HIGH_CONFIDENCE (BLOCK)
                          </span>
                        )}
                        {item.severity === 'ELEVATED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] bg-secondary-container/20 border border-secondary text-secondary font-mono-label text-[10px] font-semibold">
                            REVIEW_QUEUE
                          </span>
                        )}
                        {item.severity === 'LOW' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] bg-surface-variant border border-outline-variant text-on-surface-variant font-mono-label text-[10px] font-medium">
                            PASS (ALLOW)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant text-xs whitespace-nowrap">
                        {item.detectedBy}
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant text-right whitespace-nowrap">
                        {item.sourceIp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
