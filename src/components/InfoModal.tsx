import React from 'react';

interface InfoModalProps {
  type: 'support' | 'account' | null;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest border border-outline rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-outline pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">
              {type === 'support' ? 'support_agent' : 'person'}
            </span>
            <h3 className="font-headline-sm text-lg font-bold text-on-surface">
              {type === 'support' ? 'Sentinel Enterprise Support' : 'Analyst Account Profile'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {type === 'support' ? (
          <div className="space-y-3 font-body-sm text-xs text-on-surface-variant">
            <p className="text-on-surface leading-relaxed">
              For urgent incident escalation or custom adversarial test suite configurations, contact the 24/7 Security Operations Center.
            </p>
            <div className="bg-surface-container-low p-3 rounded border border-outline space-y-1 font-mono-data text-[11px]">
              <div>HOTLINE: +1 (800) 555-SNTL</div>
              <div>SOC TICKET REF: SNTL-NODE-BETA-771</div>
              <div>PRIORITY: TIER 1 MISSION-CRITICAL</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 font-body-sm text-xs">
            <div className="flex items-center gap-3">
              <div
                id="unknown-profile-avatar"
                className="w-12 h-12 rounded-full border border-outline bg-surface-container flex items-center justify-center text-on-surface-variant shadow-xs shrink-0"
              >
                <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                  person
                </span>
              </div>
              <div>
                <h4 className="font-headline-sm text-sm font-bold text-on-surface">Unknown Analyst</h4>
                <p className="font-mono-label text-[11px] text-on-surface-variant">
                  Anonymous Operator / Security Node Auditor
                </p>
                <span className="text-[10px] font-mono-label text-secondary font-semibold">
                  SECURITY CLEARANCE: LEVEL 5
                </span>
              </div>
            </div>

            <div className="bg-surface-container-low p-3 rounded border border-outline space-y-1 font-mono-data text-[11px] text-on-surface-variant">
              <div>ASSIGNED REGION: US-WEST / GLOBAL</div>
              <div>SESSION ENCRYPTION: AES-256-GCM</div>
              <div>ROLE: ADVERSARIAL MATRIX AUDITOR</div>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end border-t border-outline">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
