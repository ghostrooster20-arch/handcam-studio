import { useEffect, useState } from 'react';
import { allLogs, clearLogs, exportLogs, subscribeLogs } from '../lib/logger';
import type { AppLog } from '../types';

interface LogViewProps {
  open: boolean;
  onClose: () => void;
}

export default function LogView({ open, onClose }: LogViewProps) {
  const [logs, setLogs] = useState<AppLog[]>(allLogs());
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');

  useEffect(() => subscribeLogs(setLogs), []);

  if (!open) return null;
  const shown = logs.filter((log) => filter === 'all' || log.level === filter);

  return (
    <section className="logs-panel" role="dialog" aria-label="Session logs">
      <div className="panel-header"><h2>Session log <span>{shown.length}</span></h2>
        <div className="button-row compact">
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Log level filter">
            <option value="all">All</option><option value="info">Info</option><option value="warn">Warn</option><option value="error">Error</option><option value="debug">Debug</option>
          </select>
          <button type="button" className="ghost-button" onClick={exportLogs}>Export</button>
          <button type="button" className="ghost-button" onClick={clearLogs}>Clear</button>
          <button type="button" className="icon-circle" onClick={onClose} aria-label="Close logs">×</button>
        </div>
      </div>
      <div className="log-scroll" role="log" aria-live="polite">
        {shown.length === 0 ? <p className="muted log-empty">No log entries match this filter.</p> : shown.slice().reverse().map((log) => (
          <details className={`log-row ${log.level}`} key={`${log.ts}-${log.message}`}>
            <summary><time>{new Date(log.ts).toLocaleTimeString()}</time><strong>{log.level.toUpperCase()}</strong><span>{log.source}</span><p>{log.message}</p></summary>
            {log.data !== undefined && <pre>{JSON.stringify(log.data, null, 2)}</pre>}
          </details>
        ))}
      </div>
    </section>
  );
}
