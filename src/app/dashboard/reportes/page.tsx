"use client";

import React, { useMemo, useState } from 'react';
import { useApp, Sale } from '@/context/AppContext';
import { loadJsPDFAutoTable, loadSheetJS } from '@/lib/cdn';

export default function ReportesEstadisticasPage() {
  const { sales, toast } = useApp();

  const [txSearch, setTxSearch] = useState('');

  const reportMetrics = useMemo(() => {
    // Only active (non-annulled) sales count towards KPI statistics
    const activeSales = sales.filter(s => s.estado !== 0);
    const hasSales = activeSales.length > 0;

    const tv = activeSales.reduce((a, b) => a + b.total, 0);
    const tr = activeSales.length;
    const un = activeSales.reduce((a, b) => a + b.items.reduce((acc, i) => acc + i.qty, 0), 0);
    const av = tr > 0 ? tv / tr : 0;

    // Historial completo de ventas (incluye anuladas para auditoría en el listado)
    const historyList = [...sales].reverse().map(s => ({
      id: s.id,
      n: s.n,
      d: s.d,
      t: s.t,
      cajero: s.cajero,
      method: s.method,
      total: s.total,
      estado: s.estado,
      clienteId: s.clienteId,
      clienteNombre: s.clienteNombre,
      items: s.items.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, version: i.version })),
    }));

    // Ventas por día de la semana actual (Lun–Dom)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + mondayOffset + i);
      return d.toLocaleDateString();
    });
    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const weekTotals = weekDays.map(dateStr =>
      activeSales.filter(s => s.d === dateStr).reduce((a, b) => a + b.total, 0)
    );
    const maxWeekTotal = Math.max(...weekTotals, 1);

    // Ranking de productos (todas las ventas activas)
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    activeSales.forEach(s => {
      s.items.forEach(item => {
        if (!productMap[item.name]) {
          productMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        productMap[item.name].qty += item.qty;
        productMap[item.name].revenue += item.price * item.qty;
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);

    return {
      hasSales,
      tv, tr, un, av,
      historyList,
      weekTotals,
      weekDays,
      dayLabels,
      maxWeekTotal,
      topProducts,
    };
  }, [sales]);

  const filteredHistory = useMemo(() => {
    return reportMetrics.historyList.filter(h => {
      const searchLower = txSearch.toLowerCase();
      return (
        `b-${h.n}`.toLowerCase().includes(searchLower) ||
        h.cajero.toLowerCase().includes(searchLower) ||
        h.method.toLowerCase().includes(searchLower)
      );
    });
  }, [reportMetrics.historyList, txSearch]);

  const exportToExcel = async () => {
    try {
      const XLSX = await loadSheetJS();
      const wb = XLSX.utils.book_new();
      
      const kpisData = [
        ['REPORTE DE VENTAS - SNACK ROQUE'],
        [`Fecha de Reporte: ${new Date().toLocaleString()}`],
        [],
        ['KPI', 'Valor'],
        ['Ventas Totales Activas (S/.)', reportMetrics.tv],
        ['Transacciones Activas', reportMetrics.tr],
        ['Unidades Vendidas Activas', reportMetrics.un],
        ['Ticket Promedio Activo (S/.)', reportMetrics.av]
      ];
      const wsKpis = XLSX.utils.aoa_to_sheet(kpisData);
      XLSX.utils.book_append_sheet(wb, wsKpis, 'Resumen KPIs');
      
      const txHeader = ['Boleta', 'Fecha y Hora', 'Productos', 'Cajero', 'Método Pago', 'Total (S/.)', 'Estado'];
      const txRows = reportMetrics.historyList.map(h => [
        `B-${h.n}`,
        `${h.d} ${h.t || ''}`,
        h.items.map(i => `${i.name} x${i.qty}`).join(', '),
        h.cajero,
        h.method,
        h.total,
        h.estado === 0 ? 'Anulado' : 'Pagado'
      ]);
      const wsTx = XLSX.utils.aoa_to_sheet([txHeader, ...txRows]);
      XLSX.utils.book_append_sheet(wb, wsTx, 'Transacciones');
      
      XLSX.writeFile(wb, `Reporte_Snack_Roque_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('📥 Reporte Excel descargado con éxito');
    } catch (err: any) {
      console.error(err);
      alert('Error al exportar Excel: ' + err.message);
    }
  };

  const exportToPdf = async () => {
    try {
      const jspdfModule = await loadJsPDFAutoTable();
      const { jsPDF } = jspdfModule;
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Reporte de Operaciones POS - Snack Roque', 14, 15);
      doc.setFontSize(10);
      doc.text(`Fecha del reporte: ${new Date().toLocaleString()}`, 14, 22);
      
      doc.setFillColor(245, 247, 250);
      doc.rect(14, 28, 182, 25, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen de Rendimiento (Ventas Activas):', 18, 34);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Ventas: S/. ${reportMetrics.tv.toFixed(2)}`, 18, 40);
      doc.text(`Transacciones: ${reportMetrics.tr}`, 18, 46);
      doc.text(`Unidades Vendidas: ${reportMetrics.un}`, 100, 40);
      doc.text(`Ticket Promedio: S/. ${reportMetrics.av.toFixed(2)}`, 100, 46);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Listado de Transacciones:', 14, 62);
      
      const tableHeaders = [['Boleta', 'Fecha y Hora', 'Productos', 'Cajero', 'Método', 'Total', 'Estado']];
      const tableRows = reportMetrics.historyList.map(h => [
        `B-${h.n}`,
        `${h.d} ${h.t || ''}`,
        h.items.map(i => `${i.name} x${i.qty}`).join(', '),
        h.cajero,
        h.method,
        `S/. ${h.total.toFixed(2)}`,
        h.estado === 0 ? 'Anulado' : 'Pagado'
      ]);
      
      (doc as any).autoTable({
        startY: 66,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [124, 106, 247] },
        columnStyles: {
          2: { cellWidth: 60 }
        }
      });
      
      doc.save(`Reporte_Snack_Roque_${new Date().toISOString().split('T')[0]}.pdf`);
      toast('📥 Reporte PDF descargado con éxito');
    } catch (err: any) {
      console.error(err);
      alert('Error al exportar PDF: ' + err.message);
    }
  };

  const rankColors = [
    'linear-gradient(135deg,#FBBF24,#F59E0B)',
    'var(--bg-card2)',
    'var(--bg-card2)',
    'var(--bg-card2)',
  ];

  return (
    <div className="screen active">
      {/* KPIs ROW */}
      <div className="stats-4" style={{ marginBottom: '18px' }}>
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-lav">💰</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>Total</div>
          </div>
          <div className="st-val">{reportMetrics.hasSales ? `S/. ${reportMetrics.tv.toFixed(2)}` : 'S/. 0.00'}</div>
          <div className="st-lbl">Ventas registradas</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-blush">🛒</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>Total</div>
          </div>
          <div className="st-val">{reportMetrics.tr}</div>
          <div className="st-lbl">Transacciones</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-peach">📦</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>Total</div>
          </div>
          <div className="st-val">{reportMetrics.un}</div>
          <div className="st-lbl">Unidades vendidas</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-mint">💳</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>Prom.</div>
          </div>
          <div className="st-val">{reportMetrics.hasSales ? `S/. ${reportMetrics.av.toFixed(2)}` : '—'}</div>
          <div className="st-lbl">Ticket Promedio</div>
        </div>
      </div>

      {/* GRAPH + RANKING */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', marginBottom: '16px' }}>

        {/* CHART PANEL */}
        <div className="panel">
          <div className="p-title">
            <span>Ventas por Día — Semana Actual</span>
          </div>

          {reportMetrics.hasSales ? (
            <>
              <div className="chart-wrap">
                {reportMetrics.weekTotals.map((val, i) => {
                  const pct = Math.max(val > 0 ? 8 : 0, (val / reportMetrics.maxWeekTotal) * 100);
                  const isToday = reportMetrics.weekDays[i] === new Date().toLocaleDateString();
                  return (
                    <div className="bc" key={i}>
                      <div
                        className="bbar"
                        style={{
                          height: `${pct}%`,
                          background: isToday
                            ? 'linear-gradient(180deg, var(--accent), var(--accent-dark))'
                            : undefined,
                          opacity: val === 0 ? 0.2 : isToday ? 1 : 0.65,
                        }}
                      />
                      <span className="blbl" style={{ color: isToday ? 'var(--accent)' : undefined, fontWeight: isToday ? '700' : undefined }}>
                        {reportMetrics.dayLabels[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '10px', paddingTop: '10px' }}>
                {reportMetrics.weekTotals.map((val, i) => {
                  const isToday = reportMetrics.weekDays[i] === new Date().toLocaleDateString();
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: isToday ? 'var(--accent)' : 'var(--text-3)', fontWeight: isToday ? 700 : 400 }}>
                      {val > 0 ? `S/. ${val.toFixed(0)}` : '—'}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: '10px', color: 'var(--text-3)' }}>
              <span style={{ fontSize: '40px', opacity: 0.35 }}>📊</span>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Sin ventas registradas esta semana</span>
              <span style={{ fontSize: '11.5px', fontWeight: '400' }}>El gráfico se actualizará automáticamente con cada venta</span>
            </div>
          )}
        </div>

        {/* RANKING PANEL */}
        <div className="panel">
          <div className="p-title" style={{ fontSize: '14px' }}>🥇 Ranking de Productos</div>

          {reportMetrics.topProducts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
              {reportMetrics.topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '28px', height: '28px',
                    background: rankColors[i] || 'var(--bg-card2)',
                    border: i > 0 ? '1px solid var(--border)' : 'none',
                    borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: '800',
                    color: i === 0 ? 'white' : 'var(--text-2)',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{p.qty} unidades</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--green)' }}>
                    S/. {p.revenue.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', gap: '8px', color: 'var(--text-3)' }}>
              <span style={{ fontSize: '28px', opacity: 0.35 }}>🥇</span>
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Sin datos aún</span>
            </div>
          )}
        </div>
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="panel">
        <div className="p-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <span>Historial Completo de Transacciones</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-new" onClick={exportToExcel} style={{ fontSize: '11.5px', padding: '6px 12px' }}>
              📊 Exportar Excel
            </button>
            <button className="btn-new" onClick={exportToPdf} style={{ fontSize: '11.5px', padding: '6px 12px' }}>
              📄 Exportar PDF
            </button>
          </div>
        </div>

        <div className="tb-bar" style={{ margin: '15px 0 10px 0' }}>
          <div className="inp-wrap" style={{ flex: 1, maxWidth: '360px' }}>
            <span className="inp-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar por boleta (ej: B-501), cajero, método..." 
              value={txSearch} 
              onChange={e => setTxSearch(e.target.value)} 
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: '10px', color: 'var(--text-3)' }}>
            <span style={{ fontSize: '40px', opacity: 0.35 }}>🧾</span>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Sin transacciones encontradas</span>
            <span style={{ fontSize: '11.5px', fontWeight: '400' }}>Las ventas del POS aparecerán aquí en tiempo real</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Boleta</th>
                  <th style={{ textAlign: 'left' }}>Fecha y Hora</th>
                  <th style={{ textAlign: 'left' }}>Productos</th>
                  <th style={{ textAlign: 'left' }}>Cajero</th>
                  <th style={{ textAlign: 'left' }}>Método</th>
                  <th style={{ textAlign: 'left' }}>Total</th>
                  <th style={{ textAlign: 'left' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((h, idx) => (
                  <tr key={h.id || idx} style={{ opacity: h.estado === 0 ? 0.65 : 1 }}>
                    <td><strong style={{ color: 'var(--accent)' }}>#B-{h.n}</strong></td>
                    <td style={{ fontSize: '12px' }}>{h.d} {h.t || ''}</td>
                    <td style={{ color: 'var(--text-2)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.items.map(i => `${i.name} ×${i.qty}`).join(', ')}
                    </td>
                    <td>{h.cajero}</td>
                    <td><span className="tag tg-blue">{h.method}</span></td>
                    <td style={{ fontWeight: '800', color: 'var(--green)' }}>S/. {h.total.toFixed(2)}</td>
                    <td>
                      {h.estado === 0 ? (
                        <span className="tag tg-danger" style={{ background: 'rgba(220,53,69,0.1)', color: 'var(--red)', border: '1px solid rgba(220,53,69,0.2)' }}>Anulado</span>
                      ) : (
                        <span className="tag tg-ok">Pagado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
