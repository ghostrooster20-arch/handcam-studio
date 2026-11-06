import type { AppLog } from '../types';

const logs: AppLog[] = [];
const listeners = new Set<(logs: AppLog[]) => void>();

export function pushLog(level: AppLog['level'], source: string, message: string, data?: unknown) {
  const item: AppLog = { ts: Date.now(), level, source, message, ...(data === undefined ? {} : { data }) };
  logs.push(item);
  if (logs.length > 500) logs.splice(0, logs.length - 500);
  console[level === 'debug' ? 'log' : level](`[${source}]`, message, data ?? '');
  for (const listener of listeners) listener([...logs]);
  return item;
}

export function allLogs(): AppLog[] {
  return [...logs];
}

export function clearLogs() {
  logs.length = 0;
  for (const listener of listeners) listener([]);
}

export function subscribeLogs(listener: (logs: AppLog[]) => void) {
  listeners.add(listener);
  listener([...logs]);
  return () => { listeners.delete(listener); };
}

export function exportLogs() {
  const text = logs
    .map((log) => `${new Date(log.ts).toISOString()} ${log.level.toUpperCase().padEnd(5)} [${log.source}] ${log.message}`)
    .join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `handcam-studio-${Date.now()}.log`;
  a.click();
  URL.revokeObjectURL(url);
}
