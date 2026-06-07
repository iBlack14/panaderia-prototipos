"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { 
  User, 
  Product, 
  Provider, 
  PaymentMethod, 
  CartItem, 
  CashSession, 
  CashDrop, 
  CashHistoryRecord, 
  CustomRole, 
  Client, 
  BreadLog, 
  Sale, 
  Pedido, 
  ReturnRecord, 
  Purchase,
  AppContextType 
} from './types';

export type { 
  User, 
  Product, 
  ProductVersion,
  Provider, 
  PaymentMethod, 
  CartItem, 
  CashSession, 
  CashDrop, 
  CashHistoryRecord, 
  CustomRole, 
  Client, 
  CreditPayment,
  BreadLog, 
  Sale, 
  Pedido, 
  ReturnRecord, 
  ReturnedItem,
  PurchaseItem,
  Purchase,
  DenominacionArqueo,
  AppContextType 
} from './types';

// Import custom hooks
import { useAuthOperations } from '@/hooks/useAuthOperations';
import { useInventoryOps } from '@/hooks/useInventoryOps';
import { useCartOperations } from '@/hooks/useCartOperations';
import { useCashOperations } from '@/hooks/useCashOperations';
import { useClientOps } from '@/hooks/useClientOps';
import { useOrderOperations } from '@/hooks/useOrderOperations';

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- SEED DATA FALLBACKS ---
const DEFAULT_PRODUCTS: Product[] = [];

const DEFAULT_ROLES: CustomRole[] = [
  {
    id: 'Administrador',
    name: 'Administrador',
    desc: 'Control total de la panadería con acceso sin restricciones a todos los módulos.',
    permissions: ['pos_ventas', 'caja_operaciones', 'caja_auditoria', 'inventario_ver', 'inventario_editar', 'estadisticas_ver', 'personal_gestionar']
  },
  {
    id: 'Cajero',
    name: 'Cajero',
    desc: 'Operador de caja estándar encargado de cobros al detalle y arqueo de turnos básicos.',
    permissions: ['pos_ventas', 'caja_operaciones', 'inventario_ver']
  },
  {
    id: 'Contador',
    name: 'Contador',
    desc: 'Auditor contable enfocado en control fiscal, ingresos consolidados y reportes mensuales.',
    permissions: ['caja_auditoria', 'estadisticas_ver']
  },
  {
    id: 'Supervisor',
    name: 'Supervisor',
    desc: 'Encargado del local. Habilitado para auditar cajas, gestionar descartes de panes y stock.',
    permissions: ['pos_ventas', 'caja_operaciones', 'caja_auditoria', 'inventario_ver', 'inventario_editar', 'estadisticas_ver']
  }
];

const DEFAULT_USERS: User[] = [
  { id: 1, u: 'admin', p: '1234', n: 'Administrador', rs: ['Administrador'], st: 'act', email: 'admin@snackroque.com', phone: '' },
  { id: 2, u: 'carlos', p: '1234', n: 'Carlos Mendoza', rs: ['Cajero'], st: 'act', email: 'carlos@snackroque.com', phone: '987654321' },
  { id: 3, u: 'maria', p: '1234', n: 'María Sánchez', rs: ['Cajero'], st: 'act', email: 'maria@snackroque.com', phone: '912345678' }
];

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 1, name: 'Efectivo', desc: 'Pago tradicional en caja', active: true },
  { id: 2, name: 'Yape', desc: 'Pago QR digital BCP', active: true },
  { id: 3, name: 'Plin', desc: 'Pago QR digital Interbank/BBVA', active: true },
  { id: 4, name: 'Tarjeta Crédito/Débito', desc: 'Terminal POS Visa/Mastercard', active: true }
];

const DEFAULT_PROVIDERS: Provider[] = [];

