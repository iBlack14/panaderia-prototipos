"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import type { Pedido, PedidoItem, Product, Insumo } from '@/context/types';
import { loadJsPDFAutoTable, loadSheetJS } from '@/lib/cdn';

type PeriodKey = 'hoy' | 'semana' | 'mes' | 'todo' | 'custom';
type EstadoFiltro = 'todos' | 'pagado' | 'anulado';
type ReportTab = 'ventas' | 'productos' | 'insumos' | 'pedidos';
type PedidoEstadoFiltro = 'todos' | 'Pendiente' | 'Listo' | 'Entregado' | 'Cancelado';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date) {
  return d.toLocaleDateString();
}

function parseSaleDate(d: string): Date | null {
  if (!d) return null;
  // ISO / datetime
  if (d.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
  }
  const parts = d.trim().split(/[\/\-.]/).map(p => p.trim());
  if (parts.length === 3) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    const c = parseInt(parts[2], 10);
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) return null;
    if (parts[0].length === 4) return startOfDay(new Date(a, b - 1, c));
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

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000) + 1;
}

function shiftRange(from: Date, to: Date) {
  const n = daysBetween(from, to);
  const prevTo = new Date(from);
  prevTo.setDate(from.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevTo.getDate() - (n - 1));
  return { from: startOfDay(prevFrom), to: startOfDay(prevTo) };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function formatPct(p: number | null) {
  if (p === null) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

function money(n: number) {
  return `S/. ${n.toFixed(2)}`;
}

function effectiveStock(p: Product) {
  if (p.versions?.length > 0) return p.versions.reduce((a, v) => a + (v.stock || 0), 0);
  return p.stock || 0;
}

function effectivePrice(p: Product) {
  if (p.versions?.length > 0) return p.versions[0].price || p.price || 0;
  return p.price || 0;
}

function parsePedidoMeta(p: Pedido): {
  itemsList: PedidoItem[];
  totalVal: number;
  summary: string;
} {
  let itemsList: PedidoItem[] = [];
  let totalVal = p.adelanto || 0;
  let summary = p.productoTexto || '';

  if (p.productoTexto?.startsWith('{')) {
    try {
      const parsed = JSON.parse(p.productoTexto);
      itemsList = parsed.items || [];
      totalVal = Number(parsed.total) || p.adelanto || 0;
      summary =
        parsed.legacyText ||
        itemsList.map(i => i.name).join(', ') ||
        'Reserva';
    } catch {
      summary = p.productoTexto;
    }
  }
  return {
    itemsList,
    totalVal,
    summary: summary.replace(/\s+/g, ' ').trim(),
  };
}

function pedidoDate(p: Pedido): Date | null {
  return parseSaleDate(p.fecEntrega) || (p.createdAt ? parseSaleDate(p.createdAt) : null);
}

function estadoTagStyle(estado: Pedido['estado']): React.CSSProperties {
  switch (estado) {
    case 'Pendiente':
      return { background: 'rgba(176,125,46,0.12)', color: 'var(--accent)', border: '1px solid rgba(176,125,46,0.25)' };
    case 'Listo':
      return { background: 'rgba(59,110,168,0.12)', color: 'var(--blue)', border: '1px solid rgba(59,110,168,0.25)' };
    case 'Entregado':
      return { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(74,140,92,0.25)' };
    case 'Cancelado':
      return { background: 'rgba(220,53,69,0.1)', color: 'var(--red)', border: '1px solid rgba(220,53,69,0.2)' };
    default:
      return {};
  }
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'todo', label: 'Todo' },
  { key: 'custom', label: 'Rango' },
];

const REPORT_TABS: { key: ReportTab; label: string; icon: string }[] = [
  { key: 'ventas', label: 'Ventas', icon: '💰' },
  { key: 'productos', label: 'Productos', icon: '🥖' },
  { key: 'insumos', label: 'Insumos', icon: '🌾' },
  { key: 'pedidos', label: 'Pedidos / Reservas', icon: '📋' },
];

const PAGE_SIZE = 12;
const LOW_STOCK = 10;

const METHOD_COLORS = [
  'linear-gradient(90deg, var(--accent), var(--accent-dark))',
  'linear-gradient(90deg, var(--green), #3d7a4d)',
  'linear-gradient(90deg, var(--blue), #3b6ea8)',
  'linear-gradient(90deg, #c17a4a, #a05e32)',
  'linear-gradient(90deg, #7c6af7, #5b4bd1)',
];

export default function ReportesEstadisticasPage() {
  const { sales, products, insumos, pedidos, breadLogs, purchases, toast } = useApp();

  const [tab, setTab] = useState<ReportTab>('ventas');
  const [period, setPeriod] = useState<PeriodKey>('semana');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(startOfDay(new Date())));
  const [customTo, setCustomTo] = useState(() => toInputDate(startOfDay(new Date())));
  const [filterMethod, setFilterMethod] = useState('todos');
  const [filterCajero, setFilterCajero] = useState('todos');
  const [filterEstado, setFilterEstado] = useState<EstadoFiltro>('todos');
  const [pedidoEstado, setPedidoEstado] = useState<PedidoEstadoFiltro>('todos');
  const [txSearch, setTxSearch] = useState('');
  const [page, setPage] = useState(1);

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
      return { from: mon, to: sun, label: 'Semana actual (Lun–Dom)' };
    }
    if (period === 'mes') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const monthName = from.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
      return { from, to, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
    }
    if (period === 'custom') {
      const from = fromInputDate(customFrom) ?? today;
      const to = fromInputDate(customTo) ?? today;
      const a = from <= to ? from : to;
      const b = from <= to ? to : from;
      return { from: a, to: b, label: `${a.toLocaleDateString()} — ${b.toLocaleDateString()}` };
    }
    return { from: null as Date | null, to: null as Date | null, label: 'Todo el historial' };
  }, [period, customFrom, customTo]);

  const inRange = (d: string | undefined | null, from: Date | null, to: Date | null) => {
    if (!from || !to) return true;
    if (!d) return false;
    const sd = parseSaleDate(d);
    if (!sd) return false;
    return sd >= from && sd <= to;
  };

  // ─── VENTAS ─────────────────────────────────────────────
  const applySaleFilters = (list: typeof sales) =>
    list.filter(s => {
      if (filterMethod !== 'todos' && s.method !== filterMethod) return false;
      if (filterCajero !== 'todos' && s.cajero !== filterCajero) return false;
      if (filterEstado === 'pagado' && s.estado === 0) return false;
      if (filterEstado === 'anulado' && s.estado !== 0) return false;
      return true;
    });

  const filteredSales = useMemo(
    () => applySaleFilters(sales).filter(s => inRange(s.d, dateRange.from, dateRange.to)),
    [sales, filterMethod, filterCajero, filterEstado, dateRange]
  );

  const prevPeriodSales = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [] as typeof sales;
    const prev = shiftRange(dateRange.from, dateRange.to);
    return applySaleFilters(sales).filter(s => inRange(s.d, prev.from, prev.to));
  }, [sales, filterMethod, filterCajero, filterEstado, dateRange]);

  const salesMetrics = useMemo(() => {
    const activeSales = filteredSales.filter(s => s.estado !== 0);
    const prevActive = prevPeriodSales.filter(s => s.estado !== 0);
    const annulledCount = filteredSales.filter(s => s.estado === 0).length;

    const tv = activeSales.reduce((a, b) => a + b.total, 0);
    const tr = activeSales.length;
    const un = activeSales.reduce((a, b) => a + b.items.reduce((acc, i) => acc + i.qty, 0), 0);
    const av = tr > 0 ? tv / tr : 0;
    const prevTv = prevActive.reduce((a, b) => a + b.total, 0);
    const prevTr = prevActive.length;
    const prevUn = prevActive.reduce((a, b) => a + b.items.reduce((acc, i) => acc + i.qty, 0), 0);
    const prevAv = prevTr > 0 ? prevTv / prevTr : 0;

    const historyList = [...filteredSales]
      .sort((a, b) => {
        const da = parseSaleDate(a.d)?.getTime() ?? 0;
        const db = parseSaleDate(b.d)?.getTime() ?? 0;
        if (db !== da) return db - da;
        return (b.n || 0) - (a.n || 0);
      })
      .map(s => ({
        id: s.id,
        n: s.n,
        d: s.d,
        t: s.t,
        cajero: s.cajero,
        method: s.method,
        total: s.total,
        estado: s.estado,
        clienteNombre: s.clienteNombre,
        items: s.items.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
      }));

    let barLabels: string[] = [];
    let barKeys: string[] = [];
    let chartTitle = 'Evolución de ventas';
    let chartSub = dateRange.label;
    let barTotals: number[] = [];

    if (period === 'hoy') {
      chartTitle = 'Ventas por franja horaria';
      chartSub = 'Distribución del día';
      const slots = [
        { key: 'm', label: 'Mañana' },
        { key: 'md', label: 'Mediodía' },
        { key: 't', label: 'Tarde' },
        { key: 'n', label: 'Noche' },
        { key: 'o', label: 'Madrugada' },
      ];
      barLabels = slots.map(s => s.label);
      barKeys = slots.map(s => s.key);
      const slotOf = (t: string) => {
        const m = t?.match(/(\d{1,2})/);
        let h = m ? parseInt(m[1], 10) : 12;
        if (/p\.?\s*m/i.test(t) && h < 12) h += 12;
        if (/a\.?\s*m/i.test(t) && h === 12) h = 0;
        if (h >= 5 && h < 12) return 'm';
        if (h >= 12 && h < 15) return 'md';
        if (h >= 15 && h < 19) return 't';
        if (h >= 19) return 'n';
        return 'o';
      };
      barTotals = barKeys.map(k =>
        activeSales.filter(s => slotOf(s.t || '') === k).reduce((a, b) => a + b.total, 0)
      );
    } else if (period === 'semana' && dateRange.from) {
      chartTitle = 'Ventas por día de la semana';
      const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      barLabels = dayLabels;
      barKeys = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(dateRange.from!);
        d.setDate(dateRange.from!.getDate() + i);
        return dateKey(d);
      });
      barTotals = barKeys.map(key =>
        activeSales.filter(s => s.d === key).reduce((a, b) => a + b.total, 0)
      );
    } else if (period === 'mes' && dateRange.from && dateRange.to) {
      chartTitle = 'Ventas diarias del mes';
      const days = eachDay(dateRange.from, dateRange.to);
      barLabels = days.map(d => String(d.getDate()));
      barKeys = days.map(dateKey);
      barTotals = barKeys.map(key =>
        activeSales.filter(s => s.d === key).reduce((a, b) => a + b.total, 0)
      );
    } else if (period === 'custom' && dateRange.from && dateRange.to) {
      const days = eachDay(dateRange.from, dateRange.to);
      if (days.length > 31) {
        const weeks: { label: string; keys: string[] }[] = [];
        for (let i = 0; i < days.length; i += 7) {
          const slice = days.slice(i, i + 7);
          weeks.push({ label: `${slice[0].getDate()}/${slice[0].getMonth() + 1}`, keys: slice.map(dateKey) });
        }
        chartTitle = 'Ventas por semana';
        barLabels = weeks.map(w => w.label);
        barKeys = weeks.map((_, i) => `w${i}`);
        barTotals = weeks.map(w =>
          activeSales.filter(s => w.keys.includes(s.d)).reduce((a, b) => a + b.total, 0)
        );
      } else {
        chartTitle = 'Ventas por día';
        barLabels = days.map(d => `${d.getDate()}/${d.getMonth() + 1}`);
        barKeys = days.map(dateKey);
        barTotals = barKeys.map(key =>
          activeSales.filter(s => s.d === key).reduce((a, b) => a + b.total, 0)
        );
      }
    } else {
      chartTitle = 'Últimos 14 días';
      const end = startOfDay(new Date());
      const start = new Date(end);
      start.setDate(end.getDate() - 13);
      const days = eachDay(start, end);
      barLabels = days.map(d => `${d.getDate()}/${d.getMonth() + 1}`);
      barKeys = days.map(dateKey);
      barTotals = barKeys.map(key =>
        activeSales.filter(s => s.d === key).reduce((a, b) => a + b.total, 0)
      );
    }

    const maxBarTotal = Math.max(...barTotals, 1);
    const peakIdx = barTotals.reduce((best, v, i) => (v > barTotals[best] ? i : best), 0);

    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    activeSales.forEach(s => {
      s.items.forEach(item => {
        if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
        productMap[item.name].qty += item.qty;
        productMap[item.name].revenue += item.price * item.qty;
      });
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    const maxProdRev = topProducts[0]?.revenue || 1;

    const methodMap: Record<string, { name: string; total: number; count: number }> = {};
    activeSales.forEach(s => {
      const m = s.method || 'Sin método';
      if (!methodMap[m]) methodMap[m] = { name: m, total: 0, count: 0 };
      methodMap[m].total += s.total;
      methodMap[m].count += 1;
    });
    const byMethod = Object.values(methodMap).sort((a, b) => b.total - a.total);
    const maxMethod = byMethod[0]?.total || 1;

    const cajeroMap: Record<string, { name: string; total: number; count: number }> = {};
    activeSales.forEach(s => {
      const c = s.cajero || 'Sin cajero';
      if (!cajeroMap[c]) cajeroMap[c] = { name: c, total: 0, count: 0 };
      cajeroMap[c].total += s.total;
      cajeroMap[c].count += 1;
    });
    const byCajero = Object.values(cajeroMap).sort((a, b) => b.total - a.total);
    const maxCajero = byCajero[0]?.total || 1;

    const todayKey = dateKey(new Date());
    const highlightKey = period === 'hoy' ? null : todayKey;

    return {
      hasSales: activeSales.length > 0,
      tv, tr, un, av, prevTv, prevTr, prevUn, prevAv, annulledCount,
      historyList, barTotals, barLabels, barKeys, maxBarTotal,
      topProducts, maxProdRev, byMethod, maxMethod, byCajero, maxCajero,
      chartTitle, chartSub, highlightKey,
      peakLabel: barLabels[peakIdx] || '—',
      peakVal: barTotals[peakIdx] || 0,
      bestMethod: byMethod[0]?.name || '—',
      bestCajero: byCajero[0]?.name || '—',
      bestProduct: topProducts[0]?.name || '—',
      productSalesMap: productMap,
    };
  }, [filteredSales, prevPeriodSales, period, dateRange]);

  // ─── PRODUCTOS ──────────────────────────────────────────
  const productReport = useMemo(() => {
    const sellable = products.filter(p => p.cat !== 'Insumos');
    const rows = sellable.map(p => {
      const stock = effectiveStock(p);
      const price = effectivePrice(p);
      const valor = stock * price;
      // Match sales by product id or name
      const sold = filteredSales
        .filter(s => s.estado !== 0)
        .flatMap(s => s.items)
        .filter(i => i.id === p.id || i.name === p.name || i.name.startsWith(p.name));
      const qtySold = sold.reduce((a, i) => a + i.qty, 0);
      const revenue = sold.reduce((a, i) => a + i.price * i.qty, 0);

      // Kardex movements in period
      const logs = breadLogs.filter(l =>
        l.prodName === p.name || l.prodName.startsWith(p.name)
      ).filter(l => inRange(l.d, dateRange.from, dateRange.to));
      const produccion = logs.filter(l => l.type === 'produccion').reduce((a, l) => a + l.qty, 0);
      const descarte = logs.filter(l => l.type === 'descarte').reduce((a, l) => a + l.qty, 0);

      let status: 'ok' | 'bajo' | 'agotado' = 'ok';
      if (stock <= 0) status = 'agotado';
      else if (stock < LOW_STOCK) status = 'bajo';

      return {
        id: p.id,
        name: p.name,
        cat: p.cat || 'Sin categoría',
        stock,
        price,
        valor,
        qtySold,
        revenue,
        produccion,
        descarte,
        versions: p.versions?.length || 0,
        status,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const totalSKUs = rows.length;
    const lowStock = rows.filter(r => r.status === 'bajo').length;
    const agotados = rows.filter(r => r.status === 'agotado').length;
    const valorInventario = rows.reduce((a, r) => a + r.valor, 0);
    const totalSoldUnits = rows.reduce((a, r) => a + r.qtySold, 0);
    const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);

    const byCat: Record<string, { name: string; count: number; stock: number; revenue: number }> = {};
    rows.forEach(r => {
      if (!byCat[r.cat]) byCat[r.cat] = { name: r.cat, count: 0, stock: 0, revenue: 0 };
      byCat[r.cat].count += 1;
      byCat[r.cat].stock += r.stock;
      byCat[r.cat].revenue += r.revenue;
    });
    const categories = Object.values(byCat).sort((a, b) => b.revenue - a.revenue);

    return {
      rows,
      totalSKUs,
      lowStock,
      agotados,
      valorInventario,
      totalSoldUnits,
      totalRevenue,
      categories,
      topSold: [...rows].filter(r => r.qtySold > 0).slice(0, 8),
      alerts: rows.filter(r => r.status !== 'ok').sort((a, b) => a.stock - b.stock),
    };
  }, [products, filteredSales, breadLogs, dateRange]);

  // ─── INSUMOS ────────────────────────────────────────────
  const insumoReport = useMemo(() => {
    const rows = insumos.map((ins: Insumo) => {
      const valor = (ins.stock || 0) * (ins.costoUnitario || 0);
      let status: 'ok' | 'bajo' | 'agotado' = 'ok';
      if (ins.stock <= 0) status = 'agotado';
      else if (ins.stock <= ins.stockMinimo) status = 'bajo';

      // Compras de este insumo en el periodo
      let qtyComprada = 0;
      let costoCompras = 0;
      purchases.forEach(pur => {
        if (!inRange(pur.d, dateRange.from, dateRange.to)) return;
        pur.items?.forEach(it => {
          if (it.type === 'insumo' && it.insumoId === ins.id) {
            qtyComprada += it.qty;
            costoCompras += it.qty * it.cost;
          }
        });
      });

      // Uso en pedidos (items tipo insumo)
      let qtyEnPedidos = 0;
      pedidos.forEach(p => {
        const pd = pedidoDate(p);
        if (dateRange.from && dateRange.to) {
          if (!pd || pd < dateRange.from || pd > dateRange.to) return;
        }
        const meta = parsePedidoMeta(p);
        meta.itemsList.forEach(it => {
          if (it.type === 'insumo' && (it.insumoId === ins.id || it.name === ins.nombre)) {
            qtyEnPedidos += it.qty;
          }
        });
      });

      return {
        id: ins.id,
        nombre: ins.nombre,
        stock: ins.stock,
        stockMinimo: ins.stockMinimo,
        costoUnitario: ins.costoUnitario,
        unidad: ins.unidadMedida || 'und',
        valor,
        active: ins.active,
        status,
        qtyComprada,
        costoCompras,
        qtyEnPedidos,
        lotes: ins.lotes?.length || 0,
      };
    }).sort((a, b) => {
      const order = { agotado: 0, bajo: 1, ok: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.valor - a.valor;
    });

    const activos = rows.filter(r => r.active);
    const valorTotal = activos.reduce((a, r) => a + r.valor, 0);
    const bajos = rows.filter(r => r.status === 'bajo').length;
    const agotados = rows.filter(r => r.status === 'agotado').length;
    const comprasPeriodo = rows.reduce((a, r) => a + r.costoCompras, 0);
    const qtyCompradaPeriodo = rows.reduce((a, r) => a + r.qtyComprada, 0);

    return {
      rows,
      total: rows.length,
      activos: activos.length,
      valorTotal,
      bajos,
      agotados,
      comprasPeriodo,
      qtyCompradaPeriodo,
      alerts: rows.filter(r => r.status !== 'ok'),
    };
  }, [insumos, purchases, pedidos, dateRange]);

  // ─── PEDIDOS / RESERVAS ─────────────────────────────────
  const pedidoReport = useMemo(() => {
    const enriched = pedidos.map(p => {
      const meta = parsePedidoMeta(p);
      const dEntrega = pedidoDate(p);
      return {
        ...p,
        ...meta,
        dEntrega,
        saldo: Math.max(0, meta.totalVal - (p.adelanto || 0)),
      };
    });

    const inPeriod = enriched.filter(p => {
      if (!dateRange.from || !dateRange.to) return true;
      if (!p.dEntrega) {
        // sin fecha de entrega: incluir por createdAt si existe
        if (p.createdAt) return inRange(p.createdAt, dateRange.from, dateRange.to);
        return true;
      }
      return p.dEntrega >= dateRange.from && p.dEntrega <= dateRange.to;
    });

    const filtered = pedidoEstado === 'todos'
      ? inPeriod
      : inPeriod.filter(p => p.estado === pedidoEstado);

    const byEstado: Record<string, number> = {
      Pendiente: 0, Listo: 0, Entregado: 0, Cancelado: 0,
    };
    inPeriod.forEach(p => {
      if (byEstado[p.estado] !== undefined) byEstado[p.estado] += 1;
    });

    const totalReservas = inPeriod.length;
    const activas = inPeriod.filter(p => p.estado === 'Pendiente' || p.estado === 'Listo').length;
    const entregadas = inPeriod.filter(p => p.estado === 'Entregado').length;
    const canceladas = inPeriod.filter(p => p.estado === 'Cancelado').length;
    const montoaAdelantos = inPeriod
      .filter(p => p.estado !== 'Cancelado')
      .reduce((a, p) => a + (p.adelanto || 0), 0);
    const montoTotal = inPeriod
      .filter(p => p.estado !== 'Cancelado')
      .reduce((a, p) => a + p.totalVal, 0);
    const montoPendiente = inPeriod
      .filter(p => p.estado === 'Pendiente' || p.estado === 'Listo')
      .reduce((a, p) => a + p.saldo, 0);

    // Productos más pedidos en reservas
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    inPeriod.filter(p => p.estado !== 'Cancelado').forEach(p => {
      p.itemsList.forEach(it => {
        const key = it.name || 'Item';
        if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 };
        itemMap[key].qty += it.qty;
        itemMap[key].revenue += (it.price || 0) * it.qty;
      });
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

    // Próximas entregas (pendiente/listo ordenadas por fecha)
    const upcoming = [...enriched]
      .filter(p => p.estado === 'Pendiente' || p.estado === 'Listo')
      .sort((a, b) => {
        const ta = a.dEntrega?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const tb = b.dEntrega?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return ta - tb;
      })
      .slice(0, 10);

    const sortedList = [...filtered].sort((a, b) => {
      const ta = a.dEntrega?.getTime() ?? 0;
      const tb = b.dEntrega?.getTime() ?? 0;
      return tb - ta;
    });

    return {
      list: sortedList,
      byEstado,
      totalReservas,
      activas,
      entregadas,
      canceladas,
      montoaAdelantos,
      montoTotal,
      montoPendiente,
      topItems,
      upcoming,
    };
  }, [pedidos, dateRange, pedidoEstado]);

  // ─── SEARCH / PAGER ─────────────────────────────────────
  const filteredHistory = useMemo(() => {
    const searchLower = txSearch.toLowerCase().trim();
    if (!searchLower) return salesMetrics.historyList;
    return salesMetrics.historyList.filter(h =>
      `b-${h.n}`.toLowerCase().includes(searchLower) ||
      String(h.n).includes(searchLower) ||
      h.cajero.toLowerCase().includes(searchLower) ||
      h.method.toLowerCase().includes(searchLower) ||
      (h.clienteNombre || '').toLowerCase().includes(searchLower) ||
      h.items.some(i => i.name.toLowerCase().includes(searchLower))
    );
  }, [salesMetrics.historyList, txSearch]);

  const filteredProductRows = useMemo(() => {
    const q = txSearch.toLowerCase().trim();
    if (!q) return productReport.rows;
    return productReport.rows.filter(r =>
      r.name.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q)
    );
  }, [productReport.rows, txSearch]);

  const filteredInsumoRows = useMemo(() => {
    const q = txSearch.toLowerCase().trim();
    if (!q) return insumoReport.rows;
    return insumoReport.rows.filter(r =>
      r.nombre.toLowerCase().includes(q) || r.unidad.toLowerCase().includes(q)
    );
  }, [insumoReport.rows, txSearch]);

  const filteredPedidoList = useMemo(() => {
    const q = txSearch.toLowerCase().trim();
    if (!q) return pedidoReport.list;
    return pedidoReport.list.filter(p =>
      String(p.id).includes(q) ||
      (p.clienteNombre || '').toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.estado.toLowerCase().includes(q)
    );
  }, [pedidoReport.list, txSearch]);

  useEffect(() => { setPage(1); }, [tab, period, customFrom, customTo, filterMethod, filterCajero, filterEstado, pedidoEstado, txSearch]);

  const listForPage =
    tab === 'ventas' ? filteredHistory :
    tab === 'productos' ? filteredProductRows :
    tab === 'insumos' ? filteredInsumoRows :
    filteredPedidoList;

  const totalPages = Math.max(1, Math.ceil(listForPage.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedSlice = listForPage.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const periodBadge =
    period === 'hoy' ? 'Hoy' :
    period === 'semana' ? 'Semana' :
    period === 'mes' ? 'Mes' :
    period === 'todo' ? 'Todo' : 'Rango';

  const activeFiltersCount = [
    filterMethod !== 'todos',
    filterCajero !== 'todos',
    filterEstado !== 'todos',
    pedidoEstado !== 'todos',
    period !== 'semana',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setPeriod('semana');
    setFilterMethod('todos');
    setFilterCajero('todos');
    setFilterEstado('todos');
    setPedidoEstado('todos');
    setTxSearch('');
    const t = toInputDate(startOfDay(new Date()));
    setCustomFrom(t);
    setCustomTo(t);
  };

  const deltaClass = (p: number | null) => {
    if (p === null || p === 0) return 'flat';
    return p > 0 ? 'up' : 'down';
  };
  const deltaIcon = (p: number | null) => {
    if (p === null || p === 0) return '●';
    return p > 0 ? '▲' : '▼';
  };

  // ─── EXPORT ─────────────────────────────────────────────
  const exportToExcel = async () => {
    try {
      const XLSX = await loadSheetJS();
      const wb = XLSX.utils.book_new();

      // Resumen
      const kpisData = [
        ['REPORTE INTEGRAL — SNACK ROQUE'],
        [`Generado: ${new Date().toLocaleString()}`],
        [`Periodo: ${dateRange.label}`],
        [`Sección activa: ${tab}`],
        [],
        ['=== VENTAS ==='],
        ['KPI', 'Valor'],
        ['Ventas netas (S/.)', salesMetrics.tv],
        ['Transacciones', salesMetrics.tr],
        ['Unidades vendidas', salesMetrics.un],
        ['Ticket promedio', salesMetrics.av],
        ['Anuladas', salesMetrics.annulledCount],
        [],
        ['=== PRODUCTOS ==='],
        ['SKUs', productReport.totalSKUs],
        ['Stock bajo', productReport.lowStock],
        ['Agotados', productReport.agotados],
        ['Valor inventario (S/.)', productReport.valorInventario],
        ['Unidades vendidas (periodo)', productReport.totalSoldUnits],
        [],
        ['=== INSUMOS ==='],
        ['Total insumos', insumoReport.total],
        ['Activos', insumoReport.activos],
        ['Stock bajo', insumoReport.bajos],
        ['Agotados', insumoReport.agotados],
        ['Valor inventario (S/.)', insumoReport.valorTotal],
        ['Compras periodo (S/.)', insumoReport.comprasPeriodo],
        [],
        ['=== PEDIDOS / RESERVAS ==='],
        ['Total en periodo', pedidoReport.totalReservas],
        ['Activas (Pend./Listo)', pedidoReport.activas],
        ['Entregadas', pedidoReport.entregadas],
        ['Canceladas', pedidoReport.canceladas],
        ['Adelantos (S/.)', pedidoReport.montoaAdelantos],
        ['Monto total reservas (S/.)', pedidoReport.montoTotal],
        ['Saldo por cobrar (S/.)', pedidoReport.montoPendiente],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpisData), 'Resumen');

      // Ventas detalle
      const txRows = [
        ['Boleta', 'Fecha', 'Hora', 'Productos', 'Cajero', 'Método', 'Total', 'Estado', 'Cliente'],
        ...filteredHistory.map(h => [
          `B-${h.n}`, h.d, h.t || '',
          h.items.map(i => `${i.name} x${i.qty}`).join(', '),
          h.cajero, h.method, h.total,
          h.estado === 0 ? 'Anulado' : 'Pagado',
          h.clienteNombre || '',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txRows), 'Ventas');

      // Productos
      const prodRows = [
        ['Producto', 'Categoría', 'Stock', 'Precio', 'Valor inv.', 'Vendidos', 'Ingresos', 'Producción', 'Descarte', 'Estado'],
        ...productReport.rows.map(r => [
          r.name, r.cat, r.stock, r.price, r.valor, r.qtySold, r.revenue, r.produccion, r.descarte, r.status,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prodRows), 'Productos');

      // Insumos
      const insRows = [
        ['Insumo', 'Stock', 'Mínimo', 'Unidad', 'Costo unit.', 'Valor', 'Comprado', 'Costo compras', 'En pedidos', 'Estado', 'Activo'],
        ...insumoReport.rows.map(r => [
          r.nombre, r.stock, r.stockMinimo, r.unidad, r.costoUnitario, r.valor,
          r.qtyComprada, r.costoCompras, r.qtyEnPedidos, r.status, r.active ? 'Sí' : 'No',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(insRows), 'Insumos');

      // Pedidos
      const pedRows = [
        ['ID', 'Cliente', 'Detalle', 'Entrega', 'Estado', 'Total', 'Adelanto', 'Saldo'],
        ...pedidoReport.list.map(p => [
          p.id,
          p.clienteNombre || '',
          p.summary,
          p.fecEntrega,
          p.estado,
          p.totalVal,
          p.adelanto,
          p.saldo,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pedRows), 'Pedidos');

      XLSX.writeFile(wb, `Reporte_Integral_Snack_Roque_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('📥 Excel integral descargado (Ventas + Productos + Insumos + Pedidos)');
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
      let y = 16;

      doc.setFontSize(15);
      doc.text('Reporte Integral POS — Snack Roque', 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generado: ${new Date().toLocaleString()}  ·  Periodo: ${dateRange.label}`, 14, y);
      y += 10;
      doc.setTextColor(40);

      const addSection = (title: string, lines: string[]) => {
        if (y > 260) { doc.addPage(); y = 16; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(title, 14, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        lines.forEach(l => {
          if (y > 280) { doc.addPage(); y = 16; }
          doc.text(l, 18, y);
          y += 5;
        });
        y += 4;
      };

      addSection('1. Ventas', [
        `Netas: ${money(salesMetrics.tv)}  ·  Ops: ${salesMetrics.tr}  ·  Und: ${salesMetrics.un}  ·  Ticket: ${money(salesMetrics.av)}`,
        `Anuladas: ${salesMetrics.annulledCount}  ·  Mejor producto: ${salesMetrics.bestProduct}`,
      ]);
      addSection('2. Productos', [
        `SKUs: ${productReport.totalSKUs}  ·  Valor inv.: ${money(productReport.valorInventario)}`,
        `Stock bajo: ${productReport.lowStock}  ·  Agotados: ${productReport.agotados}  ·  Vendidos periodo: ${productReport.totalSoldUnits}`,
      ]);
      addSection('3. Insumos', [
        `Total: ${insumoReport.total}  ·  Valor inv.: ${money(insumoReport.valorTotal)}`,
        `Bajos: ${insumoReport.bajos}  ·  Agotados: ${insumoReport.agotados}  ·  Compras periodo: ${money(insumoReport.comprasPeriodo)}`,
      ]);
      addSection('4. Pedidos / Reservas', [
        `Total: ${pedidoReport.totalReservas}  ·  Activas: ${pedidoReport.activas}  ·  Entregadas: ${pedidoReport.entregadas}  ·  Canceladas: ${pedidoReport.canceladas}`,
        `Adelantos: ${money(pedidoReport.montoaAdelantos)}  ·  Total reservas: ${money(pedidoReport.montoTotal)}  ·  Por cobrar: ${money(pedidoReport.montoPendiente)}`,
      ]);

      // Tabla según tab
      if (tab === 'ventas' && filteredHistory.length) {
        (doc as any).autoTable({
          startY: y,
          head: [['Boleta', 'Fecha', 'Cajero', 'Método', 'Total', 'Est.']],
          body: filteredHistory.slice(0, 40).map(h => [
            `B-${h.n}`, `${h.d} ${h.t || ''}`, h.cajero.slice(0, 14), h.method.slice(0, 12),
            money(h.total), h.estado === 0 ? 'Anul.' : 'OK',
          ]),
          headStyles: { fillColor: [176, 125, 46], fontSize: 8 },
          styles: { fontSize: 7.5 },
        });
      } else if (tab === 'productos') {
        (doc as any).autoTable({
          startY: y,
          head: [['Producto', 'Cat.', 'Stock', 'Vend.', 'Ingresos', 'Est.']],
          body: productReport.rows.slice(0, 40).map(r => [
            r.name.slice(0, 22), r.cat.slice(0, 12), r.stock, r.qtySold, money(r.revenue), r.status,
          ]),
          headStyles: { fillColor: [176, 125, 46], fontSize: 8 },
          styles: { fontSize: 7.5 },
        });
      } else if (tab === 'insumos') {
        (doc as any).autoTable({
          startY: y,
          head: [['Insumo', 'Stock', 'Mín', 'Costo', 'Valor', 'Est.']],
          body: insumoReport.rows.slice(0, 40).map(r => [
            r.nombre.slice(0, 22), `${r.stock} ${r.unidad}`, r.stockMinimo, money(r.costoUnitario), money(r.valor), r.status,
          ]),
          headStyles: { fillColor: [176, 125, 46], fontSize: 8 },
          styles: { fontSize: 7.5 },
        });
      } else if (tab === 'pedidos') {
        (doc as any).autoTable({
          startY: y,
          head: [['ID', 'Cliente', 'Entrega', 'Estado', 'Total', 'Adelanto']],
          body: pedidoReport.list.slice(0, 40).map(p => [
            String(p.id).slice(0, 10),
            (p.clienteNombre || '—').slice(0, 16),
            p.fecEntrega?.slice(0, 12) || '—',
            p.estado,
            money(p.totalVal),
            money(p.adelanto || 0),
          ]),
          headStyles: { fillColor: [176, 125, 46], fontSize: 8 },
          styles: { fontSize: 7.5 },
        });
      }

      doc.save(`Reporte_Integral_Snack_Roque_${new Date().toISOString().split('T')[0]}.pdf`);
      toast('📥 PDF integral descargado');
    } catch (err: any) {
      console.error(err);
      alert('Error al exportar PDF: ' + err.message);
    }
  };

  const dTv = pctChange(salesMetrics.tv, salesMetrics.prevTv);
  const dTr = pctChange(salesMetrics.tr, salesMetrics.prevTr);
  const dUn = pctChange(salesMetrics.un, salesMetrics.prevUn);
  const dAv = pctChange(salesMetrics.av, salesMetrics.prevAv);
  const showCompare = !!(dateRange.from && dateRange.to);

  const statusBadge = (status: string) => {
    if (status === 'agotado') return <span className="tag" style={{ background: 'rgba(220,53,69,0.1)', color: 'var(--red)', border: '1px solid rgba(220,53,69,0.2)' }}>Agotado</span>;
    if (status === 'bajo') return <span className="tag" style={{ background: 'rgba(176,125,46,0.12)', color: 'var(--accent)', border: '1px solid rgba(176,125,46,0.25)' }}>Bajo</span>;
    return <span className="tag tg-ok">OK</span>;
  };

  return (
    <div className="screen active">
      {/* HERO */}
      <div className="rep-hero">
        <div>
          <h2 className="rep-hero-title">Centro de Analítica</h2>
          <p className="rep-hero-sub">
            Ventas, catálogo de productos, insumos y pedidos/reservas en un solo panel.
            Exporta el informe integral con un clic.
          </p>
        </div>
        <div className="rep-hero-meta">
          <span className="rep-meta-chip">📅 <strong>{dateRange.label}</strong></span>
          <span className="rep-meta-chip">💰 <strong>{money(salesMetrics.tv)}</strong></span>
          <span className="rep-meta-chip">📋 <strong>{pedidoReport.totalReservas}</strong> reservas</span>
          <button type="button" className="rep-btn-export" onClick={exportToPdf}>📄 PDF</button>
          <button type="button" className="rep-btn-export primary" onClick={exportToExcel}>📊 Excel integral</button>
        </div>
      </div>

      {/* TABS */}
      <div className="rep-period-pills" style={{ marginBottom: 14, borderRadius: 14, padding: 5 }}>
        {REPORT_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={`rep-period-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
            style={{ borderRadius: 10, padding: '8px 16px' }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* FILTERS */}
      <div className="rep-filters">
        <div className="rep-filters-head">
          <div className="rep-filters-title">
            🎛️ Filtros del reporte
            <span className="rep-filters-hint">
              {activeFiltersCount > 0
                ? `${activeFiltersCount} personalizado${activeFiltersCount > 1 ? 's' : ''}`
                : 'Periodo por defecto: semana actual'}
            </span>
          </div>
          {activeFiltersCount > 0 && (
            <button type="button" className="rep-btn-ghost" onClick={clearFilters}>✕ Restablecer</button>
          )}
        </div>

        <div className="rep-period-pills">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              className={`rep-period-btn${period === opt.key ? ' active' : ''}`}
              onClick={() => setPeriod(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="rep-filter-row">
          {period === 'custom' && (
            <>
              <div className="rep-field">
                <label>Desde</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div className="rep-field">
                <label>Hasta</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </>
          )}

          {tab === 'ventas' && (
            <>
              <div className="rep-field">
                <label>Método de pago</label>
                <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
                  <option value="todos">Todos los métodos</option>
                  {methods.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="rep-field">
                <label>Cajero</label>
                <select value={filterCajero} onChange={e => setFilterCajero(e.target.value)}>
                  <option value="todos">Todos los cajeros</option>
                  {cajeros.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="rep-field">
                <label>Estado venta</label>
                <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as EstadoFiltro)}>
                  <option value="todos">Todos</option>
                  <option value="pagado">Solo pagados</option>
                  <option value="anulado">Solo anulados</option>
                </select>
              </div>
            </>
          )}

          {tab === 'pedidos' && (
            <div className="rep-field">
              <label>Estado pedido</label>
              <select value={pedidoEstado} onChange={e => setPedidoEstado(e.target.value as PedidoEstadoFiltro)}>
                <option value="todos">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Listo">Listo</option>
                <option value="Entregado">Entregado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ TAB: VENTAS ═══════════ */}
      {tab === 'ventas' && (
        <>
          <div className="stats-4" style={{ marginBottom: 18 }}>
            <div className="stat-tile">
              <div className="st-header">
                <div className="st-icon ic-lav">💰</div>
                <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>{periodBadge}</div>
              </div>
              <div className="st-val">{money(salesMetrics.tv)}</div>
              <div className="st-lbl">Ventas netas</div>
              {showCompare && <div className={`rep-kpi-delta ${deltaClass(dTv)}`}>{deltaIcon(dTv)} {formatPct(dTv)} vs ant.</div>}
            </div>
            <div className="stat-tile">
              <div className="st-header">
                <div className="st-icon ic-blush">🛒</div>
                <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>{periodBadge}</div>
              </div>
              <div className="st-val">{salesMetrics.tr}</div>
              <div className="st-lbl">Transacciones</div>
              {showCompare && <div className={`rep-kpi-delta ${deltaClass(dTr)}`}>{deltaIcon(dTr)} {formatPct(dTr)} vs ant.</div>}
            </div>
            <div className="stat-tile">
              <div className="st-header">
                <div className="st-icon ic-peach">📦</div>
                <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>{periodBadge}</div>
              </div>
              <div className="st-val">{salesMetrics.un}</div>
              <div className="st-lbl">Unidades vendidas</div>
              {showCompare && <div className={`rep-kpi-delta ${deltaClass(dUn)}`}>{deltaIcon(dUn)} {formatPct(dUn)} vs ant.</div>}
            </div>
            <div className="stat-tile">
              <div className="st-header">
                <div className="st-icon ic-mint">💳</div>
                <div className="st-delta d-up">Prom.</div>
              </div>
              <div className="st-val">{salesMetrics.tr > 0 ? money(salesMetrics.av) : '—'}</div>
              <div className="st-lbl">Ticket promedio</div>
              {showCompare && (
                <div className={`rep-kpi-delta ${deltaClass(dAv)}`}>
                  {deltaIcon(dAv)} {formatPct(dAv)} vs ant.
                  {salesMetrics.annulledCount > 0 && <span style={{ marginLeft: 6, color: 'var(--red)' }}>· {salesMetrics.annulledCount} anul.</span>}
                </div>
              )}
            </div>
          </div>

          <div className="rep-grid-main">
            <div className="panel">
              <div className="rep-panel-head">
                <div>
                  <h3>{salesMetrics.chartTitle}</h3>
                  <p>{salesMetrics.chartSub}</p>
                </div>
                {salesMetrics.peakVal > 0 && (
                  <span className="rep-meta-chip">📈 Pico: <strong>{salesMetrics.peakLabel}</strong> · {money(salesMetrics.peakVal)}</span>
                )}
              </div>
              {salesMetrics.hasSales || salesMetrics.barTotals.some(v => v > 0) ? (
                <>
                  <div className="chart-wrap" style={{ overflowX: salesMetrics.barLabels.length > 12 ? 'auto' : undefined, gap: salesMetrics.barLabels.length > 16 ? 4 : 10 }}>
                    {salesMetrics.barTotals.map((val, i) => {
                      const pct = Math.max(val > 0 ? 6 : 0, (val / salesMetrics.maxBarTotal) * 100);
                      const key = salesMetrics.barKeys[i];
                      const isHl = salesMetrics.highlightKey != null && key === salesMetrics.highlightKey;
                      return (
                        <div className="bc" key={`${key}-${i}`} style={{ minWidth: salesMetrics.barLabels.length > 16 ? 16 : undefined }} title={`${salesMetrics.barLabels[i]}: ${money(val)}`}>
                          <div className="bbar" style={{ height: `${pct}%`, opacity: val === 0 ? 0.18 : isHl ? 1 : 0.62, background: isHl ? 'linear-gradient(180deg, var(--accent), var(--accent-dark))' : undefined }} />
                          <span className="blbl" style={{ color: isHl ? 'var(--accent)' : undefined, fontWeight: isHl ? 800 : undefined, fontSize: salesMetrics.barLabels.length > 16 ? 8 : undefined }}>
                            {salesMetrics.barLabels[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rep-chart-values" style={{ overflowX: salesMetrics.barLabels.length > 12 ? 'auto' : undefined }}>
                    {salesMetrics.barTotals.map((val, i) => (
                      <div key={`v-${i}`} className={`rep-chart-val${salesMetrics.highlightKey === salesMetrics.barKeys[i] ? ' hl' : ''}`}>
                        {val > 0 ? `S/. ${val.toFixed(0)}` : '—'}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rep-chart-empty">
                  <span className="ico">📊</span>
                  <span className="t1">Sin ventas en este periodo</span>
                  <span className="t2">Ajusta los filtros o registra operaciones en el POS</span>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="rep-panel-head">
                <div>
                  <h3>Ranking de productos</h3>
                  <p>Por ingresos del periodo</p>
                </div>
              </div>
              {salesMetrics.topProducts.length > 0 ? salesMetrics.topProducts.map((p, i) => (
                <div className="rep-rank-row" key={p.name}>
                  <div className="rep-rank-num" style={{ background: i === 0 ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : 'var(--bg-card2)', border: i === 0 ? 'none' : '1px solid var(--border)', color: i === 0 ? '#fff' : 'var(--text-2)' }}>{i + 1}</div>
                  <div className="rep-rank-body">
                    <div className="rep-rank-name">{p.name}</div>
                    <div className="rep-rank-meta">{p.qty} und.</div>
                    <div className="rep-rank-bar-track">
                      <div className="rep-rank-bar-fill" style={{ width: `${Math.max(4, (p.revenue / salesMetrics.maxProdRev) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="rep-rank-val">{money(p.revenue)}</div>
                </div>
              )) : (
                <div className="rep-chart-empty" style={{ padding: '28px 12px' }}><span className="t1">Sin datos</span></div>
              )}
            </div>
          </div>

          <div className="rep-grid-3">
            <div className="panel">
              <div className="rep-panel-head"><div><h3>Métodos de pago</h3><p>Participación sobre ventas netas</p></div></div>
              {salesMetrics.byMethod.length === 0 ? <div className="rep-chart-empty" style={{ padding: 24 }}><span className="t1">Sin desglose</span></div> :
                salesMetrics.byMethod.map((m, i) => {
                  const share = salesMetrics.tv > 0 ? (m.total / salesMetrics.tv) * 100 : 0;
                  return (
                    <div className="rep-method-row" key={m.name}>
                      <div className="rep-method-top"><strong>{m.name}</strong><span>{money(m.total)}</span></div>
                      <div className="rep-progress"><i style={{ width: `${Math.max(3, (m.total / salesMetrics.maxMethod) * 100)}%`, background: METHOD_COLORS[i % METHOD_COLORS.length] }} /></div>
                      <div className="rep-method-sub">{m.count} ops · {share.toFixed(1)}%</div>
                    </div>
                  );
                })}
            </div>
            <div className="panel">
              <div className="rep-panel-head"><div><h3>Por cajero</h3><p>Volumen y ticket promedio</p></div></div>
              {salesMetrics.byCajero.length === 0 ? <div className="rep-chart-empty" style={{ padding: 24 }}><span className="t1">Sin datos</span></div> :
                salesMetrics.byCajero.map(c => (
                  <div className="rep-cajero-row" key={c.name}>
                    <div className="rep-method-top"><strong>🧑‍💼 {c.name}</strong><span>{money(c.total)}</span></div>
                    <div className="rep-progress alt"><i style={{ width: `${Math.max(3, (c.total / salesMetrics.maxCajero) * 100)}%` }} /></div>
                    <div className="rep-method-sub">{c.count} ventas · prom. {money(c.count > 0 ? c.total / c.count : 0)}</div>
                  </div>
                ))}
            </div>
            <div className="panel">
              <div className="rep-panel-head"><div><h3>Insights</h3><p>Resumen ejecutivo</p></div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="rep-insight">🏆 <strong>Mejor producto:</strong> {salesMetrics.bestProduct}</div>
                <div className="rep-insight">💳 <strong>Método dominante:</strong> {salesMetrics.bestMethod}</div>
                <div className="rep-insight">🧑‍💼 <strong>Cajero top:</strong> {salesMetrics.bestCajero}</div>
                <div className="rep-insight">📈 <strong>Pico:</strong> {salesMetrics.peakVal > 0 ? `${salesMetrics.peakLabel} (${money(salesMetrics.peakVal)})` : 'Sin datos'}</div>
              </div>
            </div>
          </div>

          {/* Sales table */}
          <div className="panel">
            <div className="rep-panel-head" style={{ marginBottom: 8 }}>
              <div>
                <h3>Historial de transacciones</h3>
                <p>{filteredHistory.length} registro{filteredHistory.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="rep-table-toolbar">
              <div className="inp-wrap" style={{ flex: 1, maxWidth: 420 }}>
                <span className="inp-icon">🔍</span>
                <input type="text" placeholder="Buscar boleta, cajero, método, producto..." value={txSearch} onChange={e => setTxSearch(e.target.value)} />
              </div>
            </div>
            {filteredHistory.length === 0 ? (
              <div className="rep-chart-empty"><span className="ico">🧾</span><span className="t1">Sin transacciones</span></div>
            ) : (
              <>
                <div className="rep-table-wrap">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Boleta</th><th>Fecha</th><th>Productos</th><th>Cliente</th><th>Cajero</th><th>Método</th><th>Total</th><th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pagedSlice as typeof filteredHistory).map((h, idx) => (
                        <tr key={h.id || idx} className={h.estado === 0 ? 'annulled' : undefined}>
                          <td><span className="rep-boleta">#B-{h.n}</span></td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{h.d}{h.t ? ` · ${h.t}` : ''}</td>
                          <td><div className="rep-products-cell" title={h.items.map(i => `${i.name} ×${i.qty}`).join(', ')}>{h.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</div></td>
                          <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{h.clienteNombre || '—'}</td>
                          <td>{h.cajero}</td>
                          <td><span className="tag tg-blue">{h.method}</span></td>
                          <td className="rep-money">{money(h.total)}</td>
                          <td>{h.estado === 0 ? <span className="tag" style={{ background: 'rgba(220,53,69,0.1)', color: 'var(--red)' }}>Anulado</span> : <span className="tag tg-ok">Pagado</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager pageSafe={pageSafe} totalPages={totalPages} total={filteredHistory.length} setPage={setPage} pageSize={PAGE_SIZE} />
              </>
            )}
          </div>
        </>
      )}

      {/* ═══════════ TAB: PRODUCTOS ═══════════ */}
      {tab === 'productos' && (
        <>
          <div className="stats-4" style={{ marginBottom: 18 }}>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-lav">🥖</div><div className="st-delta d-up">Catálogo</div></div>
              <div className="st-val">{productReport.totalSKUs}</div>
              <div className="st-lbl">Productos activos</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-blush">💎</div><div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>Inv.</div></div>
              <div className="st-val" style={{ fontSize: 22 }}>{money(productReport.valorInventario)}</div>
              <div className="st-lbl">Valor de inventario</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-peach">📦</div><div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>{periodBadge}</div></div>
              <div className="st-val">{productReport.totalSoldUnits}</div>
              <div className="st-lbl">Unidades vendidas</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-mint">⚠️</div><div className={productReport.lowStock + productReport.agotados > 0 ? 'st-delta d-down' : 'st-delta d-up'}>{productReport.agotados > 0 ? 'Crítico' : productReport.lowStock > 0 ? 'Alerta' : 'OK'}</div></div>
              <div className="st-val" style={{ color: productReport.agotados > 0 ? 'var(--red)' : undefined }}>{productReport.lowStock + productReport.agotados}</div>
              <div className="st-lbl">{productReport.lowStock} bajos · {productReport.agotados} agotados</div>
            </div>
          </div>

          <div className="rep-grid-main">
            <div className="panel">
              <div className="rep-panel-head"><div><h3>Ventas por categoría</h3><p>Ingresos del periodo filtrado</p></div></div>
              {productReport.categories.length === 0 ? (
                <div className="rep-chart-empty" style={{ padding: 24 }}><span className="t1">Sin categorías</span></div>
              ) : (
                productReport.categories.map((c, i) => {
                  const max = productReport.categories[0]?.revenue || 1;
                  return (
                    <div className="rep-method-row" key={c.name}>
                      <div className="rep-method-top"><strong>{c.name}</strong><span>{money(c.revenue)}</span></div>
                      <div className="rep-progress"><i style={{ width: `${Math.max(3, (c.revenue / max) * 100)}%`, background: METHOD_COLORS[i % METHOD_COLORS.length] }} /></div>
                      <div className="rep-method-sub">{c.count} SKUs · stock {c.stock} und.</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="panel">
              <div className="rep-panel-head"><div><h3>Alertas de stock</h3><p>Productos bajo umbral (&lt; {LOW_STOCK}) o agotados</p></div></div>
              {productReport.alerts.length === 0 ? (
                <div className="rep-insight">✅ Inventario de productos en niveles saludables</div>
              ) : (
                productReport.alerts.slice(0, 10).map(r => (
                  <div className="rep-rank-row" key={r.id}>
                    <div className="rep-rank-body">
                      <div className="rep-rank-name">{r.name}</div>
                      <div className="rep-rank-meta">{r.cat} · stock {r.stock}</div>
                    </div>
                    {statusBadge(r.status)}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="rep-panel-head" style={{ marginBottom: 8 }}>
              <div>
                <h3>Inventario y desempeño de productos</h3>
                <p>Stock actual + ventas/producción del periodo · {filteredProductRows.length} filas</p>
              </div>
            </div>
            <div className="rep-table-toolbar">
              <div className="inp-wrap" style={{ flex: 1, maxWidth: 420 }}>
                <span className="inp-icon">🔍</span>
                <input type="text" placeholder="Buscar producto o categoría..." value={txSearch} onChange={e => setTxSearch(e.target.value)} />
              </div>
            </div>
            {filteredProductRows.length === 0 ? (
              <div className="rep-chart-empty"><span className="t1">Sin productos</span></div>
            ) : (
              <>
                <div className="rep-table-wrap">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Producto</th><th>Categoría</th><th>Stock</th><th>Precio</th><th>Valor inv.</th>
                        <th>Vendidos</th><th>Ingresos</th><th>Producción</th><th>Descarte</th><th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pagedSlice as typeof filteredProductRows).map(r => (
                        <tr key={r.id}>
                          <td><strong>{r.name}</strong>{r.versions > 0 && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 6 }}>{r.versions} var.</span>}</td>
                          <td><span className="tag tg-blue">{r.cat}</span></td>
                          <td style={{ fontWeight: 700 }}>{r.stock}</td>
                          <td>{money(r.price)}</td>
                          <td className="rep-money">{money(r.valor)}</td>
                          <td>{r.qtySold}</td>
                          <td className="rep-money">{money(r.revenue)}</td>
                          <td style={{ color: 'var(--green)' }}>{r.produccion || '—'}</td>
                          <td style={{ color: r.descarte > 0 ? 'var(--red)' : 'var(--text-3)' }}>{r.descarte || '—'}</td>
                          <td>{statusBadge(r.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager pageSafe={pageSafe} totalPages={totalPages} total={filteredProductRows.length} setPage={setPage} pageSize={PAGE_SIZE} />
              </>
            )}
          </div>
        </>
      )}

      {/* ═══════════ TAB: INSUMOS ═══════════ */}
      {tab === 'insumos' && (
        <>
          <div className="stats-4" style={{ marginBottom: 18 }}>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-lav">🌾</div><div className="st-delta d-up">Activos</div></div>
              <div className="st-val">{insumoReport.activos}</div>
              <div className="st-lbl">de {insumoReport.total} insumos</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-blush">💎</div><div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>Inv.</div></div>
              <div className="st-val" style={{ fontSize: 22 }}>{money(insumoReport.valorTotal)}</div>
              <div className="st-lbl">Valor de inventario</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-peach">🛒</div><div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>{periodBadge}</div></div>
              <div className="st-val" style={{ fontSize: 22 }}>{money(insumoReport.comprasPeriodo)}</div>
              <div className="st-lbl">Compras del periodo</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-mint">⚠️</div><div className={insumoReport.bajos + insumoReport.agotados > 0 ? 'st-delta d-down' : 'st-delta d-up'}>{insumoReport.agotados > 0 ? 'Crítico' : insumoReport.bajos > 0 ? 'Alerta' : 'OK'}</div></div>
              <div className="st-val" style={{ color: insumoReport.agotados > 0 ? 'var(--red)' : undefined }}>{insumoReport.bajos + insumoReport.agotados}</div>
              <div className="st-lbl">{insumoReport.bajos} bajos · {insumoReport.agotados} agotados</div>
            </div>
          </div>

          <div className="rep-grid-main">
            <div className="panel">
              <div className="rep-panel-head"><div><h3>Alertas de reposición</h3><p>Bajo mínimo o sin stock</p></div></div>
              {insumoReport.alerts.length === 0 ? (
                <div className="rep-insight">✅ Todos los insumos por encima del mínimo</div>
              ) : (
                insumoReport.alerts.slice(0, 12).map(r => (
                  <div className="rep-rank-row" key={r.id}>
                    <div className="rep-rank-body">
                      <div className="rep-rank-name">{r.nombre}</div>
                      <div className="rep-rank-meta">
                        stock {r.stock} {r.unidad} · mín. {r.stockMinimo} · costo {money(r.costoUnitario)}
                      </div>
                    </div>
                    {statusBadge(r.status)}
                  </div>
                ))
              )}
            </div>
            <div className="panel">
              <div className="rep-panel-head"><div><h3>Resumen del periodo</h3><p>Movimiento de insumos</p></div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="rep-insight">📥 <strong>Cantidad comprada:</strong> {insumoReport.qtyCompradaPeriodo.toFixed(2)} und. totales</div>
                <div className="rep-insight">💵 <strong>Inversión en compras:</strong> {money(insumoReport.comprasPeriodo)}</div>
                <div className="rep-insight">📦 <strong>Valor actual en almacén:</strong> {money(insumoReport.valorTotal)}</div>
                <div className="rep-insight">⚠️ <strong>Requieren atención:</strong> {insumoReport.alerts.length} insumo{insumoReport.alerts.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="rep-panel-head" style={{ marginBottom: 8 }}>
              <div>
                <h3>Inventario de insumos</h3>
                <p>Stock, costos, compras y uso en pedidos · {filteredInsumoRows.length} filas</p>
              </div>
            </div>
            <div className="rep-table-toolbar">
              <div className="inp-wrap" style={{ flex: 1, maxWidth: 420 }}>
                <span className="inp-icon">🔍</span>
                <input type="text" placeholder="Buscar insumo..." value={txSearch} onChange={e => setTxSearch(e.target.value)} />
              </div>
            </div>
            {filteredInsumoRows.length === 0 ? (
              <div className="rep-chart-empty"><span className="t1">Sin insumos registrados</span></div>
            ) : (
              <>
                <div className="rep-table-wrap">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Insumo</th><th>Stock</th><th>Mínimo</th><th>Unidad</th><th>Costo unit.</th>
                        <th>Valor</th><th>Comprado</th><th>$ Compras</th><th>En pedidos</th><th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pagedSlice as typeof filteredInsumoRows).map(r => (
                        <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                          <td><strong>{r.nombre}</strong>{!r.active && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 6 }}>inactivo</span>}</td>
                          <td style={{ fontWeight: 800, color: r.status === 'agotado' ? 'var(--red)' : r.status === 'bajo' ? 'var(--accent)' : undefined }}>{r.stock}</td>
                          <td>{r.stockMinimo}</td>
                          <td>{r.unidad}</td>
                          <td>{money(r.costoUnitario)}</td>
                          <td className="rep-money">{money(r.valor)}</td>
                          <td>{r.qtyComprada > 0 ? r.qtyComprada : '—'}</td>
                          <td className="rep-money">{r.costoCompras > 0 ? money(r.costoCompras) : '—'}</td>
                          <td>{r.qtyEnPedidos > 0 ? r.qtyEnPedidos : '—'}</td>
                          <td>{statusBadge(r.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager pageSafe={pageSafe} totalPages={totalPages} total={filteredInsumoRows.length} setPage={setPage} pageSize={PAGE_SIZE} />
              </>
            )}
          </div>
        </>
      )}

      {/* ═══════════ TAB: PEDIDOS ═══════════ */}
      {tab === 'pedidos' && (
        <>
          <div className="stats-4" style={{ marginBottom: 18 }}>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-lav">📋</div><div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>{periodBadge}</div></div>
              <div className="st-val">{pedidoReport.totalReservas}</div>
              <div className="st-lbl">Reservas en periodo</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-blush">⏳</div><div className="st-delta d-up">Activas</div></div>
              <div className="st-val">{pedidoReport.activas}</div>
              <div className="st-lbl">Pendientes + Listos</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-peach">💵</div><div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>Adelantos</div></div>
              <div className="st-val" style={{ fontSize: 22 }}>{money(pedidoReport.montoaAdelantos)}</div>
              <div className="st-lbl">Cobrados por adelantado</div>
            </div>
            <div className="stat-tile">
              <div className="st-header"><div className="st-icon ic-mint">🧾</div><div className="st-delta d-down">Por cobrar</div></div>
              <div className="st-val" style={{ fontSize: 22 }}>{money(pedidoReport.montoPendiente)}</div>
              <div className="st-lbl">Saldo de reservas activas</div>
            </div>
          </div>

          <div className="rep-grid-3">
            <div className="panel">
              <div className="rep-panel-head"><div><h3>Por estado</h3><p>Distribución del periodo</p></div></div>
              {(['Pendiente', 'Listo', 'Entregado', 'Cancelado'] as const).map((est, i) => {
                const n = pedidoReport.byEstado[est] || 0;
                const max = Math.max(...Object.values(pedidoReport.byEstado), 1);
                return (
                  <div className="rep-method-row" key={est}>
                    <div className="rep-method-top">
                      <strong>{est}</strong>
                      <span>{n}</span>
                    </div>
                    <div className="rep-progress">
                      <i style={{ width: `${Math.max(n > 0 ? 4 : 0, (n / max) * 100)}%`, background: METHOD_COLORS[i % METHOD_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              <div className="rep-insight" style={{ marginTop: 8 }}>
                💰 <strong>Monto total reservas:</strong> {money(pedidoReport.montoTotal)}
                <br />✅ Entregadas: {pedidoReport.entregadas} · 🚫 Canceladas: {pedidoReport.canceladas}
              </div>
            </div>

            <div className="panel">
              <div className="rep-panel-head"><div><h3>Ítems más reservados</h3><p>Productos / insumos en pedidos</p></div></div>
              {pedidoReport.topItems.length === 0 ? (
                <div className="rep-chart-empty" style={{ padding: 24 }}><span className="t1">Sin ítems en reservas</span></div>
              ) : (
                pedidoReport.topItems.map((it, i) => (
                  <div className="rep-rank-row" key={it.name}>
                    <div className="rep-rank-num" style={{ background: i === 0 ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : 'var(--bg-card2)', border: i === 0 ? 'none' : '1px solid var(--border)', color: i === 0 ? '#fff' : 'var(--text-2)' }}>{i + 1}</div>
                    <div className="rep-rank-body">
                      <div className="rep-rank-name">{it.name}</div>
                      <div className="rep-rank-meta">{it.qty} und. · {money(it.revenue)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="panel">
              <div className="rep-panel-head"><div><h3>Próximas entregas</h3><p>Pendiente / Listo · más cercanas</p></div></div>
              {pedidoReport.upcoming.length === 0 ? (
                <div className="rep-insight">📭 No hay entregas pendientes</div>
              ) : (
                pedidoReport.upcoming.map(p => (
                  <div className="rep-rank-row" key={String(p.id)}>
                    <div className="rep-rank-body">
                      <div className="rep-rank-name">{p.clienteNombre || 'Cliente'}</div>
                      <div className="rep-rank-meta">
                        {p.fecEntrega || 'Sin fecha'} · {p.summary.slice(0, 40)}{p.summary.length > 40 ? '…' : ''}
                      </div>
                    </div>
                    <span className="tag" style={estadoTagStyle(p.estado)}>{p.estado}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="rep-panel-head" style={{ marginBottom: 8 }}>
              <div>
                <h3>Listado de pedidos / reservas</h3>
                <p>{filteredPedidoList.length} registro{filteredPedidoList.length !== 1 ? 's' : ''} · filtro estado: {pedidoEstado}</p>
              </div>
            </div>
            <div className="rep-table-toolbar">
              <div className="inp-wrap" style={{ flex: 1, maxWidth: 420 }}>
                <span className="inp-icon">🔍</span>
                <input type="text" placeholder="Buscar cliente, ID, detalle o estado..." value={txSearch} onChange={e => setTxSearch(e.target.value)} />
              </div>
            </div>
            {filteredPedidoList.length === 0 ? (
              <div className="rep-chart-empty">
                <span className="ico">📋</span>
                <span className="t1">Sin pedidos con estos filtros</span>
                <span className="t2">Cambia el periodo o el estado</span>
              </div>
            ) : (
              <>
                <div className="rep-table-wrap">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>ID</th><th>Cliente</th><th>Detalle</th><th>Entrega</th><th>Estado</th>
                        <th>Total</th><th>Adelanto</th><th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pagedSlice as typeof filteredPedidoList).map(p => (
                        <tr key={String(p.id)} style={{ opacity: p.estado === 'Cancelado' ? 0.6 : 1 }}>
                          <td><span className="rep-boleta">#{String(p.id).startsWith('local_') ? 'Local' : p.id}</span></td>
                          <td><strong>{p.clienteNombre || '—'}</strong></td>
                          <td><div className="rep-products-cell" title={p.summary}>{p.summary || '—'}</div></td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{p.fecEntrega || '—'}</td>
                          <td><span className="tag" style={estadoTagStyle(p.estado)}>{p.estado}</span></td>
                          <td className="rep-money">{money(p.totalVal)}</td>
                          <td>{money(p.adelanto || 0)}</td>
                          <td style={{ fontWeight: 700, color: p.saldo > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{money(p.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager pageSafe={pageSafe} totalPages={totalPages} total={filteredPedidoList.length} setPage={setPage} pageSize={PAGE_SIZE} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Pager({
  pageSafe, totalPages, total, setPage, pageSize,
}: {
  pageSafe: number;
  totalPages: number;
  total: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
}) {
  return (
    <div className="rep-pager">
      <span>
        Mostrando {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, total)} de {total}
      </span>
      <div className="rep-pager-btns">
        <button type="button" disabled={pageSafe <= 1} onClick={() => setPage(1)}>«</button>
        <button type="button" disabled={pageSafe <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
        <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
        <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage(totalPages)}>»</button>
      </div>
    </div>
  );
}
