import React, { useState, useEffect } from 'react';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const steps = [
    'Probing ingress neural gateways (SYS.CPU.01)...',
    'Analyzing Entropy of Velocity matrix stability (ALG.EVL.9)...',
    'Simulating synthetic heuristic shadowing vector...',
    'Testing regional edge latencies across 4 nodes...',
    'Verifying memory heap allocation boundaries...',
  ];

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setProgress(0);
      setIsCompleted(false);
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsCompleted(true);
          return 100;
        }
        const next = prev + 12;
        const currentStep = Math.min(steps.length - 1, Math.floor((next / 100) * steps.length));
        setStep(currentStep);
        return Math.min(next, 100);
      });
    }, 280);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id="diagnostic-scan-backdrop"
      className="fixed inset-0 z-50 bg-on-background/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="diagnostic-scan-modal"
        className="bg-surface-container-lowest border border-outline rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5"
      >
        <div className="flex justify-between items-center border-b border-outline pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">
              {isCompleted ? 'verified_user' : 'radar'}
            </span>
            <h3 className="font-headline-sm text-lg font-bold text-on-surface">
              {isCompleted ? 'Diagnostic Scan Complete' : 'Executing Sentinel Security Diagnostic'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center font-mono-label text-xs mb-2">
            <span className="text-on-surface-variant">DIAGNOSTIC PIPELINE PROGRESS</span>
            <span className="text-primary font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current running step output */}
        <div className="bg-surface-container-low p-4 rounded border border-outline space-y-2 font-mono-data text-xs">
          <div className="text-on-surface-variant text-[11px] uppercase font-mono-label">
            EXECUTION LOG STREAM:
          </div>
          <div className="flex items-center gap-2 text-on-surface font-medium">
            {!isCompleted ? (
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-primary" />
            )}
            <span>{steps[step]}</span>
          </div>

          <div className="pt-2 border-t border-outline/50 text-[11px] text-on-surface-variant space-y-1">
            <div className="flex justify-between">
              <span>Entropy Turbulence:</span>
              <span className="text-primary">0.014 Hz (OPTIMAL)</span>
            </div>
            <div className="flex justify-between">
              <span>Shadow Resistance:</span>
              <span className="text-primary">100% (NO LEAKAGE)</span>
            </div>
            <div className="flex justify-between">
              <span>Edge Heartbeat:</span>
              <span className="text-primary">NOMINAL (4/4 NODES)</span>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-outline">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            {isCompleted ? 'Acknowledge & Close' : 'Cancel Scan'}
          </button>
        </div>
      </div>
    </div>
  );
};
