"use client";

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { loadJsPDFAutoTable, loadSheetJS } from '@/lib/cdn';

type PeriodKey = 'hoy' | 'semana' | 'mes' | 'todo' | 'custom';
type EstadoFiltro = 'todos' | 'pagado' | 'anulado';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date) {
  return d.toLocaleDateString();
}

/** Parsea fechas guardadas con toLocaleDateString() (es-PE: d/m/yyyy). */
function parseSaleDate(d: string): Date | null {
  if (!d) return null;
  const parts = d.trim().split(/[\/\-.]/).map(p => p.trim());
  if (parts.length === 3) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    const c = parseInt(parts[2], 10);
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) return null;
    // yyyy-mm-dd
    if (parts[0].length === 4) return startOfDay(new Date(a, b - 1, c));
    // dd/mm/yyyy (locale ES)
    if (a > 31) return startOfDay(new Date(a, b - 1, c));
    return startOfDay(new Date(c, b - 1, a));
  }
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromInputDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return startOfDay(new Date(y, m - 1, d));
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'hoy', label: '📅 Hoy' },
  { key: 'semana', label: '📆 Semana' },
  { key: 'mes', label: '🗓️ Mes' },
  { key: 'todo', label: '♾️ Todo' },
  { key: 'custom', label: '🎛️ Rango' },
];

