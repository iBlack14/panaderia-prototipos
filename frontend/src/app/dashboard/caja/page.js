"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function ControlCajaPage() {
  const { cashSession, cashHistory, openCashSession, closeCashSession } = useApp();
  
  const [openingAmount, setOpeningAmount] = useState('100.00');
  const [closingAmount, setClosingAmount] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);

  const handleOpenCaja = (e) => {
    e.preventDefault();
    const amt = parseFloat(openingAmount);
    if (isNaN(amt) || amt < 0) return;
    openCashSession(amt);
  };

  const handleCloseCaja = (e) => {
    e.preventDefault();
    const amt = parseFloat(closingAmount);
    if (isNaN(amt) || amt < 0) return;
    closeCashSession(amt);
    setShowCloseModal(false);
    setClosingAmount('');
  };

  // Cálculos dinámicos si la caja está abierta
  const expectedCash = cashSession 
    ? (cashSession.tot_saldo_inicial + cashSession.tot_ventas_efectivo) 
    : 0;

  const totalInDrawer = cashSession 
    ? (cashSession.tot_saldo_inicial + cashSession.tot_ventas_efectivo + cashSession.tot_ventas_otros) 
    : 0;

  return (
    <div className="screen active">
      {/* 1. CAJA CERRADA: FORMULARIO DE APERTURA */}
      {!cashSession ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="panel" style={{ width: '480px', maxWidth: '100%', textAlign: 'center', border: '1.5px solid var(--border2)' }}>
            <span className="ci-em" style={{ fontSize: '48px', marginBottom: '10px' }}>💰</span>
            <h3 style={{ fontFamily: 'DM Serif Display', fontSize: '22px', color: 'var(--text)', marginBottom: '8px' }}>
              Apertura de Estación de Caja
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
              Para poder registrar ventas en el POS, debes establecer el saldo inicial en efectivo para el cambio (sencillo).
            </p>

            <form onSubmit={handleOpenCaja}>
              <div className="inp-group" style={{ textAlign: 'left' }}>
                <label>Monto Inicial en Efectivo (S/.)</label>
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

              <button type="submit" className="btn-enter" style={{ marginTop: '10px' }}>
                🟢 Abrir Caja y Habilitar Ventas
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* 2. CAJA ABIERTA: INDICADORES EN TIEMPO REAL */
        <div>
          <div className="stats-4" style={{ marginBottom: '18px' }}>
            <div className="stat-tile" style={{ padding: '16px 20px' }}>
              <div className="st-lbl" style={{ fontSize: '10px' }}>Saldo Inicial (Apertura)</div>
              <div className="st-val" style={{ fontSize: '24px', color: 'var(--text-2)' }}>
                S/. {cashSession.tot_saldo_inicial.toFixed(2)}
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

          {/* ACTIVE SESSION MANAGEMENT VIEW */}
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', background: 'var(--bg-card2)', border: '1.5px solid var(--border2)' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.8px' }}>
                ● Turno Abierto y Operativo
              </span>
              <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '4px' }}>
                Abierto a las <strong>{cashSession.fec_apertura}</strong> por el cajero <strong>{cashSession.cajero}</strong>
              </div>
            </div>
            <button className="btn-sell" onClick={() => setShowCloseModal(true)} style={{ width: '180px', margin: 0, background: 'linear-gradient(135deg, var(--red), #8E1F14)', boxShadow: '0 4px 14px rgba(192,72,58,0.3)' }}>
              🔴 Realizar Cierre
            </button>
          </div>
        </div>
      )}

      {/* 3. HISTORIAL DE CIERRES */}
      <div className="panel">
        <div className="p-title">Historial de Turnos y Cierres de Caja</div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Fecha</th>
              <th style={{ textAlign: 'left' }}>Cajero</th>
              <th style={{ textAlign: 'left' }}>Apertura</th>
              <th style={{ textAlign: 'left' }}>Cierre</th>
              <th style={{ textAlign: 'left' }}>Saldo Inicial</th>
              <th style={{ textAlign: 'left' }}>Ventas Efec.</th>
              <th style={{ textAlign: 'left' }}>Monto Final</th>
              <th style={{ textAlign: 'left' }}>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {cashHistory.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)', fontWeight: '600' }}>
                  Aún no hay turnos cerrados en el historial.
                </td>
              </tr>
            ) : (
              cashHistory.map((h, idx) => (
                <tr key={h.id || idx}>
                  <td>{h.date}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text)' }}>{h.cajero}</td>
                  <td><span className="tag tg-blue">{h.fec_apertura}</span></td>
                  <td><span className="tag tg-blue">{h.fec_cierre}</span></td>
                  <td>S/. {parseFloat(h.monto_inicial).toFixed(2)}</td>
                  <td>S/. {parseFloat(h.ventas_efectivo).toFixed(2)}</td>
                  <td style={{ fontWeight: '700', color: 'var(--text)' }}>S/. {parseFloat(h.monto_final).toFixed(2)}</td>
                  <td style={{ fontWeight: '800', color: h.diferencia >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {h.diferencia > 0 ? `+S/. ${h.diferencia.toFixed(2)} (Sobra)` : h.diferencia < 0 ? `-S/. ${Math.abs(h.diferencia).toFixed(2)} (Falta)` : 'S/. 0.00'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CIERRE DE CAJA MODAL */}
      {showCloseModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '450px' }}>
            <span className="mc-icon">🔒</span>
            <div className="mc-title">Arqueo y Cierre de Caja</div>
            <p className="mc-sub">Registra el efectivo contado en gaveta</p>

            <div style={{ background: 'var(--bg-card2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '18px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monto inicial de apertura:</span>
                <strong>S/. {cashSession?.tot_saldo_inicial.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Ventas en efectivo hoy:</span>
                <strong>+S/. {cashSession?.tot_ventas_efectivo.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>
                <span>Efectivo esperado en gaveta:</span>
                <span style={{ color: 'var(--green)' }}>S/. {expectedCash.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseCaja}>
              <div className="inp-group" style={{ textAlign: 'left' }}>
                <label>Efectivo Físico Contado (S/.)</label>
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
