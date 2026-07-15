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

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
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

  // ─── EXPORT (solo pestaña + filtros activos) ────────────
  const tabLabel =
    tab === 'ventas' ? 'Ventas' :
    tab === 'productos' ? 'Productos' :
    tab === 'insumos' ? 'Insumos' : 'Pedidos';

  const filterSummaryLines = (): string[] => {
    const lines = [
      `Periodo: ${dateRange.label}`,
      `Generado: ${new Date().toLocaleString('es-PE')}`,
      `Módulo: ${tabLabel}`,
    ];
    if (tab === 'ventas') {
      lines.push(`Método: ${filterMethod === 'todos' ? 'Todos' : filterMethod}`);
      lines.push(`Cajero: ${filterCajero === 'todos' ? 'Todos' : filterCajero}`);
      lines.push(`Estado venta: ${filterEstado === 'todos' ? 'Todos' : filterEstado === 'pagado' ? 'Pagado' : 'Anulado'}`);
    }
    if (tab === 'pedidos') {
      lines.push(`Estado pedido: ${pedidoEstado === 'todos' ? 'Todos' : pedidoEstado}`);
    }
    if (txSearch.trim()) lines.push(`Búsqueda: "${txSearch.trim()}"`);
    lines.push(`Registros exportados: ${listForPage.length}`);
    return lines;
  };

  const safeFileSlug = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'Reporte';

  const exportFileBase = () => {
    const datePart = new Date().toISOString().split('T')[0];
    const periodPart = safeFileSlug(periodBadge);
    return `SnackRoque_${safeFileSlug(tabLabel)}_${periodPart}_${datePart}`;
  };

  /** Construye hoja Excel profesional: cabecera + filtros + tabla con anchos y autofilter */
  const buildExcelSheet = (
    XLSX: any,
    opts: {
      title: string;
      meta: string[];
      headers: string[];
      rows: (string | number | null | undefined)[][];
      colWidths?: number[];
      moneyCols?: number[]; // índices 0-based en la tabla (no en meta)
      totalsRow?: (string | number | null | undefined)[];
    }
  ) => {
    const aoa: (string | number | null | undefined)[][] = [];
    aoa.push([opts.title]);
    aoa.push(['Snack Roque — Sistema POS / Gestión']);
    aoa.push([]);
    aoa.push(['CRITERIOS DE FILTRO APLICADOS']);
    opts.meta.forEach(m => aoa.push([m]));
    aoa.push([]);
    const headerRowIndex = aoa.length; // 0-based in aoa
    aoa.push(opts.headers);
    opts.rows.forEach(r => aoa.push(r));
    if (opts.totalsRow) {
      aoa.push([]);
      aoa.push(opts.totalsRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Anchos de columna
    const widths = opts.colWidths || opts.headers.map((h, i) => {
      const maxCell = Math.max(
        h.length,
        ...opts.rows.map(r => String(r[i] ?? '').length)
      );
      return Math.min(42, Math.max(10, maxCell + 2));
    });
    ws['!cols'] = widths.map(w => ({ wch: w }));

    // Merge título
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(opts.headers.length - 1, 0) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(opts.headers.length - 1, 0) } },
    ];

    // Congelar cabecera de tabla
    ws['!freeze'] = { xSplit: 0, ySplit: headerRowIndex + 1 };
    // Algunos visores usan esta forma:
    if (!ws['!views']) ws['!views'] = [{ state: 'frozen', ySplit: headerRowIndex + 1, topLeftCell: `A${headerRowIndex + 2}`, activeCell: `A${headerRowIndex + 2}` }];

    // AutoFilter sobre la tabla de datos
    const lastCol = colLetter(opts.headers.length - 1);
    const firstDataRow = headerRowIndex + 1; // 1-based excel
    const lastDataRow = headerRowIndex + 1 + opts.rows.length;
    if (opts.rows.length > 0) {
      ws['!autofilter'] = { ref: `A${firstDataRow}:${lastCol}${lastDataRow}` };
    }

    // Formato numérico en columnas de dinero (best-effort SheetJS community)
    if (opts.moneyCols?.length) {
      for (let r = 0; r < opts.rows.length; r++) {
        for (const c of opts.moneyCols) {
          const addr = `${colLetter(c)}${headerRowIndex + 2 + r}`;
          const cell = ws[addr];
          if (cell && typeof cell.v === 'number') {
            cell.t = 'n';
            cell.z = '"S/." #,##0.00';
          }
        }
      }
    }

    return ws;
  };

  const colLetter = (idx: number) => {
    let n = idx;
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  };

  const appendSheet = (XLSX: any, wb: any, name: string, ws: any) => {
    const safe = name.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await loadSheetJS();
      const wb = XLSX.utils.book_new();
      const meta = filterSummaryLines();
      const rowsCount = listForPage.length;

      if (rowsCount === 0) {
        toast('⚠️ No hay datos con los filtros actuales para exportar');
        return;
      }

      if (tab === 'ventas') {
        // Hoja 1: Resumen KPIs (solo ventas filtradas)
        const resumenWs = buildExcelSheet(XLSX, {
          title: 'REPORTE DE VENTAS — RESUMEN',
          meta,
          headers: ['Indicador', 'Valor', 'Periodo anterior', 'Variación %'],
          rows: [
            ['Ventas netas (S/.)', round2(salesMetrics.tv), round2(salesMetrics.prevTv), formatPct(pctChange(salesMetrics.tv, salesMetrics.prevTv))],
            ['Transacciones', salesMetrics.tr, salesMetrics.prevTr, formatPct(pctChange(salesMetrics.tr, salesMetrics.prevTr))],
            ['Unidades vendidas', salesMetrics.un, salesMetrics.prevUn, formatPct(pctChange(salesMetrics.un, salesMetrics.prevUn))],
            ['Ticket promedio (S/.)', round2(salesMetrics.av), round2(salesMetrics.prevAv), formatPct(pctChange(salesMetrics.av, salesMetrics.prevAv))],
            ['Anuladas (en filtro)', salesMetrics.annulledCount, '', ''],
            ['Mejor producto', salesMetrics.bestProduct, '', ''],
            ['Método dominante', salesMetrics.bestMethod, '', ''],
            ['Cajero top', salesMetrics.bestCajero, '', ''],
            ['Pico de ventas', `${salesMetrics.peakLabel} = ${money(salesMetrics.peakVal)}`, '', ''],
          ],
          colWidths: [28, 18, 18, 14],
          moneyCols: [1, 2],
        });
        appendSheet(XLSX, wb, '1. Resumen', resumenWs);

        // Hoja 2: Detalle transacciones (filtradas + búsqueda)
        const detRows = filteredHistory.map(h => [
          `B-${h.n}`,
          h.d,
          h.t || '',
          h.items.map(i => `${i.name} x${i.qty}`).join('; '),
          h.clienteNombre || '',
          h.cajero,
          h.method,
          round2(h.total),
          h.estado === 0 ? 'Anulado' : 'Pagado',
        ]);
        const detWs = buildExcelSheet(XLSX, {
          title: 'REPORTE DE VENTAS — DETALLE',
          meta,
          headers: ['Boleta', 'Fecha', 'Hora', 'Productos', 'Cliente', 'Cajero', 'Método', 'Total (S/.)', 'Estado'],
          rows: detRows,
          colWidths: [12, 14, 10, 40, 18, 16, 14, 12, 10],
          moneyCols: [7],
          totalsRow: ['TOTAL', '', '', '', '', '', '', round2(filteredHistory.filter(h => h.estado !== 0).reduce((a, h) => a + h.total, 0)), `${filteredHistory.length} filas`],
        });
        appendSheet(XLSX, wb, '2. Transacciones', detWs);

        // Hoja 3: Serie temporal
        if (salesMetrics.barLabels.length) {
          const serieWs = buildExcelSheet(XLSX, {
            title: 'REPORTE DE VENTAS — SERIE',
            meta: [...meta, `Gráfico: ${salesMetrics.chartTitle}`],
            headers: ['Periodo / Etiqueta', 'Total (S/.)'],
            rows: salesMetrics.barLabels.map((lbl, i) => [lbl, round2(salesMetrics.barTotals[i])]),
            colWidths: [22, 14],
            moneyCols: [1],
          });
          appendSheet(XLSX, wb, '3. Serie temporal', serieWs);
        }

        // Hoja 4: Top productos del filtro
        if (salesMetrics.topProducts.length) {
          const topWs = buildExcelSheet(XLSX, {
            title: 'REPORTE DE VENTAS — TOP PRODUCTOS',
            meta,
            headers: ['#', 'Producto', 'Unidades', 'Ingresos (S/.)'],
            rows: salesMetrics.topProducts.map((p, i) => [i + 1, p.name, p.qty, round2(p.revenue)]),
            colWidths: [6, 32, 12, 14],
            moneyCols: [3],
          });
          appendSheet(XLSX, wb, '4. Top productos', topWs);
        }

        // Hoja 5: Métodos
        if (salesMetrics.byMethod.length) {
          const mWs = buildExcelSheet(XLSX, {
            title: 'REPORTE DE VENTAS — MÉTODOS DE PAGO',
            meta,
            headers: ['Método', 'Operaciones', 'Total (S/.)', '% del total'],
            rows: salesMetrics.byMethod.map(m => [
              m.name,
              m.count,
              round2(m.total),
              salesMetrics.tv > 0 ? round2((m.total / salesMetrics.tv) * 100) : 0,
            ]),
            colWidths: [22, 14, 14, 12],
            moneyCols: [2],
          });
          appendSheet(XLSX, wb, '5. Metodos de pago', mWs);
        }

        // Hoja 6: Cajeros
        if (salesMetrics.byCajero.length) {
          const cWs = buildExcelSheet(XLSX, {
            title: 'REPORTE DE VENTAS — POR CAJERO',
            meta,
            headers: ['Cajero', 'Operaciones', 'Total (S/.)', 'Ticket prom. (S/.)'],
            rows: salesMetrics.byCajero.map(c => [
              c.name,
              c.count,
              round2(c.total),
              round2(c.count > 0 ? c.total / c.count : 0),
            ]),
            colWidths: [22, 14, 14, 16],
            moneyCols: [2, 3],
          });
          appendSheet(XLSX, wb, '6. Por cajero', cWs);
        }
      }

      if (tab === 'productos') {
        const resWs = buildExcelSheet(XLSX, {
          title: 'REPORTE DE PRODUCTOS — RESUMEN',
          meta,
          headers: ['Indicador', 'Valor'],
          rows: [
            ['SKUs en catálogo', productReport.totalSKUs],
            ['Valor inventario (S/.)', round2(productReport.valorInventario)],
            ['Unidades vendidas (periodo)', productReport.totalSoldUnits],
            ['Ingresos por productos (S/.)', round2(productReport.totalRevenue)],
            ['Stock bajo', productReport.lowStock],
            ['Agotados', productReport.agotados],
            ['Filas exportadas (búsqueda)', filteredProductRows.length],
          ],
          colWidths: [32, 18],
          moneyCols: [1],
        });
        appendSheet(XLSX, wb, '1. Resumen', resWs);

        const detWs = buildExcelSheet(XLSX, {
          title: 'REPORTE DE PRODUCTOS — DETALLE',
          meta,
          headers: [
            'Producto', 'Categoría', 'Stock', 'Precio (S/.)', 'Valor inv. (S/.)',
            'Vendidos', 'Ingresos (S/.)', 'Producción', 'Descarte', 'Estado stock',
          ],
          rows: filteredProductRows.map(r => [
            r.name, r.cat, r.stock, round2(r.price), round2(r.valor),
            r.qtySold, round2(r.revenue), r.produccion, r.descarte,
            r.status === 'ok' ? 'OK' : r.status === 'bajo' ? 'Bajo' : 'Agotado',
          ]),
          colWidths: [28, 14, 10, 12, 14, 10, 14, 12, 10, 12],
          moneyCols: [3, 4, 6],
          totalsRow: [
            'TOTALES', '',
            filteredProductRows.reduce((a, r) => a + r.stock, 0),
            '',
            round2(filteredProductRows.reduce((a, r) => a + r.valor, 0)),
            filteredProductRows.reduce((a, r) => a + r.qtySold, 0),
            round2(filteredProductRows.reduce((a, r) => a + r.revenue, 0)),
            filteredProductRows.reduce((a, r) => a + r.produccion, 0),
            filteredProductRows.reduce((a, r) => a + r.descarte, 0),
            '',
          ],
        });
        appendSheet(XLSX, wb, '2. Inventario y ventas', detWs);

        if (productReport.categories.length) {
          const catWs = buildExcelSheet(XLSX, {
            title: 'REPORTE DE PRODUCTOS — POR CATEGORÍA',
            meta,
            headers: ['Categoría', 'SKUs', 'Stock total', 'Ingresos (S/.)'],
            rows: productReport.categories.map(c => [c.name, c.count, c.stock, round2(c.revenue)]),
            colWidths: [22, 10, 12, 14],
            moneyCols: [3],
          });
          appendSheet(XLSX, wb, '3. Por categoria', catWs);
        }
      }

      if (tab === 'insumos') {
        const resWs = buildExcelSheet(XLSX, {
          title: 'REPORTE DE INSUMOS — RESUMEN',
          meta,
          headers: ['Indicador', 'Valor'],
          rows: [
            ['Total insumos', insumoReport.total],
            ['Activos', insumoReport.activos],
            ['Valor inventario (S/.)', round2(insumoReport.valorTotal)],
            ['Compras del periodo (S/.)', round2(insumoReport.comprasPeriodo)],
            ['Cantidad comprada (und.)', round2(insumoReport.qtyCompradaPeriodo)],
            ['Stock bajo (≤ mínimo)', insumoReport.bajos],
            ['Agotados', insumoReport.agotados],
            ['Filas exportadas (búsqueda)', filteredInsumoRows.length],
          ],
          colWidths: [32, 18],
          moneyCols: [1],
        });
        appendSheet(XLSX, wb, '1. Resumen', resWs);

        const detWs = buildExcelSheet(XLSX, {
          title: 'REPORTE DE INSUMOS — DETALLE',
          meta,
          headers: [
            'Insumo', 'Stock', 'Mínimo', 'Unidad', 'Costo unit. (S/.)', 'Valor (S/.)',
            'Comprado (periodo)', 'Costo compras (S/.)', 'Usado en pedidos', 'Estado', 'Activo',
          ],
          rows: filteredInsumoRows.map(r => [
            r.nombre, r.stock, r.stockMinimo, r.unidad, round2(r.costoUnitario), round2(r.valor),
            r.qtyComprada, round2(r.costoCompras), r.qtyEnPedidos,
            r.status === 'ok' ? 'OK' : r.status === 'bajo' ? 'Bajo' : 'Agotado',
            r.active ? 'Sí' : 'No',
          ]),
          colWidths: [26, 10, 10, 10, 14, 12, 14, 16, 14, 10, 8],
          moneyCols: [4, 5, 7],
          totalsRow: [
            'TOTALES', '', '', '', '',
            round2(filteredInsumoRows.reduce((a, r) => a + r.valor, 0)),
            round2(filteredInsumoRows.reduce((a, r) => a + r.qtyComprada, 0)),
            round2(filteredInsumoRows.reduce((a, r) => a + r.costoCompras, 0)),
            round2(filteredInsumoRows.reduce((a, r) => a + r.qtyEnPedidos, 0)),
            '', '',
          ],
        });
        appendSheet(XLSX, wb, '2. Inventario insumos', detWs);

        if (insumoReport.alerts.length) {
          const alWs = buildExcelSheet(XLSX, {
            title: 'REPORTE DE INSUMOS — ALERTAS',
            meta: [...meta, 'Solo stock bajo o agotado'],
            headers: ['Insumo', 'Stock', 'Mínimo', 'Unidad', 'Estado', 'Valor (S/.)'],
            rows: insumoReport.alerts.map(r => [
              r.nombre, r.stock, r.stockMinimo, r.unidad,
              r.status === 'bajo' ? 'Bajo' : 'Agotado', round2(r.valor),
            ]),
            colWidths: [26, 10, 10, 10, 10, 12],
            moneyCols: [5],
          });
          appendSheet(XLSX, wb, '3. Alertas', alWs);
        }
      }

      if (tab === 'pedidos') {
        const resWs = buildExcelSheet(XLSX, {
          title: 'REPORTE DE PEDIDOS / RESERVAS — RESUMEN',
          meta,
          headers: ['Indicador', 'Valor'],
          rows: [
            ['Total en periodo', pedidoReport.totalReservas],
            ['Activas (Pendiente + Listo)', pedidoReport.activas],
            ['Entregadas', pedidoReport.entregadas],
            ['Canceladas', pedidoReport.canceladas],
            ['Pendientes', pedidoReport.byEstado.Pendiente || 0],
            ['Listos', pedidoReport.byEstado.Listo || 0],
            ['Adelantos cobrados (S/.)', round2(pedidoReport.montoaAdelantos)],
            ['Monto total reservas (S/.)', round2(pedidoReport.montoTotal)],
            ['Saldo por cobrar (S/.)', round2(pedidoReport.montoPendiente)],
            ['Filas exportadas (filtros + búsqueda)', filteredPedidoList.length],
          ],
          colWidths: [36, 18],
          moneyCols: [1],
        });
        appendSheet(XLSX, wb, '1. Resumen', resWs);

        const detWs = buildExcelSheet(XLSX, {
          title: 'REPORTE DE PEDIDOS / RESERVAS — DETALLE',
          meta,
          headers: [
            'ID', 'Cliente', 'Detalle', 'Fecha entrega', 'Estado',
            'Total (S/.)', 'Adelanto (S/.)', 'Saldo (S/.)', 'Ítems',
          ],
          rows: filteredPedidoList.map(p => [
            String(p.id).startsWith('local_') ? 'Local' : String(p.id),
            p.clienteNombre || '',
            p.summary,
            p.fecEntrega || '',
            p.estado,
            round2(p.totalVal),
            round2(p.adelanto || 0),
            round2(p.saldo),
            p.itemsList.length,
          ]),
          colWidths: [12, 20, 40, 14, 12, 12, 12, 12, 8],
          moneyCols: [5, 6, 7],
          totalsRow: [
            'TOTALES', '', '', '', `${filteredPedidoList.length} pedidos`,
            round2(filteredPedidoList.reduce((a, p) => a + p.totalVal, 0)),
            round2(filteredPedidoList.reduce((a, p) => a + (p.adelanto || 0), 0)),
            round2(filteredPedidoList.reduce((a, p) => a + p.saldo, 0)),
            '',
          ],
        });
        appendSheet(XLSX, wb, '2. Listado pedidos', detWs);

        if (pedidoReport.topItems.length) {
          const topWs = buildExcelSheet(XLSX, {
            title: 'REPORTE DE PEDIDOS — ÍTEMS MÁS RESERVADOS',
            meta,
            headers: ['#', 'Ítem', 'Cantidad', 'Ingresos est. (S/.)'],
            rows: pedidoReport.topItems.map((it, i) => [i + 1, it.name, it.qty, round2(it.revenue)]),
            colWidths: [6, 32, 12, 16],
            moneyCols: [3],
          });
          appendSheet(XLSX, wb, '3. Items reservados', topWs);
        }
      }

      const fileName = `${exportFileBase()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast(`📥 Excel de ${tabLabel} descargado (${rowsCount} registros · filtros aplicados)`);
    } catch (err: any) {
      console.error(err);
      alert('Error al exportar Excel: ' + err.message);
    }
  };

  const exportToPdf = async () => {
    try {
      if (listForPage.length === 0) {
        toast('⚠️ No hay datos con los filtros actuales para exportar');
        return;
      }

      const jspdfModule = await loadJsPDFAutoTable();
      const { jsPDF } = jspdfModule;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const meta = filterSummaryLines();
      const brand: [number, number, number] = [176, 125, 46];

      // Cabecera
      doc.setFillColor(250, 246, 238);
      doc.rect(0, 0, 297, 28, 'F');
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`Snack Roque — Reporte de ${tabLabel}`, 14, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text(meta.join('  ·  '), 14, 19, { maxWidth: 270 });
      doc.setDrawColor(...brand);
      doc.setLineWidth(0.6);
      doc.line(14, 26, 283, 26);

      let startY = 32;

      // Bloque KPIs según tab
      doc.setTextColor(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Indicadores (con filtros aplicados)', 14, startY);
      startY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);

      let kpiLines: string[] = [];
      if (tab === 'ventas') {
        kpiLines = [
          `Ventas netas: ${money(salesMetrics.tv)}   ·   Transacciones: ${salesMetrics.tr}   ·   Unidades: ${salesMetrics.un}   ·   Ticket prom.: ${money(salesMetrics.av)}`,
          `Anuladas: ${salesMetrics.annulledCount}   ·   Mejor producto: ${salesMetrics.bestProduct}   ·   Método: ${salesMetrics.bestMethod}   ·   Cajero top: ${salesMetrics.bestCajero}`,
        ];
      } else if (tab === 'productos') {
        kpiLines = [
          `SKUs: ${productReport.totalSKUs}   ·   Valor inventario: ${money(productReport.valorInventario)}   ·   Vendidos periodo: ${productReport.totalSoldUnits}`,
          `Ingresos: ${money(productReport.totalRevenue)}   ·   Stock bajo: ${productReport.lowStock}   ·   Agotados: ${productReport.agotados}   ·   Filas: ${filteredProductRows.length}`,
        ];
      } else if (tab === 'insumos') {
        kpiLines = [
          `Insumos: ${insumoReport.total} (${insumoReport.activos} activos)   ·   Valor inv.: ${money(insumoReport.valorTotal)}   ·   Compras periodo: ${money(insumoReport.comprasPeriodo)}`,
          `Bajos: ${insumoReport.bajos}   ·   Agotados: ${insumoReport.agotados}   ·   Filas exportadas: ${filteredInsumoRows.length}`,
        ];
      } else {
        kpiLines = [
          `Reservas periodo: ${pedidoReport.totalReservas}   ·   Activas: ${pedidoReport.activas}   ·   Entregadas: ${pedidoReport.entregadas}   ·   Canceladas: ${pedidoReport.canceladas}`,
          `Adelantos: ${money(pedidoReport.montoaAdelantos)}   ·   Total: ${money(pedidoReport.montoTotal)}   ·   Por cobrar: ${money(pedidoReport.montoPendiente)}   ·   Filas: ${filteredPedidoList.length}`,
        ];
      }
      kpiLines.forEach(l => {
        doc.text(l, 14, startY, { maxWidth: 270 });
        startY += 5;
      });
      startY += 3;

      const tableOpts = {
        startY,
        theme: 'striped' as const,
        headStyles: { fillColor: brand, textColor: 255, fontSize: 8, fontStyle: 'bold' as const },
        styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' as const },
        alternateRowStyles: { fillColor: [252, 249, 244] as [number, number, number] },
        margin: { left: 14, right: 14 },
      };

      if (tab === 'ventas') {
        (doc as any).autoTable({
          ...tableOpts,
          head: [['Boleta', 'Fecha', 'Hora', 'Productos', 'Cliente', 'Cajero', 'Método', 'Total', 'Estado']],
          body: filteredHistory.map(h => [
            `B-${h.n}`,
            h.d,
            h.t || '',
            h.items.map(i => `${i.name}×${i.qty}`).join(', ').slice(0, 60),
            (h.clienteNombre || '—').slice(0, 18),
            h.cajero.slice(0, 16),
            h.method.slice(0, 14),
            money(h.total),
            h.estado === 0 ? 'Anulado' : 'Pagado',
          ]),
          columnStyles: { 3: { cellWidth: 55 }, 7: { halign: 'right' } },
        });
      } else if (tab === 'productos') {
        (doc as any).autoTable({
          ...tableOpts,
          head: [['Producto', 'Categoría', 'Stock', 'Precio', 'Valor inv.', 'Vendidos', 'Ingresos', 'Prod.', 'Desc.', 'Estado']],
          body: filteredProductRows.map(r => [
            r.name.slice(0, 24),
            r.cat.slice(0, 14),
            r.stock,
            money(r.price),
            money(r.valor),
            r.qtySold,
            money(r.revenue),
            r.produccion,
            r.descarte,
            r.status === 'ok' ? 'OK' : r.status === 'bajo' ? 'Bajo' : 'Agotado',
          ]),
          columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 6: { halign: 'right' } },
        });
      } else if (tab === 'insumos') {
        (doc as any).autoTable({
          ...tableOpts,
          head: [['Insumo', 'Stock', 'Mín', 'Unidad', 'Costo', 'Valor', 'Comprado', '$ Compras', 'Pedidos', 'Estado']],
          body: filteredInsumoRows.map(r => [
            r.nombre.slice(0, 24),
            r.stock,
            r.stockMinimo,
            r.unidad,
            money(r.costoUnitario),
            money(r.valor),
            r.qtyComprada || '—',
            r.costoCompras > 0 ? money(r.costoCompras) : '—',
            r.qtyEnPedidos || '—',
            r.status === 'ok' ? 'OK' : r.status === 'bajo' ? 'Bajo' : 'Agotado',
          ]),
          columnStyles: { 4: {halign: 'right' }, 5: {halign: 'right' }, 7: {halign: 'right' } },
        });
      } else {
        (doc as any).autoTable({
          ...tableOpts,
          head: [['ID', 'Cliente', 'Detalle', 'Entrega', 'Estado', 'Total', 'Adelanto', 'Saldo']],
          body: filteredPedidoList.map(p => [
            String(p.id).startsWith('local_') ? 'Local' : String(p.id).slice(0, 12),
            (p.clienteNombre || '—').slice(0, 18),
            p.summary.slice(0, 50),
            p.fecEntrega || '—',
            p.estado,
            money(p.totalVal),
            money(p.adelanto || 0),
            money(p.saldo),
          ]),
          columnStyles: { 2: { cellWidth: 60 }, 5: {halign: 'right' }, 6: {halign: 'right' }, 7: {halign: 'right' } },
        });
      }

      // Pie de página
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(140);
        doc.text(
          `Snack Roque · ${tabLabel} · ${dateRange.label} · Página ${i} de ${pageCount}`,
          14,
          200
        );
        doc.text('Documento generado con los filtros activos en pantalla', 200, 200);
      }

      doc.save(`${exportFileBase()}.pdf`);
      toast(`📥 PDF de ${tabLabel} descargado (${listForPage.length} registros · filtros aplicados)`);
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
          <button type="button" className="rep-btn-export" onClick={exportToPdf} title={`Exporta solo ${tabLabel} con filtros actuales`}>
            📄 PDF · {tabLabel}
          </button>
          <button type="button" className="rep-btn-export primary" onClick={exportToExcel} title={`Exporta solo ${tabLabel} con filtros actuales`}>
            📊 Excel · {tabLabel}
          </button>
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
