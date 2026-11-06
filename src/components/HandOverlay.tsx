import { useEffect, useRef } from 'react';
import type { HandFrame, NormalizedLandmark } from '../types';

export type OverlayStyle = 'ghost' | 'neon' | 'wireframe' | 'skeleton';

interface Props {
  hands: HandFrame[];
  overlay: OverlayStyle;
  mirror: boolean;
}

const FINGERS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];

function pt(lm: NormalizedLandmark, width: number, height: number, mirror: boolean) {
  const x = mirror ? 1 - lm.x : lm.x;
  return { x: x * width, y: lm.y * height, z: lm.z };
}

export default function HandOverlay({ hands, overlay, mirror }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.max(1, Math.floor(clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const hand of hands) {
      if (hand.landmarks.length < 21) continue;
      const p = hand.landmarks.map((lm) => pt(lm, width, height, mirror));
      const isGhost = overlay === 'ghost';
      const isNeon = overlay === 'neon';
      const isWire = overlay === 'wireframe';

      ctx.globalAlpha = overlay === 'ghost' ? 0.58 : 1;

      if (isGhost) {
        // Filled palm silhouette.
        const palm = [0, 1, 5, 9, 13, 17];
        ctx.beginPath();
        palm.forEach((idx, index) => { const { x, y } = p[idx]; if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.closePath();
        const grad = ctx.createLinearGradient(width * 0.25, height * 0.2, width * 0.75, height * 0.9);
        grad.addColorStop(0, 'rgba(190, 220, 255, .84)');
        grad.addColorStop(0.55, 'rgba(115, 156, 194, .58)');
        grad.addColorStop(1, 'rgba(58, 74, 112, .25)');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(120, 210, 255, .55)';
        ctx.shadowBlur = 32;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(225, 246, 255, .55)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const chain of FINGERS) {
        ctx.beginPath();
        chain.forEach((idx, i) => {
          const { x, y } = p[idx];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        if (isGhost) {
          ctx.strokeStyle = 'rgba(190, 220, 255, .82)';
          ctx.lineWidth = chain[0] === 0 ? 14 : 9;
          ctx.shadowColor = 'rgba(130, 225, 255, .35)';
          ctx.shadowBlur = 24;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(236, 252, 255, .55)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (isNeon) {
          ctx.shadowColor = '#4ffcff';
          ctx.shadowBlur = 18;
          ctx.strokeStyle = 'rgba(112, 255, 255, .9)';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255, 255, 255, .75)';
          ctx.lineWidth = 1.25;
          ctx.stroke();
        } else if (isWire) {
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = 'rgba(166, 239, 255, .95)';
          ctx.lineWidth = 1.75;
          ctx.shadowColor = 'rgba(75, 220, 255, .35)';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = 'rgba(100, 255, 214, .95)';
          ctx.lineWidth = 1.15;
          ctx.stroke();
        }
      }

      for (let i = 0; i < p.length; i++) {
        const { x, y } = p[i];
        ctx.beginPath();
        ctx.arc(x, y, i === 0 ? 5 : 3.2, 0, Math.PI * 2);
        if (isGhost) { ctx.fillStyle = 'rgba(255, 255, 255, .55)'; ctx.fill(); }
        else if (isNeon) { ctx.fillStyle = 'rgba(190, 255, 255, .95)'; ctx.fill(); }
        else if (isWire) { ctx.fillStyle = 'rgba(166, 239, 255, .8)'; ctx.fill(); }
        else { ctx.fillStyle = 'rgba(100, 255, 214, .95)'; ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
  });

  return <canvas className="hand-overlay" ref={ref} aria-hidden="true" />;
}
