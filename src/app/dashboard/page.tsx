"use client";

import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';

export default function DashboardHome() {
  const { sales, products } = useApp();

  interface DisplaySaleItem {
    name: string;
    qty: number;
  }

  interface DisplaySale {
    id: number | string;
    n: number;
    d: string;
    t: string;
    cajero: string;
    total: number;
    items: DisplaySaleItem[];
  }

  // --- REACTIVE CALCULATIONS FOR TODAY'S METRICS ---
  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    
    // Ventas de hoy
    const todaySales = sales.filter(s => s.d === todayStr);
    const hasRealSales = todaySales.length > 0;
    
    const totalSalesAmount = todaySales.reduce((sum, s) => sum + s.total, 0);
    const transactionCount = hasRealSales ? todaySales.length : 34;
    const unitsCount = hasRealSales 
      ? todaySales.reduce((sum, s) => sum + s.items.reduce((acc, item) => acc + item.qty, 0), 0)
      : 127;
      
    const lowStockCount = products.filter(p => p.stock < 10).length;

    // Ventas recientes
    let recentSalesList: DisplaySale[] = [];
    if (hasRealSales) {
      recentSalesList = todaySales.slice(-5).reverse().map(s => ({
        id: s.id,
        n: s.n,
        d: s.d,
        t: s.t,
        cajero: s.cajero,
        total: s.total,
        items: s.items.map(item => ({
          name: item.name,
          qty: item.qty
        }))
      }));
    } else {
      // Mock de datos demo premium
      recentSalesList = [
        { id: 1, n: 541, d: todayStr, t: '09:14', cajero: 'Carlos Mendoza', total: 24.50, items: [{ name: 'Pan de yema', qty: 3 }, { name: 'Croissant', qty: 2 }] },
        { id: 2, n: 542, d: todayStr, t: '10:02', cajero: 'María Sánchez', total: 45.00, items: [{ name: 'Torta de chocolate', qty: 1 }] },
        { id: 3, n: 543, d: todayStr, t: '10:47', cajero: 'Carlos Mendoza', total: 32.00, items: [{ name: 'Empanada', qty: 5 }, { name: 'Café', qty: 2 }] },
        { id: 4, n: 544, d: todayStr, t: '11:30', cajero: 'María Sánchez', total: 18.80, items: [{ name: 'Pan integral', qty: 4 }, { name: 'Alfajor', qty: 2 }] },
        { id: 5, n: 545, d: todayStr, t: '12:15', cajero: 'Carlos Mendoza', total: 27.50, items: [{ name: 'Bizcocho', qty: 6 }, { name: 'Queque', qty: 1 }] }
      ];
    }

    const totalSalesStr = hasRealSales ? `S/. ${totalSalesAmount.toFixed(2)}` : 'S/. 842.00';

    return {
      totalSalesStr,
      transactionCount,
      unitsCount,
      lowStockCount,
      recentSalesList
    };
  }, [sales, products]);

  return (
    <div className="screen active">
      {/* 4 KPI METRIC CARDS */}
      <div className="stats-4">
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-lav">💰</div>
            <div className="st-delta d-up">↑ 12%</div>
          </div>
          <div className="st-val">{stats.totalSalesStr}</div>
          <div className="st-lbl">Ventas del día</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-blush">🛒</div>
            <div className="st-delta d-up">↑ 5%</div>
          </div>
          <div className="st-val">{stats.transactionCount}</div>
          <div className="st-lbl">Transacciones</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-peach">📦</div>
            <div className="st-delta d-up">↑ 8%</div>
          </div>
          <div className="st-val">{stats.unitsCount}</div>
          <div className="st-lbl">Unidades vendidas</div>
        </div>

        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-mint">⚠️</div>
            <div className="st-delta d-down">Alerta</div>
          </div>
          <div className="st-val">{stats.lowStockCount}</div>
          <div className="st-lbl">Stock bajo</div>
        </div>
      </div>

      {/* Grid: Recent Activity & Top Products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>
        
        {/* Panel: Recent Activity */}
        <div className="panel">
          <div className="p-title">
            <span>Actividad Reciente</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)' }}>
              Hoy · {new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          
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
        </div>

        {/* Panel: Top Products & Quick info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Top Products */}
          <div className="panel" style={{ flex: 1 }}>
            <div className="p-title" style={{ fontSize: '14px', marginBottom: '14px' }}>🏆 Top Productos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🥐</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Croissant</div>
                  <div style={{ height: '5px', background: 'var(--bg)', borderRadius: '3px', marginTop: '5px' }}>
                    <div style={{ height: '100%', width: '80%', background: 'var(--accent)', borderRadius: '3px' }}></div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent)' }}>42u</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🍞</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Pan de yema</div>
                  <div style={{ height: '5px', background: 'var(--bg)', borderRadius: '3px', marginTop: '5px' }}>
                    <div style={{ height: '100%', width: '65%', background: 'var(--green)', borderRadius: '3px' }}></div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--green)' }}>34u</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🎂</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Torta de choco</div>
                  <div style={{ height: '5px', background: 'var(--bg)', borderRadius: '3px', marginTop: '5px' }}>
                    <div style={{ height: '100%', width: '40%', background: 'var(--blue)', borderRadius: '3px' }}></div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--blue)' }}>21u</div>
              </div>

            </div>
          </div>

          {/* Average Ticket Card */}
          <div className="panel" style={{ textAlign: 'center', padding: '18px 22px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-3)', marginBottom: '8px' }}>
              Ticket Promedio
            </div>
            <div style={{ fontSize: '36px', fontWeight: '900', color: 'var(--accent)', letterSpacing: '-1px' }}>
              S/. 24.80
            </div>
            <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '600', marginTop: '4px' }}>
              ↑ +S/. 3.20 vs. ayer
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
