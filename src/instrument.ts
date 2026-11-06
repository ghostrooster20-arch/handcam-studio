import { midiFromNote } from './lib/music';

export type WhiteNote = 'C4' | 'D4' | 'E4' | 'F4' | 'G4' | 'A4' | 'B4' | 'C5' | 'D5' | 'E5' | 'F5' | 'G5' | 'A5' | 'B5' | 'C6';
export type BlackNote = 'C#4' | 'D#4' | 'F#4' | 'G#4' | 'A#4' | 'C#5' | 'D#5' | 'F#5' | 'G#5' | 'A#5';

export const WHITE_NOTES: WhiteNote[] = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];
export const BLACK_NOTES: BlackNote[] = ['C#4', 'D#4', 'F#4', 'G#4', 'A#4', 'C#5', 'D#5', 'F#5', 'G#5', 'A#5'];

export const KEY_MIDI: Record<string, number> = {
  C4: 60, CSharp4: 61, D4: 62, DSharp4: 63, E4: 64, F4: 65, FSharp4: 66,
  G4: 67, GSharp4: 68, A4: 69, ASharp4: 70, B4: 71, C5: 72, CSharp5: 73,
  D5: 74, DSharp5: 75, E5: 76, F5: 77, FSharp5: 78, G5: 79, GSharp5: 80,
  A5: 81, ASharp5: 82, B5: 83, C6: 84,
};

export const PAD_MIDI = [36, 38, 42, 45, 39, 46] as const;
export const PAD_LABELS = ['KICK', 'SNARE', 'CHH', 'TOM', 'CLAP', 'OHH'] as const;
export const PAD_MIDI_BY_LABEL = { KICK: 36, SNARE: 38, CHH: 42, TOM: 45, CLAP: 39, OHH: 46 } as const;

export type PadKitId = 'ep25' | 'diagram-literal' | 'lofi' | 'custom';
export interface PadKit {
  id: PadKitId;
  name: string;
  notes: readonly number[];
  labels: readonly string[];
}

export const PAD_KITS: readonly PadKit[] = [
  { id: 'ep25', name: 'EP25 Kit', notes: [36, 38, 42, 45, 39, 46], labels: ['KICK', 'SNARE', 'CHH', 'TOM', 'CLAP', 'OHH'] },
  { id: 'diagram-literal', name: 'Diagram Literal', notes: [36, 38, 36, 45, 38, 46], labels: ['KICK', 'SNR', 'KICK A', 'TOM', 'SNR A', 'OHH'] },
  { id: 'lofi', name: 'Lo-Fi', notes: [35, 40, 42, 46, 37, 39], labels: ['KICK', 'SNR', 'CHH', 'OHH', 'RIM', 'CLAP'] },
] as const;

export interface KeyZone {
  note: string;
  midi: number;
  color: 'white' | 'black';
  x0: number;
  x1: number;
}

// Deterministic fallback zones. Used when the exported manifest is unavailable.
export const FALLBACK_KEY_ZONES: KeyZone[] = [
  ...WHITE_NOTES.map((note, index) => ({ note, midi: midiFromNote(note)!, color: 'white' as const, x0: index / WHITE_NOTES.length, x1: (index + 1) / WHITE_NOTES.length })),
  ...BLACK_NOTES.map((note, index) => {
    const blackIndex = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12][index];
    const center = (blackIndex + 1) / WHITE_NOTES.length;
    const half = 0.65 / WHITE_NOTES.length;
    return { note, midi: midiFromNote(note)!, color: 'black' as const, x0: center - half, x1: center + half };
  }),
];

export function padLabelByIndex(index: number): string {
  return PAD_LABELS[index] ?? `PAD ${index + 1}`;
}

export function noteFromMidiNameMap(): Map<number, string> {
  return new Map(Object.entries(KEY_MIDI).map(([note, midi]) => [midi, note]));
}
