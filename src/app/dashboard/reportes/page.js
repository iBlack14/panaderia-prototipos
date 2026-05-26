"use client";

import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';

export default function ReportesEstadisticasPage() {
  const { sales } = useApp();

  const reportMetrics = useMemo(() => {
    const hasSales = sales.length > 0;
    
    // Cálculos reactivos
    const tv = sales.reduce((a, b) => a + b.total, 0);
    const tr = sales.length;
    const un = sales.reduce((a, b) => a + b.items.reduce((acc, i) => acc + i.qty, 0), 0);
    const av = tr > 0 ? (tv / tr) : 0;

    // Métricas
    const tvStr = hasSales ? `S/. ${tv.toFixed(2)}` : 'S/. 5,284.00';
    const trStr = hasSales ? tr : '214';
    const unStr = hasSales ? un : '863';
    const avStr = hasSales ? `S/. ${av.toFixed(2)}` : 'S/. 24.69';

    // Historial
    let historyList = [];
    if (hasSales) {
      historyList = [...sales].reverse();
    } else {
      historyList = [
        { id: 1, n: 538, d: 'Lun 14/05', cajero: 'Carlos Mendoza', method: 'Efectivo', total: 22.00, itemsStr: 'Pan de yema ×4, Alfajor ×2', status: 'Pagado' },
        { id: 2, n: 539, d: 'Lun 14/05', cajero: 'María Sánchez', method: 'Yape', total: 57.50, itemsStr: 'Torta ×1, Croissant ×3', status: 'Pagado' },
        { id: 3, n: 540, d: 'Mar 15/05', cajero: 'Carlos Mendoza', method: 'Tarjeta', total: 38.00, itemsStr: 'Empanada ×6, Café ×2', status: 'Pagado' },
        { id: 4, n: 541, d: 'Mar 15/05', cajero: 'María Sánchez', method: 'Efectivo', total: 31.00, itemsStr: 'Queque ×2, Pan especial ×5', status: 'Pagado' },
        { id: 5, n: 542, d: 'Mié 16/05', cajero: 'Carlos Mendoza', method: 'Plin', total: 16.00, itemsStr: 'Bizcocho ×8', status: 'Pendiente' }
      ];
    }

    return {
      tvStr,
      trStr,
      unStr,
      avStr,
      historyList
    };
  }, [sales]);

  return (
    <div className="screen active">
      {/* KPIs ROW */}
      <div className="stats-4" style={{ marginBottom: '18px' }}>
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-lav">💰</div>
            <div className="st-delta d-up">↑ 8%</div>
          </div>
          <div className="st-val">{reportMetrics.tvStr}</div>
          <div className="st-lbl">Ventas registradas</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-blush">🛒</div>
            <div className="st-delta d-up">↑ 3%</div>
          </div>
          <div className="st-val">{reportMetrics.trStr}</div>
          <div className="st-lbl">Transacciones</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-peach">📦</div>
            <div className="st-delta d-up">↑ 11%</div>
          </div>
          <div className="st-val">{reportMetrics.unStr}</div>
          <div className="st-lbl">Unidades vendidas</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-mint">💳</div>
            <div className="st-delta d-up">↑ 5%</div>
          </div>
          <div className="st-val">{reportMetrics.avStr}</div>
          <div className="st-lbl">Ticket Promedio</div>
        </div>
      </div>

      {/* GRAPH + TOP PRODUCTS RANKING */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', marginBottom: '16px' }}>
        
        {/* CHART PANEL */}
        <div className="panel">
          <div className="p-title">
            <span>Ventas por Día — Semana Actual</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ padding: '4px 14px', borderRadius: '20px', border: '1.5px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)', fontFamily: 'sans-serif', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                Semana
              </button>
              <button style={{ padding: '4px 14px', borderRadius: '20px', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-3)', fontFamily: 'sans-serif', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                Mes
              </button>
            </div>
          </div>
          
          <div className="chart-wrap">
            <div className="bc"><div className="bbar" style={{ height: '58%' }}></div><span className="blbl">Lun</span></div>
            <div className="bc"><div className="bbar" style={{ height: '72%' }}></div><span className="blbl">Mar</span></div>
            <div className="bc"><div className="bbar" style={{ height: '61%' }}></div><span className="blbl">Mié</span></div>
            <div className="bc"><div className="bbar" style={{ height: '90%' }}></div><span className="blbl">Jue</span></div>
            <div className="bc"><div className="bbar" style={{ height: '100%' }}></div><span className="blbl">Vie</span></div>
            <div className="bc"><div className="bbar" style={{ height: '85%', background: 'linear-gradient(180deg,#A5B4FC,var(--accent))', opacity: 0.9 }}></div><span className="blbl">Sáb</span></div>
            <div className="bc"><div className="bbar" style={{ height: '42%', opacity: 0.4 }}></div><span className="blbl">Dom</span></div>
          </div>
          
          {/* Day labels with values */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '10px' }}>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>S/. 640</div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>S/. 795</div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>S/. 672</div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>S/. 990</div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>S/. 1,102</div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>S/. 938</div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>S/. 147</div>
          </div>
        </div>

        {/* RANKING PANEL */}
        <div className="panel">
          <div className="p-title" style={{ fontSize: '14px' }}>🥇 Ranking Semanal</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '13px', fontWeight: '800', color: 'white', justifyContent: 'center' }}>1</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Croissant</div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>278 unidades</div></div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--green)' }}>S/. 695</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '13px', fontWeight: '800', color: 'var(--text-2)', justifyContent: 'center' }}>2</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Pan especial</div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>196 unidades</div></div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--green)' }}>S/. 490</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '13px', fontWeight: '800', color: 'var(--text-2)', justifyContent: 'center' }}>3</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Torta chocolate</div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>142 unidades</div></div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--green)' }}>S/. 638</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '13px', fontWeight: '800', color: 'var(--text-2)', justifyContent: 'center' }}>4</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Empanada</div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>118 unidades</div></div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--green)' }}>S/. 414</div>
            </div>
          </div>
        </div>

      </div>

      {/* TRANSACTION LOG HISTORY */}
      <div className="panel">
        <div className="p-title">Historial Completo de Transacciones</div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Boleta</th>
              <th style={{ textAlign: 'left' }}>Fecha y Hora</th>
              <th style={{ textAlign: 'left' }}>Productos Detalle</th>
              <th style={{ textAlign: 'left' }}>Cajero</th>
              <th style={{ textAlign: 'left' }}>Método de Pago</th>
              <th style={{ textAlign: 'left' }}>Total</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {reportMetrics.historyList.map((h, idx) => (
              <tr key={h.id || idx}>
                <td><strong style={{ color: 'var(--accent)' }}>#B-{h.n}</strong></td>
                <td>{h.d} {h.t}</td>
                <td style={{ color: 'var(--text-2)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.itemsStr || h.items.map(item => `${item.name} x${item.qty}`).join(', ')}
                </td>
                <td>{h.cajero}</td>
                <td><span className="tag tg-blue">{h.method}</span></td>
                <td style={{ fontWeight: '800', color: 'var(--green)' }}>S/. {parseFloat(h.total).toFixed(2)}</td>
                <td>
                  <span className={`tag ${h.status === 'Pendiente' ? 'tg-warn' : 'tg-ok'}`}>
                    {h.status || 'Pagado'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
