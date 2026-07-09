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
import { addBaileysLog, baileysState, getWhatsAppStatus } from './baileys-state';

export { getWhatsAppStatus } from './baileys-state';

const logger = pino({ level: 'silent' });
const AUTH_TABLE = 'whatsapp_baileys_auth';

const state = baileysState;

function addLog(message: string) {
  addBaileysLog(message);
}

function asSocket(value: unknown): WASocket | null {
  return (value as WASocket | null) ?? null;
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
    if (state.status === 'disconnected') {
      addLog('🚫 [Baileys-Core] Reconexión cancelada porque el gateway está desvinculado/desconectado.');
      return;
    }
    await startWhatsAppGateway();
  }, 3000);
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

async function getBaileysVersion(): Promise<[number, number, number]> {
  const fallbackVersion: [number, number, number] = [2, 3000, 1035194821];
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 3000)
    );
    const fetchPromise = (async () => {
      const { version } = await fetchLatestBaileysVersion();
      return version;
    })();
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch {
    return fallbackVersion;
  }
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

  // Safe cleanup of the old socket to prevent connection loops
  if (state.socket) {
    const oldSocket = asSocket(state.socket);
    state.socket = null;
    try {
      oldSocket?.ev.removeAllListeners('connection.update');
      oldSocket?.ev.removeAllListeners('creds.update');
      oldSocket?.end(undefined);
    } catch {
      // Ignore cleanup errors
    }
  }

  addLog('🔄 [Baileys-Core] Inicializando socket real...');

  try {
    const { state: authState, saveCreds } = await getSupabaseAuthState();
    const version = await getBaileysVersion();

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

    socket.ev.on('creds.update', () => {
      if (state.socket === socket) {
        saveCreds().catch((err) => {
          addLog(`❌ [Baileys-Core] Error al guardar credenciales en BD: ${err.message}`);
        });
      }
    });

    socket.ev.on('connection.update', async (update) => {
      if (state.socket !== socket) {
        return;
      }

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

        const isLoggedOut = statusCode === DisconnectReason.loggedOut ||
                            statusCode === 401 ||
                            statusCode === 400 ||
                            statusCode === 403;

        if (isLoggedOut) {
          state.status = 'disconnected';
          state.phone = '';
          state.device = '';
          addLog('🔴 [Baileys-Core] Sesión cerrada desde WhatsApp. Debes vincular de nuevo.');
          clearSupabaseAuthState().catch((err) => {
            addLog(`❌ [Baileys-Core] Error al limpiar sesión inválida en BD: ${err.message}`);
          });
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
      const oldSocket = asSocket(state.socket);
      state.socket = null;
      try {
        oldSocket?.ev.removeAllListeners('connection.update');
        oldSocket?.ev.removeAllListeners('creds.update');
        await oldSocket?.logout();
        oldSocket?.end(undefined);
      } catch {
        // ignore
      }
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
  const socket = asSocket(state.socket);
  if (!socket || state.status !== 'connected') {
    throw new Error('WhatsApp no está conectado. Vincula el gateway antes de enviar.');
  }

  const jid = normalizePhone(phone);
  let result;

  if (documentBase64 && fileName) {
    const buffer = Buffer.from(documentBase64, 'base64');
    result = await socket.sendMessage(jid, {
      document: buffer,
      mimetype: 'application/pdf',
      fileName: fileName,
      caption: message
    });
    addLog(`📤 [Baileys-Out] Mensaje con PDF enviado a ${phone}`);
  } else {
    result = await socket.sendMessage(jid, { text: message });
    addLog(`📤 [Baileys-Out] Mensaje de texto enviado a ${phone}`);
  }

  return result;
}