export default function ReportesEstadisticasPage() {
  const { sales, toast } = useApp();

  const [period, setPeriod] = useState<PeriodKey>('semana');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(startOfDay(new Date())));
  const [customTo, setCustomTo] = useState(() => toInputDate(startOfDay(new Date())));
  const [filterMethod, setFilterMethod] = useState('todos');
  const [filterCajero, setFilterCajero] = useState('todos');
  const [filterEstado, setFilterEstado] = useState<EstadoFiltro>('todos');
  const [txSearch, setTxSearch] = useState('');

  const methods = useMemo(() => {
    const set = new Set<string>();
    sales.forEach(s => { if (s.method) set.add(s.method); });
    return Array.from(set).sort();
  }, [sales]);

  const cajeros = useMemo(() => {
    const set = new Set<string>();
    sales.forEach(s => { if (s.cajero) set.add(s.cajero); });
    return Array.from(set).sort();
  }, [sales]);

  const dateRange = useMemo(() => {
    const today = startOfDay(new Date());
    if (period === 'hoy') return { from: today, to: today, label: 'Hoy' };
    if (period === 'semana') {
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mon = new Date(today);
      mon.setDate(today.getDate() + mondayOffset);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: mon, to: sun, label: 'Semana actual' };
    }
    if (period === 'mes') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from, to, label: 'Mes actual' };
    }
    if (period === 'custom') {
      const from = fromInputDate(customFrom) ?? today;
      const to = fromInputDate(customTo) ?? today;
      const a = from <= to ? from : to;
      const b = from <= to ? to : from;
      return {
        from: a,
        to: b,
        label: `${a.toLocaleDateString()} — ${b.toLocaleDateString()}`,
      };
    }
    return { from: null as Date | null, to: null as Date | null, label: 'Todo el historial' };
  }, [period, customFrom, customTo]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (filterMethod !== 'todos' && s.method !== filterMethod) return false;
      if (filterCajero !== 'todos' && s.cajero !== filterCajero) return false;
      if (filterEstado === 'pagado' && s.estado === 0) return false;
      if (filterEstado === 'anulado' && s.estado !== 0) return false;

      if (dateRange.from && dateRange.to) {
        const sd = parseSaleDate(s.d);
        if (!sd) return false;
        if (sd < dateRange.from || sd > dateRange.to) return false;
      }
      return true;
    });
  }, [sales, filterMethod, filterCajero, filterEstado, dateRange]);

  const reportMetrics = useMemo(() => {
    const activeSales = filteredSales.filter(s => s.estado !== 0);
    const hasSales = activeSales.length > 0;

    const tv = activeSales.reduce((a, b) => a + b.total, 0);
    const tr = activeSales.length;
    const un = activeSales.reduce((a, b) => a + b.items.reduce((acc, i) => acc + i.qty, 0), 0);
    const av = tr > 0 ? tv / tr : 0;

    const historyList = [...filteredSales].reverse().map(s => ({
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

    // --- Buckets del gráfico de barras según periodo ---
    let barLabels: string[] = [];
    let barKeys: string[] = [];
    let chartTitle = 'Ventas';

    if (period === 'hoy') {
      chartTitle = 'Ventas por franja — Hoy';
      const slots = [
        { key: 'm', label: 'Mañana', fromH: 5, toH: 12 },
        { key: 'md', label: 'Mediodía', fromH: 12, toH: 15 },
        { key: 't', label: 'Tarde', fromH: 15, toH: 19 },
        { key: 'n', label: 'Noche', fromH: 19, toH: 24 },
        { key: 'o', label: 'Madrugada', fromH: 0, toH: 5 },
      ];
      barLabels = slots.map(s => s.label);
      barKeys = slots.map(s => s.key);
    } else if (period === 'semana') {
      chartTitle = 'Ventas por día — Semana actual';
      const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const from = dateRange.from!;
      barLabels = dayLabels;
      barKeys = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        return dateKey(d);
      });
    } else if (period === 'mes') {
      chartTitle = 'Ventas por día — Mes actual';
      const days = eachDay(dateRange.from!, dateRange.to!);
      barLabels = days.map(d => String(d.getDate()));
      barKeys = days.map(dateKey);
    } else if (period === 'custom' && dateRange.from && dateRange.to) {
      const days = eachDay(dateRange.from, dateRange.to);
      chartTitle = days.length <= 14
        ? `Ventas por día — ${dateRange.label}`
        : `Ventas por día (${days.length} días)`;
      // Si el rango es muy largo, agrupar por semana
      if (days.length > 31) {
        const weeks: { label: string; keys: string[] }[] = [];
        for (let i = 0; i < days.length; i += 7) {
          const slice = days.slice(i, i + 7);
          weeks.push({
            label: `${slice[0].getDate()}/${slice[0].getMonth() + 1}`,
            keys: slice.map(dateKey),
          });
        }
        barLabels = weeks.map(w => w.label);
        barKeys = weeks.map((_, i) => `w${i}`);
        // store week keys mapping in parallel via totals logic below
        const weekTotals = weeks.map(w =>
          activeSales
            .filter(s => w.keys.includes(s.d))
            .reduce((a, b) => a + b.total, 0)
        );
        const maxWeekTotal = Math.max(...weekTotals, 1);
        const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
        activeSales.forEach(s => {
          s.items.forEach(item => {
            if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
            productMap[item.name].qty += item.qty;
            productMap[item.name].revenue += item.price * item.qty;
          });
        });
        const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 4);
        return {
          hasSales,
          tv, tr, un, av,
          historyList,
          barTotals: weekTotals,
          barLabels,
          barKeys,
          maxBarTotal: maxWeekTotal,
          topProducts,
          chartTitle: `Ventas por semana — ${dateRange.label}`,
          highlightKey: null as string | null,
        };
      }
      barLabels = days.map(d => `${d.getDate()}/${d.getMonth() + 1}`);
      barKeys = days.map(dateKey);
    } else {
      // Todo: últimos 14 días con actividad o últimos 14 calendario
      chartTitle = 'Ventas — Últimos 14 días';
      const end = startOfDay(new Date());
      const start = new Date(end);
      start.setDate(end.getDate() - 13);
      const days = eachDay(start, end);
      barLabels = days.map(d => `${d.getDate()}/${d.getMonth() + 1}`);
      barKeys = days.map(dateKey);
    }

    let barTotals: number[];
    if (period === 'hoy') {
      const slotOf = (t: string) => {
        const m = t?.match(/(\d{1,2})/);
        let h = m ? parseInt(m[1], 10) : 12;
        // AM/PM heurística simple si aparece
        if (/p\.?\s*m/i.test(t) && h < 12) h += 12;
        if (/a\.?\s*m/i.test(t) && h === 12) h = 0;
        if (h >= 5 && h < 12) return 'm';
        if (h >= 12 && h < 15) return 'md';
        if (h >= 15 && h < 19) return 't';
        if (h >= 19 && h < 24) return 'n';
        return 'o';
      };
      barTotals = barKeys.map(k =>
        activeSales.filter(s => slotOf(s.t || '') === k).reduce((a, b) => a + b.total, 0)
      );
    } else {
      barTotals = barKeys.map(key =>
        activeSales.filter(s => s.d === key).reduce((a, b) => a + b.total, 0)
      );
    }

    const maxBarTotal = Math.max(...barTotals, 1);

    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    activeSales.forEach(s => {
      s.items.forEach(item => {
        if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
        productMap[item.name].qty += item.qty;
        productMap[item.name].revenue += item.price * item.qty;
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);

    const todayKey = dateKey(new Date());
    const highlightKey =
      period === 'hoy' ? null :
      period === 'semana' || period === 'mes' || period === 'todo' || period === 'custom'
        ? todayKey
        : null;

    return {
      hasSales,
      tv, tr, un, av,
      historyList,
      barTotals,
      barLabels,
      barKeys,
      maxBarTotal,
      topProducts,
      chartTitle,
      highlightKey,
    };
  }, [filteredSales, period, dateRange]);

  const filteredHistory = useMemo(() => {
    const searchLower = txSearch.toLowerCase().trim();
    if (!searchLower) return reportMetrics.historyList;
    return reportMetrics.historyList.filter(h =>
      `b-${h.n}`.toLowerCase().includes(searchLower) ||
      h.cajero.toLowerCase().includes(searchLower) ||
      h.method.toLowerCase().includes(searchLower) ||
      (h.clienteNombre || '').toLowerCase().includes(searchLower) ||
      h.items.some(i => i.name.toLowerCase().includes(searchLower))
    );
  }, [reportMetrics.historyList, txSearch]);

  const periodBadge =
    period === 'hoy' ? 'Hoy' :
    period === 'semana' ? 'Semana' :
    period === 'mes' ? 'Mes' :
    period === 'todo' ? 'Todo' : 'Rango';

  const activeFiltersCount = [
    filterMethod !== 'todos',
    filterCajero !== 'todos',
    filterEstado !== 'todos',
    period !== 'semana',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setPeriod('semana');
    setFilterMethod('todos');
    setFilterCajero('todos');
    setFilterEstado('todos');
    setTxSearch('');
    const t = toInputDate(startOfDay(new Date()));
    setCustomFrom(t);
    setCustomTo(t);
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await loadSheetJS();
      const wb = XLSX.utils.book_new();

      const kpisData = [
        ['REPORTE DE VENTAS - SNACK ROQUE'],
        [`Fecha de Reporte: ${new Date().toLocaleString()}`],
        [`Periodo: ${dateRange.label}`],
        [
          `Filtros: Método=${filterMethod === 'todos' ? 'Todos' : filterMethod}; ` +
          `Cajero=${filterCajero === 'todos' ? 'Todos' : filterCajero}; ` +
          `Estado=${filterEstado}`,
        ],
        [],
        ['KPI', 'Valor'],
        ['Ventas Totales Activas (S/.)', reportMetrics.tv],
        ['Transacciones Activas', reportMetrics.tr],
        ['Unidades Vendidas Activas', reportMetrics.un],
        ['Ticket Promedio Activo (S/.)', reportMetrics.av],
      ];
      const wsKpis = XLSX.utils.aoa_to_sheet(kpisData);
      XLSX.utils.book_append_sheet(wb, wsKpis, 'Resumen KPIs');

      const txHeader = ['Boleta', 'Fecha y Hora', 'Productos', 'Cajero', 'Método Pago', 'Total (S/.)', 'Estado'];
      const txRows = filteredHistory.map(h => [
        `B-${h.n}`,
        `${h.d} ${h.t || ''}`,
        h.items.map(i => `${i.name} x${i.qty}`).join(', '),
        h.cajero,
        h.method,
        h.total,
        h.estado === 0 ? 'Anulado' : 'Pagado',
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
      doc.text(`Periodo: ${dateRange.label}`, 14, 27);

      doc.setFillColor(245, 247, 250);
      doc.rect(14, 32, 182, 25, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen de Rendimiento (filtros aplicados):', 18, 38);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Ventas: S/. ${reportMetrics.tv.toFixed(2)}`, 18, 44);
      doc.text(`Transacciones: ${reportMetrics.tr}`, 18, 50);
      doc.text(`Unidades Vendidas: ${reportMetrics.un}`, 100, 44);
      doc.text(`Ticket Promedio: S/. ${reportMetrics.av.toFixed(2)}`, 100, 50);

      doc.setFont('helvetica', 'bold');
      doc.text('Listado de Transacciones:', 14, 66);

      const tableHeaders = [['Boleta', 'Fecha y Hora', 'Productos', 'Cajero', 'Método', 'Total', 'Estado']];
      const tableRows = filteredHistory.map(h => [
        `B-${h.n}`,
        `${h.d} ${h.t || ''}`,
        h.items.map(i => `${i.name} x${i.qty}`).join(', '),
        h.cajero,
        h.method,
        `S/. ${h.total.toFixed(2)}`,
        h.estado === 0 ? 'Anulado' : 'Pagado',
      ]);

      (doc as any).autoTable({
        startY: 70,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [124, 106, 247] },
        columnStyles: { 2: { cellWidth: 60 } },
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

  const selectStyle: React.CSSProperties = {
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text)',
    cursor: 'pointer',
    minWidth: '120px',
  };

  const dateInputStyle: React.CSSProperties = {
    ...selectStyle,
    minWidth: 'auto',
    padding: '6px 10px',
  };

  return (
    <div className="screen active">
      {/* BARRA DE FILTROS DE REPORTES */}
      <div
        className="panel"
        style={{
          marginBottom: '16px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>🔍 Filtros de reporte</span>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>
              {dateRange.label}
              {activeFiltersCount > 0 ? ` · ${activeFiltersCount} filtro${activeFiltersCount > 1 ? 's' : ''} activo${activeFiltersCount > 1 ? 's' : ''}` : ''}
            </span>
          </div>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '999px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              ✕ Limpiar filtros
            </button>
          )}
        </div>

        {/* Periodo — pills */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            background: 'var(--bg-2)',
            padding: '4px',
            borderRadius: '999px',
            border: '1px solid var(--border)',
            width: 'fit-content',
            maxWidth: '100%',
            overflowX: 'auto',
            flexWrap: 'wrap',
          }}
        >
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriod(opt.key)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '999px',
                border: 'none',
                background: period === opt.key ? 'var(--accent)' : 'transparent',
                color: period === opt.key ? '#fff' : 'var(--text-3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Rango personalizado + filtros secundarios */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {period === 'custom' && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)' }}>
                Desde
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={dateInputStyle}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)' }}>
                Hasta
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={dateInputStyle}
                />
              </label>
            </>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)' }}>
            Método
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={selectStyle}>
              <option value="todos">Todos</option>
              {methods.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)' }}>
            Cajero
            <select value={filterCajero} onChange={e => setFilterCajero(e.target.value)} style={selectStyle}>
              <option value="todos">Todos</option>
              {cajeros.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)' }}>
            Estado
            <select
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value as EstadoFiltro)}
              style={selectStyle}
            >
              <option value="todos">Todos</option>
              <option value="pagado">Pagado</option>
              <option value="anulado">Anulado</option>
            </select>
          </label>
        </div>
      </div>

      {/* KPIs ROW */}
      <div className="stats-4" style={{ marginBottom: '18px' }}>
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-lav">💰</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>{periodBadge}</div>
          </div>
          <div className="st-val">{reportMetrics.hasSales ? `S/. ${reportMetrics.tv.toFixed(2)}` : 'S/. 0.00'}</div>
          <div className="st-lbl">Ventas registradas</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-blush">🛒</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>{periodBadge}</div>
          </div>
          <div className="st-val">{reportMetrics.tr}</div>
          <div className="st-lbl">Transacciones</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-peach">📦</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>{periodBadge}</div>
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
            <span>{reportMetrics.chartTitle}</span>
          </div>

          {reportMetrics.hasSales || reportMetrics.barTotals.some(v => v > 0) ? (
            <>
              <div
                className="chart-wrap"
                style={{
                  overflowX: reportMetrics.barLabels.length > 10 ? 'auto' : undefined,
                  gap: reportMetrics.barLabels.length > 14 ? '4px' : '10px',
                }}
              >
                {reportMetrics.barTotals.map((val, i) => {
                  const pct = Math.max(val > 0 ? 8 : 0, (val / reportMetrics.maxBarTotal) * 100);
                  const key = reportMetrics.barKeys[i];
                  const isHighlight = reportMetrics.highlightKey != null && key === reportMetrics.highlightKey;
                  return (
                    <div
                      className="bc"
                      key={`${key}-${i}`}
                      style={{ minWidth: reportMetrics.barLabels.length > 14 ? '18px' : undefined }}
                      title={`${reportMetrics.barLabels[i]}: S/. ${val.toFixed(2)}`}
                    >
                      <div
                        className="bbar"
                        style={{
                          height: `${pct}%`,
                          background: isHighlight
                            ? 'linear-gradient(180deg, var(--accent), var(--accent-dark))'
                            : undefined,
                          opacity: val === 0 ? 0.2 : isHighlight ? 1 : 0.65,
                        }}
                      />
                      <span
                        className="blbl"
                        style={{
                          color: isHighlight ? 'var(--accent)' : undefined,
                          fontWeight: isHighlight ? 700 : undefined,
                          fontSize: reportMetrics.barLabels.length > 14 ? '8px' : undefined,
                        }}
                      >
                        {reportMetrics.barLabels[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: reportMetrics.barLabels.length > 14 ? '4px' : '10px',
                  paddingTop: '10px',
                  overflowX: reportMetrics.barLabels.length > 10 ? 'auto' : undefined,
                }}
              >
                {reportMetrics.barTotals.map((val, i) => {
                  const key = reportMetrics.barKeys[i];
                  const isHighlight = reportMetrics.highlightKey != null && key === reportMetrics.highlightKey;
                  return (
                    <div
                      key={`val-${key}-${i}`}
                      style={{
                        flex: 1,
                        minWidth: reportMetrics.barLabels.length > 14 ? '18px' : undefined,
                        textAlign: 'center',
                        fontSize: reportMetrics.barLabels.length > 14 ? '9px' : '11px',
                        color: isHighlight ? 'var(--accent)' : 'var(--text-3)',
                        fontWeight: isHighlight ? 700 : 400,
                      }}
                    >
                      {val > 0 ? `S/. ${val.toFixed(0)}` : '—'}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: '10px', color: 'var(--text-3)' }}>
              <span style={{ fontSize: '40px', opacity: 0.35 }}>📊</span>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Sin ventas en este periodo</span>
              <span style={{ fontSize: '11.5px', fontWeight: '400' }}>Prueba otro filtro o registra ventas en el POS</span>
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
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Sin datos en este filtro</span>
            </div>
          )}
        </div>
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="panel">
        <div className="p-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <span>
            Historial de Transacciones
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', marginLeft: '8px' }}>
              ({filteredHistory.length})
            </span>
          </span>
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
              placeholder="Buscar por boleta, cajero, método, producto..."
              value={txSearch}
              onChange={e => setTxSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: '10px', color: 'var(--text-3)' }}>
            <span style={{ fontSize: '40px', opacity: 0.35 }}>🧾</span>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Sin transacciones con estos filtros</span>
            <span style={{ fontSize: '11.5px', fontWeight: '400' }}>Ajusta el periodo, método o cajero</span>
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
