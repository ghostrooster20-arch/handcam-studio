import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { HandFrame, NormalizedLandmark } from '../types';
import { pushLog } from '../lib/logger';

export type HandResultHandler = (hands: HandFrame[]) => void;

const WASM_ROOT = './wasm';
const MODEL_ROOT = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private raf = 0;
  private lastTs = 0;
  private video: HTMLVideoElement | null = null;
  private disposed = false;

  async init(): Promise<{ ok: boolean; message: string }> {
    if (this.landmarker) return { ok: true, message: 'Hand tracker ready' };
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_ROOT, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.6,
      });
      pushLog('info', 'vision', 'MediaPipe HandLandmarker initialized');
      return { ok: true, message: 'Hand tracker ready' };
    } catch (error) {
      pushLog('error', 'vision', 'HandLandmarker failed to initialize', error);
      return { ok: false, message: String(error) };
    }
  }

  async startFromCamera(video: HTMLVideoElement, onFrame: HandResultHandler) {
    if (!this.landmarker) {
      const init = await this.init();
      if (!init.ok) return init;
    }
    this.video = video;
    this.disposed = false;
    this.lastTs = 0;
    const tick = () => {
      if (this.disposed || !this.video || !this.landmarker) return;
      if (this.video.readyState >= 2) {
        const now = performance.now();
        if (now !== this.lastTs) {
          const result = this.landmarker.detectForVideo(this.video, now);
          this.lastTs = now;
          onFrame(this.toFrames(result));
        }
      }
      this.raf = requestAnimationFrame(tick);
    };
    tick();
    return { ok: true, message: 'Camera tracking started' };
  }

  private toFrames(result: HandLandmarkerResult): HandFrame[] {
    const hands: HandFrame[] = [];
    for (let i = 0; i < result.landmarks.length; i++) {
      const raw = result.landmarks[i];
      const score = result.handedness[i]?.[0]?.score ?? 0.5;
      const handedness = result.handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';
      const landmarks: NormalizedLandmark[] = raw.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z, presence: lm.presence ?? 1 }));
      hands.push({ handedness, score, landmarks });
    }
    return hands;
  }

  stop() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.video = null;
  }

  dispose() {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }
}
