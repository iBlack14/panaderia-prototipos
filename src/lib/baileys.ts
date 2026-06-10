import makeWASocket, {
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  proto,
  type WASocket
} from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import qrcode from 'qrcode';
import pino from 'pino';

type GatewayStatus = 'disconnected' | 'initializing' | 'qr_ready' | 'connecting' | 'connected';

type GatewayState = {
  socket: WASocket | null;
  status: GatewayStatus;
  qr: string;
  qrDataUrl: string;
  phone: string;
  device: string;
  logs: string[];
  starting: boolean;
  reconnecting: boolean;
};

const logger = pino({ level: 'silent' });
const AUTH_TABLE = 'whatsapp_baileys_auth';

const globalForBaileys = globalThis as typeof globalThis & {
  snackRoqueBaileys?: GatewayState;
};

const state: GatewayState = globalForBaileys.snackRoqueBaileys ?? {
  socket: null,
  status: 'disconnected',
  qr: '',
  qrDataUrl: '',
  phone: '',
  device: '',
  logs: [],
  starting: false,
  reconnecting: false
};

globalForBaileys.snackRoqueBaileys = state;

function addLog(message: string) {
  const timestamp = new Date().toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  state.logs = [...state.logs.slice(-120), `[${timestamp}] ${message}`];
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.endsWith('@s.whatsapp.net') ? digits : `${digits}@s.whatsapp.net`;
}

function setConnectedPhone(id?: string) {
  const raw = id?.split(':')[0]?.split('@')[0] || '';
  state.phone = raw ? `+${raw}` : '';
}

function scheduleReconnect(reason: string) {
  if (state.reconnecting) return;

  state.reconnecting = true;
  state.status = 'connecting';
  addLog(`🔄 [Baileys-Core] Reconectando con sesión guardada en BD (${reason})...`);

  setTimeout(async () => {
    state.reconnecting = false;
    await startWhatsAppGateway();
  }, 1200);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para guardar la sesión en BD.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function serializeBaileysData(data: any) {
  return JSON.parse(JSON.stringify(data, BufferJSON.replacer));
}

function deserializeBaileysData(data: any) {
  if (!data) return null;
  return JSON.parse(JSON.stringify(data), BufferJSON.reviver);
}

function fixKeyName(key: string) {
  return key.replace(/\//g, '__').replace(/:/g, '-');
}

async function getSupabaseAuthState() {
  const supabase = getSupabaseAdmin();

  const writeData = async (key: string, value: any) => {
    const { error } = await supabase
      .from(AUTH_TABLE)
      .upsert({
        key: fixKeyName(key),
        value: serializeBaileysData(value),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) throw error;
  };

  const readData = async (key: string) => {
    const { data, error } = await supabase
      .from(AUTH_TABLE)
      .select('value')
      .eq('key', fixKeyName(key))
      .maybeSingle();

    if (error) throw error;
    return deserializeBaileysData(data?.value);
  };

  const removeData = async (key: string) => {
    const { error } = await supabase
      .from(AUTH_TABLE)
      .delete()
      .eq('key', fixKeyName(key));

    if (error) throw error;
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};

          await Promise.all(ids.map(async (id) => {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }));

          return data;
        },
        set: async (data: Record<string, Record<string, any>>) => {
          const tasks: Promise<void>[] = [];

          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }

          await Promise.all(tasks);
        }
      }
    },
    saveCreds: async () => writeData('creds', creds)
  };
}

async function clearSupabaseAuthState() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(AUTH_TABLE)
    .delete()
    .neq('key', '');

  if (error) throw error;
}

