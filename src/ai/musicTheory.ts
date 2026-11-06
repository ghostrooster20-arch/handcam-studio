import { notePitchClass } from '../lib/music';

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const QUALITY_PATTERNS: Array<{ suffix: string; intervals: number[] }> = [
  { suffix: 'maj', intervals: [0, 4, 7] },
  { suffix: 'min', intervals: [0, 3, 7] },
  { suffix: 'dim', intervals: [0, 3, 6] },
  { suffix: 'aug', intervals: [0, 4, 8] },
  { suffix: 'sus4', intervals: [0, 5, 7] },
  { suffix: 'sus2', intervals: [0, 2, 7] },
  { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { suffix: '7', intervals: [0, 4, 7, 10] },
  { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: 'mMaj7', intervals: [0, 3, 7, 11] },
];

function normalizeIntervals(notes: number[]): number[] {
  const sorted = [...new Set(notes.map(notePitchClass))].sort((a, b) => a - b);
  if (sorted.length < 2) return [];
  return sorted.map((n) => (n - sorted[0] + 12) % 12).sort((a, b) => a - b);
}

export function analyzeChord(midiNotes: number[]): {
  root: string;
  quality: string;
  inversion: string;
  notes: string[];
  confidence: number;
  intervals: number[];
} {
  const notes = [...new Set(midiNotes)].sort((a, b) => a - b);
  if (notes.length < 3) {
    return { root: '—', quality: 'insufficient notes', inversion: '—', notes: [], confidence: 0, intervals: [] };
  }
  const intervals = normalizeIntervals(notes);
  let best: { root: number; suffix: string; distance: number; intervals: number[] } | null = null;

  for (let index = 0; index < notes.length; index++) {
    const root = notes[index];
    const normalized = normalizeIntervals(notes.map((n) => n - root));
    for (const pattern of QUALITY_PATTERNS) {
      const expected = [...pattern.intervals].sort((a, b) => a - b);
      const distance = expected.reduce((sum, step, i) => sum + Math.abs((normalized[i] ?? 99) - step), Math.abs(normalized.length - expected.length) * 2);
      if (!best || distance < best.distance) best = { root: notePitchClass(root), suffix: pattern.suffix, distance, intervals: normalized };
    }
  }

  if (!best || best.distance > 2) {
    return { root: '—', quality: `cluster(${midiNotes.length})`, inversion: `mixed`, notes: notes.map((m) => PITCH_NAMES[notePitchClass(m)]), confidence: 0.35, intervals };
  }

  const inversionIndex = notes.findIndex((n) => notePitchClass(n) === best!.root);
  const inversions = ['root', '1st', '2nd', '3rd', '4th'];
  return {
    root: PITCH_NAMES[best.root],
    quality: best.suffix.replace(/^maj$/, 'major').replace(/^min$/, 'minor'),
    inversion: inversions[inversionIndex] ?? `${inversionIndex + 1}th`,
    notes: notes.map((m) => PITCH_NAMES[notePitchClass(m)]),
    confidence: best.distance === 0 ? 0.96 : 0.78,
    intervals: best.intervals,
  };
}
