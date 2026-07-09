/**
 * Estado ligero del gateway WhatsApp (sin importar Baileys).
 * Permite consultar status/QR/logs sin cargar WAProto en memoria.
 */

export type GatewayStatus =
  | 'disconnected'
  | 'initializing'
  | 'qr_ready'
  | 'connecting'
  | 'connected';

export type GatewayState = {
  /** Socket Baileys (solo se asigna desde baileys.ts) */
  socket: unknown | null;
  status: GatewayStatus;
  qr: string;
  qrDataUrl: string;
  phone: string;
  device: string;
  logs: string[];
  starting: boolean;
  reconnecting: boolean;
};

const globalForBaileys = globalThis as typeof globalThis & {
  snackRoqueBaileys?: GatewayState;
};

export const baileysState: GatewayState =
  globalForBaileys.snackRoqueBaileys ??
  {
    socket: null,
    status: 'disconnected',
    qr: '',
    qrDataUrl: '',
    phone: '',
    device: '',
    logs: [],
    starting: false,
    reconnecting: false,
  };

globalForBaileys.snackRoqueBaileys = baileysState;

export function addBaileysLog(message: string) {
  const timestamp = new Date().toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  baileysState.logs = [...baileysState.logs.slice(-120), `[${timestamp}] ${message}`];
}

export function getWhatsAppStatus() {
  return {
    connected: baileysState.status === 'connected',
    status: baileysState.status,
    qrDataUrl: baileysState.qrDataUrl,
    phone: baileysState.phone,
    device: baileysState.device,
    logs: baileysState.logs,
  };
}
