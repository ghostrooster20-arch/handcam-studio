import type { HandFrame, NormalizedLandmark } from '../types';
import { FALLBACK_KEY_ZONES } from '../instrument';

export interface BoardRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Calibration {
  board: BoardRect;
  pads: BoardRect;
  mirror: boolean;
}

export type ControlEvent =
  | { type: 'note-on'; midi: number; velocity: number; source: 'hand' | 'mouse' | 'keyboard'; finger: string }
  | { type: 'note-off'; midi: number; source: 'hand' | 'mouse' | 'keyboard' | 'release-all' }
  | { type: 'pad-on'; index: number; velocity: number }
  | { type: 'pad-off'; index: number };

export const DEFAULT_CALIBRATION: Calibration = {
  board: { left: 0.08, right: 0.98, top: 0.25, bottom: 0.86 },
  pads: { left: 0.02, right: 0.13, top: 0.28, bottom: 0.80 },
  mirror: false,
};

const FINGER_TIPS = [
  { name: 'thumb', index: 4 },
  { name: 'index', index: 8 },
  { name: 'middle', index: 12 },
  { name: 'ring', index: 16 },
  { name: 'pinky', index: 20 },
];

export class ControlMapper {
  private calibration = DEFAULT_CALIBRATION;
  private previous = new Map<string, { y: number; ts: number }>();
  private notePressed = new Map<string, { midi: number; ts: number }>();
  private padPressed = new Map<string, { index: number; ts: number }>();

  setCalibration(next: Calibration) {
    this.calibration = this.sanitize(next);
  }

  getCalibration() {
    return this.sanitize(this.calibration);
  }

  private sanitize(next: Calibration): Calibration {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const rect = (r: BoardRect): BoardRect => ({
      left: clamp(r.left), right: clamp(r.right), top: clamp(r.top), bottom: clamp(r.bottom),
    });
    return { board: rect(next.board), pads: rect(next.pads), mirror: !!next.mirror };
  }

  update(hands: HandFrame[], now = performance.now()): ControlEvent[] {
    const events: ControlEvent[] = [];
    const seen = new Set<string>();

    for (const hand of hands) {
      for (const finger of FINGER_TIPS) {
        const tip = hand.landmarks[finger.index];
        if (!tip) continue;
        const key = `${hand.handedness}:${finger.name}`;
        seen.add(key);
        const point = this.toBoardPoint(tip);
        const velocity = this.verticalVelocity(key, point.y, now);
        const zoneHit = this.hitZone(point);

        if (zoneHit?.kind === 'key') {
          const current = this.notePressed.get(key);
          if (!current && velocity > 0.65) {
            const midi = zoneHit.midi;
            this.notePressed.set(key, { midi, ts: now });
            events.push({ type: 'note-on', midi, velocity: this.scaleVelocity(velocity), source: 'hand', finger: finger.name });
          } else if (current && current.midi !== zoneHit.midi && now - current.ts > 40) {
            this.notePressed.delete(key);
            events.push({ type: 'note-off', midi: current.midi, source: 'hand' });
          }
        } else if (this.notePressed.get(key)) {
          const current = this.notePressed.get(key)!;
          if (now - current.ts > 40) {
            this.notePressed.delete(key);
            events.push({ type: 'note-off', midi: current.midi, source: 'hand' });
          }
        }

        const pad = this.hitPad(point);
        const currentPad = this.padPressed.get(key);
        if (pad !== null && !currentPad && velocity > 0.5) {
          this.padPressed.set(key, { index: pad, ts: now });
          events.push({ type: 'pad-on', index: pad, velocity: this.scaleVelocity(velocity) });
        } else if (pad === null && currentPad) {
          this.padPressed.delete(key);
          events.push({ type: 'pad-off', index: currentPad.index });
        }
      }
    }

    for (const [key, current] of this.notePressed) {
      if (!seen.has(key) && now - current.ts > 150) {
        this.notePressed.delete(key);
        events.push({ type: 'note-off', midi: current.midi, source: 'hand' });
      }
    }
    for (const [key, current] of this.padPressed) {
      if (!seen.has(key)) {
        this.padPressed.delete(key);
        events.push({ type: 'pad-off', index: current.index });
      }
    }

    return events;
  }

  private toBoardPoint(raw: NormalizedLandmark) {
    const x = this.calibration.mirror ? 1 - raw.x : raw.x;
    const y = raw.y;
    return { x, y };
  }

  private verticalVelocity(key: string, y: number, now: number): number {
    const previous = this.previous.get(key);
    this.previous.set(key, { y, ts: now });
    if (!previous) return 0;
    const dt = Math.max(0.001, (now - previous.ts) / 1000);
    return (y - previous.y) / dt;
  }

  private scaleVelocity(v: number): number {
    return Math.max(0.08, Math.min(1, 0.35 + v * 0.45));
  }

  private hitZone(point: { x: number; y: number }) {
    const b = this.calibration.board;
    if (point.y < b.top || point.y > b.bottom || point.x < b.left || point.x > b.right) return null;
    const nx = (point.x - b.left) / Math.max(0.001, b.right - b.left);
    // black zones overlay white area; test them first.
    const black = FALLBACK_KEY_ZONES.find((k) => k.color === 'black' && nx >= k.x0 && nx <= k.x1 && point.y < b.top + (b.bottom - b.top) * 0.72);
    if (black) return { kind: 'key' as const, midi: black.midi };
    const whiteIndexes = FALLBACK_KEY_ZONES.filter((k) => k.color === 'white');
    const whiteWidth = 1 / whiteIndexes.length;
    const index = Math.max(0, Math.min(whiteIndexes.length - 1, Math.floor(nx / whiteWidth)));
    const white = whiteIndexes[index];
    return { kind: 'key' as const, midi: white.midi };
  }

  private hitPad(point: { x: number; y: number }): number | null {
    const p = this.calibration.pads;
    if (point.x < p.left || point.x > p.right || point.y < p.top || point.y > p.bottom) return null;
    const nx = (point.x - p.left) / Math.max(0.001, p.right - p.left);
    const ny = (point.y - p.top) / Math.max(0.001, p.bottom - p.top);
    const col = nx < 0.5 ? 0 : 1;
    const row = Math.max(0, Math.min(2, Math.floor(ny * 3)));
    return row * 2 + col;
  }

  releaseAll(): ControlEvent[] {
    const events: ControlEvent[] = [];
    for (const [, current] of this.notePressed) events.push({ type: 'note-off', midi: current.midi, source: 'release-all' });
    for (const [, current] of this.padPressed) events.push({ type: 'pad-off', index: current.index });
    this.notePressed.clear();
    this.padPressed.clear();
    return events;
  }
}