const DEFAULT_CLIENTS: Client[] = [
  { id: 1, nombre: 'Rosa Quispe Mamani', dni: '43218765', telefono: '987654321', email: '', limiteCred: 80, saldoCred: 0, historialPagos: [], active: true },
  { id: 2, nombre: 'Juan Torres Huanca', dni: '56781234', telefono: '912345678', email: '', limiteCred: 120, saldoCred: 35, historialPagos: [{ id: 1, fecha: '24/05/2026', concepto: 'Compra a crédito — 4 panes y 1 torta', monto: 35, tipo: 'cargo' }], active: true },
  { id: 3, nombre: 'Carmen Flores Díaz', dni: '29876543', telefono: '945612378', email: '', limiteCred: 200, saldoCred: 0, historialPagos: [], active: true }
];

export function AppProvider({ children }: { children: ReactNode }) {
  // --- STATE VARIABLES ---
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashHistory, setCashHistory] = useState<CashHistoryRecord[]>([]);
  const [cashDrops, setCashDrops] = useState<CashDrop[]>([]);
  const [breadLogs, setBreadLogs] = useState<BreadLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [rolesList, setRolesList] = useState<CustomRole[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [devoluciones, setDevoluciones] = useState<ReturnRecord[]>([]);

  const [toastMsg, setToastMsg] = useState<string>('');

  // --- SHOW TOAST HELPER ---
  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // --- SAVE LOCALSTORAGE HELPER ---
  const saveOffline = (key: string, data: any) => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  // --- INITIAL LOAD ---
  useEffect(() => {
    const cleaned = localStorage.getItem('snack_ls_demo_cleaned_v3');
    if (!cleaned) {
      localStorage.removeItem('snack_products');
      localStorage.removeItem('snack_users');
      localStorage.removeItem('snack_providers');
      localStorage.removeItem('snack_sales');
      localStorage.removeItem('snack_purchases');
      localStorage.removeItem('snack_session');
      localStorage.removeItem('snack_cash_history');
      localStorage.removeItem('snack_bread_logs');
      localStorage.setItem('snack_ls_demo_cleaned_v3', 'true');
      console.log('🧹 LocalStorage limpiado con éxito para eliminar datos demo.');
    }

    async function loadData(isFirstLoad = false) {
      if (isFirstLoad) setLoading(true);
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: prof } = await supabase
              .from('profiles').select('*, roles(nombre)').eq('id', session.user.id).maybeSingle();
            if (prof && prof.estado === 'act') {
              setUser({ id: prof.id, u: prof.username, n: prof.nombre + ' ' + (prof.apellido_paterno || ''),
                rs: [prof.roles?.nombre || 'Cajero'], email: prof.correo, phone: prof.num_telefono || '', st: prof.estado });
              setRole(prof.roles?.nombre || 'Cajero');
            }
          }
          console.log('Cargando datos en paralelo...');
          const [
            { data: prods }, { data: cats }, { data: rls }, { data: paym }, { data: profs },
            { data: clis }, { data: provs }, { data: sesAbierta }, { data: cashHist }, { data: ventas }, { data: compras },
            { data: peds }, { data: devs }
          ] = await Promise.all([
            supabase.from('productos').select('*, producto_versiones(*), categorias(nombre)').eq('estado', 1),
            supabase.from('categorias').select('*').order('id_categoria', { ascending: true }),
            supabase.from('roles').select('*').order('id_rol', { ascending: true }),
            supabase.from('metodos_pago').select('*'),
            supabase.from('profiles').select('*, roles(nombre)'),
            supabase.from('clientes').select('*').order('id_cliente', { ascending: true }),
            supabase.from('proveedores').select('*'),
            supabase.from('cierres_caja').select('*').eq('estado', 'abierto').limit(1),
            supabase.from('cierres_caja').select('*').eq('estado', 'cerrado').order('fec_cierre', { ascending: false }),
            supabase.from('ventas').select('*, detalle_venta(*, productos(nombre, em), producto_versiones(nombre_version)), metodos_pago(tipo_pago), profiles(nombre, apellido_paterno)').order('fec_venta', { ascending: false }).limit(500),
            supabase.from('compras').select('*, detalle_compra(*, productos(nombre)), proveedores(nombre_empresa)').eq('estado', 1).order('fec_compra', { ascending: false }).limit(200),
            supabase.from('pedidos_reserva').select('*, clientes(nombre)').order('fec_entrega', { ascending: true }),
            supabase.from('devoluciones').select('*, detalle_devolucion(*, productos(nombre)), clientes(nombre), profiles(nombre, apellido_paterno)').order('fec_devolucion', { ascending: false }),
          ]);
          if (prods) setProducts((prods as any[]).map(p => ({ id: p.id_producto, name: p.nombre, cat: p.categorias?.nombre || 'Sin categoria', price: parseFloat(p.precio_unitario), stock: parseFloat(p.num_stock || 0), em: p.em, unidad_medida: p.unidad_medida || 'unidades', versions: p.producto_versiones ? (p.producto_versiones as any[]).map(v => ({ id: v.id_version, name: v.nombre_version, price: parseFloat(v.precio_unitario), stock: parseFloat(v.num_stock || 0) })) : [] })));
          if (cats) setCategories((cats as any[]).map(c => ({ id: c.id_categoria, name: c.nombre })));
          if (rls) setRolesList((rls as any[]).map(r => ({ id: r.nombre, name: r.nombre, desc: r.descripcion || '', permissions: Array.isArray(r.permisos) ? r.permisos : (typeof r.permisos === 'string' ? JSON.parse(r.permisos) : []) })));
          if (paym) setPaymentMethods((paym as any[]).map(pm => ({ id: pm.id_metodo_pago, name: pm.tipo_pago, desc: 'Metodo en la nube', active: pm.estado === 1 })));
          if (profs) setUsersList((profs as any[]).map(p => ({ id: p.id, u: p.username, p: '••••', n: p.nombre + ' ' + (p.apellido_paterno || ''), rs: [p.roles?.nombre || 'Cajero'], st: p.estado, email: p.correo, phone: p.num_telefono || '' })));
          if (clis) setClients((clis as any[]).map(c => ({ id: c.id_cliente, nombre: c.nombre, dni: c.dni || '', telefono: c.telefono || '', email: c.email || '', limiteCred: parseFloat(c.limite_credito || 0), saldoCred: parseFloat(c.saldo_credito || 0), historialPagos: c.historial_pagos ? (typeof c.historial_pagos === 'string' ? JSON.parse(c.historial_pagos) : c.historial_pagos) : [], active: c.estado === 1 })));
          if (provs) setProviders((provs as any[]).map(pr => ({ id: pr.id_proveedor, ruc: pr.ruc, name: pr.nombre_empresa, phone: pr.num_telefono, address: pr.direccion, active: pr.estado === 1 })));
          if (sesAbierta && sesAbierta.length > 0) setCashSession({ id: sesAbierta[0].id_cierre_caja, fec_apertura: new Date(sesAbierta[0].fec_apertura), tot_saldo_inicial: parseFloat(sesAbierta[0].tot_saldo_inicial), tot_ventas_efectivo: parseFloat(sesAbierta[0].tot_ventas_efectivo), tot_ventas_otros: parseFloat(sesAbierta[0].tot_ventas_otros), tot_retiros: parseFloat(sesAbierta[0].tot_retiros || 0), estado: 'abierto' });
          if (cashHist) setCashHistory((cashHist as any[]).map(h => ({ id: h.id_cierre_caja, fec_apertura: new Date(h.fec_apertura).toLocaleDateString(), fec_cierre: new Date(h.fec_cierre).toLocaleDateString(), monto_inicial: parseFloat(h.tot_saldo_inicial), monto_final: parseFloat(h.tot_saldo_final), ventas_efectivo: parseFloat(h.tot_ventas_efectivo), ventas_otros: parseFloat(h.tot_ventas_otros), estado: 'cerrado' })));
          if (ventas) setSales((ventas as any[]).map(v => ({ id: v.id_venta, n: v.id_venta, items: (v.detalle_venta || []).map((d: any) => ({ id: d.id_producto, name: (d.productos?.nombre || '') + (d.producto_versiones ? ` (${d.producto_versiones.nombre_version})` : ''), price: parseFloat(d.precio_unitario), qty: parseFloat(d.num_cantidad || 0), version: d.producto_versiones?.nombre_version || null })), total: parseFloat(v.tot_pago), method: v.metodos_pago?.tipo_pago || 'Efectivo', methodId: v.id_metodo_pago, d: new Date(v.fec_venta).toLocaleDateString(), t: new Date(v.fec_venta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), cajero: v.profiles ? (v.profiles.nombre + ' ' + (v.profiles.apellido_paterno || '')).trim() : 'Sistema', clienteId: v.id_cliente || undefined, estado: v.estado })));
          if (compras) setPurchases((compras as any[]).map(c => ({ id: 'COM-' + c.id_compra, d: new Date(c.fec_compra).toLocaleDateString(), prov: c.proveedores?.nombre_empresa || 'Proveedor', subTotal: 'S/. ' + parseFloat(c.sub_total).toFixed(2), igv: 'S/. ' + parseFloat(c.igv).toFixed(2), total: 'S/. ' + parseFloat(c.tot_pago).toFixed(2), items: (c.detalle_compra || []).map((d: any) => ({ productId: d.id_producto, qty: parseFloat(d.num_cantidad || 0), cost: parseFloat(d.precio_compra), version: null })) })));
          if (peds) setPedidos((peds as any[]).map(p => ({ id: p.id_pedido, clienteId: p.id_cliente, clienteNombre: p.clientes?.nombre || 'Cliente Genérico', productoTexto: p.producto_texto, fecEntrega: p.fec_entrega, adelanto: parseFloat(p.adelanto || 0), notas: p.notas || '', estado: p.estado || 'Pendiente', idUsuario: p.id_usuario, createdAt: p.created_at, updatedAt: p.updated_at })));
          if (devs) setDevoluciones((devs as any[]).map(d => ({
            id: d.id_devolucion,
            saleId: d.id_venta,
            clienteId: d.id_cliente,
            clienteNombre: d.clientes?.nombre || 'Cliente Genérico',
            motivo: d.motivo || '',
            totalReturned: parseFloat(d.total_devuelto || 0),
            cajero: d.profiles ? (d.profiles.nombre + ' ' + (d.profiles.apellido_paterno || '')).trim() : 'Sistema',
            date: new Date(d.fec_devolucion).toLocaleDateString(),
            items: (d.detalle_devolucion || []).map((det: any) => ({
              productId: det.id_producto,
              version: det.id_version ? String(det.id_version) : null,
              qty: parseFloat(det.num_cantidad || 0),
              price: parseFloat(det.precio_unitario)
            }))
          })));
        } catch (err) {
          console.error('Error cargando datos de Supabase', err);
        }
      } else {
        console.log('🔌 Modo Offline: Cargando desde LocalStorage...');
        const localUser = localStorage.getItem('snack_offline_user');
        if (localUser) {
          try {
            const parsed = JSON.parse(localUser);
            setUser(parsed);
            setRole(parsed.rs[0]);
          } catch (e) {
            console.error('Error parsing offline user session', e);
          }
        }
        const localProds = localStorage.getItem('snack_products');
        const localUsers = localStorage.getItem('snack_users');
        const localProviders = localStorage.getItem('snack_providers');
        const localMethods = localStorage.getItem('snack_methods');
        const localSales = localStorage.getItem('snack_sales');
        const localPurchases = localStorage.getItem('snack_purchases');
        const localSession = localStorage.getItem('snack_session');
        const localCashHist = localStorage.getItem('snack_cash_history');
        const localBreadLogs = localStorage.getItem('snack_bread_logs');

        const localDrops = localStorage.getItem('snack_cash_drops');
        const localClients = localStorage.getItem('snack_clients');
        const localRoles = localStorage.getItem('snack_custom_roles_v1');
        const localPedidos = localStorage.getItem('snack_pedidos');
        const localDevoluciones = localStorage.getItem('snack_devoluciones');

        setProducts(localProds ? JSON.parse(localProds) : DEFAULT_PRODUCTS);
        setCategories([
          { id: 1, name: 'Panes' },
          { id: 2, name: 'Tortas' },
          { id: 3, name: 'Dulces' },
          { id: 4, name: 'Bebidas' },
        ]);
        setUsersList(localUsers ? JSON.parse(localUsers) : DEFAULT_USERS);
        setProviders(localProviders ? JSON.parse(localProviders) : DEFAULT_PROVIDERS);
        setPaymentMethods(localMethods ? JSON.parse(localMethods) : DEFAULT_PAYMENT_METHODS);
        setSales(localSales ? JSON.parse(localSales) : []);
        setPurchases(localPurchases ? JSON.parse(localPurchases) : []);
        setCashSession(localSession ? JSON.parse(localSession) : null);
        setCashHistory(localCashHist ? JSON.parse(localCashHist) : []);
        setBreadLogs(localBreadLogs ? JSON.parse(localBreadLogs) : []);
        setCashDrops(localDrops ? JSON.parse(localDrops) : []);
        setClients(localClients ? JSON.parse(localClients) : DEFAULT_CLIENTS);
        setRolesList(localRoles ? JSON.parse(localRoles) : DEFAULT_ROLES);
        setPedidos(localPedidos ? JSON.parse(localPedidos) : []);
        setDevoluciones(localDevoluciones ? JSON.parse(localDevoluciones) : []);
      }
      if (isFirstLoad) setLoading(false);
    }
    loadData(true);

    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          loadData(false);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // --- CONNECT SUB-HOOKS LÓGICA ---
  const authOps = useAuthOperations({
    user, setUser,
    role, setRole,
    usersList, setUsersList,
    rolesList, setRolesList,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline
  });

  const inventoryOps = useInventoryOps({
    products, setProducts,
    categories,
    breadLogs, setBreadLogs,
    user,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline
  });

  const cartOps = useCartOperations({
    cart, setCart,
    products, setProducts,
    sales, setSales,
    paymentMethods, setPaymentMethods,
    cashSession, setCashSession,
    clients, setClients,
    breadLogs, setBreadLogs,
    user,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline
  });

  const cashOps = useCashOperations({
    cashSession, setCashSession,
    cashHistory, setCashHistory,
    cashDrops, setCashDrops,
    user,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline
  });

  const clientOps = useClientOps({
    clients, setClients,
    providers, setProviders,
    cashSession, setCashSession,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline
  });

  const orderOps = useOrderOperations({
    pedidos, setPedidos,
    devoluciones, setDevoluciones,
    purchases, setPurchases,
    sales, setSales,
    products, setProducts,
    clients, setClients,
    providers,
    breadLogs, setBreadLogs,
    user,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline
  });

  return (
    <AppContext.Provider value={{
      user,
      role,
      loading,
      products,
      categories,
      usersList,
      providers,
      paymentMethods,
      sales,
      purchases,
      cart,
      cashSession,
      cashHistory,
      cashDrops,
      breadLogs,
      clients,
      rolesList,
      toastMsg,
      pedidos,
      devoluciones,
      toast,
      ...authOps,
      ...inventoryOps,
      ...cartOps,
      ...cashOps,
      ...clientOps,
      ...orderOps
    }}>
      {children}
      {toastMsg && <div className="snack" style={{ display: 'block' }}>{toastMsg}</div>}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
