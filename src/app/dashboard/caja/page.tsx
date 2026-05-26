"use client";

import React, { useState, useMemo } from 'react';
import { useApp, CashHistoryRecord } from '@/context/AppContext';

export default function ControlCajaPage() {
  const { cashSession, cashHistory, openCashSession, closeCashSession, user, usersList } = useApp();
  
  const [openingAmount, setOpeningAmount] = useState('100.00');
  const [closingAmount, setClosingAmount] = useState('');
  const [selectedShift, setSelectedShift] = useState('Mañana');
  const [observaciones, setObservaciones] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Admin filter states
  const [reportTimeframe, setReportTimeframe] = useState<'diario' | 'mensual'>('diario');
  const [selectedCajeroFilter, setSelectedCajeroFilter] = useState('Todos');

  const handleOpenCaja = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(openingAmount);
    if (isNaN(amt) || amt < 0) return;
    openCashSession(amt, selectedShift);
  };

  const handleCloseCaja = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(closingAmount);
    if (isNaN(amt) || amt < 0) return;
    closeCashSession(amt, observaciones);
    setShowCloseModal(false);
    setClosingAmount('');
    setObservaciones('');
  };

  // Cálculos dinámicos si la caja está abierta
  const expectedCash = cashSession 
    ? (cashSession.tot_saldo_inicial + cashSession.tot_ventas_efectivo) 
    : 0;

  // --- REPORTE DE AUDITORÍA MULTITURNO (ADMINISTRADOR) ---
  const auditReports = useMemo(() => {
    // Si no hay historial real, creamos un set de datos históricos profesionales agrupados para simular
    const defaultHistory: CashHistoryRecord[] = [
      { id: 101, date: '25/05/2026', cajero: 'Carlos Mendoza', turno: 'Mañana', fec_apertura: '06:00', fec_cierre: '14:02', monto_inicial: 100, monto_final: 420, ventas_efectivo: 320, ventas_otros: 180, diferencia: 0, estado: 'cerrado', observaciones: 'Cuadre perfecto. Sin novedades.' },
      { id: 102, date: '25/05/2026', cajero: 'María Sánchez', turno: 'Tarde', fec_apertura: '14:15', fec_cierre: '22:05', monto_inicial: 150, monto_final: 685, ventas_efectivo: 540, ventas_otros: 310, diferencia: -5, estado: 'cerrado', observaciones: 'Faltaron S/. 5.00 en gaveta. Posible error al dar vuelto en hora punta.' },
      { id: 103, date: '24/05/2026', cajero: 'Carlos Mendoza', turno: 'Mañana', fec_apertura: '06:00', fec_cierre: '14:00', monto_inicial: 100, monto_final: 395, ventas_efectivo: 290, ventas_otros: 120, diferencia: 5, estado: 'cerrado', observaciones: 'Sobraron S/. 5.00. Cliente se retiró antes de recibir su sencillo completo.' },
      { id: 104, date: '24/05/2026', cajero: 'María Sánchez', turno: 'Tarde', fec_apertura: '14:05', fec_cierre: '22:00', monto_inicial: 100, monto_final: 710, ventas_efectivo: 610, ventas_otros: 280, diferencia: 0, estado: 'cerrado', observaciones: 'Cierre del día cuadrado.' }
    ];

    const finalHistory = cashHistory.length > 0 ? cashHistory : defaultHistory;

    // Métricas por cajero
    const cajeroMetrics: Record<string, { totalVendido: number; discrepanciaTotal: number; turnosOperados: number }> = {};
    // Métricas por turno
    const shiftMetrics: Record<string, { totalVendido: number; transacciones: number }> = {
      'Mañana': { totalVendido: 0, transacciones: 0 },
      'Tarde': { totalVendido: 0, transacciones: 0 },
      'Noche': { totalVendido: 0, transacciones: 0 }
    };

    finalHistory.forEach(h => {
      const cajero = h.cajero || 'Desconocido';
      const turno = h.turno || 'Mañana';
      const ventaTotal = h.ventas_efectivo + h.ventas_otros;
      const disc = h.diferencia || 0;

      // Por Cajero
      if (!cajeroMetrics[cajero]) {
        cajeroMetrics[cajero] = { totalVendido: 0, discrepanciaTotal: 0, turnosOperados: 0 };
      }
      cajeroMetrics[cajero].totalVendido += ventaTotal;
      cajeroMetrics[cajero].discrepanciaTotal += disc;
      cajeroMetrics[cajero].turnosOperados += 1;

      // Por Turno
      if (shiftMetrics[turno]) {
        shiftMetrics[turno].totalVendido += ventaTotal;
        shiftMetrics[turno].transacciones += 1;
      }
    });

    return {
      history: finalHistory,
      cajeroMetrics,
      shiftMetrics
    };
  }, [cashHistory]);

  const isAdmin = user?.rs?.includes('Administrador');

  return (
    <div className="screen active">
      {/* 1. SECCIÓN DE CAJA CERRADA: APERTURA PROFESIONAL */}
      {!cashSession ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <div className="panel" style={{ width: '540px', maxWidth: '100%', border: '1.5px solid var(--border2)', borderRadius: '16px', background: 'var(--bg-card)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span className="ci-em" style={{ fontSize: '56px', display: 'block', marginBottom: '8px' }}>💰</span>
              <h3 style={{ fontFamily: 'DM Serif Display', fontSize: '24px', color: 'var(--text)', marginBottom: '8px' }}>
                Apertura de Estación de Caja
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
                Configura el turno y saldo inicial para comenzar las operaciones del POS.
              </p>
            </div>

            <form onSubmit={handleOpenCaja}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div className="inp-group">
                  <label>Turno Operativo</label>
                  <select 
                    value={selectedShift} 
                    onChange={(e) => setSelectedShift(e.target.value)}
                    style={{ padding: '10px', fontSize: '13px', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    <option value="Mañana">🌅 Mañana (06:00 - 14:00)</option>
                    <option value="Tarde">🌆 Tarde (14:00 - 22:00)</option>
                    <option value="Noche">🌃 Noche (22:00 - 06:00)</option>
                  </select>
                </div>

                <div className="inp-group">
                  <label>Cajero Responsable</label>
                  <div className="inp-wrap" style={{ opacity: 0.85 }}>
                    <input 
                      type="text" 
                      value={user ? user.n : 'Carlos Mendoza'} 
                      disabled 
                      style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-2)', border: '1.5px solid var(--border)' }}
                    />
                  </div>
                </div>
              </div>

              <div className="inp-group">
                <label>Saldo Inicial en Gaveta (Efectivo para Sencillo)</label>
                <div className="inp-wrap">
                  <span className="inp-icon">💵</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-enter" style={{ marginTop: '16px', background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
                🟢 Abrir Caja y Habilitar Ventas
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* 2. SECCIÓN DE CAJA ABIERTA: INDICADORES EN TIEMPO REAL */
        <div>
          <div className="stats-4" style={{ marginBottom: '18px' }}>
            <div className="stat-tile" style={{ padding: '16px 20px' }}>
              <div className="st-lbl" style={{ fontSize: '10px' }}>Saldo Inicial (Apertura)</div>
              <div className="st-val" style={{ fontSize: '24px', color: 'var(--text-2)' }}>
                S/. {cashSession.tot_saldo_inicial.toFixed(2)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '700', marginTop: '4px' }}>
                🌅 Turno: {cashSession.turno || 'Mañana'}
              </div>
            </div>
            
            <div className="stat-tile" style={{ padding: '16px 20px' }}>
              <div className="st-lbl" style={{ fontSize: '10px' }}>Ventas Efectivo</div>
              <div className="st-val" style={{ fontSize: '24px', color: 'var(--text-2)' }}>
                S/. {cashSession.tot_ventas_efectivo.toFixed(2)}
              </div>
            </div>

            <div className="stat-tile" style={{ padding: '16px 20px' }}>
              <div className="st-lbl" style={{ fontSize: '10px' }}>Otros Medios (Yape/Card/etc.)</div>
              <div className="st-val" style={{ fontSize: '24px', color: 'var(--text-2)' }}>
                S/. {cashSession.tot_ventas_otros.toFixed(2)}
              </div>
            </div>

            <div className="stat-tile" style={{ padding: '16px 20px' }}>
              <div className="st-lbl" style={{ fontSize: '10px', color: 'var(--green)' }}>Total en Caja (Esperado)</div>
              <div className="st-val" style={{ fontSize: '24px', color: 'var(--green)', fontWeight: '800' }}>
                S/. {expectedCash.toFixed(2)}
              </div>
            </div>
          </div>

          {/* CONTROL ACTIVO DE TURNO */}
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', background: 'var(--bg-card2)', border: '1.5px solid var(--border2)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.8px' }}>
                ● Turno de Caja Operativo
              </span>
              <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '4px' }}>
                Operado en turno <strong>{cashSession.turno || 'Mañana'}</strong> por el cajero <strong>{cashSession.cajero}</strong> desde las <strong>{typeof cashSession.fec_apertura === 'string' ? cashSession.fec_apertura : cashSession.fec_apertura.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
            </div>
            <button className="btn-sell" onClick={() => setShowCloseModal(true)} style={{ width: '180px', margin: 0, background: 'linear-gradient(135deg, var(--red), #8E1F14)', boxShadow: '0 4px 14px rgba(192,72,58,0.3)' }}>
              🔴 Realizar Arqueo y Cierre
            </button>
          </div>
        </div>
      )}

      {/* --- PANEL DE AUDITORÍA CORPORATIVA (VISTA DE ADMINISTRADOR) --- */}
      {isAdmin && (
        <div className="panel" style={{ marginBottom: '24px', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <div>
                <h4 style={{ margin: 0, fontFamily: 'DM Serif Display', fontSize: '18px', color: 'var(--text)' }}>Auditoría Analítica de Cajeros y Turnos</h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)' }}>Reporte consolidado del flujo de ventas y discrepancias del personal</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={() => setReportTimeframe('diario')} 
                style={{ padding: '5px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '12px', border: '1px solid var(--border)', background: reportTimeframe === 'diario' ? 'var(--accent-bg)' : 'transparent', color: reportTimeframe === 'diario' ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}
              >
                Diario (Último Día)
              </button>
              <button 
                onClick={() => setReportTimeframe('mensual')} 
                style={{ padding: '5px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '12px', border: '1px solid var(--border)', background: reportTimeframe === 'mensual' ? 'var(--accent-bg)' : 'transparent', color: reportTimeframe === 'mensual' ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}
              >
                Mensual Acumulado
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Rendimiento por Cajero */}
            <div style={{ borderRight: '1px solid var(--border)', paddingRight: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                🧑‍💼 Flujo de Ventas por Colaborador ({reportTimeframe === 'diario' ? 'Hoy' : 'Este Mes'})
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.keys(auditReports.cajeroMetrics).map((cajero) => {
                  const m = auditReports.cajeroMetrics[cajero];
                  const factor = reportTimeframe === 'diario' ? 0.35 : 1; // Simulación mensual vs diaria
                  const totalVentas = m.totalVendido * factor;
                  const totalDisc = m.discrepanciaTotal * factor;
                  const isPerfect = totalDisc === 0;
                  
                  return (
                    <div key={cajero} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-card2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: '800', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                          {cajero[0].toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: '12.5px', color: 'var(--text)' }}>{cajero}</strong>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '2px' }}>
                            {m.turnosOperados} turnos controlados
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', color: 'var(--green)', fontSize: '13px' }}>
                          S/. {totalVentas.toFixed(2)}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: isPerfect ? 'var(--text-3)' : totalDisc > 0 ? 'var(--green)' : 'var(--red)' }}>
                          {isPerfect ? 'Perfecto (Cuadrado)' : totalDisc > 0 ? `+S/. ${totalDisc.toFixed(2)} (Sobra)` : `-S/. ${Math.abs(totalDisc).toFixed(2)} (Falta)`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rendimiento por Turno */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                🌅 Rendimiento Comparativo por Turno
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                {Object.keys(auditReports.shiftMetrics).map((turno) => {
                  const m = auditReports.shiftMetrics[turno];
                  const factor = reportTimeframe === 'diario' ? 0.35 : 1;
                  const totalVendido = m.totalVendido * factor;
                  
                  // Emojis y colores por turno
                  const shiftMeta: Record<string, { emoji: string; color: string; pct: number }> = {
                    'Mañana': { emoji: '🌅', color: 'var(--accent)', pct: 65 },
                    'Tarde': { emoji: '🌆', color: 'var(--green)', pct: 85 },
                    'Noche': { emoji: '🌃', color: 'var(--blue)', pct: 35 }
                  };
                  const meta = shiftMeta[turno] || { emoji: '⏰', color: 'var(--text-3)', pct: 40 };

                  return (
                    <div key={turno} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text)' }}>
                          {meta.emoji} Turno {turno}
                        </span>
                        <strong style={{ color: 'var(--text)' }}>
                          S/. {totalVendido.toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg)', borderRadius: '3px', width: '100%' }}>
                        <div style={{ height: '100%', width: `${meta.pct}%`, background: meta.color, borderRadius: '3px', transition: 'width 0.5s' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Auditoria Express info footer */}
              <div style={{ marginTop: '16px', background: 'rgba(79,70,229,0.03)', border: '1.5px dashed var(--accent)', padding: '10px', borderRadius: '10px', fontSize: '11px', color: 'var(--text-2)', lineHeight: '1.4' }}>
                💡 <strong>Consejo del Administrador:</strong> El turno <strong>Tarde</strong> sigue acumulando el mayor flujo de ventas digitales por QR. Se recomienda asegurar que el cartel QR esté visible y limpio en dicho horario.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. HISTORIAL DE TURNOS Y CIERRES DE CAJA */}
      <div className="panel">
        <div className="p-title">Bitácora de Cierres y Auditoría de Caja</div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Fecha</th>
              <th style={{ textAlign: 'left' }}>Cajero / Operador</th>
              <th style={{ textAlign: 'left' }}>Turno</th>
              <th style={{ textAlign: 'left' }}>Monto Inicial</th>
              <th style={{ textAlign: 'left' }}>Ventas Efec.</th>
              <th style={{ textAlign: 'left' }}>Monto Final</th>
              <th style={{ textAlign: 'left' }}>Diferencia</th>
              <th style={{ textAlign: 'left' }}>Notas de Arqueo / Justificación</th>
            </tr>
          </thead>
          <tbody>
            {auditReports.history.map((h, idx) => {
              const diff = h.diferencia !== undefined ? h.diferencia : 0;
              const isPerfect = diff === 0;
              const shiftEmoji = h.turno === 'Mañana' ? '🌅' : h.turno === 'Tarde' ? '🌆' : '🌃';
              
              return (
                <tr key={h.id || idx}>
                  <td style={{ fontSize: '12px' }}>{h.date}</td>
                  <td style={{ fontWeight: '700', color: 'var(--text)', fontSize: '12.5px' }}>{h.cajero}</td>
                  <td>
                    <span className="tag tg-blue" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                      {shiftEmoji} {h.turno || 'Mañana'}
                    </span>
                  </td>
                  <td>S/. {h.monto_inicial.toFixed(2)}</td>
                  <td>S/. {h.ventas_efectivo.toFixed(2)}</td>
                  <td style={{ fontWeight: '700', color: 'var(--text)' }}>S/. {h.monto_final.toFixed(2)}</td>
                  <td>
                    <span className={`tag ${isPerfect ? 'tg-ok' : diff > 0 ? 'tg-ok' : 'tg-err'}`} style={{ fontWeight: '800' }}>
                      {isPerfect ? 'Cuadrado' : diff > 0 ? `+S/. ${diff.toFixed(2)}` : `-S/. ${Math.abs(diff).toFixed(2)}`}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: '11px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.observaciones || 'Sin comentarios registrados.'}>
                    {h.observaciones || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CIERRE DE CAJA / ARQUEO MODAL */}
      {showCloseModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '480px' }}>
            <span className="mc-icon">🔒</span>
            <div className="mc-title">Arqueo y Cierre de Turno</div>
            <p className="mc-sub">Verifica los montos y justifica el cuadre del turno</p>

            <div style={{ background: 'var(--bg-card2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Turno Activo:</span>
                <strong style={{ color: 'var(--accent)' }}>🌅 {cashSession?.turno || 'Mañana'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cajero Responsable:</span>
                <strong>{cashSession?.cajero}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                <span>Monto Apertura (Efectivo):</span>
                <strong>S/. {cashSession?.tot_saldo_inicial.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Ventas en efectivo registradas:</span>
                <strong>+S/. {cashSession?.tot_ventas_efectivo.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '13.5px', fontWeight: '700', color: 'var(--text)' }}>
                <span>Efectivo Esperado en Gaveta:</span>
                <span style={{ color: 'var(--green)' }}>S/. {expectedCash.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseCaja}>
              <div className="inp-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label>Efectivo Físico Contado en Gaveta (S/.)</label>
                <div className="inp-wrap">
                  <span className="inp-icon">💵</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="inp-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label>Observaciones de Cuadre / Auditoría</label>
                <textarea 
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Detalla cualquier novedad, diferencias detectadas o justificación del cuadre..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    background: 'var(--bg-card)',
                    color: 'var(--text)',
                    fontFamily: 'Inter, sans-serif',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <div className="mc-btns" style={{ marginTop: '20px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowCloseModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri" style={{ background: 'linear-gradient(135deg, var(--red), #8E1F14)' }}>
                  Confirmar y Cerrar Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
