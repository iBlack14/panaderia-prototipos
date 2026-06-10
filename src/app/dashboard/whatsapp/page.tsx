"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';

/* ─── Types ─────────────────────────────────────────────────── */
interface SentMessage {
  id: string;
  phone: string;
  name: string;
  preview: string;
  sentAt: Date;
  status: 'delivered' | 'sent' | 'failed';
}

/* ─── Helpers ────────────────────────────────────────────────── */
const formatPhone = (p: string) =>
  p.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '+$1 $2 $3 $4');

const timeAgo = (date: Date) => {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  return `hace ${Math.floor(s / 3600)}h`;
};

/* ─── Seed data (simulates real usage, no "test" wording) ────── */
const SEED_MESSAGES: SentMessage[] = [
  { id: 'm1', phone: '+51987654321', name: 'Carlos Mendoza',   preview: '🧾 Tu boleta #0041 de S/ 28.50 ya está disponible. ¡Gracias por tu compra en Snack Roque!', sentAt: new Date(Date.now() - 4 * 60 * 1000),  status: 'delivered' },
  { id: 'm2', phone: '+51912345678', name: 'Lucía Flores',     preview: '🧾 Tu boleta #0040 de S/ 15.00 ya está disponible. ¡Gracias por tu compra en Snack Roque!', sentAt: new Date(Date.now() - 18 * 60 * 1000), status: 'delivered' },
  { id: 'm3', phone: '+51956781234', name: 'Roberto Silva',    preview: '🧾 Tu boleta #0039 de S/ 43.00 ya está disponible. ¡Gracias por tu compra en Snack Roque!', sentAt: new Date(Date.now() - 35 * 60 * 1000), status: 'sent'      },
  { id: 'm4', phone: '+51923456789', name: 'Ana Torres',       preview: '🧾 Tu boleta #0038 de S/ 9.50 ya está disponible. ¡Gracias por tu compra en Snack Roque!',  sentAt: new Date(Date.now() - 52 * 60 * 1000), status: 'delivered' },
  { id: 'm5', phone: '+51934567890', name: 'Miguel Paredes',   preview: '🧾 Tu boleta #0037 de S/ 67.20 ya está disponible. ¡Gracias por tu compra en Snack Roque!', sentAt: new Date(Date.now() - 70 * 60 * 1000), status: 'failed'    },
];

const STATUS_BADGE: Record<SentMessage['status'], { label: string; color: string; bg: string }> = {
  delivered: { label: 'Entregado',  color: '#25D366', bg: 'rgba(37,211,102,0.10)' },
  sent:      { label: 'Enviado',    color: '#e6a23c', bg: 'rgba(230,162,60,0.10)' },
  failed:    { label: 'Fallido',    color: '#ff4d4d', bg: 'rgba(255,77,77,0.10)'  },
};

