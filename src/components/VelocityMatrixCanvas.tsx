import React, { useEffect, useRef, useState } from 'react';

interface VelocityMatrixCanvasProps {
  entropyWeight: number; // e.g. 88
  heuristicReliance: number; // e.g. -94
  mode?: 'stabilized' | 'shadowed';
}

export const VelocityMatrixCanvas: React.FC<VelocityMatrixCanvasProps> = ({
  entropyWeight = 88,
  heuristicReliance = -94,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showLiveSim, setShowLiveSim] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.04;
      const width = canvas.width;
      const height = canvas.height;

      // Clear with subtle trail
      ctx.clearRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = '#e6e8e9';
      ctx.lineWidth = 1;
      const step = 28;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw velocity entropy waves
      const waves = [
        { freq: 0.02, speed: 1.2, amp: 22, color: 'rgba(0, 95, 102, 0.45)', lineW: 2 },
        { freq: 0.035, speed: 0.8, amp: 14, color: 'rgba(0, 209, 223, 0.65)', lineW: 2.5 },
        { freq: 0.05, speed: 1.6, amp: 8, color: 'rgba(0, 95, 102, 0.25)', lineW: 1.5 },
      ];

      const cy = height / 2;
      const turbulenceFactor = Math.max(0.2, (100 - entropyWeight) / 50);

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = wave.lineW;

        for (let x = 0; x < width; x += 3) {
          const rawY =
            Math.sin(x * wave.freq + time * wave.speed) * wave.amp +
            Math.cos(x * 0.015 - time * 0.5) * (wave.amp * 0.4 * turbulenceFactor);
          const y = cy + rawY;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // Animated matrix nodes
      const nodeCount = 8;
      for (let i = 0; i < nodeCount; i++) {
        const nx = (width / (nodeCount + 1)) * (i + 1);
        const ny = cy + Math.sin(nx * 0.025 + time * 1.2) * 18;
        ctx.beginPath();
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#005f66';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(nx, ny, 7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 209, 223, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [entropyWeight, heuristicReliance]);

  return (
    <div
      id="velocity-matrix-visualizer-container"
      className="bg-surface border border-outline rounded-[2px] flex items-center justify-center p-4 relative overflow-hidden h-64 md:h-full min-h-[220px]"
    >
      {/* Background radial gradient */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-surface to-surface pointer-events-none" />

      {/* Dynamic Animated Canvas */}
      {showLiveSim && (
        <canvas
          ref={canvasRef}
          width={380}
          height={220}
          className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
        />
      )}

      {/* Center Label and Icon */}
      <div className="text-center relative z-10 flex flex-col items-center select-none bg-surface/80 backdrop-blur-xs px-6 py-4 rounded border border-outline/50">
        <span
          id="velocity-waves-icon"
          className="material-symbols-outlined text-[44px] text-primary mb-2 animate-pulse"
        >
          waves
        </span>
        <p
          id="velocity-matrix-label"
          className="font-mono-label text-[12px] text-on-surface font-semibold tracking-wider"
        >
          VELOCITY_MATRIX_STABILIZED
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-mono-label text-[10px] text-on-surface-variant">
            ENTROPY GRADIENT FLUX: ±0.018 Hz
          </span>
        </div>

        {/* Toggle visual simulation overlay */}
        <button
          onClick={() => setShowLiveSim(!showLiveSim)}
          className="mt-3 text-[10px] font-mono-label text-primary hover:underline cursor-pointer opacity-75 hover:opacity-100"
        >
          {showLiveSim ? 'Hide Dynamic Waveform' : 'Show Dynamic Waveform'}
        </button>
      </div>
    </div>
  );
};