export async function startWhatsAppGateway() {
  if (state.status === 'connected' && state.socket) {
    return getWhatsAppStatus();
  }

  if (state.starting) {
    return getWhatsAppStatus();
  }

  state.starting = true;
  state.status = 'initializing';
  state.qr = '';
  state.qrDataUrl = '';
  state.socket?.end(undefined);
  state.socket = null;
  addLog('🔄 [Baileys-Core] Inicializando socket real...');

  try {
    const { state: authState, saveCreds } = await getSupabaseAuthState();
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, logger)
      },
      browser: ['Snack Roque POS', 'Chrome', '1.0.0'],
      logger,
      printQRInTerminal: false,
      syncFullHistory: false
    });

    state.socket = socket;
    state.status = 'connecting';
    state.device = 'Snack Roque POS - Baileys Real';

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        state.qr = qr;
        state.qrDataUrl = await qrcode.toDataURL(qr, {
          width: 320,
          margin: 2,
          color: { dark: '#1b1b1b', light: '#ffffff' }
        });
        state.status = 'qr_ready';
        addLog('📸 [Baileys-Core] QR real generado. Escanéalo desde WhatsApp.');
      }

      if (connection === 'connecting') {
        state.status = state.qr ? 'qr_ready' : 'connecting';
        addLog('⚡ [Baileys-Core] Conectando con WhatsApp...');
      }

      if (connection === 'open') {
        state.status = 'connected';
        state.qr = '';
        state.qrDataUrl = '';
        state.reconnecting = false;
        setConnectedPhone(socket.user?.id);
        state.device = socket.user?.name || 'Snack Roque POS - Baileys Real';
        addLog(`🟢 [Baileys-Core] Conectado como ${state.phone || socket.user?.id || 'WhatsApp'}`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        state.socket = null;
        state.qr = '';
        state.qrDataUrl = '';
        addLog(`🔴 [Baileys-Core] Conexión cerrada por WhatsApp. Código: ${statusCode || 'sin código'}`);

        if (statusCode === DisconnectReason.loggedOut) {
          state.status = 'disconnected';
          state.phone = '';
          addLog('🔴 [Baileys-Core] Sesión cerrada desde WhatsApp. Debes vincular de nuevo.');
        } else {
          scheduleReconnect(String(statusCode || 'network'));
        }
      }
    });

    addLog(`🔑 [Baileys-Core] Usando Baileys ${version.join('.')}`);
  } catch (error: any) {
    state.status = 'disconnected';
    state.socket = null;
    addLog(`❌ [Baileys-Core] Error al iniciar: ${error.message}`);
  } finally {
    state.starting = false;
  }

  return getWhatsAppStatus();
}

export async function disconnectWhatsAppGateway() {
  try {
    if (state.socket) {
      await state.socket.logout();
      state.socket.end(undefined);
    }
    await clearSupabaseAuthState();
  } catch (error: any) {
    addLog(`❌ [Baileys-Core] Error al cerrar sesión: ${error.message}`);
  }

  state.socket = null;
  state.status = 'disconnected';
  state.qr = '';
  state.qrDataUrl = '';
  state.phone = '';
  state.device = '';
  addLog('🔴 [Baileys-Core] Gateway desvinculado');

  return getWhatsAppStatus();
}

export async function sendWhatsAppMessage(phone: string, message: string, documentBase64?: string, fileName?: string) {
  if (!state.socket || state.status !== 'connected') {
    throw new Error('WhatsApp no está conectado. Vincula el gateway antes de enviar.');
  }

  const jid = normalizePhone(phone);
  let result;

  if (documentBase64 && fileName) {
    const buffer = Buffer.from(documentBase64, 'base64');
    result = await state.socket.sendMessage(jid, { 
      document: buffer, 
      mimetype: 'application/pdf', 
      fileName: fileName,
      caption: message 
    });
    addLog(`📤 [Baileys-Out] Mensaje con PDF enviado a ${phone}`);
  } else {
    result = await state.socket.sendMessage(jid, { text: message });
    addLog(`📤 [Baileys-Out] Mensaje de texto enviado a ${phone}`);
  }

  return result;
}

export function getWhatsAppStatus() {
  return {
    connected: state.status === 'connected',
    status: state.status,
    qrDataUrl: state.qrDataUrl,
    phone: state.phone,
    device: state.device,
    logs: state.logs
  };
}
