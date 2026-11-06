import type { OverlayStyle } from './HandOverlay';

interface TopBarProps {
  cameraOn: boolean;
  quality: 'high' | 'low';
  overlay: OverlayStyle;
  onToggleCamera: () => void;
  onQuality: (quality: 'high' | 'low') => void;
  onOverlay: (overlay: OverlayStyle) => void;
  onOpenAi: () => void;
  onOpenPair: () => void;
  onOpenLogs: () => void;
  onOpenSettings: () => void;
}

export default function TopBar({
  cameraOn, quality, overlay, onToggleCamera, onQuality, onOverlay, onOpenAi, onOpenPair, onOpenLogs, onOpenSettings,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <a className="brand" href="/" aria-label="HandCam Studio">
        <span className="brand-mark">H</span>
        <span><strong>HandCam Studio</strong><small>EP-25 · AR</small></span>
      </a>

      <nav className="top-actions" aria-label="Application controls">
        <button type="button" className={cameraOn ? 'chip active' : 'chip'} onClick={onToggleCamera} aria-pressed={cameraOn}>
          <span className="status-dot" /> {cameraOn ? 'Camera on' : 'Camera off'}
        </button>
        <label className="select-wrap" title="Overlay style">
          <span>Overlay</span>
          <select value={overlay} onChange={(event) => onOverlay(event.target.value as OverlayStyle)}>
            <option value="ghost">Ghost</option>
            <option value="neon">Neon</option>
            <option value="wireframe">Wireframe</option>
            <option value="skeleton">Skeleton</option>
          </select>
        </label>
        <label className="select-wrap" title="Rendering quality">
          <span>Quality</span>
          <select value={quality} onChange={(event) => onQuality(event.target.value as 'high' | 'low')}>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </label>

        <button type="button" className="top-button accent" onClick={onOpenAi}>✦ AI</button>
        <button type="button" className="top-button" onClick={onOpenPair}>⌗ Pair phone</button>
        <button type="button" className="top-button" onClick={onOpenLogs}>▤ Logs</button>
        <button type="button" className="icon-circle" onClick={onOpenSettings} aria-label="Settings">⚙</button>
      </nav>
    </header>
  );
}
