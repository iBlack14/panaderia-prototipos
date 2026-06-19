"use client";

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function DashboardHome() {
  const router = useRouter();
  const { sales, products } = useApp();

  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    const todaySales = sales.filter(s => s.d === todayStr);

    const totalSalesAmount = todaySales.reduce((sum, s) => sum + s.total, 0);
    const transactionCount = todaySales.length;
    const unitsCount = todaySales.reduce(
      (sum, s) => sum + s.items.reduce((acc, item) => acc + item.qty, 0), 0
    );

    // Stock bajo threshold configurable (< 10 unidades)
    const LOW_STOCK_THRESHOLD = 10;
    const lowStockProducts = products.filter(p => {
      const effectiveStock = p.versions.length > 0
        ? p.versions.reduce((a, v) => a + v.stock, 0)
        : p.stock;
      return effectiveStock < LOW_STOCK_THRESHOLD && effectiveStock >= 0;
    }).map(p => ({
      id: p.id,
      name: p.name,
      cat: p.cat,
      stock: p.versions.length > 0
        ? p.versions.reduce((a, v) => a + v.stock, 0)
        : p.stock,
    })).sort((a, b) => a.stock - b.stock);

    const recentSalesList = [...todaySales].reverse().slice(0, 5);

    const productMap: Record<string, { name: string; cat: string; qty: number }> = {};
    todaySales.forEach(s => {
      s.items.forEach(item => {
        if (!productMap[item.name]) {
          const originalProd = products.find(p => p.id === item.id);
          productMap[item.name] = { name: item.name, cat: originalProd?.cat || 'Otros', qty: 0 };
        }
        productMap[item.name].qty += item.qty;
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    const maxQty = topProducts[0]?.qty || 1;
    const avgTicket = transactionCount > 0 ? totalSalesAmount / transactionCount : 0;

    return {
      totalSalesAmount, transactionCount, unitsCount,
      lowStockProducts, lowStockCount: lowStockProducts.length,
      recentSalesList, topProducts, maxQty, avgTicket,
    };
  }, [sales, products]);

  const hasData = stats.transactionCount > 0;

  return (
    <div className="screen active">
      {/* ── KPI CARDS ───────────────────────────────────────── */}
      <div className="stats-4">
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-lav">💰</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>Hoy</div>
          </div>
          <div className="st-val">{hasData ? `S/. ${stats.totalSalesAmount.toFixed(2)}` : 'S/. 0.00'}</div>
          <div className="st-lbl">Ventas del día</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-blush">🛒</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>Hoy</div>
          </div>
          <div className="st-val">{stats.transactionCount}</div>
          <div className="st-lbl">Transacciones</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-peach">📦</div>
            <div className="st-delta" style={{ background: 'var(--bg)', color: 'var(--text-3)', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700' }}>Hoy</div>
          </div>
          <div className="st-val">{stats.unitsCount}</div>
          <div className="st-lbl">Unidades vendidas</div>
        </div>

        <div
          className="stat-tile"
          style={{ cursor: stats.lowStockCount > 0 ? 'pointer' : 'default' }}
          onClick={() => stats.lowStockCount > 0 && router.push('/dashboard/productos')}
        >
          <div className="st-header">
            <div className="st-icon ic-mint">⚠️</div>
            <div className={stats.lowStockCount > 0 ? 'st-delta d-down' : 'st-delta d-up'}>
              {stats.lowStockCount > 0 ? 'Alerta' : 'OK'}
            </div>
          </div>
          <div className="st-val" style={{ color: stats.lowStockCount > 0 ? 'var(--red)' : undefined }}>
            {stats.lowStockCount}
          </div>
          <div className="st-lbl">Stock bajo {stats.lowStockCount > 0 ? '· Click para ver' : ''}</div>
        </div>
      </div>

      {/* ── STOCK ALERTS BANNER ─────────────────────────────── */}
      {stats.lowStockCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(220,53,69,0.08), rgba(220,53,69,0.04))',
          border: '1.5px solid rgba(220,53,69,0.22)',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🚨</span>
              <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--red)' }}>
                {stats.lowStockCount} producto{stats.lowStockCount !== 1 ? 's' : ''} con stock crítico
              </span>
            </div>
            <button
              onClick={() => router.push('/dashboard/productos')}
              style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--red)',
                background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.2)',
                padding: '4px 12px', borderRadius: '20px', cursor: 'pointer'
              }}
            >
              Gestionar productos →
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {stats.lowStockProducts.slice(0, 8).map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--bg-card)', border: '1px solid rgba(220,53,69,0.18)',
                borderRadius: '8px', padding: '5px 10px',
              }}>
                <span style={{ fontSize: '14px' }}>
                  {{
                    'Panes': '🍞',
                    'Tortas': '🎂',
                    'Dulces': '🍬',
                    'Bebidas': '🥤',
                    'Insumos': '🌾'
                  }[p.cat] || '📦'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{p.name}</span>
                <span style={{
                  fontSize: '10.5px', fontWeight: 800,
                  color: p.stock === 0 ? '#dc3545' : '#e6a23c',
                  background: p.stock === 0 ? 'rgba(220,53,69,0.1)' : 'rgba(230,162,60,0.1)',
                  padding: '1px 7px', borderRadius: '12px'
                }}>
                  {p.stock === 0 ? 'Agotado' : `${p.stock} und.`}
                </span>
              </div>
            ))}
            {stats.lowStockCount > 8 && (
              <div style={{
                fontSize: '12px', color: 'var(--text-3)', fontWeight: 600,
                display: 'flex', alignItems: 'center', padding: '5px 10px'
              }}>
                +{stats.lowStockCount - 8} más
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN GRID ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>

        {/* Panel: Recent Activity */}
        <div className="panel">
          <div className="p-title">
            <span>Actividad Reciente</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)' }}>
              Hoy · {new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {hasData ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Boleta</th>
                  <th style={{ textAlign: 'left' }}>Productos</th>
                  <th style={{ textAlign: 'left' }}>Hora</th>
                  <th style={{ textAlign: 'left' }}>Cajero</th>
                  <th style={{ textAlign: 'left' }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSalesList.map((sale) => (
                  <tr key={sale.id}>
                    <td><span style={{ fontWeight: '700', color: 'var(--accent)' }}>#B-{sale.n}</span></td>
                    <td style={{ color: 'var(--text-2)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sale.items.map(i => `${i.name} ×${i.qty}`).join(', ')}
                    </td>
                    <td><span className="tag tg-blue">{sale.t || 'Hoy'}</span></td>
                    <td>{sale.cajero}</td>
                    <td style={{ fontWeight: '800', color: 'var(--green)' }}>S/. {sale.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '10px', color: 'var(--text-3)', textAlign: 'center' }}>
              <span style={{ fontSize: '40px', opacity: 0.4 }}>🧾</span>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Sin ventas registradas hoy</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: '400' }}>
                Las ventas del día aparecerán aquí en tiempo real
              </span>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Top Products */}
          <div className="panel" style={{ flex: 1 }}>
            <div className="p-title" style={{ fontSize: '14px', marginBottom: '14px' }}>🏆 Top Productos</div>
            {stats.topProducts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats.topProducts.map((p, i) => {
                  const colors = ['var(--accent)', 'var(--green)', 'var(--blue)'];
                  const pct = Math.round((p.qty / stats.maxQty) * 100);
                  return (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>
                        {{
                          'Panes': '🍞',
                          'Tortas': '🎂',
                          'Dulces': '🍬',
                          'Bebidas': '🥤',
                          'Insumos': '🌾'
                        }[p.cat] || '📦'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                          {p.name}
                        </div>
                        <div style={{ height: '5px', background: 'var(--bg)', borderRadius: '3px', marginTop: '5px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: colors[i] || 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s' }} />
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: colors[i] || 'var(--accent)' }}>
                        {p.qty}u
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: '8px', color: 'var(--text-3)' }}>
                <span style={{ fontSize: '28px', opacity: 0.35 }}>📊</span>
                <span style={{ fontSize: '12px', fontWeight: '600' }}>Sin datos aún</span>
              </div>
            )}
          </div>

          {/* Average Ticket */}
          <div className="panel" style={{ textAlign: 'center', padding: '18px 22px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-3)', marginBottom: '8px' }}>
              Ticket Promedio
            </div>
            <div style={{ fontSize: '36px', fontWeight: '900', color: hasData ? 'var(--accent)' : 'var(--text-3)', letterSpacing: '-1px' }}>
              {hasData ? `S/. ${stats.avgTicket.toFixed(2)}` : '—'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '500', marginTop: '4px' }}>
              {hasData ? `${stats.transactionCount} venta${stats.transactionCount !== 1 ? 's' : ''} hoy` : 'Sin ventas registradas hoy'}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
