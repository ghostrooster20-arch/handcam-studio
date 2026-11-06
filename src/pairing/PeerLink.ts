import Peer, { type DataConnection } from 'peerjs';
import { pushLog } from '../lib/logger';

export type PeerRole = 'desktop' | 'phone';
export type LinkState = 'idle' | 'waiting' | 'connected' | 'disconnected' | 'error';

export interface PairingPayload {
  room: string;
  code: string;
  url: string;
}

export interface HandFramePacket {
  type: 'hand-frame';
  seq: number;
  ts: number;
  fps: number;
  width: number;
  height: number;
  hands: Array<{
    handedness: 'Left' | 'Right';
    score: number;
    landmarks: Array<{ x: number; y: number; z: number; presence?: number }>;
  }>;
}

export interface HelloPacket {
  type: 'hello';
  code: string;
  name: string;
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
}

interface PeerLinkOptions {
  role: PeerRole;
  room?: string;
  code?: string;
  host?: string;
  port?: number;
  path?: string;
  onState?: (state: LinkState, detail?: string) => void;
  onData?: (data: unknown) => void;
  onPeerId?: (id: string) => void;
}

export class PeerLink {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private role: PeerRole;
  private room = '';
  private code = '';
  private host: string;
  private port: number;
  private path: string;
  private onState?: (state: LinkState, detail?: string) => void;
  private onData?: (data: unknown) => void;
  private onPeerId?: (id: string) => void;
  private closed = false;

  constructor(options: PeerLinkOptions) {
    this.role = options.role;
    this.room = options.room ?? '';
    this.code = options.code ?? '';
    this.host = options.host ?? import.meta.env.VITE_PEERJS_HOST ?? '0.peerjs.com';
    this.port = Number(options.port ?? import.meta.env.VITE_PEERJS_PORT ?? 443);
    this.path = options.path ?? import.meta.env.VITE_PEERJS_PATH ?? '/';
    this.onState = options.onState;
    this.onData = options.onData;
    this.onPeerId = options.onPeerId;
  }

  static makePairing(baseUrl = `${window.location.origin}${window.location.pathname}`): PairingPayload {
    const token = crypto.getRandomValues(new Uint8Array(16));
    const room = [...token].map((b) => b.toString(16).padStart(2, '0')).join('');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const params = new URLSearchParams({ view: 'phone', room, code });
    return { room, code, url: `${baseUrl}?${params.toString()}` };
  }

  connect(): Promise<string> {
    if (this.role !== 'phone') return Promise.reject(new Error('Only the phone can initiate connect()'));
    if (!this.room || !this.code) return Promise.reject(new Error('Missing room/code'));
    this.peer = new Peer({ host: this.host, port: this.port, path: this.path });
    this.peer.on('open', (id) => {
      pushLog('info', 'pairing', 'Phone peer registered', { id });
      this.onPeerId?.(id);
      const conn = this.peer!.connect(this.room, { reliable: true });
      this.attachConnection(conn);
      this.onState?.('waiting', 'Connecting to desktop');
    });
    this.peer.on('error', (error) => this.handleError('Peer error', error));
    this.peer.on('disconnected', () => { if (!this.closed) this.onState?.('disconnected', 'Signal disconnected'); });
    return Promise.resolve('opening');
  }

  waitForPairing(): Promise<void> {
    if (this.role !== 'desktop') return Promise.reject(new Error('Only desktop can waitForPairing()'));
    this.peer = new Peer(this.room, { host: this.host, port: this.port, secure: this.port !== 80, path: this.path });
    this.peer.on('open', (id) => {
      pushLog('info', 'pairing', 'Desktop listening for phone', { id });
      this.onPeerId?.(id);
      this.onState?.('waiting', 'Waiting for phone to scan QR');
    });
    this.peer.on('connection', (conn) => this.attachConnection(conn));
    this.peer.on('error', (error) => this.handleError('Peer error', error));
    this.peer.on('disconnected', () => { if (!this.closed) this.onState?.('disconnected', 'Signal disconnected'); });
    return Promise.resolve();
  }

  sendHello(name = 'Phone companion') {
    this.send({ type: 'hello', code: this.code, name, platform: this.platform() });
  }

  send(data: unknown) {
    if (!this.connection?.open) {
      pushLog('warn', 'pairing', 'Attempted to send before data channel was ready');
      return false;
    }
    try {
      this.connection.send(data);
      return true;
    } catch (error) {
      this.handleError('Send failed', error);
      return false;
    }
  }

  close() {
    this.closed = true;
    this.connection?.close();
    this.peer?.destroy();
    this.connection = null;
    this.peer = null;
    this.onState?.('disconnected', 'Disconnected');
  }

  verificationCode() {
    return this.code;
  }

  roomId() {
    return this.room;
  }

  isConnected() {
    return !!this.connection?.open;
  }

  private attachConnection(conn: DataConnection) {
    this.connection = conn;
    conn.on('open', () => {
      pushLog('info', 'pairing', 'Data channel opened');
      this.onState?.('connected', 'Phone linked');
      if (this.role === 'phone') this.sendHello();
    });
    conn.on('data', (data: unknown) => this.onData?.(data));
    conn.on('close', () => {
      pushLog('warn', 'pairing', 'Data channel closed');
      this.onState?.('disconnected', 'Phone disconnected');
    });
    conn.on('error', (error: unknown) => this.handleError('Connection error', error));
  }

  private platform(): HelloPacket['platform'] {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const source = nav.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
    const s = source.toLowerCase();
    if (/iphone|ipad|ipod/.test(s)) return 'ios';
    if (/android/.test(s)) return 'android';
    if (/win/.test(s)) return 'windows';
    if (/mac/.test(s)) return 'macos';
    if (/linux/.test(s)) return 'linux';
    return 'unknown';
  }

  private handleError(context: string, error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    pushLog('error', 'pairing', context, { detail });
    this.onState?.('error', detail);
  }
}
