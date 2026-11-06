import * as Tone from 'tone';
import { PAD_MIDI } from '../instrument';
import { noteFromMidi } from '../lib/music';
import { pushLog } from '../lib/logger';

export interface SoundTestResult {
  ok: boolean;
  message: string;
}

export class SoundEngine {
  private ep: Tone.PolySynth | null = null;
  private kick: Tone.MembraneSynth | null = null;
  private snare: Tone.NoiseSynth | null = null;
  private hat: Tone.NoiseSynth | null = null;
  private ready = false;
  private padMap: number[] = [...PAD_MIDI];
  private padVolume = 0.7;
  private volume = 0.8;

  async init(): Promise<SoundTestResult> {
    if (this.ready) return { ok: true, message: 'Audio already initialized' };
    await Tone.start();
    this.ep = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.5,
      modulationIndex: 9,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.004, decay: 0.7, sustain: 0.35, release: 0.8 },
      modulationEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.3, release: 0.35 },
      volume: -10,
    }).toDestination();
    this.kick = new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 8, envelope: { attack: 0.001, decay: 0.55, sustain: 0 } }).toDestination();
    this.snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).toDestination();
    this.hat = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.06, sustain: 0 } }).toDestination();
    this.applyVolume();
    this.ready = true;
    pushLog('info', 'audio', 'Tone.js audio graph initialized');
    return { ok: true, message: 'Audio initialized' };
  }

  setPadMap(midi: number[]) {
    this.padMap = [...midi];
  }

  setPadVolume(value: number) {
    this.padVolume = Math.max(0, Math.min(1, value));
    this.applyVolume();
  }

  setMasterVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ep) return;
    const dry = this.volume * 0.8;
    this.ep.volume.value = Tone.gainToDb(Math.max(0.0001, dry));
    const pads = this.volume * this.padVolume * 0.7;
    if (this.kick) this.kick.volume.value = Tone.gainToDb(Math.max(0.0001, pads));
    if (this.snare) this.snare.volume.value = Tone.gainToDb(Math.max(0.0001, pads * 0.65));
    if (this.hat) this.hat.volume.value = Tone.gainToDb(Math.max(0.0001, pads * 0.35));
  }

  noteOn(midi: number, velocity = 0.75): boolean {
    if (!this.ep) return false;
    const note = noteFromMidi(midi);
    const level = Math.max(0.03, Math.min(1, velocity));
    this.ep.triggerAttack(note, undefined, level);
    return true;
  }

  noteOff(midi: number): boolean {
    if (!this.ep) return false;
    this.ep.triggerRelease(noteFromMidi(midi));
    return true;
  }

  triggerPad(index: number, velocity = 0.8): boolean {
    if (!this.kick || !this.snare || !this.hat) return false;
    const velocityClamped = Math.max(0.03, Math.min(1, velocity));
    const note = noteFromMidi(this.padMap[index] ?? 36);
    switch (index % 6) {
      case 0:
        this.kick.triggerAttackRelease(note, '16n', undefined, velocityClamped);
        break;
      case 1:
        this.snare.triggerAttackRelease('16n', undefined, velocityClamped);
        break;
      case 2:
        this.hat.triggerAttackRelease('32n', undefined, velocityClamped * 0.75);
        break;
      case 3:
        this.kick.triggerAttackRelease(note, '8n', undefined, velocityClamped * 0.9);
        break;
      case 4:
        this.snare.triggerAttackRelease('16n', undefined, velocityClamped * 0.8);
        break;
      default:
        this.hat.triggerAttackRelease('16n', undefined, velocityClamped * 0.9);
    }
    return true;
  }

  chord(midiNotes: number[], duration = '1m', velocity = 0.65): boolean {
    if (!this.ep || !midiNotes.length) return false;
    this.ep.triggerAttackRelease(midiNotes.map(noteFromMidi), duration, undefined, velocity);
    return true;
  }

  test(): SoundTestResult {
    if (!this.ready) return { ok: false, message: 'Audio not initialized. Click any key or enable audio.' };
    this.chord([60, 64, 67], '4n', 0.5);
    return { ok: true, message: 'Audio path verified' };
  }

  reset() {
    this.ep?.releaseAll();
  }

  dispose() {
    this.ep?.dispose(); this.kick?.dispose(); this.snare?.dispose(); this.hat?.dispose();
    this.ep = null; this.kick = null; this.snare = null; this.hat = null; this.ready = false;
  }
}
