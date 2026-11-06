import { memo, useMemo, useState } from 'react';
import { analyzeChord } from '../ai/musicTheory';
import { loadProviderConfigs } from '../ai/providers';
import { explainChord, solveCommand, suggestBacking, suggestLearningPlan } from '../ai/assist';
import type {
  AiProviderId, BackingArrangement, LearningPlan,
} from '../types';
import { noteName } from '../lib/music';
import { pushLog } from '../lib/logger';

export type AiCommand =
  | { type: 'volume'; value: number }
  | { type: 'octave'; value: number }
  | { type: 'tempo'; value: number }
  | { type: 'velocityCurve'; value: 'soft' | 'normal' | 'hard' }
  | { type: 'padKit'; value: 'ep25' | 'diagram-literal' | 'lofi' | 'custom' }
  | { type: 'backing'; arrangement: BackingArrangement }
  | { type: 'exercise'; plan: LearningPlan };

interface AiPanelProps {
  open: boolean;
  onClose: () => void;
  notes: number[];
  provider: AiProviderId;
  onProvider: (provider: AiProviderId) => void;
  onApply: (command: AiCommand) => void;
  onPlayBacking: (arrangement: BackingArrangement) => void;
  volume: number;
  octave: number;
  tempo: number;
  velocityCurve: 'soft' | 'normal' | 'hard';
  padKit: 'ep25' | 'diagram-literal' | 'lofi' | 'custom';
}

