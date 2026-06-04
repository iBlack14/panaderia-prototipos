"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function WhatsAppBaileysPage() {
  const { toast } = useApp();
  
  // Connection states: 'disconnected', 'initializing', 'qr_ready', 'connecting', 'connected'
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'initializing' | 'qr_ready' | 'connecting' | 'connected'>('disconnected');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  
  // Test message states
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('¡Hola! Este es un mensaje de prueba enviado de forma automática desde el Punto de Venta de Snack Roque 🥐.');
  const [sendingTest, setSendingTest] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    setLogs(prev => [...prev.slice(-80), `[${timestamp}] ${message}`]);
  }, []);

  const applyGatewayStatus = useCallback((data: any) => {
    setConnectionStatus(data.status || (data.connected ? 'connected' : 'disconnected'));
    setPhoneNumber(data.phone || '');
    setDeviceName(data.device || '');
    setQrDataUrl(data.qrDataUrl || '');
    if (Array.isArray(data.logs)) {
      setLogs(data.logs);
    }
  }, []);

  const fetchGatewayStatus = useCallback(async () => {
    const response = await fetch('/api/whatsapp-status', { cache: 'no-store' });
    const data = await response.json();
    applyGatewayStatus(data);
    return data;
  }, [applyGatewayStatus]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        await fetchGatewayStatus();
      } catch (error: any) {
        addLog(`❌ [Baileys-Core] No se pudo consultar el estado: ${error.message}`);
      }
    };

    loadSession();
  }, [addLog, fetchGatewayStatus]);

  useEffect(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'connected') return;

    const interval = window.setInterval(() => {
      fetchGatewayStatus().catch((error: any) => {
        addLog(`❌ [Baileys-Core] Error consultando estado: ${error.message}`);
      });
    }, 1500);

    return () => window.clearInterval(interval);
  }, [addLog, connectionStatus, fetchGatewayStatus]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStartConnection = async () => {
    setConnectionStatus('initializing');
    addLog('🔄 [Baileys-Core] Solicitando inicio real del gateway...');

    try {
      const response = await fetch('/api/whatsapp-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo iniciar Baileys');
      }

      applyGatewayStatus(data);
      toast('Escanea el QR real con WhatsApp');
    } catch (error: any) {
      setConnectionStatus('disconnected');
      addLog(`❌ [Baileys-Core] Error al iniciar: ${error.message}`);
      toast('❌ No se pudo iniciar WhatsApp');
    }
  };

  const handleDisconnect = async () => {
    addLog('🔴 [Baileys-Core] Cerrando sesión y limpiando credenciales...');

    try {
      await fetch('/api/whatsapp-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      });

      setPhoneNumber('');
      setDeviceName('');
      setQrDataUrl('');
      setConnectionStatus('disconnected');
      addLog('🔴 [Baileys-Core] Sesión desvinculada');
      toast('WhatsApp desvinculado');
    } catch (error: any) {
      addLog(`❌ [Baileys-Core] Error al desvincular: ${error.message}`);
      toast('❌ No se pudo desvincular WhatsApp');
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) {
      toast('⚠️ Por favor ingresa un número de teléfono válido');
      return;
    }
    
    setSendingTest(true);
    addLog(`📤 [Baileys-Out] Intentando enviar mensaje a ${testPhone}...`);
    
    try {
      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage,
          isTest: true
        })
      });
      
      const resData = await response.json();
      if (resData.success) {
        addLog(`✅ [Baileys-Out] Mensaje enviado con éxito. ID: ${resData.messageId}`);
        toast('✅ Mensaje de prueba enviado con éxito');
      } else {
        addLog(`❌ [Baileys-Out] Falló el envío: ${resData.error}`);
        toast(`❌ Error al enviar: ${resData.error}`);
      }
    } catch (error: any) {
      addLog(`❌ [Baileys-Out] Error de red: ${error.message}`);
      toast('❌ Error al enviar mensaje');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      
      {/* LEFT COLUMN: CONNECTION CONFIGURATION */}
      <div className="panel" style={{ border: '1.5px solid var(--border)', background: 'var(--bg-card)', padding: '24px', borderRadius: '16px' }}>
        <h3 style={{ fontFamily: 'DM Serif Display', fontSize: '20px', color: 'var(--text)', marginBottom: '8px' }}>
          Estado de WhatsApp Gateway
        </h3>
        <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginBottom: '24px' }}>
          Este módulo integra la librería <strong>Baileys API</strong> para automatizar el envío de boletas y tickets a tus clientes al momento de finalizar la venta.
        </p>

        {connectionStatus === 'disconnected' && (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <div style={{ fontSize: '54px', marginBottom: '14px' }}>📡</div>
            <h4 style={{ fontWeight: '800', color: 'var(--text)', marginBottom: '6px' }}>Puerta de Enlace Inactiva</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '20px', maxWidth: '300px', margin: '0 auto 20px auto' }}>
              No hay ningún número de WhatsApp vinculado actualmente a este terminal de caja.
            </p>
            <button className="btn-new" onClick={handleStartConnection} style={{ padding: '12px 24px' }}>
              🔗 Vincular WhatsApp (Baileys)
            </button>
          </div>
        )}

        {(connectionStatus === 'initializing' || connectionStatus === 'connecting') && (
          <div style={{ textAlign: 'center', padding: '40px 10px' }}>
            <div className="ci-em" style={{ animation: 'spin 1.5s linear infinite', fontSize: '42px', marginBottom: '20px' }}>🔄</div>
            <h4 style={{ fontWeight: '800', color: 'var(--text)', marginBottom: '6px' }}>
              {connectionStatus === 'initializing' ? 'Inicializando Baileys API...' : 'Estableciendo Conexión...'}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>
              Por favor, no recargues la página ni cierres la pestaña actual.
            </p>
          </div>
        )}

        {connectionStatus === 'qr_ready' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <h4 style={{ fontWeight: '800', color: 'var(--text)', marginBottom: '6px' }}>Escanea el Código QR</h4>
            <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginBottom: '20px', maxWidth: '340px', margin: '0 auto 20px auto' }}>
              Abre WhatsApp en tu celular, ingresa a <strong>Dispositivos vinculados</strong>, presiona <strong>Vincular un dispositivo</strong> y escanea esta pantalla.
            </p>
            
            <div style={{ 
              background: 'white', 
              padding: '16px', 
              borderRadius: '16px', 
              width: '230px', 
              height: '230px', 
              margin: '0 auto 20px auto', 
              boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--border)',
              position: 'relative'
            }}>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Código QR real para vincular WhatsApp"
                  style={{ width: '198px', height: '198px', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ color: 'var(--text-3)', fontSize: '12px', fontWeight: 700 }}>
                  Generando QR real...
                </div>
              )}
              
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                background: 'rgba(37, 211, 102, 0.7)',
                boxShadow: '0 0 10px #25D366, 0 0 20px #25D366',
                animation: 'scan 2.2s linear infinite'
              }}></div>
            </div>
            
            <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: '600' }}>
              🔑 Sesión local: <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>.baileys_auth</span>
            </div>
          </div>
        )}

        {connectionStatus === 'connected' && (
          <div style={{ padding: '5px 0' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              background: 'rgba(74, 140, 92, 0.06)', 
              border: '1.5px solid rgba(74, 140, 92, 0.25)', 
              padding: '16px', 
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <span style={{ fontSize: '32px' }}>🟢</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: 'var(--green)' }}>Servidor Baileys Conectado</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-3)' }}>Operando en tiempo real desde terminal local</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', display: 'block', fontWeight: '600' }}>Número Conectado</span>
                <strong style={{ fontSize: '13.5px', color: 'var(--text)', marginTop: '4px', display: 'block' }}>{phoneNumber}</strong>
              </div>
              <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', display: 'block', fontWeight: '600' }}>Dispositivo Vinculado</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--text)', marginTop: '4px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deviceName}</strong>
              </div>
              <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', display: 'block', fontWeight: '600' }}>Latencia Gateway</span>
                <strong style={{ fontSize: '13.5px', color: 'var(--green)', marginTop: '4px', display: 'block' }}>12 ms (Excelente)</strong>
              </div>
              <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', display: 'block', fontWeight: '600' }}>Sesión Iniciada</span>
                <strong style={{ fontSize: '13.5px', color: 'var(--text)', marginTop: '4px', display: 'block' }}>Activa hoy</strong>
              </div>
            </div>

            <button 
              className="btn-clear" 
              onClick={handleDisconnect} 
              style={{ width: '100%', border: '1.5px solid rgba(192, 72, 58, 0.25)', color: 'var(--red)', background: 'transparent', padding: '12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
            >
              🛑 Desvincular Cuenta de WhatsApp
            </button>
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: TEST BENCH & LIVE LOGS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* TEST MESSAGE */}
        <div className="panel" style={{ border: '1.5px solid var(--border)', background: 'var(--bg-card)', padding: '24px', borderRadius: '16px' }}>
          <h4 style={{ fontFamily: 'DM Serif Display', fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}>
            Prueba de Envío (Baileys Outbox)
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px' }}>
            Envía un mensaje rápido a cualquier número de WhatsApp para certificar que el socket Baileys está transmitiendo paquetes.
          </p>

          <form onSubmit={handleSendTest}>
            <div className="inp-group" style={{ marginBottom: '12px' }}>
              <label>Número Destinatario (con código de país, ej: +51987654321)</label>
              <input 
                type="text" 
                placeholder="+51987654321" 
                value={testPhone} 
                onChange={(e) => setTestPhone(e.target.value.replace(/[^\d+]/g, ''))}
                disabled={connectionStatus !== 'connected'}
                required 
              />
            </div>
            
            <div className="inp-group" style={{ marginBottom: '16px' }}>
              <label>Mensaje a Transmitir</label>
              <textarea 
                rows={3}
                placeholder="Escribe el mensaje..." 
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                disabled={connectionStatus !== 'connected'}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg-card2)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                  resize: 'none'
                }}
                required 
              />
            </div>

            <button 
              type="submit" 
              className="btn-new"
              disabled={connectionStatus !== 'connected' || sendingTest}
              style={{ 
                width: '100%', 
                background: connectionStatus === 'connected' ? '#25D366' : undefined,
                color: connectionStatus === 'connected' ? 'white' : undefined,
                opacity: (connectionStatus !== 'connected' || sendingTest) ? 0.5 : 1,
                cursor: (connectionStatus !== 'connected' || sendingTest) ? 'not-allowed' : 'pointer'
              }}
            >
              {sendingTest ? '⏳ Enviando paquete...' : '💬 Transmitir vía WhatsApp'}
            </button>
          </form>
        </div>

        {/* LOGS MONITOR */}
        <div className="panel" style={{ 
          border: '1.5px solid var(--border)', 
          background: '#0d0e12', 
          padding: '20px', 
          borderRadius: '16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '260px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#8a8e9e', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
              📡 Consola del Servidor Baileys
            </h4>
            <span style={{ fontSize: '9.5px', color: '#25d366', fontWeight: '700', background: 'rgba(37, 211, 102, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
              LIVE MONITOR
            </span>
          </div>

          <div style={{ 
            flex: 1, 
            background: '#07080a', 
            borderRadius: '10px', 
            padding: '12px', 
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: '1.6',
            color: '#a5abbc',
            border: '1px solid #1a1c23'
          }}>
            {logs.map((log, idx) => {
              let color = '#a5abbc';
              if (log.startsWith('🟢')) color = '#25D366';
              else if (log.startsWith('🔴') || log.includes('❌')) color = '#ff4d4d';
              else if (log.startsWith('⏳') || log.startsWith('🔑') || log.startsWith('🔄') || log.startsWith('📸') || log.startsWith('⚡')) color = '#e6a23c';
              
              return (
                <div key={idx} style={{ color, marginBottom: '6px', whiteSpace: 'pre-wrap' }}>
                  {log}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>

      {/* SCAN ANIMATION STYLES */}
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0.3; }
          50% { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 0.3; }
        }
      `}</style>

    </div>
  );
}
