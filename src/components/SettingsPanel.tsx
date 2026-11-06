import { useState } from 'react';
import type { AiProviderConfig, AiProviderId } from '../types';
import { clearProviderKeys, loadProviderConfigs, saveProviderConfigs } from '../ai/providers';
import { pushLog } from '../lib/logger';
import type { Calibration } from '../vision/ControlMapper';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  calibration: Calibration;
  onCalibrationChange: (value: Calibration) => void;
  volume: number;
  padVolume: number;
  velocityCurve: 'soft' | 'normal' | 'hard';
  padKit: 'ep25' | 'diagram-literal' | 'lofi' | 'custom';
  panelTouch: 'always' | 'locked-on-play' | 'hidden';
  onVolume: (value: number) => void;
  onPadVolume: (value: number) => void;
  onVelocityCurve: (value: 'soft' | 'normal' | 'hard') => void;
  onPadKit: (value: 'ep25' | 'diagram-literal' | 'lofi' | 'custom') => void;
  onPanelTouch: (value: 'always' | 'locked-on-play' | 'hidden') => void;
}

export default function SettingsPanel({
  open, onClose, calibration, onCalibrationChange,
  volume, padVolume, velocityCurve, padKit, panelTouch,
  onVolume, onPadVolume, onVelocityCurve, onPadKit, onPanelTouch,
}: SettingsPanelProps) {
  const [configs, setConfigs] = useState(loadProviderConfigs);
  const [saved, setSaved] = useState('');

  if (!open) return null;

  const save = () => {
    saveProviderConfigs(configs);
    setSaved('Saved locally in this browser.');
    window.setTimeout(() => setSaved(''), 1800);
  };

  const clear = () => {
    const cleared = clearProviderKeys();
    setConfigs(cleared);
    setSaved('AI keys cleared from this browser.');
    window.setTimeout(() => setSaved(''), 1800);
  };

  const patch = (provider: AiProviderId, field: keyof AiProviderConfig, value: string) => {
    setConfigs((prev) => ({ ...prev, [provider]: { ...prev[provider], [field]: value } }));
  };

  const patchBoard = (field: 'left' | 'right' | 'top' | 'bottom', value: number) => {
    const board = { ...calibration.board, [field]: value };
    onCalibrationChange({ ...calibration, board });
    pushLog('debug', 'settings', 'Board calibration changed', { field, value });
  };

  return (
    <aside className="side-panel settings-panel" role="dialog" aria-modal="false" aria-label="Settings">
      <div className="panel-header"><h2>Settings</h2><button type="button" onClick={onClose} aria-label="Close settings">×</button></div>

      <div className="panel-scroll">
        <fieldset className="settings-group ai-settings">
          <legend>AI providers</legend>
          <p className="muted">Keys stay in this browser. Nothing is sent anywhere until you invoke an AI action.</p>
          {(Object.keys(configs) as AiProviderId[]).map((provider) => (
            <div className="provider-card" key={provider}>
              <div className="provider-header">
                <strong>{provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Google Gemini' : 'OpenCode gateway'}</strong>
                <span>{configs[provider].model}</span>
              </div>
              <label>Model<input value={configs[provider].model} onChange={(event) => patch(provider, 'model', event.target.value)} /></label>
              {provider === 'opencode' && <label>Base URL<input value={configs[provider].baseUrl} onChange={(event) => patch(provider, 'baseUrl', event.target.value)} /></label>}
              <label>API key<input type="password" autoComplete="off" value={configs[provider].key} onChange={(event) => patch(provider, 'key', event.target.value)} placeholder="Paste key" /></label>
            </div>
          ))}
          <div className="button-row">
            <button type="button" className="primary-button" onClick={save}>Save AI keys</button>
            <button type="button" className="ghost-danger" onClick={clear}>Clear keys</button>
          </div>
          {saved && <p className="success" role="status">{saved}</p>}
        </fieldset>

        <fieldset className="settings-group">
          <legend>Audio</legend>
          <label>MASTER VOLUME <output>{Math.round(volume * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onVolume(Number(event.target.value))} /></label>
          <label>PAD VOLUME <output>{Math.round(padVolume * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={padVolume} onChange={(event) => onPadVolume(Number(event.target.value))} /></label>
          <label>Velocity curve<select value={velocityCurve} onChange={(event) => onVelocityCurve(event.target.value as typeof velocityCurve)}><option value="soft">Soft</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label>
          <label>Pad kit<select value={padKit} onChange={(event) => onPadKit(event.target.value as typeof padKit)}><option value="ep25">EP25 Kit</option><option value="diagram-literal">Diagram Literal</option><option value="lofi">Lo-Fi</option><option value="custom">Custom (MIDI map)</option></select></label>
          <label>Panel touch mode<select value={panelTouch} onChange={(event) => onPanelTouch(event.target.value as typeof panelTouch)}><option value="always">During play and idle</option><option value="locked-on-play">Lock while playing</option><option value="hidden">HUD/keyboard only</option></select></label>
        </fieldset>

        <fieldset className="settings-group">
          <legend>Camera calibration</legend>
          <div className="calibration-note">Values are normalized camera coordinates. The phone should see the entire keyboard plus pads without twisting.</div>
          <div className="grid-two">
            <label>Board left<input type="number" min="0" max="1" step="0.01" value={calibration.board.left} onChange={(event) => patchBoard('left', Number(event.target.value))} /></label>
            <label>Board right<input type="number" min="0" max="1" step="0.01" value={calibration.board.right} onChange={(event) => patchBoard('right', Number(event.target.value))} /></label>
            <label>Top edge<input type="number" min="0" max="1" step="0.01" value={calibration.board.top} onChange={(event) => patchBoard('top', Number(event.target.value))} /></label>
            <label>Bottom edge<input type="number" min="0" max="1" step="0.01" value={calibration.board.bottom} onChange={(event) => patchBoard('bottom', Number(event.target.value))} /></label>
          </div>
        </fieldset>
      </div>
    </aside>
  );
}
