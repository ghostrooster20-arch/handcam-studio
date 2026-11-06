const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FREQS: number[] = [];
for (let m = 0; m <= 127; m++) FREQS[m] = 440 * Math.pow(2, (m - 69) / 12);

/** C4 = MIDI 60, matching the EP-25 layout. */
export function noteName(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function frequency(midi: number): number {
  return FREQS[Math.max(0, Math.min(127, midi))];
}

export function notePitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function transposeNoteName(value: string, semitones: number): string {
  const match = value.match(/^([A-Ga-g])([#♯b♭]?)(-?\d+)$/);
  if (!match) return value;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase() as 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'];
  const accidental = match[2].replace('♯', '#').replace('♭', 'b');
  const delta = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const octave = Number(match[3]);
  const midi = (octave + 1) * 12 + base + delta;
  return noteName(midi + semitones);
}

export function midiFromNote(name: string): number | null {
  const match = name.trim().match(/^([A-Ga-g])([#♯b♭]?)(-?\d+)$/);
  if (!match) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase() as 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'];
  const accidental = match[2].replace('♯', '#').replace('♭', 'b');
  const delta = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + base + delta;
}

export function noteFromMidi(midi: number): string {
  return noteName(midi);
}
