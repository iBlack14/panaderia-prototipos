"use client";

import React, { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, logout, loading, rolesList } = useApp();
  const [timeStr, setTimeStr] = useState('');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const userPermissions = rolesList.find(r => r.name === role)?.permissions || [];
  const isAdmin = role === 'Administrador';
  const isSupervisor = role === 'Supervisor';
  const hasPerm = (p: string) => userPermissions.includes(p);

  // --- AUTH SECURITY & ROUTE GUARD ---
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }

    if (!loading && user && role && rolesList.length > 0) {
      const perms = rolesList.find(r => r.name === role)?.permissions || [];
      const adminOrSup = role === 'Administrador' || role === 'Supervisor';
      
      const routeReqs: Record<string, boolean> = {
        '/dashboard/clientes': perms.includes('pos_ventas') || adminOrSup,
        '/dashboard/ventas': perms.includes('pos_ventas'),
        '/dashboard/caja': perms.includes('caja_operaciones') || perms.includes('caja_auditoria'),
        '/dashboard/productos': perms.includes('inventario_ver'),
        '/dashboard/proveedores': adminOrSup,
        '/dashboard/compras': adminOrSup,
        '/dashboard/categorias': adminOrSup,
        '/dashboard/metodos': adminOrSup,
        '/dashboard/usuarios': role === 'Administrador',
        '/dashboard/whatsapp': perms.includes('pos_ventas') || adminOrSup
      };

      if (routeReqs[pathname] === false) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router, pathname, role, rolesList]);

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

  // Solo mostramos la pantalla de carga cuando NO hay usuario (primer arranque).
  // Si 'loading' es true pero ya hay un 'user', significa que hay un refresco silencioso → no bloquear la UI.
  if (loading && !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-3)', fontWeight: '600', fontSize: '15px' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="ci-em" style={{ animation: 'spin 1.5s linear infinite', fontSize: '40px', marginBottom: '16px' }}>🥐</div>
          Cargando estación de trabajo...
        </div>
      </div>
    );
  }

  interface NavItem {
    label: string;
    path?: string;
    icon?: string;
    type: 'section' | 'item';
    show?: boolean;
  }

  // --- NAVIGATION LINKS ---
  const navItems: NavItem[] = [
    { label: 'Principal', type: 'section', show: true },
    { label: 'Dashboard', path: '/dashboard', icon: '📊', type: 'item', show: true },
    { label: 'Clientes', path: '/dashboard/clientes', icon: '👥', type: 'item', show: hasPerm('pos_ventas') || isAdmin || isSupervisor },
    
    { label: 'Operaciones', type: 'section', show: hasPerm('pos_ventas') || hasPerm('caja_operaciones') || hasPerm('caja_auditoria') || hasPerm('inventario_ver') },
    { label: 'Punto de Venta', path: '/dashboard/ventas', icon: '🛒', type: 'item', show: hasPerm('pos_ventas') },
    { label: 'Control de Caja', path: '/dashboard/caja', icon: '💰', type: 'item', show: hasPerm('caja_operaciones') || hasPerm('caja_auditoria') },
    { label: 'Inventario', path: '/dashboard/productos', icon: '📦', type: 'item', show: hasPerm('inventario_ver') },
    
    { label: 'Logística', type: 'section', show: isAdmin || isSupervisor },
    { label: 'Proveedores', path: '/dashboard/proveedores', icon: '🏭', type: 'item', show: isAdmin || isSupervisor },
    { label: 'Compras', path: '/dashboard/compras', icon: '📥', type: 'item', show: isAdmin || isSupervisor },
    
    { label: 'Mantenimiento', type: 'section', show: isAdmin || isSupervisor },
    { label: 'Categorías', path: '/dashboard/categorias', icon: '🏷️', type: 'item', show: isAdmin || isSupervisor },
    { label: 'Métodos de Pago', path: '/dashboard/metodos', icon: '💳', type: 'item', show: isAdmin || isSupervisor },
    
    { label: 'Análisis', type: 'section', show: hasPerm('estadisticas_ver') || isAdmin },
    { label: 'Estadísticas', path: '/dashboard/reportes', icon: '📈', type: 'item', show: hasPerm('estadisticas_ver') },
    { label: 'Personal', path: '/dashboard/usuarios', icon: '👤', type: 'item', show: isAdmin },
    { label: 'WhatsApp', path: '/dashboard/whatsapp', icon: '💬', type: 'item', show: hasPerm('pos_ventas') || isAdmin || isSupervisor },
  ];

  // Filtramos por permisos
  const filteredNavItems = navItems.filter(item => item.show !== false);

  // --- DYNAMIC HEADER TITLE & SUBTITLE ---
  const pageDetails: Record<string, { title: string; sub: string }> = {
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
    '/dashboard/whatsapp': { title: 'WhatsApp', sub: 'Mensajería automatizada · Gateway Baileys' },
  };

  const currentPathDetails = pageDetails[pathname] || { title: 'Sistema de Gestión', sub: 'Snack Roque' };

  return (
    <div className="app-wrap" style={{ display: 'block' }}>
      
      {/* MOBILE TOP HEADER */}
      <div className="mobile-top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/asset/logo.png" alt="Logo" className="mobile-logo-img" onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/992/992747.png"; }} />
          <span className="mobile-brand-title">Snack Roque</span>
        </div>
        <div className="sb-av">{user?.n ? user.n[0].toUpperCase() : '👤'}</div>
      </div>

      <div className="app-body">
        
        {/* SIDEBAR NAVIGATION (Desktop Only - hidden on mobile via CSS) */}
        <div className="sidebar">
          <div className="sb-brand" onClick={() => router.push('/dashboard')} style={{ cursor: 'pointer' }}>
            <img 
              src="/asset/logo.png" 
              alt="Logo" 
              className="sb-logo" 
              onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/992/992747.png"; }} 
            />
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
                  onClick={() => item.path && router.push(item.path)}
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

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="mobile-bottom-nav">
        <div className={`mb-item ${pathname === '/dashboard' ? 'active' : ''}`} onClick={() => router.push('/dashboard')}>
          <span className="mb-icon">📊</span>
          <span className="mb-label">Dashboard</span>
        </div>
        
        {hasPerm('pos_ventas') && (
          <div className={`mb-item ${pathname === '/dashboard/ventas' ? 'active' : ''}`} onClick={() => router.push('/dashboard/ventas')}>
            <span className="mb-icon">🛒</span>
            <span className="mb-label">Ventas</span>
          </div>
        )}
        
        {(hasPerm('caja_operaciones') || hasPerm('caja_auditoria')) && (
          <div className={`mb-item ${pathname === '/dashboard/caja' ? 'active' : ''}`} onClick={() => router.push('/dashboard/caja')}>
            <span className="mb-icon">💰</span>
            <span className="mb-label">Caja</span>
          </div>
        )}
        
        {hasPerm('inventario_ver') && (
          <div className={`mb-item ${pathname === '/dashboard/productos' ? 'active' : ''}`} onClick={() => router.push('/dashboard/productos')}>
            <span className="mb-icon">📦</span>
            <span className="mb-label">Inventario</span>
          </div>
        )}
        
        <div className={`mb-item ${isMoreMenuOpen ? 'active' : ''}`} onClick={() => setIsMoreMenuOpen(true)}>
          <span className="mb-icon">☰</span>
          <span className="mb-label">Más</span>
        </div>
      </div>

      {/* MOBILE SLIDE-UP DRAWER OVERLAY */}
      {isMoreMenuOpen && (
        <div className="mobile-drawer-overlay open" onClick={() => setIsMoreMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="md-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🥐</span>
                <span style={{ fontWeight: '800', color: 'var(--text)', fontSize: '14.5px' }}>Menú de Administración</span>
              </div>
              <button className="md-close" onClick={() => setIsMoreMenuOpen(false)}>✕</button>
            </div>
            
            <div className="md-body">
              <div className="md-grid">
                {(hasPerm('pos_ventas') || isAdmin || isSupervisor) && (
                  <>
                    <div className="md-item-btn" onClick={() => { router.push('/dashboard/clientes'); setIsMoreMenuOpen(false); }}>
                      <span className="md-btn-icon">👥</span>
                      <span className="md-btn-lbl">Clientes</span>
                    </div>
                    <div className="md-item-btn" onClick={() => { router.push('/dashboard/whatsapp'); setIsMoreMenuOpen(false); }}>
                      <span className="md-btn-icon">💬</span>
                      <span className="md-btn-lbl">WhatsApp</span>
                    </div>
                  </>
                )}
                {(isAdmin || isSupervisor) && (
                  <>
                    <div className="md-item-btn" onClick={() => { router.push('/dashboard/proveedores'); setIsMoreMenuOpen(false); }}>
                      <span className="md-btn-icon">🏭</span>
                      <span className="md-btn-lbl">Proveedores</span>
                    </div>
                    <div className="md-item-btn" onClick={() => { router.push('/dashboard/compras'); setIsMoreMenuOpen(false); }}>
                      <span className="md-btn-icon">📥</span>
                      <span className="md-btn-lbl">Compras</span>
                    </div>
                    <div className="md-item-btn" onClick={() => { router.push('/dashboard/categorias'); setIsMoreMenuOpen(false); }}>
                      <span className="md-btn-icon">🏷️</span>
                      <span className="md-btn-lbl">Categorías</span>
                    </div>
                    <div className="md-item-btn" onClick={() => { router.push('/dashboard/metodos'); setIsMoreMenuOpen(false); }}>
                      <span className="md-btn-icon">💳</span>
                      <span className="md-btn-lbl">Pagos</span>
                    </div>
                  </>
                )}
                {hasPerm('estadisticas_ver') && (
                  <div className="md-item-btn" onClick={() => { router.push('/dashboard/reportes'); setIsMoreMenuOpen(false); }}>
                    <span className="md-btn-icon">📈</span>
                    <span className="md-btn-lbl">Reportes</span>
                  </div>
                )}
                {isAdmin && (
                  <div className="md-item-btn" onClick={() => { router.push('/dashboard/usuarios'); setIsMoreMenuOpen(false); }}>
                    <span className="md-btn-icon">👤</span>
                    <span className="md-btn-lbl">Personal</span>
                  </div>
                )}
                <div className="md-item-btn md-btn-logout" onClick={() => { logout(); router.push('/'); setIsMoreMenuOpen(false); }}>
                  <span className="md-btn-icon">↩</span>
                  <span className="md-btn-lbl">Salir</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
