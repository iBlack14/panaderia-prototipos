"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, logout, loading } = useApp();
  const [timeStr, setTimeStr] = useState('');

  // --- AUTH SECURITY GUARD ---
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // --- CLOCK TICKER ---
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const t = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const d = now.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' });
      setTimeStr(`${d} · ${t}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-3)', fontWeight: '600', fontSize: '15px' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="ci-em" style={{ animation: 'spin 1.5s linear infinite', fontSize: '40px', marginBottom: '16px' }}>🥐</div>
          Cargando estación de trabajo...
        </div>
      </div>
    );
  }

  // --- NAVIGATION LINKS ---
  const navItems = [
    { label: 'Principal', type: 'section' },
    { label: 'Dashboard', path: '/dashboard', icon: '📊', type: 'item' },
    { label: 'Clientes', path: '/dashboard/clientes', icon: '👥', type: 'item' },
    
    { label: 'Operaciones', type: 'section' },
    { label: 'Punto de Venta', path: '/dashboard/ventas', icon: '🛒', type: 'item' },
    { label: 'Control de Caja', path: '/dashboard/caja', icon: '💰', type: 'item' },
    { label: 'Inventario', path: '/dashboard/productos', icon: '📦', type: 'item' },
    
    { label: 'Logística', type: 'section' },
    { label: 'Proveedores', path: '/dashboard/proveedores', icon: '🏭', type: 'item' },
    { label: 'Compras', path: '/dashboard/compras', icon: '📥', type: 'item' },
    
    { label: 'Mantenimiento', type: 'section' },
    { label: 'Categorías', path: '/dashboard/categorias', icon: '🏷️', type: 'item' },
    { label: 'Métodos de Pago', path: '/dashboard/metodos', icon: '💳', type: 'item' },
    
    { label: 'Análisis', type: 'section' },
    { label: 'Estadísticas', path: '/dashboard/reportes', icon: '📈', type: 'item' },
    { label: 'Personal', path: '/dashboard/usuarios', icon: '👤', type: 'item', adminOnly: true },
  ];

  // Filtramos por rol si no es administrador
  const isAdmin = role === 'Administrador';
  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  // --- DYNAMIC HEADER TITLE & SUBTITLE ---
  const pageDetails = {
    '/dashboard': { title: 'Dashboard', sub: 'Resumen de operaciones · Hoy' },
    '/dashboard/clientes': { title: 'Gestión de Clientes', sub: 'Listado y registro de clientes frecuentes' },
    '/dashboard/ventas': { title: 'Punto de Venta (POS)', sub: 'Registrar nueva venta al detalle' },
    '/dashboard/caja': { title: 'Control de Caja', sub: 'Apertura, cierre y movimientos de efectivo' },
    '/dashboard/productos': { title: 'Inventario de Productos', sub: 'Control de stock y variantes' },
    '/dashboard/proveedores': { title: 'Directorio de Proveedores', sub: 'Gestión de socios estratégicos' },
    '/dashboard/compras': { title: 'Gestión de Compras', sub: 'Registro de abastecimiento de insumos' },
    '/dashboard/categorias': { title: 'Mantenimiento de Categorías', sub: 'Organización jerárquica de productos' },
    '/dashboard/metodos': { title: 'Métodos de Pago Configurados', sub: 'Configuración de canales de cobro' },
    '/dashboard/reportes': { title: 'Estadísticas y Reportes', sub: 'Análisis y métricas de rendimiento' },
    '/dashboard/usuarios': { title: 'Gestión de Personal', sub: 'Control de accesos y roles del equipo' },
  };

  const currentPathDetails = pageDetails[pathname] || { title: 'Sistema de Gestión', sub: 'Snack Roque' };

  return (
    <div className="app-wrap" style={{ display: 'block' }}>
      <div className="app-body">
        
        {/* SIDEBAR NAVIGATION */}
        <div className="sidebar">
          <div className="sb-brand" onClick={() => router.push('/dashboard')} style={{ cursor: 'pointer' }}>
            <img src="/asset/logo.png" alt="Logo" className="sb-logo" onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/992/992747.png"; }} />
            <p>Snack Roque</p>
            <div className="sb-brand-sub">Panadería &amp; Pastelería</div>
          </div>

          <div className="sb-nav">
            {filteredNavItems.map((item, idx) => {
              if (item.type === 'section') {
                return (
                  <div key={`sec-${idx}`} className="sb-section">
                    {item.label}
                  </div>
                );
              }
              
              const active = pathname === item.path;
              return (
                <div 
                  key={item.path} 
                  className={`sb-item ${active ? 'active' : ''}`}
                  onClick={() => router.push(item.path)}
                >
                  <span className="sb-icon">{item.icon}</span> {item.label}
                </div>
              );
            })}
          </div>

          {/* USER PROFILE INFO FOOTER */}
          <div className="sb-footer">
            <div className="sb-user">
              <div className="sb-av">{user?.n ? user.n[0].toUpperCase() : '👤'}</div>
              <div>
                <div className="sb-u-name">{user?.n || 'Usuario'}</div>
                <div className="sb-u-role">{role || 'Cajero'}</div>
              </div>
              <button 
                className="sb-logout" 
                onClick={() => { logout(); router.push('/'); }} 
                title="Cerrar sesión"
              >
                ↩
              </button>
            </div>
          </div>
        </div>

        {/* MAIN DISPLAY AREA */}
        <div className="main-area">
          <div className="page-head">
            <div className="ph-left">
              <h2>{currentPathDetails.title}</h2>
              <p>{currentPathDetails.sub}</p>
            </div>
            
            <div className="ph-right">
              <div className="search-pill">
                <span>🔍</span>
                <input placeholder="Buscar operaciones..." />
              </div>
              <div className="datetime-chip">{timeStr}</div>
            </div>
          </div>

          <div className="page-body">
            {children}
          </div>
        </div>

      </div>
    </div>
  );
}
