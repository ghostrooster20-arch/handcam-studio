import { memo } from 'react';
import { BLACK_NOTES, WHITE_NOTES, PAD_LABELS, type PadKit } from '../instrument';

interface Props {
  pressedMidi: ReadonlySet<number>;
  pressedPads: ReadonlySet<number>;
  padKit: PadKit;
  octave: number;
  sustain: boolean;
  onNoteOn: (midi: number, velocity?: number) => void;
  onNoteOff: (midi: number) => void;
  onPadOn: (index: number, velocity?: number) => void;
  onPadOff: (index: number) => void;
  onOctave: (delta: number) => void;
  onResetOctave: () => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const MIDI_BY_NAME: Record<string, number> = {
  C4: 60, CSharp4: 61, D4: 62, DSharp4: 63, E4: 64, F4: 65, FSharp4: 66,
  G4: 67, GSharp4: 68, A4: 69, ASharp4: 70, B4: 71, C5: 72, CSharp5: 73,
  D5: 74, DSharp5: 75, E5: 76, F5: 77, FSharp5: 78, G5: 79, GSharp5: 80,
  A5: 81, ASharp5: 82, B5: 83, C6: 84,
};

function TemplateStrip({
  pressedMidi, pressedPads, padKit, octave, sustain,
  onNoteOn, onNoteOff, onPadOn, onPadOff, onOctave, onResetOctave,
}: Props) {
  const displayName = (name: string, semitones: number) => {
    const base = MIDI_BY_NAME[name] + semitones;
    return `${NOTE_NAMES[((base % 12) + 12) % 12]}${Math.floor(base / 12) - 1}`;
  };

  return (
    <section className="template-strip" aria-label="Keyboard readout and controls">
      <div className="strip-keyboard" role="group" aria-label="25-key keyboard">
        <div className="white-keys">
          {WHITE_NOTES.map((name) => {
            const midi = MIDI_BY_NAME[name] + octave * 12;
            const baseMidi = MIDI_BY_NAME[name];
            const pressed = pressedMidi.has(baseMidi);
            return (
              <button
                key={name}
                type="button"
                className={`template-key white${pressed ? ' pressed' : ''}`}
                data-midi={midi}
                onPointerDown={() => onNoteOn(baseMidi, 0.78)}
                onPointerUp={() => onNoteOff(baseMidi)}
                onPointerLeave={() => onNoteOff(baseMidi)}
                onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') onNoteOn(baseMidi, 0.78); }}
                onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') onNoteOff(baseMidi); }}
                aria-pressed={pressed}
              >
                <span>{displayName(name, octave * 12)}</span>
              </button>
            );
          })}
        </div>

        <div className="black-keys" aria-hidden="true">
          {BLACK_NOTES.map((name) => {
            const midi = MIDI_BY_NAME[name] + octave * 12;
            const baseMidi = MIDI_BY_NAME[name];
            const pressed = pressedMidi.has(baseMidi);
            const transpositionLabel = displayName(name, octave * 12);
            return (
              <button
                key={name}
                type="button"
                className={`template-key black${pressed ? ' pressed' : ''}`}
                data-midi={midi}
                onPointerDown={() => onNoteOn(baseMidi, 0.82)}
                onPointerUp={() => onNoteOff(baseMidi)}
                onPointerLeave={() => onNoteOff(baseMidi)}
                onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') onNoteOn(baseMidi, 0.82); }}
                onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') onNoteOff(baseMidi); }}
                aria-pressed={pressed}
                title={transpositionLabel}
              >
                <span>{transpositionLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pad-dock" role="group" aria-label="EP-25 pads">
        <p className="dock-title">PADS <span>{padKit.name.toUpperCase()}</span></p>
        <div className="pad-grid">
          {PAD_LABELS.map((fallback, index) => {
            const label = padKit.labels[index] ?? fallback;
            const pressed = pressedPads.has(index);
            return (
              <button
                key={index}
                type="button"
                className={`template-pad${pressed ? ' pressed' : ''}`}
                onPointerDown={() => onPadOn(index, 0.82)}
                onPointerUp={() => onPadOff(index)}
                onPointerLeave={() => onPadOff(index)}
                onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') onPadOn(index, 0.82); }}
                onKeyUp={() => onPadOff(index)}
                aria-pressed={pressed}
              >
                <strong>{index + 1}</strong>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="octave-dock" aria-label="Octave shift">
          <button type="button" className="octave-button" onClick={() => onOctave(-1)} aria-label="Octave down">− OCT</button>
          <button type="button" className="octave-current" onClick={onResetOctave} title="Reset octave to 0">
            {octave === 0 ? 'C4' : `${octave > 0 ? '+' : ''}${octave}`}
          </button>
          <button type="button" className="octave-button" onClick={() => onOctave(1)} aria-label="Octave up">+ OCT</button>
        </div>

        <div className={`sustain-indicator${sustain ? ' on' : ''}`} aria-label={sustain ? 'Sustain on' : 'Sustain off'}>
          <span className="sustain-dot" /> SUSTAIN
        </div>
      </div>
    </section>
  );
}


export default memo(TemplateStrip);
