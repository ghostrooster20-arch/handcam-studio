import type { AiProviderConfig, BackingArrangement, LearningPlan } from '../types';
import { completeJson, completeText } from './providers';

const SYSTEM_PROMPT = `You are the embedded music coach/assistant for HandCam Studio, a 3D AR EP-25 electric piano.
Be concise, specific and conservative. Never invent permissions or API keys.
Return strict JSON where asked. Return no markdown fences inside JSON.`;

export async function explainChord(config: AiProviderConfig, notes: string[]): Promise<string> {
  return completeText(config, {
    system: SYSTEM_PROMPT,
    user: `Explain this chord in 2-4 plain English sentences, suggest a playable voicing, and mention one compatible next chord. Notes: ${notes.join(', ')}`,
  });
}

export async function analyzeChordWithAi(config: AiProviderConfig, notes: string[]): Promise<{
  root: string;
  quality: string;
  inversion: string;
  explanation: string;
}> {
  return completeJson<{ root: string; quality: string; inversion: string; explanation: string }>(config, {
    system: SYSTEM_PROMPT,
    json: true,
    user: `Return JSON {"root":"string","quality":"string","inversion":"string","explanation":"string"}.
Analyze this chord from pitch classes: ${notes.join(', ')}.`,
  });
}

export async function suggestBacking(config: AiProviderConfig, input: {
  key: string;
  genre: string;
  tempo: number;
  bass: string;
  pad: string;
}): Promise<BackingArrangement> {
  return completeJson<BackingArrangement>(config, {
    system: SYSTEM_PROMPT,
    json: true,
    user: `Create a compact EP accompaniment. Input: ${JSON.stringify(input)}.
Return JSON exactly with keys: key, genre, tempo, bars, progression, pad, bass, noteLength.
- bars: array of up to 4 4-chord bars, each represented as note-name chords (e.g. ["C","Am","F","G"])
- progression: flat array of chord names in order
- pad: short loop description (e.g. "Rhodes pads, 2 bars")
- bass: short loop description
- noteLength: e.g. "4n"
Keep it musically coherent and suitable for a 25-key electric piano.`,
  });
}

export async function suggestLearningPlan(config: AiProviderConfig, input: {
  level: 'beginner' | 'intermediate' | 'advanced';
  goal: string;
  minutesPerDay: number;
}): Promise<LearningPlan> {
  return completeJson<LearningPlan>(config, {
    system: SYSTEM_PROMPT,
    json: true,
    user: `Return JSON with keys title, goal, level, steps. steps is an array of up to 5 objects with id, title, target, minutes.
Input: ${JSON.stringify(input)}`,
  });
}

export async function solveCommand(config: AiProviderConfig, history: string[], instruction: string): Promise<{
  action: string;
  argument: string;
  reason: string;
}> {
  return completeJson<{ action: string; argument: string; reason: string }>(config, {
    system: SYSTEM_PROMPT,
    json: true,
    user: `You are an operator for HandCam Studio. Recent app context: ${history.slice(-12).join(' | ')}
Convert the instruction into one JSON action.
Allowed actions: setVolume, setTempo, setOctave, transpose, toggleSustain, setVelocityCurve, setPadKit, generateBacking, generateExercise, none.
Return {"action":"...","argument":"...","reason":"..."}.
Instruction: ${instruction}`,
  });
}
