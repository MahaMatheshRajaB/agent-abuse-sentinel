import React, { useState } from 'react';
import { AnomalyItem } from '../types';

interface LogsViewProps {
  anomalies: AnomalyItem[];
  searchQuery?: string;
  onExportLogs: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({
  anomalies,
  searchQuery = '',
  onExportLogs,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'ELEVATED' | 'LOW'>('ALL');
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyItem | null>(null);

  const filtered = anomalies.filter((item) => {
    const matchesSearch =
      item.signature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sourceIp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.detectedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.timestamp.includes(searchQuery);

    const matchesSeverity =
      severityFilter === 'ALL' || item.severity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  return (
    <main id="logs-canvas" className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono-label text-xs text-tertiary uppercase tracking-wider">
                AUDIT_TELEMETRY_LOG
              </span>
              <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono-label text-xs">
                BUFFER: 2,490 EVENTS
              </span>
            </div>
            <h2 className="font-display-lg text-[28px] md:text-[36px] font-bold text-on-surface">
              Security Event Logs
            </h2>
            <p className="font-body-md text-on-surface-variant text-sm max-w-2xl">
              Chronological ledger of spectral anomalies, synthetic vector injections, and heuristic shadow detections.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportLogs}
              className="bg-surface border border-outline text-on-surface px-4 py-2 rounded-xs font-body-sm text-[14px] hover:bg-surface-container transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="glass-panel p-3 rounded-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <span className="font-mono-label text-xs text-on-surface-variant mr-2">SEVERITY:</span>
            {(['ALL', 'CRITICAL', 'ELEVATED', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1 rounded text-xs font-mono-label cursor-pointer transition-colors ${
                  severityFilter === sev
                    ? 'bg-primary text-on-primary font-bold shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <span className="font-mono-label text-xs text-on-surface-variant">
            Showing {filtered.length} of {anomalies.length} entries
          </span>
        </div>

        {/* Logs Table */}
        <div className="glass-panel rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline font-mono-label text-[11px] text-on-surface-variant uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                  <th className="px-5 py-3 font-semibold">Signature</th>
                  <th className="px-5 py-3 font-semibold">Severity</th>
                  <th className="px-5 py-3 font-semibold">Detected By</th>
                  <th className="px-5 py-3 font-semibold text-right">Source IP</th>
                  <th className="px-5 py-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="font-mono-data text-[13px] divide-y divide-outline">
                {filtered.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedAnomaly(item)}
                    className={`hover:bg-surface-container transition-colors cursor-pointer ${
                      idx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-bright'
                    }`}
                  >
                    <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">
                      {item.timestamp}
                    </td>
                    <td className="px-5 py-3 text-on-surface font-medium whitespace-nowrap">
                      {item.signature}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {item.severity === 'CRITICAL' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] bg-error-container/20 border border-error text-error font-mono-label text-[10px] font-semibold">
                          CRITICAL
                        </span>
                      )}
                      {item.severity === 'ELEVATED' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] bg-secondary-container/20 border border-secondary text-secondary font-mono-label text-[10px] font-semibold">
                          ELEVATED
                        </span>
                      )}
                      {item.severity === 'LOW' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] bg-surface-variant border border-outline-variant text-on-surface-variant font-mono-label text-[10px] font-medium">
                          LOW
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">
                      {item.detectedBy}
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant text-right whitespace-nowrap">
                      {item.sourceIp}
                    </td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <span className="text-primary hover:underline text-xs font-mono-label">
                        Inspect
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Anomaly Detail Modal */}
        {selectedAnomaly && (
          <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-outline pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono-label text-xs text-primary font-bold">
                    EVENT DETAILS
                  </span>
                  <span className="font-mono-label text-xs text-on-surface-variant">
                    {selectedAnomaly.timestamp}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 font-mono-data text-xs">
                <div>
                  <span className="text-on-surface-variant block mb-1">SIGNATURE:</span>
                  <p className="text-sm font-bold text-on-surface">{selectedAnomaly.signature}</p>
                </div>
                <div>
                  <span className="text-on-surface-variant block mb-1">SOURCE IP & SENSOR:</span>
                  <p className="text-on-surface">
                    {selectedAnomaly.sourceIp} (Intercepted via {selectedAnomaly.detectedBy})
                  </p>
                </div>
                <div>
                  <span className="text-on-surface-variant block mb-1">TECHNICAL SUMMARY:</span>
                  <div className="bg-surface-container-low p-3 rounded border border-outline">
                    {selectedAnomaly.details}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-outline flex justify-end">
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-medium rounded hover:bg-primary/90 cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