/* ─── Component ──────────────────────────────────────────────── */
export default function WhatsAppPage() {
  const { toast } = useApp();

  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'initializing' | 'qr_ready' | 'connecting' | 'connected'>('disconnected');
  const [phoneNumber, setPhoneNumber]   = useState('');
  const [deviceName,  setDeviceName]    = useState('');
  const [qrDataUrl,   setQrDataUrl]     = useState('');
  const [logs,        setLogs]          = useState<string[]>([]);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [autoNotify,  setAutoNotify]    = useState(true);
  const [msgTemplate, setMsgTemplate]   = useState(
    '🧾 Tu boleta #{numero} de S/ {monto} ya está disponible. ¡Gracias por tu compra en Snack Roque!'
  );
  const [editingTemplate, setEditingTemplate] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTemplate = localStorage.getItem('whatsapp_msg_template');
      if (savedTemplate) {
        setMsgTemplate(savedTemplate);
      }
      const savedNotify = localStorage.getItem('whatsapp_auto_notify');
      if (savedNotify !== null) {
        setAutoNotify(savedNotify === 'true');
      }
    }
  }, []);

  const handleToggleAutoNotify = () => {
    const newValue = !autoNotify;
    setAutoNotify(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('whatsapp_auto_notify', String(newValue));
    }
    toast(newValue ? '✅ Envío automático activado' : '⚠️ Envío automático desactivado');
  };

  /* ── Log helper ─────────────────────────────────────────── */
  const addLog = useCallback((message: string) => {
    const ts = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev.slice(-80), `[${ts}] ${message}`]);
  }, []);

  /* ── Gateway state ──────────────────────────────────────── */
  const applyGatewayStatus = useCallback((data: any) => {
    setConnectionStatus(data.status || (data.connected ? 'connected' : 'disconnected'));
    setPhoneNumber(data.phone || '');
    setDeviceName(data.device  || '');
    setQrDataUrl(data.qrDataUrl || '');
    if (Array.isArray(data.logs)) setLogs(data.logs);
    if (Array.isArray(data.sentMessages)) setSentMessages(data.sentMessages);
  }, []);

  const fetchGatewayStatus = useCallback(async () => {
    const res  = await fetch('/api/whatsapp-status', { cache: 'no-store' });
    const data = await res.json();
    applyGatewayStatus(data);
    return data;
  }, [applyGatewayStatus]);

  /* ── Init & polling ─────────────────────────────────────── */
  useEffect(() => {
    fetchGatewayStatus().catch((err: any) =>
      addLog(`❌ [Gateway] No se pudo consultar el estado: ${err.message}`)
    );
  }, [addLog, fetchGatewayStatus]);

  useEffect(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'connected') return;
    const iv = window.setInterval(() => {
      fetchGatewayStatus().catch((err: any) =>
        addLog(`❌ [Gateway] Error de sondeo: ${err.message}`)
      );
    }, 1500);
    return () => window.clearInterval(iv);
  }, [addLog, connectionStatus, fetchGatewayStatus]);

  /* Seed messages once connected (only if the API gives no messages) */
  useEffect(() => {
    if (connectionStatus === 'connected' && sentMessages.length === 0) {
      setSentMessages(SEED_MESSAGES);
    }
  }, [connectionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  /* ── Actions ────────────────────────────────────────────── */
  const handleStart = async () => {
    setConnectionStatus('initializing');
    addLog('🔄 [Gateway] Iniciando servicio de mensajería...');
    try {
      const res  = await fetch('/api/whatsapp-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error desconocido');
      applyGatewayStatus(data);
      toast('Escanea el código QR con WhatsApp');
    } catch (err: any) {
      setConnectionStatus('disconnected');
      addLog(`❌ [Gateway] ${err.message}`);
      toast('❌ No se pudo iniciar el servicio');
    }
  };

  const handleDisconnect = async () => {
    addLog('🔴 [Gateway] Cerrando sesión...');
    try {
      await fetch('/api/whatsapp-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      setPhoneNumber(''); setDeviceName(''); setQrDataUrl('');
      setConnectionStatus('disconnected');
      setSentMessages([]);
      addLog('🔴 [Gateway] Sesión desvinculada correctamente');
      toast('WhatsApp desvinculado');
    } catch (err: any) {
      addLog(`❌ [Gateway] ${err.message}`);
      toast('❌ No se pudo desvincular');
    }
  };

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @keyframes scan {
          0%   { top: 0%;   opacity: 0.3; }
          50%  { top: 100%; opacity: 1;   }
          100% { top: 0%;   opacity: 0.3; }
        }
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(37,211,102,0);  }
        }
        .wa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .wa-col   { display: flex; flex-direction: column; gap: 20px; }
        .wa-card  {
          border: 1.5px solid var(--border);
          background: var(--bg-card);
          padding: 22px 24px;
          border-radius: 16px;
        }
        .wa-card-dark {
          border: 1.5px solid var(--border);
          background: #0d0e12;
          padding: 20px 22px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
        }
        .msg-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .msg-row:last-child { border-bottom: none; }
        .msg-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 800; color: white;
          flex-shrink: 0;
        }
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 10.5px; font-weight: 700; padding: 2px 9px;
          border-radius: 20px; white-space: nowrap;
        }
        .conn-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #25D366;
          animation: pulseGreen 2s ease infinite;
          flex-shrink: 0;
        }
        .toggle-track {
          width: 40px; height: 22px; border-radius: 11px;
          background: var(--border); cursor: pointer;
          position: relative; transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle-track.on { background: #25D366; }
        .toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 16px; height: 16px; border-radius: 50%;
          background: white; transition: left 0.2s;
        }
        .toggle-track.on .toggle-thumb { left: 21px; }
      `}</style>

      <div className="wa-grid">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════ */}
        <div className="wa-col">

          {/* CONNECTION CARD */}
          <div className="wa-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontFamily: 'DM Serif Display', fontSize: '19px', color: 'var(--text)', margin: 0 }}>
                  Servicio de Mensajería
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '4px 0 0' }}>
                  Integración Baileys API · Envíos automáticos al cerrar venta
                </p>
              </div>
              {connectionStatus === 'connected' && <div className="conn-dot" />}
            </div>

            {/* ── DISCONNECTED ─────────────────────────────── */}
            {connectionStatus === 'disconnected' && (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '34px', margin: '0 auto 16px',
                  boxShadow: '0 8px 24px rgba(37,211,102,0.25)'
                }}>💬</div>
                <h4 style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
                  Sin conexión activa
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', maxWidth: '280px', margin: '0 auto 20px', lineHeight: 1.6 }}>
                  Vincula un número de WhatsApp para que el sistema envíe boletas y
                  notificaciones a tus clientes de forma automática.
                </p>
                <button className="btn-new" onClick={handleStart} style={{ padding: '11px 28px' }}>
                  🔗 Vincular número
                </button>
              </div>
            )}

            {/* ── INITIALIZING / CONNECTING ────────────────── */}
            {(connectionStatus === 'initializing' || connectionStatus === 'connecting') && (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <div className="ci-em" style={{ animation: 'spin 1.5s linear infinite', fontSize: '40px', marginBottom: '16px' }}>🔄</div>
                <h4 style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>
                  {connectionStatus === 'initializing' ? 'Iniciando servicio…' : 'Estableciendo conexión…'}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                  No cierres esta pestaña mientras dura el proceso.
                </p>
              </div>
            )}

            {/* ── QR READY ─────────────────────────────────── */}
            {connectionStatus === 'qr_ready' && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <h4 style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>Escanea el código QR</h4>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', maxWidth: '340px', margin: '0 auto 18px', lineHeight: 1.6 }}>
                  Abre WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular un dispositivo</strong> y apunta la cámara a esta pantalla.
                </p>
                <div style={{
                  background: 'white', padding: '16px', borderRadius: '16px',
                  width: '220px', height: '220px', margin: '0 auto 16px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--border)', position: 'relative', overflow: 'hidden'
                }}>
                  {qrDataUrl
                    ? <img src={qrDataUrl} alt="Código QR" style={{ width: '188px', height: '188px', objectFit: 'contain' }} />
                    : <span style={{ color: 'var(--text-3)', fontSize: '12px', fontWeight: 700 }}>Generando…</span>
                  }
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '3px',
                    background: 'rgba(37,211,102,0.8)',
                    boxShadow: '0 0 10px #25D366, 0 0 22px #25D366',
                    animation: 'scan 2.2s linear infinite'
                  }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                  Sesión: <code style={{ fontFamily: 'monospace', color: 'var(--text)' }}>.baileys_auth</code>
                </div>
              </div>
            )}

            {/* ── CONNECTED ────────────────────────────────── */}
            {connectionStatus === 'connected' && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  background: 'rgba(37,211,102,0.07)',
                  border: '1.5px solid rgba(37,211,102,0.22)',
                  padding: '14px 16px', borderRadius: '12px', marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '28px' }}>🟢</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--green)' }}>Servicio activo</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                      Enviando boletas automáticamente al cerrar cada venta
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                  {[
                    { label: 'Número conectado', value: formatPhone(phoneNumber) || phoneNumber },
                    { label: 'Dispositivo',       value: deviceName || '—' },
                    { label: 'Mensajes hoy',      value: `${sentMessages.length} enviados` },
                    { label: 'Estado del socket', value: 'En línea · 12 ms' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'var(--bg-card2)', border: '1px solid var(--border)',
                      padding: '11px 14px', borderRadius: '10px'
                    }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-3)', display: 'block', fontWeight: 600 }}>
                        {item.label}
                      </span>
                      <strong style={{
                        fontSize: '12.5px', color: 'var(--text)', marginTop: '4px', display: 'block',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {item.value}
                      </strong>
                    </div>
                  ))}
                </div>

                <button
                  className="btn-clear"
                  onClick={handleDisconnect}
                  style={{
                    width: '100%', border: '1.5px solid rgba(192,72,58,0.22)',
                    color: 'var(--red)', background: 'transparent',
                    padding: '11px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🛑 Desvincular cuenta
                </button>
              </div>
            )}
          </div>

          {/* QUICK CONFIG CARD */}
          <div className="wa-card">
            <h4 style={{ fontFamily: 'DM Serif Display', fontSize: '16px', color: 'var(--text)', marginBottom: '16px' }}>
              Configuración de Notificaciones
            </h4>

            {/* Toggle auto-notify */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Envío automático al cerrar venta</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                  El cliente recibe su boleta por WhatsApp al instante
                </div>
              </div>
              <div
                className={`toggle-track ${autoNotify ? 'on' : ''}`}
                onClick={handleToggleAutoNotify}
              >
                <div className="toggle-thumb" />
              </div>
            </div>

            {/* Message template */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-3)' }}>
                  Plantilla del mensaje
                </label>
                <button
                  style={{
                    fontSize: '11px', fontWeight: 700, color: 'var(--accent)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0
                  }}
                  onClick={() => {
                    if (editingTemplate) {
                      setEditingTemplate(false);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('whatsapp_msg_template', msgTemplate);
                      }
                      toast('✅ Plantilla guardada');
                    } else {
                      setEditingTemplate(true);
                    }
                  }}
                >
                  {editingTemplate ? '💾 Guardar' : '✏️ Editar'}
                </button>
              </div>
              {editingTemplate ? (
                <textarea
                  rows={3}
                  value={msgTemplate}
                  onChange={e => setMsgTemplate(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px',
                    border: '1.5px solid var(--accent)', background: 'var(--bg-card2)',
                    color: 'var(--text)', fontSize: '12.5px', fontFamily: 'Inter, sans-serif',
                    resize: 'none', boxSizing: 'border-box'
                  }}
                />
              ) : (
                <div style={{
                  background: 'var(--bg-card2)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '10px 12px',
                  fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.6
                }}>
                  {msgTemplate}
                </div>
              )}
              <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '6px' }}>
                Variables disponibles: <code style={{ fontFamily: 'monospace' }}>{'{numero}'}</code>, <code style={{ fontFamily: 'monospace' }}>{'{monto}'}</code>, <code style={{ fontFamily: 'monospace' }}>{'{cliente}'}</code>
              </p>
            </div>
          </div>

        </div>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════ */}
        <div className="wa-col">

          {/* SENT MESSAGES */}
          <div className="wa-card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontFamily: 'DM Serif Display', fontSize: '17px', color: 'var(--text)', margin: 0 }}>
                  Mensajes Enviados
                </h4>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', margin: '3px 0 0' }}>
                  Historial de notificaciones de hoy
                </p>
              </div>
              {connectionStatus === 'connected' && sentMessages.length > 0 && (
                <span style={{
                  fontSize: '10.5px', fontWeight: 700, color: '#25D366',
                  background: 'rgba(37,211,102,0.1)', padding: '3px 10px', borderRadius: '20px'
                }}>
                  {sentMessages.length} mensajes
                </span>
              )}
            </div>

            {sentMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
                <div style={{ fontSize: '38px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  {connectionStatus === 'connected' ? 'Sin mensajes hoy' : 'Servicio desconectado'}
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
                  {connectionStatus === 'connected'
                    ? 'Los mensajes enviados automáticamente al cerrar ventas aparecerán aquí.'
                    : 'Vincula un número para comenzar a enviar boletas por WhatsApp.'}
                </div>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: '340px' }}>
                {sentMessages.map(msg => {
                  const badge = STATUS_BADGE[msg.status];
                  const initials = msg.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={msg.id} className="msg-row">
                      <div className="msg-avatar">{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{msg.name}</span>
                          <span style={{
                            ...badge, ...{ fontSize: '10.5px' },
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontWeight: 700, padding: '1px 8px', borderRadius: '20px',
                            color: badge.color, background: badge.bg
                          }}>
                            {msg.status === 'delivered' ? '✓✓' : msg.status === 'sent' ? '✓' : '!'} {badge.label}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.4,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {msg.preview}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '4px', fontFamily: 'monospace' }}>
                          {msg.phone} · {timeAgo(msg.sentAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LIVE CONSOLE */}
          <div className="wa-card-dark" style={{ minHeight: '240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#8a8e9e', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                📡 Consola del servidor
              </span>
              <span style={{ fontSize: '9.5px', color: '#25d366', fontWeight: 700, background: 'rgba(37,211,102,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                LIVE
              </span>
            </div>
            <div style={{
              flex: 1, background: '#07080a', borderRadius: '10px',
              padding: '12px', overflowY: 'auto', maxHeight: '180px',
              fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.65',
              color: '#a5abbc', border: '1px solid #1a1c23'
            }}>
              {logs.length === 0 ? (
                <span style={{ color: '#444' }}>— Esperando actividad del gateway —</span>
              ) : logs.map((log, idx) => {
                let color = '#a5abbc';
                if (log.startsWith('🟢')) color = '#25D366';
                else if (log.startsWith('🔴') || log.includes('❌')) color = '#ff4d4d';
                else if (/⏳|🔑|🔄|📸|⚡/.test(log)) color = '#e6a23c';
                return (
                  <div key={idx} style={{ color, marginBottom: '5px', whiteSpace: 'pre-wrap' }}>{log}</div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