function AiPanel({ open, onClose, notes, provider, onProvider, onApply, onPlayBacking, volume, octave, tempo, velocityCurve, padKit }: AiPanelProps) {
  const [tab, setTab] = useState<'chord' | 'backing' | 'coach' | 'command'>('chord');
  const [chordExplanation, setChordExplanation] = useState('');
  const [arrangement, setArrangement] = useState<BackingArrangement | null>(null);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [key, setKey] = useState('C major');
  const [genre, setGenre] = useState('Rhodes ballad');
  const [bass, setBass] = useState('Root-fifth');
  const [pad, setPad] = useState('Rhodes pads');
  const [command, setCommand] = useState('increase volume to 80%');
  const [busy, setBusy] = useState<string>('');
  const [message, setMessage] = useState('');

  const configs = useMemo(() => loadProviderConfigs(), [open]);
  const activeConfig = configs[provider];
  const analysis = useMemo(() => analyzeChord(notes), [notes]);

  if (!open) return null;

  const setBusyMessage = (value: string, text = '') => {
    setBusy(value);
    setMessage(text);
  };

  const explain = async () => {
    if (!activeConfig.key.trim()) {
      setMessage('Add your provider API key in Settings first.');
      pushLog('warn', 'ai', 'Explain requested without configured API key');
      return;
    }
    setBusyMessage('chord', 'Contacting provider…');
    try {
      const text = await explainChord(activeConfig, notes.map(noteName));
      setChordExplanation(text);
      setMessage('Recommendation returned.');
      pushLog('info', 'ai', 'AI chord explanation completed', { provider, model: activeConfig.model, notes });
    } catch (error) {
      const text = String(error);
      setMessage(text);
      pushLog('error', 'ai', 'AI chord explanation failed', { error: text, provider });
    } finally {
      setBusy('');
    }
  };

  const makeBacking = async () => {
    if (!activeConfig.key.trim()) {
      setMessage('Add your provider API key in Settings first.');
      return;
    }
    setBusyMessage('backing', 'Generating arrangement…');
    try {
      const result = await suggestBacking(activeConfig, { key, genre, tempo, bass, pad });
      setArrangement(result);
      onApply({ type: 'backing', arrangement: result });
      setMessage('Arrangement generated and stored locally.');
      pushLog('info', 'ai', 'Backing generated', { provider, genre, key, tempo });
    } catch (error) {
      setMessage(String(error));
      pushLog('error', 'ai', 'Backing generation failed', { error: String(error), provider });
    } finally {
      setBusy('');
    }
  };

  const makePlan = async () => {
    if (!activeConfig.key.trim()) {
      setMessage('Add your provider API key in Settings first.');
      return;
    }
    setBusyMessage('coach', 'Designing practice plan…');
    try {
      const result = await suggestLearningPlan(activeConfig, {
        level: 'intermediate',
        goal: 'EP-25 AR keyboard control and expressive chord voicings',
        minutesPerDay: 20,
      });
      setPlan(result);
      onApply({ type: 'exercise', plan: result });
      pushLog('info', 'ai', 'Learning plan generated', { provider, model: activeConfig.model });
    } catch (error) {
      setMessage(String(error));
      pushLog('error', 'ai', 'Learning plan generation failed', { error: String(error), provider });
    } finally {
      setBusy('');
    }
  };

  const runCommand = async () => {
    const input = command.trim();
    if (!input) return;
    const lower = input.toLowerCase();
    const local = parseLocalCommand(lower);
    if (local) {
      applyLocal(local, input);
      return;
    }
    if (!activeConfig.key.trim()) {
      setMessage('Command not recognized locally. Add your provider key for AI command resolution.');
      return;
    }
    setBusyMessage('command', 'Resolving command…');
    try {
      const action = await solveCommand(activeConfig, [`Held: ${notes.map(noteName).join(' ')}`, `Volume: ${volume}`, `Octave: ${octave}`, `Tempo: ${tempo}`], input);
      const normalized = action.action.toLowerCase();
      if (normalized === 'setvolume') onApply({ type: 'volume', value: Number(action.argument.replace(/[^0-9.]/g, '')) / 100 });
      else if (normalized === 'settempo') onApply({ type: 'tempo', value: Number(action.argument.replace(/[^0-9.]/g, '')) });
      else if (normalized === 'setoctave') onApply({ type: 'octave', value: Number(action.argument) || 0 });
      else if (normalized === 'velocitycurve') onApply({ type: 'velocityCurve', value: action.argument as 'soft' | 'normal' | 'hard' });
      else if (normalized === 'padkit') onApply({ type: 'padKit', value: action.argument as 'ep25' | 'diagram-literal' | 'lofi' | 'custom' });
      else setMessage(`AI suggested ${action.action}: ${action.reason}`);
      setMessage(`${action.action}: ${action.reason}`);
      pushLog('info', 'ai', 'AI command resolved', { provider, instruction: input, action });
    } catch (error) {
      setMessage(String(error));
      pushLog('error', 'ai', 'AI command failed', { error: String(error), provider });
    } finally {
      setBusy('');
    }
  };

  const parseLocalCommand = (lower: string) => {
    const percent = lower.match(/(\d{1,3})%/);
    if (lower.includes('volume') && percent) return { kind: 'volume' as const, value: Number(percent[1]) / 100 };
    if (/(octave|oct).*(up|raise)/.test(lower) || lower === 'up') return { kind: 'octave' as const, value: 1 };
    if (/(octave|oct).*(down|lower)/.test(lower) || lower === 'down') return { kind: 'octave' as const, value: -1 };
    if (/reset.*oct/.test(lower)) return { kind: 'octave' as const, value: 0 };
    if (lower.includes('soft')) return { kind: 'velocity' as const, value: 'soft' as const };
    if (lower.includes('normal')) return { kind: 'velocity' as const, value: 'normal' as const };
    if (lower.includes('hard')) return { kind: 'velocity' as const, value: 'hard' as const };
    if (lower.includes('lofi') || lower.includes('lo-fi')) return { kind: 'padKit' as const, value: 'lofi' as const };
    if (lower.includes('ep25')) return { kind: 'padKit' as const, value: 'ep25' as const };
    const bpm = lower.match(/(\d{2,3})\s*(?:bpm|tempo)/);
    if (bpm) return { kind: 'tempo' as const, value: Number(bpm[1]) };
    return null;
  };

  const applyLocal = (local: ReturnType<typeof parseLocalCommand>, label: string) => {
    if (!local) return;
    if (local.kind === 'volume') onApply({ type: 'volume', value: local.value });
    if (local.kind === 'octave') onApply({ type: 'octave', value: local.value });
    if (local.kind === 'velocity') onApply({ type: 'velocityCurve', value: local.value });
    if (local.kind === 'padKit') onApply({ type: 'padKit', value: local.value });
    if (local.kind === 'tempo') onApply({ type: 'tempo', value: local.value });
    setMessage(`Local command applied: ${label}`);
    pushLog('info', 'command', 'Local command applied', { command: label });
  };

  return (
    <aside className="side-panel ai-panel" role="dialog" aria-label="Artificial intelligence tools">
      <div className="panel-header"><h2>AI Music Coach</h2><button type="button" onClick={onClose} aria-label="Close AI panel">×</button></div>
      <div className="provider-strip" role="tablist" aria-label="AI providers">
        {(['openai', 'gemini', 'opencode'] as AiProviderId[]).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={provider === id} className={provider === id ? 'provider-tab active' : 'provider-tab'} onClick={() => onProvider(id)}>
            {id === 'openai' ? 'OpenAI' : id === 'gemini' ? 'Gemini' : 'OpenCode'}
          </button>
        ))}
      </div>
      <div className="panel-scroll">
        <div className="ai-tabs" role="tablist">
          {(['chord', 'backing', 'coach', 'command'] as const).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
              {name === 'chord' ? 'Chord' : name === 'backing' ? 'Backing' : name === 'coach' ? 'Coach' : 'Command'}
            </button>
          ))}
        </div>

        {tab === 'chord' && (
          <section className="ai-card">
            <div className="card-heading"><h3>Held chord analysis</h3><span>{notes.length || 0} notes</span></div>
            <div className="note-chips">{notes.length ? notes.map((m) => <code key={m}>{noteName(m)}</code>) : <p className="muted">Hold at least three keys to analyze the voicing.</p>}</div>
            <dl className="analysis-grid"><div><dt>Root</dt><dd>{analysis.root}</dd></div><div><dt>Quality</dt><dd>{analysis.quality}</dd></div><div><dt>Inversion</dt><dd>{analysis.inversion}</dd></div><div><dt>Confidence</dt><dd>{Math.round(analysis.confidence * 100)}%</dd></div></dl>
            <button type="button" className="primary-button" onClick={explain} disabled={busy === 'chord'}>{busy === 'chord' ? 'Asking…' : 'Explain with AI'}</button>
            {chordExplanation && <p className="ai-output">{chordExplanation}</p>}
          </section>
        )}

        {tab === 'backing' && (
          <section className="ai-card">
            <h3>Backing arrangement</h3>
            <div className="grid-two"><label>Key<input value={key} onChange={(event) => setKey(event.target.value)} /></label><label>Genre<input value={genre} onChange={(event) => setGenre(event.target.value)} /></label><label>Bass<input value={bass} onChange={(event) => setBass(event.target.value)} /></label><label>Pad<input value={pad} onChange={(event) => setPad(event.target.value)} /></label></div>
            <p>Tempo is currently <strong>{tempo} BPM</strong> (change with a Command).</p>
            <button type="button" className="primary-button" onClick={makeBacking} disabled={busy === 'backing'}>{busy === 'backing' ? 'Generating…' : 'Generate EP arrangement'}</button>
            {arrangement && <><dl className="analysis-grid"><div><dt>Key</dt><dd>{arrangement.key}</dd></div><div><dt>Genre</dt><dd>{arrangement.genre}</dd></div><div><dt>Bars</dt><dd>{arrangement.bars.length}</dd></div></dl><pre className="ai-output compact">{arrangement.progression.join(' → ')}</pre><button type="button" className="ghost-button full" onClick={() => onPlayBacking(arrangement)}>Play progression</button></>}
          </section>
        )}

        {tab === 'coach' && (
          <section className="ai-card">
            <h3>Adaptive practice path</h3><p className="muted">Generates a five-step plan for EP-25 control and chord voicings.</p>
            <button type="button" className="primary-button" onClick={makePlan} disabled={busy === 'coach'}>{busy === 'coach' ? 'Designing…' : 'Generate learning plan'}</button>
            {plan && <><h4>{plan.title}</h4><ol className="plan-list">{plan.steps.map((step) => <li key={step.id}><strong>{step.title}</strong><span>{step.target}</span><small>{step.minutes} min</small></li>)}</ol></>}
          </section>
        )}

        {tab === 'command' && (
          <section className="ai-card command-panel">
            <h3>Natural-language control</h3><p className="muted">Local commands run immediately. Unrecognized commands can be resolved by the selected AI provider.</p>
            <label className="command-label">Instruction<input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runCommand(); }} placeholder="e.g. volume 60%, octave up..." /></label>
            <button type="button" className="primary-button" onClick={runCommand} disabled={!!busy}>Run command</button>
            <div className="command-current"><span>Current</span><code>velocity {velocityCurve}</code><code>kit {padKit}</code><code>octave {octave >= 0 ? `+${octave}` : octave}</code></div>
            <div className="command-examples"><span>Try:</span><code>octave up</code><code>volume 80%</code><code>hard velocity</code><code>lofi pad kit</code><code>increase volume to 60%</code></div>
          </section>
        )}
        {message && <p className="status-line">{message}</p>}
      </div>
    </aside>
  );
}


export default memo(AiPanel);
