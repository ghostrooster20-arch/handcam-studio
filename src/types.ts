export type Handedness = 'Left' | 'Right';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  presence?: number;
}

export interface HandFrame {
  handedness: Handedness;
  score: number;
  landmarks: NormalizedLandmark[];
}

export interface HandPacket {
  version: 1;
  room: string;
  seq: number;
  ts: number;
  width: number;
  height: number;
  fps: number;
  hands: HandFrame[];
}

export type ConnectionState =
  | 'offline'
  | 'pairing-waiting'
  | 'pairing-connected'
  | 'phone-connected'
  | 'phone-disconnected'
  | 'error';

export interface AppLog {
  ts: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  data?: unknown;
}

export type AiProviderId = 'openai' | 'gemini' | 'opencode';

export interface AiProviderConfig {
  provider: AiProviderId;
  model: string;
  key: string;
  baseUrl: string;
}

export interface ChordAnalysis {
  root: string;
  quality: string;
  inversion: string;
  notes: string[];
  confidence: number;
  explanation: string;
}

export interface BackingArrangement {
  key: string;
  genre: string;
  tempo: number;
  bars: string[][];
  progression: string[];
  pad: string;
  bass: string;
  noteLength: string;
}

export interface LearningPlan {
  title: string;
  goal: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  steps: Array<{ id: string; title: string; target: string; minutes: number }>;
}
