'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const ASCII_RAMP = [' ', '·', '·', ':', '-', '=', '+', '*', '#', '%', '░', '▒', '▓', '█'];

/**
 * Real-time 60fps Interactive Animated ASCII Wave & Cursor Ripple Canvas
 */
export function AsciiWaveCanvas({
  className,
  density = 24,
  opacity = 0.55,
}: {
  className?: string;
  density?: number;
  opacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    const cellSize = density;

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / cellSize);
      rows = Math.ceil(height / cellSize);
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handlePointerMove, { passive: true });

    let t = 0;
    const render = () => {
      t += 0.022;
      ctx.clearRect(0, 0, width, height);
      ctx.font = `500 ${Math.max(10, cellSize - 11)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const px = pointerRef.current.x;
      const py = pointerRef.current.y;

      for (let r = 0; r < rows; r++) {
        const y = r * cellSize + cellSize * 0.5;
        const verticalMask = Math.sin((r / Math.max(rows, 1)) * Math.PI);

        for (let c = 0; c < cols; c++) {
          const x = c * cellSize + cellSize * 0.5;

          const w1 = Math.sin(c * 0.14 + t * 1.1 + Math.cos(r * 0.12 - t * 0.7));
          const w2 = Math.cos(r * 0.18 - t * 0.85 + c * 0.08);
          const w3 = Math.sin((c + r) * 0.09 - t * 1.3);

          const dx = x - px;
          const dy = y - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ripple =
            dist < 240
              ? Math.cos(dist * 0.055 - t * 3.5) * ((240 - dist) / 240) * 1.15
              : 0;

          const rawVal = (w1 + w2 + w3) / 3 + ripple;
          const norm = Math.max(0, Math.min(1, (rawVal + 1) * 0.5 * verticalMask));

          if (norm < 0.18) continue;

          const charIndex = Math.min(
            ASCII_RAMP.length - 1,
            Math.floor(norm * ASCII_RAMP.length)
          );
          const glyph = ASCII_RAMP[charIndex];
          if (glyph === ' ') continue;

          if (norm > 0.76 || dist < 130) {
            ctx.fillStyle = `rgba(167, 139, 250, ${(norm * 0.62).toFixed(2)})`;
          } else if (norm > 0.52) {
            ctx.fillStyle = `rgba(109, 93, 251, ${(norm * 0.44).toFixed(2)})`;
          } else {
            ctx.fillStyle = `rgba(148, 163, 184, ${(norm * 0.24).toFixed(2)})`;
          }

          ctx.fillText(glyph, x, y);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      style={{ opacity }}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full select-none',
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Live Animated ASCII Audio/Sync Waveform Strip (Mobile-Safe)
 */
const WAVE_FRAMES = [
  '░▒▓█▇▅▃▂',
  '▒▓█▇▅▃▂▁',
  '▓█▇▅▃▂▁▂',
  '█▇▅▃▂▁▂▃',
  '▇▅▃▂▁▂▃▅',
  '▅▃▂▁▂▃▅▇',
  '▃▂▁▂▃▅▇█',
  '▂▁▂▃▅▇█▓',
];

export function AsciiSignalTicker({
  label = 'SYNC::LOCKED // 60FPS',
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % WAVE_FRAMES.length);
    }, 140);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-full bg-white/[0.045] backdrop-blur-xl border border-white/[0.12] px-3.5 py-1.5 font-mono text-[10px] sm:text-[11px] text-slate-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18)] overflow-hidden',
        className
      )}
    >
      <span className="text-vybe-accentLight tracking-tighter select-none shrink-0">
        {WAVE_FRAMES[frameIdx]}
      </span>
      <span className="text-white/90 font-semibold tracking-wide truncate">
        {label}
      </span>
      <span className="hidden sm:inline text-emerald-400 shrink-0">● LIVE</span>
    </div>
  );
}

/**
 * Animated ASCII Art Projector / Terminal Header Accent
 */
export function AsciiCinemaBadge({ text = 'TELEMETRY // VYBE-OS' }: { text?: string }) {
  const [tick, setTick] = useState(0);
  const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % spinners.length), 110);
    return () => clearInterval(id);
  }, [spinners.length]);

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/[0.045] backdrop-blur-md border border-white/[0.1] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-slate-300 overflow-hidden">
      <span className="text-vybe-accentLight font-bold shrink-0">
        {spinners[tick]}
      </span>
      <span className="truncate">[ {text} ]</span>
    </span>
  );
}
