import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '../components/TopBar';
import PianoView from '../components/PianoView';
import TemplateStrip from '../components/TemplateStrip';
import HandOverlay, { type OverlayStyle } from '../components/HandOverlay';
import SettingsPanel from '../components/SettingsPanel';
import PairPhoneModal from '../components/PairPhoneModal';
import LogView from '../components/LogView';
import AiPanel, { type AiCommand } from '../components/AiPanel';
import { SoundEngine } from '../engine/SoundEngine';
import { HandTracker } from '../vision/HandTracker';
import { ControlMapper, DEFAULT_CALIBRATION, type Calibration } from '../vision/ControlMapper';
import { PeerLink, type HandFramePacket } from '../pairing/PeerLink';
import { PAD_KITS, type PadKit } from '../instrument';
import { pushLog } from '../lib/logger';
import type { BackingArrangement, HandFrame, LearningPlan } from '../types';

function chordIntervals(name: string): number[] | null {
  const root = name.match(/^([A-Ga-g])([#♯b♭]?)/);
  if (!root) return null;
  const pitch: Record<string, number> = { C: 0, D: 2, E:4, F:5, G:7, A:9, B:11 };
  const accidental = root[2].replace('♯', '#').replace('♭', 'b');
  const delta = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const start = pitch[root[1].toUpperCase() as keyof typeof pitch] + delta;
  const lower = name.toLowerCase();
  const quality = lower.slice(root[0]?.length ? 2 : 1);
  let intervals = [0, 4, 7];
  if (/m(?!aj)/.test(quality) || lower.includes('min')) intervals = [0, 3, 7];
  else if (lower.includes('dim')) intervals = [0, 3, 6];
  else if (lower.includes('aug')) intervals = [0, 4, 8];
  else if (lower.includes('sus2')) intervals = [0, 2, 7];
  else if (lower.includes('sus4')) intervals = [0, 5, 7];
  return intervals.map((i) => (start + 12 + i) % 12);
}

export default function DesktopApp() {
  const soundRef = useRef(new SoundEngine());
  const trackerRef = useRef<HandTracker | null>(null);
  const mapperRef = useRef(new ControlMapper());
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<PeerLink | null>(null);
  const backingTimer = useRef<number | null>(null);
  const lastUiUpdate = useRef(0);


  const [cameraOn, setCameraOn] = useState(false);
  const [quality, setQuality] = useState<'high' | 'low'>('high');
  const [overlay, setOverlay] = useState<OverlayStyle>('ghost');
  const [volume, setVolume] = useState(0.8);
  const [padVolume, setPadVolume] = useState(0.7);
  const [velocityCurve, setVelocityCurve] = useState<'soft' | 'normal' | 'hard'>('normal');
  const [padKitId, setPadKitId] = useState<'ep25' | 'diagram-literal' | 'lofi' | 'custom'>('ep25');
  const [panelTouch, setPanelTouch] = useState<'always' | 'locked-on-play' | 'hidden'>('locked-on-play');
  const [calibration, setCalibration] = useState<Calibration>(DEFAULT_CALIBRATION);
  const [octave, setOctave] = useState(0);
  const [tempo, setTempo] = useState(96);
  const [sustain, setSustain] = useState(false);
  const [pressedIds, setPressedIds] = useState<number[]>([]);
  const [pressedPads, setPressedPads] = useState<number[]>([]);
  const [hands, setHands] = useState<HandFrame[]>([]);
  const [detectionMs, setDetectionMs] = useState(0);
  const [phoneName, setPhoneName] = useState('');
  const [pairOpen, setPairOpen] = useState(false);
  const [pairDetail, setPairDetail] = useState('Generate a one-time pairing to link the phone.');
  const [pairing, setPairing] = useState({ room: '', code: '', url: '' });
  const [pairState, setPairState] = useState<'idle' | 'waiting' | 'connected' | 'disconnected' | 'error'>('idle');
  const [aiOpen, setAiOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini' | 'opencode'>('openai');
  const [lessonPlan, setLessonPlan] = useState<LearningPlan | null>(null);
  const [arrangement, setArrangement] = useState<BackingArrangement | null>(null);
  const [muted, setMuted] = useState(false);

  const pressedMidi = useMemo(() => new Set(pressedIds), [pressedIds]);
  const padSet = useMemo(() => new Set(pressedPads), [pressedPads]);
  const activeKit = useMemo((): PadKit => PAD_KITS.find((kit) => kit.id === padKitId) ?? PAD_KITS[0], [padKitId]);

  useEffect(() => { soundRef.current.setMasterVolume(muted ? 0 : volume); }, [volume, muted]);
  useEffect(() => { soundRef.current.setPadVolume(padVolume); }, [padVolume]);
  useEffect(() => { mapperRef.current.setCalibration(calibration); }, [calibration]);
  useEffect(() => { soundRef.current.setPadMap([...activeKit.notes]); }, [activeKit]);

  const ensureAudio = useCallback(async () => {
    const result = await soundRef.current.init();
    return result.ok;
  }, []);

  const triggerNoteOn = useCallback((baseMidi: number, velocity?: number) => {
    const keyVelocity = ({ soft: 0.32, normal: 0.55, hard: 0.82 } as const)[velocityCurve];
    const level = Math.max(0.05, Math.min(1, (velocity ?? keyVelocity) * 1.15));
    const midi = baseMidi + octave * 12;
    void ensureAudio().then((ok) => {
      if (!ok) return;
      soundRef.current.noteOn(midi, level);
      setPressedIds((previous) => previous.includes(baseMidi) ? previous : [...previous, baseMidi]);
      pushLog('debug', 'music', 'Note on', { baseMidi, midi, velocity: level });
    });
  }, [ensureAudio, octave, velocityCurve]);

  const triggerNoteOff = useCallback((baseMidi: number) => {
    if (sustain) {
      pushLog('debug', 'music', 'Note release deferred by sustain', { baseMidi });
      return;
    }
    const midi = baseMidi + octave * 12;
    soundRef.current.noteOff(midi);
    setPressedIds((previous) => previous.filter((note) => note !== baseMidi));
    pushLog('debug', 'music', 'Note off', { baseMidi, midi });
  }, [octave, sustain]);

  const triggerPad = useCallback((index: number, velocity = 0.8) => {
    void ensureAudio().then((ok) => {
      if (!ok) return;
      soundRef.current.triggerPad(index, velocity);
      setPressedPads((previous) => previous.includes(index) ? previous : [...previous, index]);
      window.setTimeout(() => setPressedPads((previous) => previous.filter((item) => item !== index)), 180);
      pushLog('info', 'pads', 'Pad fired', { index: index + 1, label: activeKit.labels[index], kit: activeKit.id });
    });
  }, [activeKit, ensureAudio]);

  const releasePad = useCallback((index: number) => {
    // Drum pads are one-shots. The UI still clears its pressed state.
    setPressedPads((previous) => previous.filter((item) => item !== index));
  }, []);

  const applyCommand = useCallback((command: AiCommand) => {
    switch (command.type) {
      case 'volume': setVolume(Math.max(0, Math.min(1, command.value))); break;
      case 'octave': setOctave(Math.max(-2, Math.min(2, Math.round(command.value)))); break;
      case 'tempo': setTempo(Math.max(40, Math.min(240, Math.round(command.value)))); break;
      case 'velocityCurve': setVelocityCurve(command.value); break;
      case 'padKit': setPadKitId(command.value); break;
      case 'backing': setArrangement(command.arrangement); break;
      case 'exercise': setLessonPlan(command.plan); break;
    }
    pushLog('info', 'command', 'AI/local command applied', command);
  }, []);

  const playBacking = useCallback((input: BackingArrangement) => {
    if (backingTimer.current) window.clearInterval(backingTimer.current);
    const bpm = Math.max(40, Math.min(240, tempo || input.tempo || 96));
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * 4;
    const intervalMs = Math.round(secondsPerBar * 1000);
    const progression = input.progression.length ? input.progression : ['C', 'Am', 'F', 'G'];
    let step = 0;
    void ensureAudio().then((ok) => {
      if (!ok) return;
      const playStep = () => {
        const chord = progression[step % progression.length];
        const intervals = chordIntervals(chord) ?? [0, 4, 7];
        const rootMatch = chord.match(/^([A-Ga-g])([#♯b♭]?)/);
        const midiRoot = rootMatch ? ({ C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 } as Record<string, number>)[rootMatch[1]!.toUpperCase()] + (rootMatch[2] === '#' || rootMatch[2] === '♯' ? 1 : rootMatch[2] === 'b' || rootMatch[2] === '♭' ? -1 : 0) : 60;
        const voiced = intervals.slice(0, 3).map((semitone) => midiRoot + semitone + 12);
        soundRef.current.chord(voiced, '8n', 0.72);
        step += 1;
      };
      playStep();
      backingTimer.current = window.setInterval(playStep, intervalMs);
      window.setTimeout(() => {
        if (backingTimer.current) window.clearInterval(backingTimer.current);
        backingTimer.current = null;
      }, intervalMs * progression.length * 2);
      pushLog('info', 'backing', 'Backing loop started', { bpm, progression });
    });
  }, [ensureAudio, tempo]);

  useEffect(() => () => { if (backingTimer.current) window.clearInterval(backingTimer.current); }, []);

  const handleFrames = useCallback((frames: HandFrame[]) => {
    const before = performance.now();
    const shouldPaintUi = before - lastUiUpdate.current >= 66;
    if (shouldPaintUi) {
      lastUiUpdate.current = before;
      setHands(frames);
    }
    const events = mapperRef.current.update(frames, before);
    for (const event of events) {
      if (event.type === 'note-on') triggerNoteOn(event.midi, event.velocity);
      else if (event.type === 'note-off') triggerNoteOff(event.midi);
      else if (event.type === 'pad-on') triggerPad(event.index, event.velocity);
      else if (event.type === 'pad-off') releasePad(event.index);
    }
    if (shouldPaintUi) setDetectionMs(Math.round(performance.now() - before));
  }, [releasePad, triggerNoteOn, triggerNoteOff, triggerPad]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      pushLog('error', 'camera', 'Camera API unavailable in this context');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Video preview missing');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      const tracker = new HandTracker();
      trackerRef.current = tracker;
      const result = await tracker.init();
      if (!result.ok) throw new Error(result.message);
      await tracker.startFromCamera(video, handleFrames);
      setCameraOn(true);
      pushLog('info', 'camera', 'Webcam tracker started', { width: video.videoWidth, height: video.videoHeight });
    } catch (error) {
      const text = String(error);
      setCameraOn(false);
      pushLog('error', 'camera', 'Webcam start failed', { error: text });
    }
  }, [handleFrames]);

  const stopCamera = useCallback(() => {
    trackerRef.current?.stop();
    trackerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    setCameraOn(false);
    setHands([]);
    pushLog('info', 'camera', 'Webcam stopped');
  }, []);

  const toggleCamera = useCallback(() => {
    if (cameraOn) stopCamera();
    else void startCamera();
  }, [cameraOn, startCamera, stopCamera]);

  const startPairing = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    const generated = PeerLink.makePairing(base);
    const next = { room: generated.room, code: generated.code, url: generated.url };
    setPairing(next);
    setPairState('waiting');
    setPhoneName('');
    setPairDetail('Waiting for the phone to open the link and verify the code.');
    setPairOpen(true);

    const peer = new PeerLink({
      role: 'desktop',
      room: generated.room,
      code: generated.code,
      onState: (state, detail) => {
        setPairDetail(detail ?? state);
        if (state === 'connected') setPairState('connected');
        else if (state === 'error') setPairState('error');
        else if (state === 'disconnected') setPairState('disconnected');
        else if (state === 'waiting') setPairState('waiting');
      },
      onData: (data) => {
        const packet = data as HandFramePacket | { type?: string; code?: string; name?: string };
        if (packet.type === 'hello' && typeof packet.code === 'string' && packet.code === generated.code) {
          setPhoneName(typeof packet.name === 'string' ? packet.name : 'Phone');
          setPairDetail('Phone verified and linked.');
          setPairState('connected');
          pushLog('info', 'pairing', 'Phone hello accepted', { name: packet.name });
          return;
        }
        if (packet.type === 'hand-frame') {
          const frame = packet as HandFramePacket;
          handleFrames(frame.hands.map((hand) => ({ ...hand, score: hand.score })));
          return;
        }
        pushLog('warn', 'pairing', 'Ignored unrecognized phone packet', packet);
      },
    });
    peerRef.current = peer;
    void peer.waitForPairing();
    pushLog('info', 'pairing', 'One-time pairing session created', { room: generated.room });
  }, [handleFrames]);

  const stopPairing = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setPairState('idle');
    setPhoneName('');
    setPairDetail('Phone disconnected.');
    pushLog('info', 'pairing', 'Phone pairing stopped');
  }, []);

  const onOctave = useCallback((delta: number) => {
    setOctave((value) => Math.max(-2, Math.min(2, value + Math.sign(delta))));
  }, []);
  const resetOctave = useCallback(() => setOctave(0), []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName ?? '')) return;
      if (event.code === 'Space') { event.preventDefault(); setSustain(true); }
      else if (event.key === 'z' || event.key === 'Z') setOctave((v) => Math.max(-2, v - 1));
      else if (event.key === 'x' || event.key === 'X') setOctave((v) => Math.min(2, v + 1));
      else if (event.key === 'm' || event.key === 'M') setMuted((v) => !v);
      else if (/^[1-6]$/.test(event.key)) triggerPad(Number(event.key) - 1, 0.82);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setSustain(false);
        for (const midi of [...pressedIds]) soundRef.current.noteOff(midi + octave * 12);
        setPressedIds([]);
        pushLog('info', 'sustain', 'Sustain released');
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [octave, pressedIds, triggerPad]);

  const heldMidiForAi = useMemo(() => pressedIds.map((midi) => midi + octave * 12), [octave, pressedIds]);

  return (
    <main className="app-shell">
      <TopBar
        cameraOn={cameraOn}
        quality={quality}
        overlay={overlay}
        onToggleCamera={toggleCamera}
        onQuality={setQuality}
        onOverlay={setOverlay}
        onOpenAi={() => setAiOpen(true)}
        onOpenPair={() => setPairOpen(true)}
        onOpenLogs={() => setLogsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <section className="studio-stage" aria-label="AR piano stage">
        <video ref={videoRef} className={`camera-feed${mirrorClass(cameraOn)}`} playsInline muted />
        {!cameraOn && <div className="studio-backdrop"><div className="backdrop-frame"><p>Desktop studio preview</p><small>Camera off — use mouse or keys 1–6; enable camera for hand tracking.</small></div></div>}
        <PianoView
          pressedMidi={pressedMidi}
          pressedPads={padSet}
          quality={quality}
          overlay={overlay}
          onMeshClick={(payload) => {
            if (payload.kind === 'key') { triggerNoteOn(payload.midi, 0.78); window.setTimeout(() => triggerNoteOff(payload.midi), 220); }
            else triggerPad(payload.index, 0.82);
          }}
        />
        <HandOverlay hands={hands} overlay={overlay} mirror />
        <div className="hud-layer" aria-live="polite">
          <div>{cameraOn ? 'LIVE' : 'PREVIEW'} · {hands.length} hand{hands.length === 1 ? '' : 's'}<em>{detectionMs}ms</em></div>
          <div className={sustain ? 'hud-sustain on' : 'hud-sustain'}>SUSTAIN</div>
          <div>OCT {octave >= 0 ? `+${octave}` : octave}</div>
          <div>{tempo} BPM</div>
          <button type="button" className="hud-link" onClick={() => setPairOpen(true)}>{pairState === 'connected' ? (phoneName ? `${phoneName} linked` : 'Phone linked') : 'Phone not paired'}</button>
        </div>
      </section>

      <TemplateStrip
        pressedMidi={pressedMidi}
        pressedPads={padSet}
        padKit={activeKit}
        octave={octave}
        sustain={sustain}
        onNoteOn={triggerNoteOn}
        onNoteOff={triggerNoteOff}
        onPadOn={triggerPad}
        onPadOff={releasePad}
        onOctave={onOctave}
        onResetOctave={resetOctave}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        calibration={calibration}
        onCalibrationChange={setCalibration}
        volume={volume}
        padVolume={padVolume}
        velocityCurve={velocityCurve}
        padKit={padKitId}
        panelTouch={panelTouch}
        onVolume={setVolume}
        onPadVolume={setPadVolume}
        onVelocityCurve={setVelocityCurve}
        onPadKit={setPadKitId}
        onPanelTouch={setPanelTouch}
      />
      <AiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        notes={heldMidiForAi}
        provider={aiProvider}
        onProvider={setAiProvider}
        onApply={applyCommand}
        onPlayBacking={playBacking}
        volume={volume}
        octave={octave}
        tempo={tempo}
        velocityCurve={velocityCurve}
        padKit={padKitId}
      />
      <PairPhoneModal
        open={pairOpen}
        pairing={{ ...pairing, status: pairState, phoneName, detail: pairDetail }}
        onClose={() => setPairOpen(false)}
        onStart={startPairing}
        onStop={stopPairing}
      />
      <LogView open={logsOpen} onClose={() => setLogsOpen(false)} />
      {lessonPlan && <div className="toast" role="status"><strong>Learning plan ready:</strong> {lessonPlan.title}<button onClick={() => setLessonPlan(null)} aria-label="Dismiss">×</button></div>}
      {arrangement && <div className="toast alt" role="status"><strong>{arrangement.key} · {arrangement.genre}</strong><button onClick={() => setArrangement(null)} aria-label="Dismiss">×</button></div>}
    </main>
  );
}

function mirrorClass(cameraOn: boolean) {
  return cameraOn ? ' camera-on' : '';
}
