"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useApp, CashHistoryRecord, DenominacionArqueo } from '@/context/AppContext';

interface CustomShift {
  id: string;
  name: string;
  start: string;
  end: string;
  emoji: string;
  color: string;
}

export default function ControlCajaPage() {
  const { cashSession, cashHistory, cashDrops, openCashSession, closeCashSession, registerCashDrop, user } = useApp();
  
  const [activeTab, setActiveTab] = useState<'operacion' | 'turnos'>('operacion');

  const [openingAmount, setOpeningAmount] = useState('100.00');
  const [closingAmount, setClosingAmount] = useState('');
  const [selectedShift, setSelectedShift] = useState('Mañana');
  const [observaciones, setObservaciones] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);

  // --- DENOMINACIONES STATE (for arqueo) ---
  const DENOM_BILLETES = [
    { key: 'b100', label: 'S/. 100', value: 100 },
    { key: 'b50',  label: 'S/. 50',  value: 50  },
    { key: 'b20',  label: 'S/. 20',  value: 20  },
    { key: 'b10',  label: 'S/. 10',  value: 10  },
  ] as const;
  const DENOM_MONEDAS = [
    { key: 'm5',   label: 'S/. 5',   value: 5   },
    { key: 'm2',   label: 'S/. 2',   value: 2   },
    { key: 'm1',   label: 'S/. 1',   value: 1   },
    { key: 'm050', label: 'S/. 0.50', value: 0.5 },
    { key: 'm020', label: 'S/. 0.20', value: 0.2 },
    { key: 'm010', label: 'S/. 0.10', value: 0.1 },
  ] as const;
  const emptyDenom = (): DenominacionArqueo => ({ b100:0, b50:0, b20:0, b10:0, m5:0, m2:0, m1:0, m050:0, m020:0, m010:0 });
  const [denom, setDenom] = useState<DenominacionArqueo>(emptyDenom());
  const [useDenomMode, setUseDenomMode] = useState(true);

  const denomTotal = useMemo(() => {
    return DENOM_BILLETES.reduce((a, d) => a + (denom[d.key] * d.value), 0)
      + DENOM_MONEDAS.reduce((a, d) => a + (denom[d.key] * d.value), 0);
  }, [denom]);

  // --- CASH DROP (RETIRO PARCIAL) STATE ---
  const [showDropModal, setShowDropModal] = useState(false);
  const [dropMonto, setDropMonto] = useState('');
  const [dropMotivo, setDropMotivo] = useState('');

  // Admin filter states
  const [reportTimeframe, setReportTimeframe] = useState<'diario' | 'mensual'>('diario');

  // --- LOCAL PERSISTED SHIFTS STATE ---
  const [shiftsList, setShiftsList] = useState<CustomShift[]>([]);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  // Shift Form States
  const [shiftName, setShiftName] = useState('');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('14:00');
  const [shiftEmoji, setShiftEmoji] = useState('🌅');
  const [shiftColor, setShiftColor] = useState('var(--accent)');

  useEffect(() => {
    const stored = localStorage.getItem('snack_custom_shifts_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      setShiftsList(parsed);
      if (parsed.length > 0) {
        setSelectedShift(parsed[0].id);
      }
    } else {
      const defaultShifts: CustomShift[] = [
        { id: 'Mañana', name: 'Mañana', start: '06:00', end: '14:00', emoji: '🌅', color: 'var(--accent)' },
        { id: 'Tarde', name: 'Tarde', start: '14:00', end: '22:00', emoji: '🌆', color: 'var(--green)' },
        { id: 'Noche', name: 'Noche', start: '22:00', end: '06:00', emoji: '🌃', color: 'var(--blue)' }
      ];
      setShiftsList(defaultShifts);
      localStorage.setItem('snack_custom_shifts_v1', JSON.stringify(defaultShifts));
      setSelectedShift('Mañana');
    }
  }, []);

  const saveShiftsToStorage = (updated: CustomShift[]) => {
    setShiftsList(updated);
    localStorage.setItem('snack_custom_shifts_v1', JSON.stringify(updated));
  };

  const handleOpenCaja = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(openingAmount);
    if (isNaN(amt) || amt < 0) return;
    openCashSession(amt, selectedShift);
  };

  const handleCloseCaja = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = useDenomMode ? denomTotal : parseFloat(closingAmount);
    if (isNaN(amt) || amt < 0) return;
    const denomToSave = useDenomMode ? denom : undefined;
    closeCashSession(amt, observaciones, denomToSave);
    setShowCloseModal(false);
    setClosingAmount('');
    setObservaciones('');
    setDenom(emptyDenom());
  };

  const handleDropSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(dropMonto);
    if (isNaN(amt) || amt <= 0 || !dropMotivo.trim()) return;
    registerCashDrop(amt, dropMotivo);
    setShowDropModal(false);
    setDropMonto('');
    setDropMotivo('');
  };

  // Shift Management Handlers
  const handleOpenNewShift = () => {
    setEditingShiftId(null);
    setShiftName('');
    setStartTime('08:00');
    setEndTime('16:00');
    setShiftEmoji('⏰');
    setShiftColor('var(--accent)');
    setShowShiftModal(true);
  };

  const handleOpenEditShift = (s: CustomShift) => {
    setEditingShiftId(s.id);
    setShiftName(s.name);
    setStartTime(s.start);
    setEndTime(s.end);
    setShiftEmoji(s.emoji);
    setShiftColor(s.color);
    setShowShiftModal(true);
  };

  const handleShiftFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim()) return;

    if (editingShiftId) {
      // Editar existente
      const updated = shiftsList.map(s => s.id === editingShiftId ? { ...s, name: shiftName, start: startTime, end: endTime, emoji: shiftEmoji, color: shiftColor } : s);
      saveShiftsToStorage(updated);
    } else {
      // Crear nuevo
      const newId = shiftName.trim().replace(/\s+/g, '');
      const newShift: CustomShift = {
        id: newId,
        name: shiftName,
        start: startTime,
        end: endTime,
        emoji: shiftEmoji,
        color: shiftColor
      };
      saveShiftsToStorage([...shiftsList, newShift]);
    }
    setShowShiftModal(false);
  };

  const handleDeleteShift = (id: string) => {
    const updated = shiftsList.filter(s => s.id !== id);
    saveShiftsToStorage(updated);
  };

  // Expected cash calculations if open
  const expectedCash = cashSession 
    ? (cashSession.tot_saldo_inicial + cashSession.tot_ventas_efectivo) 
    : 0;

  // --- REPORTE DE AUDITORÍA MULTITURNO (ADMINISTRADOR) ---
  const auditReports = useMemo(() => {
    const defaultHistory: CashHistoryRecord[] = [
      { id: 101, date: '25/05/2026', cajero: 'Carlos Mendoza', turno: 'Mañana', fec_apertura: '06:00', fec_cierre: '14:02', monto_inicial: 100, monto_final: 420, ventas_efectivo: 320, ventas_otros: 180, diferencia: 0, estado: 'cerrado', observaciones: 'Cuadre perfecto. Sin novedades.' },
      { id: 102, date: '25/05/2026', cajero: 'María Sánchez', turno: 'Tarde', fec_apertura: '14:15', fec_cierre: '22:05', monto_inicial: 150, monto_final: 685, ventas_efectivo: 540, ventas_otros: 310, diferencia: -5, estado: 'cerrado', observaciones: 'Faltaron S/. 5.00 en gaveta. Posible error al dar vuelto en hora punta.' },
      { id: 103, date: '24/05/2026', cajero: 'Carlos Mendoza', turno: 'Mañana', fec_apertura: '06:00', fec_cierre: '14:00', monto_inicial: 100, monto_final: 395, ventas_efectivo: 290, ventas_otros: 120, diferencia: 5, estado: 'cerrado', observaciones: 'Sobraron S/. 5.00. Cliente se retiró antes de recibir su sencillo completo.' },
      { id: 104, date: '24/05/2026', cajero: 'María Sánchez', turno: 'Tarde', fec_apertura: '14:05', fec_cierre: '22:00', monto_inicial: 100, monto_final: 710, ventas_efectivo: 610, ventas_otros: 280, diferencia: 0, estado: 'cerrado', observaciones: 'Cierre del día cuadrado.' }
    ];

    const finalHistory = cashHistory.length > 0 ? cashHistory : defaultHistory;

    // Métricas por cajero
    const cajeroMetrics: Record<string, { totalVendido: number; discrepanciaTotal: number; turnosOperados: number }> = {};
    
    // Métricas por turno (basadas dinámicamente en los turnos registrados)
    const shiftMetrics: Record<string, { totalVendido: number; transacciones: number }> = {};
    
    shiftsList.forEach(s => {
      shiftMetrics[s.id] = { totalVendido: 0, transacciones: 0 };
    });
    
    // Añadimos comodín para turnos administrativos
    shiftMetrics['Administrativo'] = { totalVendido: 0, transacciones: 0 };

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

      // Por Turno (dinámico)
      if (!shiftMetrics[turno]) {
        shiftMetrics[turno] = { totalVendido: 0, transacciones: 0 };
      }
      shiftMetrics[turno].totalVendido += ventaTotal;
      shiftMetrics[turno].transacciones += 1;
    });

    return {
      history: finalHistory,
      cajeroMetrics,
      shiftMetrics
    };
  }, [cashHistory, shiftsList]);

  const isAdmin = user?.rs?.includes('Administrador');

  return (
    <div className="screen active">
      {/* SEGMENTED TAB CONTROLLER */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-2)', padding: '4px', borderRadius: '999px', border: '1px solid var(--border)', width: 'fit-content', margin: '0 auto 24px auto' }}>
          <button 
            onClick={() => setActiveTab('operacion')} 
            style={{
              border: 'none',
              padding: '10px 24px',
              borderRadius: '999px',
              fontSize: '12.5px',
              fontWeight: '800',
              cursor: 'pointer',
              background: activeTab === 'operacion' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'operacion' ? 'var(--accent)' : 'var(--text-3)',
              boxShadow: activeTab === 'operacion' ? '0 4px 12px rgba(176,125,46,0.12)' : 'none',
              transition: 'all 0.22s var(--ease)'
            }}
          >
            💰 Control de Caja
          </button>
          <button 
            onClick={() => setActiveTab('turnos')} 
            style={{
              border: 'none',
              padding: '10px 24px',
              borderRadius: '999px',
              fontSize: '12.5px',
              fontWeight: '800',
              cursor: 'pointer',
              background: activeTab === 'turnos' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'turnos' ? 'var(--accent)' : 'var(--text-3)',
              boxShadow: activeTab === 'turnos' ? '0 4px 12px rgba(176,125,46,0.12)' : 'none',
              transition: 'all 0.22s var(--ease)'
            }}
          >
            ⏰ Configurar Turnos ({shiftsList.length})
          </button>
        </div>
      )}

      {activeTab === 'operacion' ? (
        <>
          {/* 1. SECCIÓN DE CAJA CERRADA: APERTURA PROFESIONAL */}
          {!cashSession ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
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
                        style={{ padding: '10px', fontSize: '13px', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', color: 'var(--text)', width: '100%', outline: 'none' }}
                      >
                        {shiftsList.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.emoji} {s.name} ({s.start} - {s.end})
                          </option>
                        ))}
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
                    Turno: {cashSession.turno || 'Mañana'}
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

              <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', background: 'var(--bg-card2)', border: '1.5px solid var(--border2)' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.8px' }}>
                    ● Turno de Caja Operativo
                  </span>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '4px' }}>
                    Turno <strong>{cashSession.turno || 'Mañana'}</strong> — Cajero <strong>{cashSession.cajero}</strong> desde las <strong>{typeof cashSession.fec_apertura === 'string' ? cashSession.fec_apertura : cashSession.fec_apertura.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowDropModal(true)}
                    style={{ padding: '10px 18px', fontWeight: '700', fontSize: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    💸 Retiro Parcial
                  </button>
                  <button className="btn-sell" onClick={() => setShowCloseModal(true)} style={{ width: '190px', margin: 0, background: 'linear-gradient(135deg, var(--red), #8E1F14)', boxShadow: '0 4px 14px rgba(192,72,58,0.3)' }}>
                    🔴 Arqueo y Cierre
                  </button>
                </div>
              </div>

              {/* RETIROS PARCIALES REGISTRADOS EN TURNO */}
              {cashDrops.filter(d => d.sessionId === cashSession.id).length > 0 && (
                <div className="panel" style={{ marginBottom: '20px', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>💸 Retiros Parciales de Este Turno</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {cashDrops.filter(d => d.sessionId === cashSession.id).map(drop => (
                      <div key={drop.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card2)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px' }}>
                        <div>
                          <strong style={{ color: 'var(--text)' }}>{drop.motivo}</strong>
                          <span style={{ marginLeft: '10px', color: 'var(--text-3)', fontSize: '11px' }}>{drop.hora} — {drop.cajero}</span>
                        </div>
                        <strong style={{ color: 'var(--red)', fontSize: '13px' }}>-S/. {drop.monto.toFixed(2)}</strong>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', fontWeight: '700', color: 'var(--text-2)', marginTop: '4px' }}>
                      Total Retirado: <span style={{ color: 'var(--red)', marginLeft: '8px' }}>-S/. {cashDrops.filter(d => d.sessionId === cashSession.id).reduce((a,b)=>a+b.monto,0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
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
                      const factor = reportTimeframe === 'diario' ? 0.35 : 1; 
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
                    🌅 Rendimiento Comparativo por Turno (Gráfico de Barras)
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                    {Object.keys(auditReports.shiftMetrics).map((turno) => {
                      const m = auditReports.shiftMetrics[turno];
                      const factor = reportTimeframe === 'diario' ? 0.35 : 1;
                      const totalVendido = m.totalVendido * factor;
                      
                      // Emojis y colores dinámicos por turno
                      const sObj = shiftsList.find(s => s.id === turno) || (turno === 'Administrativo' ? { emoji: '💼', color: '#4f46e5' } : { emoji: '⏰', color: 'var(--text-3)' });
                      
                      // Cálculo matemático real del porcentaje del gráfico
                      const maxVal = Math.max(...Object.values(auditReports.shiftMetrics).map(sm => sm.totalVendido * factor)) || 1;
                      const pct = Math.max(8, (totalVendido / maxVal) * 100);

                      return (
                        <div key={turno} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ fontWeight: '700', color: 'var(--text)' }}>
                              {sObj.emoji} Turno {turno}
                            </span>
                            <strong style={{ color: 'var(--text)' }}>
                              S/. {totalVendido.toFixed(2)}
                            </strong>
                          </div>
                          <div style={{ height: '6px', background: 'var(--bg)', borderRadius: '3px', width: '100%' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: sObj.color, borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: '16px', background: 'rgba(79,70,229,0.03)', border: '1.5px dashed var(--accent)', padding: '10px', borderRadius: '10px', fontSize: '11px', color: 'var(--text-2)', lineHeight: '1.4' }}>
                    💡 <strong>Consejo de Cuadre:</strong> Puedes configurar nuevos turnos operativos para tu personal en la pestaña de <strong>Configurar Turnos</strong> del panel superior.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. HISTORIAL DE TURNOS Y CIERRES DE CAJA */}
          <div className="panel" style={{ marginTop: '20px' }}>
            <div className="p-title">Bitácora de Cierres y Auditoría de Caja</div>
            
            <div className="table-wrap">
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
                    const matchedShift = shiftsList.find(s => s.id === h.turno);
                    const shiftEmoji = matchedShift ? matchedShift.emoji : (h.turno === 'Administrativo' ? '💼' : '🌅');
                    
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
          </div>
        </>
      ) : (
        <>
          {/* CONFIGURACIÓN DE TURNOS DILIGENTE */}
          <div className="tb-bar">
            <div>
              <h3 style={{ fontFamily: 'DM Serif Display', fontSize: '18px', color: 'var(--text)' }}>Turnos de Trabajo Configurados</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Define los horarios en los que tu equipo abre y cuadra la caja.</p>
            </div>
            <button className="btn-new" onClick={handleOpenNewShift}>+ Crear Nuevo Turno</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {shiftsList.map((s) => (
              <div 
                key={s.id} 
                className="panel" 
                style={{ 
                  padding: '20px', 
                  border: '1.5px solid var(--border)', 
                  background: 'var(--bg-card)', 
                  borderRadius: '16px',
                  boxShadow: '0 4px 15px rgba(46, 26, 10, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '32px' }}>{s.emoji}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Turno {s.name}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600' }}>ID: {s.id}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="act-btn" onClick={() => handleOpenEditShift(s)} title="Editar Turno">✏️</button>
                    <button className="act-btn del" onClick={() => handleDeleteShift(s.id)} title="Eliminar Turno">🗑️</button>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-card2)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)' }}>
                  <span>⏰ Horario:</span>
                  <strong>{s.start} - {s.end}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-3)' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.color, display: 'inline-block' }}></span>
                  Color de gráfico asignado
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* CIERRE DE CAJA / ARQUEO MODAL — CON DENOMINACIONES */}
      {showCloseModal && cashSession && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <span className="mc-icon">🔒</span>
            <div className="mc-title">Arqueo y Cierre de Turno</div>
            <p className="mc-sub">Cuenta el efectivo físico en gaveta para cuadrar el cierre</p>

            <div style={{ background: 'var(--bg-card2)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Turno:</span><strong style={{ color: 'var(--accent)' }}>{cashSession.turno || 'Mañana'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cajero:</span><strong>{cashSession.cajero}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}><span>Apertura:</span><strong>S/. {cashSession.tot_saldo_inicial.toFixed(2)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ventas Efectivo:</span><strong>+S/. {cashSession.tot_ventas_efectivo.toFixed(2)}</strong></div>
              {(cashSession.tot_retiros || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Retiros Parciales:</span><strong style={{ color: 'var(--red)' }}>-S/. {(cashSession.tot_retiros || 0).toFixed(2)}</strong></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', fontWeight: '800', fontSize: '13px' }}>
                <span>Esperado en Gaveta:</span>
                <span style={{ color: 'var(--green)' }}>S/. {expectedCash.toFixed(2)}</span>
              </div>
            </div>

            {/* Toggle Modo Denominacion vs Total Directo */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', background: 'var(--bg-2)', padding: '3px', borderRadius: '999px', width: 'fit-content' }}>
              <button
                type="button"
                onClick={() => setUseDenomMode(true)}
                style={{ padding: '5px 14px', fontSize: '11px', fontWeight: '700', borderRadius: '999px', border: 'none', background: useDenomMode ? 'var(--accent)' : 'transparent', color: useDenomMode ? '#fff' : 'var(--text-3)', cursor: 'pointer' }}
              >
                💵 Por Denominación
              </button>
              <button
                type="button"
                onClick={() => setUseDenomMode(false)}
                style={{ padding: '5px 14px', fontSize: '11px', fontWeight: '700', borderRadius: '999px', border: 'none', background: !useDenomMode ? 'var(--accent)' : 'transparent', color: !useDenomMode ? '#fff' : 'var(--text-3)', cursor: 'pointer' }}
              >
                ⌨️ Total Directo
              </button>
            </div>

            <form onSubmit={handleCloseCaja}>
              {useDenomMode ? (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Billetes</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    {DENOM_BILLETES.map(d => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-card2)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', minWidth: '48px' }}>{d.label}</span>
                        <input
                          type="number" min="0" step="1"
                          value={denom[d.key] || 0}
                          onChange={e => setDenom(prev => ({ ...prev, [d.key]: parseInt(e.target.value) || 0 }))}
                          style={{ width: '52px', textAlign: 'center', padding: '4px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', minWidth: '54px', textAlign: 'right' }}>= S/. {(denom[d.key] * d.value).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>Monedas</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    {DENOM_MONEDAS.map(d => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-card2)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-2)', minWidth: '48px' }}>{d.label}</span>
                        <input
                          type="number" min="0" step="1"
                          value={denom[d.key] || 0}
                          onChange={e => setDenom(prev => ({ ...prev, [d.key]: parseInt(e.target.value) || 0 }))}
                          style={{ width: '52px', textAlign: 'center', padding: '4px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', minWidth: '54px', textAlign: 'right' }}>= S/. {(denom[d.key] * d.value).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'var(--bg-card2)', padding: '12px 16px', borderRadius: '10px', border: '2px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px' }}>Total Contado:</span>
                    <strong style={{ fontSize: '18px', color: denomTotal >= expectedCash ? 'var(--green)' : 'var(--red)' }}>S/. {denomTotal.toFixed(2)}</strong>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11.5px', fontWeight: '700' }}>
                    Diferencia: <span style={{ color: (denomTotal - expectedCash) === 0 ? 'var(--text-3)' : (denomTotal - expectedCash) > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {(denomTotal - expectedCash) > 0 ? '+' : ''}{(denomTotal - expectedCash).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="inp-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                  <label>Efectivo Físico Contado (S/.)</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">💵</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={closingAmount}
                      onChange={e => setClosingAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="inp-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label>Observaciones de Cuadre / Auditoría</label>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Detalla cualquier novedad, diferencias detectadas o justificación del cuadre..."
                  rows={2}
                  style={{ width: '100%', padding: '10px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text)', fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none' }}
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

      {/* RETIRO PARCIAL MODAL */}
      {showDropModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '400px' }}>
            <span className="mc-icon">💸</span>
            <div className="mc-title">Retiro Parcial de Caja</div>
            <p className="mc-sub">El monto será descontado del flujo de efectivo del turno activo</p>
            <form onSubmit={handleDropSubmit}>
              <div className="inp-group" style={{ textAlign: 'left', marginBottom: '12px' }}>
                <label>Monto a Retirar (S/.)</label>
                <div className="inp-wrap">
                  <span className="inp-icon">💵</span>
                  <input type="number" step="0.01" min="0.01" value={dropMonto} onChange={e => setDropMonto(e.target.value)} placeholder="0.00" required />
                </div>
              </div>
              <div className="inp-group" style={{ textAlign: 'left', marginBottom: '12px' }}>
                <label>Motivo / Destino del Retiro</label>
                <input type="text" value={dropMotivo} onChange={e => setDropMotivo(e.target.value)} placeholder="Ej: Depósito a banca, pago de servicio, fondo..." required />
              </div>
              <div className="mc-btns" style={{ marginTop: '20px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowDropModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">Confirmar Retiro</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* --- SHIFT MANAGEMENT MODAL --- */}
      {showShiftModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '480px' }}>
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '16px' }}>
              {editingShiftId ? 'Configurar Turno' : 'Nuevo Turno Operativo'}
            </div>

            <form onSubmit={handleShiftFormSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div className="inp-group">
                  <label>Nombre del Turno</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Madrugada, Cierre, Especial" 
                    value={shiftName} 
                    onChange={(e) => setShiftName(e.target.value)} 
                    required 
                    disabled={!!editingShiftId}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="inp-group">
                    <label>Hora de Inicio</label>
                    <input 
                      type="time" 
                      value={startTime} 
                      onChange={(e) => setStartTime(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="inp-group">
                    <label>Hora de Fin</label>
                    <input 
                      type="time" 
                      value={endTime} 
                      onChange={(e) => setEndTime(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                  <div className="inp-group">
                    <label>Icono / Emoji</label>
                    <select value={shiftEmoji} onChange={(e) => setShiftEmoji(e.target.value)}>
                      <option value="🌅">🌅 Amanecer</option>
                      <option value="☀️">☀️ Sol / Día</option>
                      <option value="🌆">🌆 Tarde / Ocaso</option>
                      <option value="🌃">🌃 Noche</option>
                      <option value="🌙">🌙 Luna / Madrugada</option>
                      <option value="🥐">🥐 Panadería / Especial</option>
                      <option value="⏰">⏰ Reloj estándar</option>
                    </select>
                  </div>

                  <div className="inp-group">
                    <label>Color en Estadísticas</label>
                    <select value={shiftColor} onChange={(e) => setShiftColor(e.target.value)}>
                      <option value="var(--accent)">🤎 Trigo / Dorado</option>
                      <option value="var(--green)">💚 Verde Bosque</option>
                      <option value="var(--blue)">💙 Azul Cobalto</option>
                      <option value="var(--red)">❤️ Rojo Contraste</option>
                      <option value="#8b5cf6">💜 Púrpura</option>
                      <option value="#f59e0b">💛 Ámbar Brillante</option>
                    </select>
                  </div>
                </div>

              </div>

              <div className="mc-btns" style={{ marginTop: '24px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowShiftModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}>
                  {editingShiftId ? 'Guardar Cambios' : 'Crear Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
