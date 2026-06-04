"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// --- TYPES & INTERFACES ---
export interface ProductVersion {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  cat: string;
  price: number;
  stock: number;
  em?: string;
  versions: ProductVersion[];
}

export interface User {
  id: number | string;
  u: string;
  p?: string;
  n: string;
  rs: string[];
  st: string;
  email: string;
  phone: string;
}

export interface Provider {
  id: number | string;
  ruc: string;
  name: string;
  phone: string;
  address: string;
  active: boolean;
}

export interface PaymentMethod {
  id: number;
  name: string;
  desc: string;
  active: boolean;
}

export interface CartItem {
  id: number;
  cartId?: string;
  name: string;
  price: number;
  qty: number;
  version: string | null;
}

export interface DenominacionArqueo {
  b100: number; b50: number; b20: number; b10: number;
  m5: number; m2: number; m1: number; m050: number; m020: number; m010: number;
}

export interface CashSession {
  id: number | string;
  fec_apertura: string | Date;
  date?: string;
  tot_saldo_inicial: number;
  tot_ventas_efectivo: number;
  tot_ventas_otros: number;
  tot_retiros: number;
  estado: 'abierto' | 'cerrado';
  cajero?: string;
  turno?: string;
}

export interface CashDrop {
  id: number;
  sessionId: number | string;
  monto: number;
  motivo: string;
  cajero: string;
  hora: string;
}

export interface CashHistoryRecord {
  id: number | string;
  fec_apertura: string;
  fec_cierre: string;
  monto_inicial: number;
  monto_final: number;
  ventas_efectivo: number;
  ventas_otros: number;
  tot_retiros?: number;
  diferencia?: number;
  estado: 'cerrado';
  cajero?: string;
  date?: string;
  turno?: string;
  observaciones?: string;
  denominaciones?: DenominacionArqueo;
}

export interface CustomRole {
  id: string;
  name: string;
  desc: string;
  permissions: string[];
}

export interface Client {
  id: number | string;
  nombre: string;
  dni?: string;
  telefono?: string;
  email?: string;
  limiteCred: number;
  saldoCred: number;
  historialPagos: CreditPayment[];
  active: boolean;
}

export interface CreditPayment {
  id: number;
  fecha: string;
  concepto: string;
  monto: number;
  tipo: 'cargo' | 'abono';
  metodoPago?: string; // Efectivo, Yape, Transferencia, etc.
}

export interface BreadLog {
  id: number;
  d: string;
  prodName: string;
  type: 'produccion' | 'descarte' | 'venta' | 'compra' | 'conversion';
  qty: number;
  reason: string;
  cajero?: string;
  ref_id?: string;
  destino?: string;        // Para conversiones: producto destino (ej: "Budín de pan")
  costoEstimado?: number;  // Costo estimado del insumo convertido
}

export interface Sale {
  id: number;
  n: number;
  items: CartItem[];
  total: number;
  method: string;
  methodId?: number;
  d: string;
  t: string;
  cajero: string;
  clienteId?: number | string;
  clienteNombre?: string;
}

export interface PurchaseItem {
  productId: number;
  qty: number;
  cost: number;
  version?: string | null;
}

export interface Purchase {
  id: string;
  d: string;
  prov: string;
  subTotal: string;
  igv: string;
  total: string;
  items: PurchaseItem[];
}

export interface AppContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  products: Product[];
  categories: { id: number; name: string }[];
  usersList: User[];
  providers: Provider[];
  paymentMethods: PaymentMethod[];
  sales: Sale[];
  purchases: Purchase[];
  cart: CartItem[];
  cashSession: CashSession | null;
  cashHistory: CashHistoryRecord[];
  cashDrops: CashDrop[];
  breadLogs: BreadLog[];
  clients: Client[];
  rolesList: CustomRole[];
  toastMsg: string;
  toast: (msg: string) => void;
  login: (uIn: string, pIn: string) => Promise<{ success: boolean; user?: User; message?: string }>;
  logout: () => void;
  sendRecoveryEmail: (emailIn: string) => Promise<{ success: boolean; online?: boolean; userId?: number | string; username?: string; message?: string }>;
  resetPasswordOffline: (userId: number | string, newPass: string) => void;
  addToCart: (productName: string, price: number, em: any, id: number, versionObj?: ProductVersion | null) => void;
  updateCartQty: (id: number, delta: number, version?: string | null) => void;
  clearCart: () => void;
  checkoutCart: (paymentMethodId: number, clienteId?: number | string) => Promise<Sale | undefined>;
  saveUser: (uObj: any) => void;
  toggleUserStatus: (userId: number | string) => Promise<void>;
  lookupProfileByDni: (dni: string) => Promise<{ firstName: string; lastName: string; email?: string; phone?: string } | null>;
  saveProvider: (pObj: any) => Promise<void>;
  toggleProvider: (id: number | string) => Promise<void>;
  savePaymentMethod: (mObj: any) => Promise<void>;
  togglePaymentMethod: (id: number) => Promise<void>;
  registerPurchase: (pObj: { providerId: number | string; items: PurchaseItem[] }) => Promise<void>;
  openCashSession: (initialAmount: string | number, shift: string) => Promise<void>;
  closeCashSession: (countedAmount: string | number, observaciones: string, denominaciones?: DenominacionArqueo) => Promise<void>;
  registerCashDrop: (monto: number, motivo: string) => Promise<void>;
  saveProduct: (pObj: any) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  logBreadProduction: (prodId: number, qty: number, version?: string | null) => Promise<void>;
  logBreadDiscard: (prodId: number, qty: number, reason: string, version?: string | null) => Promise<void>;
  saveClient: (cObj: any) => Promise<Client | undefined>;
  toggleClient: (id: number | string) => void;
  payCreditBalance: (clientId: number | string, monto: number, concepto: string, metodoPago?: string) => void;
  logBreadConversion: (prodId: number, qty: number, destino: string, costoEstimado?: number, version?: string | null) => void;
  saveRole: (roleObj: any) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
}

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

  const [toastMsg, setToastMsg] = useState<string>('');

  // --- SHOW TOAST HELPER ---
  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // --- INITIAL LOAD ---
  useEffect(() => {
    // Proactively clean obsolete localStorage keys containing demo/mock data
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

    // isFirstLoad: muestra spinner solo la primera vez. Recargas posteriores son silenciosas.
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
            { data: clis }, { data: provs }, { data: sesAbierta }, { data: cashHist }, { data: ventas }, { data: compras }
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
            supabase.from('ventas').select('*, detalle_venta(*, productos(nombre, em), producto_versiones(nombre_version)), metodos_pago(tipo_pago), profiles(nombre, apellido_paterno)').eq('estado', 1).order('fec_venta', { ascending: false }).limit(500),
            supabase.from('compras').select('*, detalle_compra(*, productos(nombre)), proveedores(nombre_empresa)').eq('estado', 1).order('fec_compra', { ascending: false }).limit(200),
          ]);
          if (prods) setProducts((prods as any[]).map(p => ({ id: p.id_producto, name: p.nombre, cat: p.categorias?.nombre || 'Sin categoria', price: parseFloat(p.precio_unitario), stock: p.num_stock, em: p.em, versions: p.producto_versiones ? (p.producto_versiones as any[]).map(v => ({ id: v.id_version, name: v.nombre_version, price: parseFloat(v.precio_unitario), stock: v.num_stock })) : [] })));
          if (cats) setCategories((cats as any[]).map(c => ({ id: c.id_categoria, name: c.nombre })));
          if (rls) setRolesList((rls as any[]).map(r => ({ id: r.nombre, name: r.nombre, desc: r.descripcion || '', permissions: Array.isArray(r.permisos) ? r.permisos : (typeof r.permisos === 'string' ? JSON.parse(r.permisos) : []) })));
          if (paym) setPaymentMethods((paym as any[]).map(pm => ({ id: pm.id_metodo_pago, name: pm.tipo_pago, desc: 'Metodo en la nube', active: pm.estado === 1 })));
          if (profs) setUsersList((profs as any[]).map(p => ({ id: p.id, u: p.username, p: '••••', n: p.nombre + ' ' + (p.apellido_paterno || ''), rs: [p.roles?.nombre || 'Cajero'], st: p.estado, email: p.correo, phone: p.num_telefono || '' })));
          if (clis) setClients((clis as any[]).map(c => ({ id: c.id_cliente, nombre: c.nombre, dni: c.dni || '', telefono: c.telefono || '', email: c.email || '', limiteCred: parseFloat(c.limite_credito || 0), saldoCred: parseFloat(c.saldo_credito || 0), historialPagos: c.historial_pagos ? (typeof c.historial_pagos === 'string' ? JSON.parse(c.historial_pagos) : c.historial_pagos) : [], active: c.estado === 1 })));
          if (provs) setProviders((provs as any[]).map(pr => ({ id: pr.id_proveedor, ruc: pr.ruc, name: pr.nombre_empresa, phone: pr.num_telefono, address: pr.direccion, active: pr.estado === 1 })));
          if (sesAbierta && sesAbierta.length > 0) setCashSession({ id: sesAbierta[0].id_cierre_caja, fec_apertura: new Date(sesAbierta[0].fec_apertura), tot_saldo_inicial: parseFloat(sesAbierta[0].tot_saldo_inicial), tot_ventas_efectivo: parseFloat(sesAbierta[0].tot_ventas_efectivo), tot_ventas_otros: parseFloat(sesAbierta[0].tot_ventas_otros), tot_retiros: parseFloat(sesAbierta[0].tot_retiros || 0), estado: 'abierto' });
          if (cashHist) setCashHistory((cashHist as any[]).map(h => ({ id: h.id_cierre_caja, fec_apertura: new Date(h.fec_apertura).toLocaleDateString(), fec_cierre: new Date(h.fec_cierre).toLocaleDateString(), monto_inicial: parseFloat(h.tot_saldo_inicial), monto_final: parseFloat(h.tot_saldo_final), ventas_efectivo: parseFloat(h.tot_ventas_efectivo), ventas_otros: parseFloat(h.tot_ventas_otros), estado: 'cerrado' })));
          if (ventas) setSales((ventas as any[]).map(v => ({ id: v.id_venta, n: v.id_venta, items: (v.detalle_venta || []).map((d: any) => ({ id: d.id_producto, name: (d.productos?.nombre || '') + (d.producto_versiones ? ` (${d.producto_versiones.nombre_version})` : ''), price: parseFloat(d.precio_unitario), qty: d.num_cantidad, version: d.producto_versiones?.nombre_version || null })), total: parseFloat(v.tot_pago), method: v.metodos_pago?.tipo_pago || 'Efectivo', methodId: v.id_metodo_pago, d: new Date(v.fec_venta).toLocaleDateString(), t: new Date(v.fec_venta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), cajero: v.profiles ? (v.profiles.nombre + ' ' + (v.profiles.apellido_paterno || '')).trim() : 'Sistema', clienteId: v.id_cliente || undefined })));
          if (compras) setPurchases((compras as any[]).map(c => ({ id: 'COM-' + c.id_compra, d: new Date(c.fec_compra).toLocaleDateString(), prov: c.proveedores?.nombre_empresa || 'Proveedor', subTotal: 'S/. ' + parseFloat(c.sub_total).toFixed(2), igv: 'S/. ' + parseFloat(c.igv).toFixed(2), total: 'S/. ' + parseFloat(c.tot_pago).toFixed(2), items: (c.detalle_compra || []).map((d: any) => ({ productId: d.id_producto, qty: d.num_cantidad, cost: parseFloat(d.precio_compra), version: null })) })));
        } catch (err) {
          console.error('Error cargando datos de Supabase', err);
        }
      } else {
        // --- CARGAR DESDE LOCALSTORAGE (MODO OFFLINE) ---
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

  // --- SAVE LOCALSTORAGE HELPER ---
  const saveOffline = (key: string, data: any) => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  // --- AUTH OPERATIONS ---
  const login = async (uIn: string, pIn: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        let emailToUse = uIn;

        // Si es un nombre de usuario (no contiene @), buscamos su correo en la tabla public.profiles
        if (!uIn.includes('@')) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('correo')
            .eq('username', uIn)
            .maybeSingle();

          if (profile && profile.correo) {
            emailToUse = profile.correo;
          } else {
            // Fallback por defecto si no lo encuentra en perfiles
            emailToUse = `${uIn}@snackroque.com`;
          }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: pIn,
        });
        if (error) throw error;
        
        // Obtener perfil asociado
        const { data: prof, error: profErr } = await supabase.from('profiles').select('*, roles(nombre)').eq('id', data.user.id).single();
        if (profErr) throw profErr;
        
        if (prof) {
          const userObj: User = {
            id: prof.id,
            u: prof.username,
            n: prof.nombre + ' ' + prof.apellido_paterno,
            rs: [prof.roles.nombre],
            email: prof.correo || data.user.email, // Si profiles no tiene email, usar de auth
            phone: prof.num_telefono,
            st: prof.estado
          };
          setUser(userObj);
          setRole(prof.roles.nombre);
          toast(`✨ ¡Bienvenido, ${prof.nombre}!`);
          return { success: true, user: userObj };
        }
        return { success: false, message: 'Perfil no encontrado' };
      } catch (err: any) {
        toast(`❌ Error de login: ${err.message}`);
        return { success: false, message: err.message };
      }
    } else {
      // Login offline
      const found = usersList.find(x => (x.u === uIn || x.email === uIn) && x.p === pIn && x.st === 'act');
      if (found) {
        setUser(found);
        setRole(found.rs[0]);
        localStorage.setItem('snack_offline_user', JSON.stringify(found));
        toast(`✨ ¡Bienvenido, ${found.n.split(' ')[0]}!`);
        return { success: true, user: found };
      } else {
        toast('❌ Credenciales inválidas o usuario inactivo');
        return { success: false, message: 'Credenciales inválidas' };
      }
    }
  };

  const logout = () => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(console.error);
    }
    setUser(null);
    setRole(null);
    setCart([]);
    localStorage.removeItem('snack_offline_user');
    toast('↩ Sesión cerrada');
  };

  // --- PASSWORD RECOVERY ---
  // Siempre usamos OTP propio vía Resend — nunca el email genérico de Supabase.
  // La verificación del correo se hace vía API server-side (service role)
  // porque el usuario NO está autenticado durante este flujo.
  const sendRecoveryEmail = async (emailIn: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        // Verificar correo vía endpoint server-side (bypasa RLS con service role)
        const res = await fetch('/api/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailIn }),
        });

        const data = await res.json();

        if (!res.ok || !data.found) {
          toast('❌ Correo electrónico no encontrado.');
          return { success: false, message: 'Correo no registrado en el sistema' };
        }

        return { success: true, online: false, userId: data.userId, username: data.username };
      } catch (err: any) {
        toast(`❌ Error verificando correo: ${err.message}`);
        return { success: false, message: err.message };
      }
    } else {
      // Modo offline — buscar en lista local
      const found = usersList.find(x => x.email === emailIn);
      if (found) {
        return { success: true, userId: found.id, username: found.u, online: false };
      }
      toast('❌ Correo electrónico no encontrado.');
      return { success: false };
    }
  };

  const resetPasswordOffline = async (userId: number | string, newPass: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        // Actualizar contraseña en Supabase Auth usando admin API vía endpoint
        const res = await fetch('/api/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, newPassword: newPass })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(`❌ Error al actualizar contraseña: ${err.error || 'Error desconocido'}`);
          return;
        }
        toast('🔒 Contraseña restablecida con éxito.');
      } catch (err: any) {
        toast(`❌ Error: ${err.message}`);
      }
    } else {
      const updated = usersList.map(u => u.id === userId ? { ...u, p: newPass } : u);
      setUsersList(updated);
      saveOffline('snack_users', updated);
      toast('🔒 Contraseña restablecida con éxito.');
    }
  };

  // --- POS BASICS ---
  const addToCart = (productName: string, price: number, em: any, id: number, versionObj: ProductVersion | null = null) => {
    // Verificar sesión de caja obligatoria
    if (!cashSession) {
      toast('⚠️ Debe iniciar caja para realizar ventas.');
      return;
    }

    const prod = products.find(x => x.id === id);
    if (!prod) return;

    if (versionObj) {
      const cartId = `${id}-${versionObj.name}`;
      const existing = cart.find(x => x.cartId === cartId);
      
      if (existing) {
        if (existing.qty >= versionObj.stock) {
          toast('⚠️ Sin existencias adicionales');
          return;
        }
        setCart(cart.map(x => x.cartId === cartId ? { ...x, qty: x.qty + 1 } : x));
      } else {
        if (versionObj.stock <= 0) {
          toast('⚠️ Variante agotada');
          return;
        }
        setCart([...cart, { cartId, id, name: `${prod.name} (${versionObj.name})`, price: versionObj.price, qty: 1, version: versionObj.name }]);
      }
    } else {
      if (prod.stock <= 0) {
        toast('⚠️ Producto agotado');
        return;
      }
      const existing = cart.find(x => x.id === id && !x.version);
      if (existing) {
        if (existing.qty >= prod.stock) {
          toast('⚠️ Sin existencias adicionales');
          return;
        }
        setCart(cart.map(x => (x.id === id && !x.version) ? { ...x, qty: x.qty + 1 } : x));
      } else {
        setCart([...cart, { id, name: prod.name, price, qty: 1, version: null }]);
      }
    }
    toast('🥐 Añadido al carrito');
  };

  const updateCartQty = (id: number, delta: number, version: string | null = null) => {
    const cartId = version ? `${id}-${version}` : null;
    const item = cart.find(x => version ? x.cartId === cartId : (x.id === id && !x.version));
    if (!item) return;

    const prod = products.find(p => p.id === id);
    if (!prod) return;

    if (delta > 0) {
      if (version) {
        const vObj = prod.versions.find(v => v.name === version);
        if (vObj && item.qty >= vObj.stock) return;
      } else {
        if (item.qty >= prod.stock) return;
      }
    }

    const updated = cart.map(x => {
      const match = version ? x.cartId === cartId : (x.id === id && !x.version);
      if (match) {
        return { ...x, qty: x.qty + delta };
      }
      return x;
    }).filter(x => x.qty > 0);

    setCart(updated);
  };

  const clearCart = () => setCart([]);

  const checkoutCart = async (paymentMethodId: number, clienteId?: number | string): Promise<Sale | undefined> => {
    if (cart.length === 0) return;
    
    let activeSession = cashSession;
    const isAdmin = user?.rs?.includes('Administrador');

    if (!activeSession) {
      if (isAdmin) {
        // Auto-crear turno virtual administrativo en el acto
        const newSession: CashSession = {
          id: Date.now(),
          fec_apertura: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString(),
          tot_saldo_inicial: 0,
          tot_ventas_efectivo: 0,
          tot_ventas_otros: 0,
          tot_retiros: 0,
          estado: 'abierto',
          cajero: user ? user.n : 'Administrador',
          turno: 'Administrativo'
        };
        setCashSession(newSession);
        saveOffline('snack_session', newSession);
        
        if (isSupabaseConfigured && supabase) {
          try {
            const { data } = await supabase.from('cierres_caja').insert({
              id_usuario: user?.id,
              tot_saldo_inicial: 0,
              estado: 'abierto'
            }).select().single();
            if (data) {
              newSession.id = data.id_cierre_caja;
              setCashSession(newSession);
            }
          } catch (err) {
            console.error('Error al auto-abrir caja administrativa', err);
          }
        }
        activeSession = newSession;
        toast('💼 Turno Administrativo auto-inicializado para esta venta.');
      } else {
        toast('⚠️ Debe iniciar caja para realizar ventas.');
        return;
      }
    }

    const sub = cart.reduce((a, b) => a + (b.price * b.qty), 0);
    const igv = sub * 0.18;
    const tot = sub + igv;
    
    const pm = paymentMethods.find(m => m.id === paymentMethodId) || { name: 'Efectivo' };
    const methodStr = pm.name;

    // Descontar Stock
    const updatedProds = products.map(p => {
      const itemsToDeduct = cart.filter(c => c.id === p.id);
      if (itemsToDeduct.length === 0) return p;

      let newStock = p.stock;
      let newVersions = [...p.versions];

      itemsToDeduct.forEach(item => {
        if (item.version) {
          newVersions = newVersions.map(v => 
            v.name === item.version ? { ...v, stock: v.stock - item.qty } : v
          );
        } else {
          newStock -= item.qty;
        }
      });

      return { ...p, stock: newStock, versions: newVersions };
    });

    setProducts(updatedProds);
    saveOffline('snack_products', updatedProds);

    // Sumar a la caja activa
    const isEfectivo = methodStr.toLowerCase().includes('efectivo');
    const updatedSession = {
      ...activeSession,
      tot_ventas_efectivo: activeSession.tot_ventas_efectivo + (isEfectivo ? tot : 0),
      tot_ventas_otros: activeSession.tot_ventas_otros + (!isEfectivo ? tot : 0),
    };
    setCashSession(updatedSession);
    saveOffline('snack_session', updatedSession);

    // Determinar si es venta a crédito
    const isCredito = paymentMethodId === 999; // ID reservado para crédito
    const clienteObj = clienteId ? clients.find(c => c.id === clienteId) : null;

    if (isCredito && clienteObj) {
      // Verificar límite de crédito
      const disponible = clienteObj.limiteCred - clienteObj.saldoCred;
      if (tot > disponible) {
        toast(`⚠️ Límite de crédito insuficiente. Disponible: S/. ${disponible.toFixed(2)}`);
        return;
      }
      // Cargar crédito al cliente
      const nuevoPago: CreditPayment = { id: Date.now(), fecha: new Date().toLocaleDateString(), concepto: `Compra a crédito — ${cart.map(i => i.name).join(', ')}`, monto: tot, tipo: 'cargo' };
      
      const newSaldo = clienteObj.saldoCred + tot;
      const newHistorial = [...clienteObj.historialPagos, nuevoPago];

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('clientes').update({
            saldo_credito: newSaldo,
            historial_pagos: newHistorial
          }).eq('id_cliente', clienteId);
        } catch (err) {
          console.error('Error al actualizar crédito de cliente en Supabase', err);
        }
      }

      const updClients = clients.map(c => c.id === clienteId ? { ...c, saldoCred: newSaldo, historialPagos: newHistorial } : c);
      setClients(updClients);
      saveOffline('snack_clients', updClients);
    }

    // Registrar Venta
    const saleObj: Sale = {
      id: Date.now(),
      n: sales.length + 501,
      items: [...cart],
      total: tot,
      method: isCredito ? `Crédito${clienteObj ? ' — ' + clienteObj.nombre : ''}` : methodStr,
      methodId: paymentMethodId,
      d: new Date().toLocaleDateString(),
      t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cajero: user ? user.n : 'Carlos Mendoza',
      clienteId: clienteId || undefined,
      clienteNombre: clienteObj?.nombre || undefined
    };

    const newSales = [...sales, saleObj];
    setSales(newSales);
    saveOffline('snack_sales', newSales);

    // Supabase Sync
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: vData } = await supabase.from('ventas').insert({
          id_cliente: clienteId || null,
          id_usuario: user?.id,
          id_cierre_caja: activeSession.id,
          id_metodo_pago: paymentMethodId,
          sub_total: sub,
          igv,
          tot_pago: tot
        }).select().single();

        if (vData) {
          const detailRows = cart.map(item => {
            const prodRef = products.find(p => p.id === item.id);
            const vRef = (item.version && prodRef) ? prodRef.versions.find(v => v.name === item.version) : null;
            return {
              id_venta: vData.id_venta,
              id_producto: item.id,
              id_version: vRef ? vRef.id : null,
              num_cantidad: item.qty,
              precio_unitario: item.price
            };
          });
          await supabase.from('detalle_venta').insert(detailRows);
        }
      } catch (err) {
        console.error('Error al sincronizar venta con Supabase', err);
      }
    }

    // Registrar Kardex por cada producto vendido
    const saleRef = `VTA-${saleObj.id}`;
    const newKardexEntries: BreadLog[] = cart.map(item => ({
      id: Date.now() + Math.random(),
      d: `${saleObj.d} ${saleObj.t}`,
      prodName: item.name,
      type: 'venta',
      qty: item.qty,
      reason: `Venta POS #${saleObj.n}`,
      cajero: user?.n || 'Sistema',
      ref_id: saleRef
    }));
    const updLogs = [...newKardexEntries, ...breadLogs];
    setBreadLogs(updLogs);
    saveOffline('snack_bread_logs', updLogs);

    setCart([]);
    toast('✅ Venta registrada correctamente');
    return saleObj;
  };

  // --- CRUD GESTION USUARIOS ---
  const saveUser = async (uObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (uObj.id) {
          // Actualizar usuario existente
          let idRol = 2; // Cajero por defecto
          if (uObj.role === 'Administrador') idRol = 1;
          else if (uObj.role === 'Panadero') idRol = 3;

          const { error } = await supabase.from('profiles').update({
            username: uObj.u,
            nombre: uObj.n.split(' ')[0] || uObj.n,
            apellido_paterno: uObj.n.split(' ').slice(1).join(' ') || '',
            correo: uObj.email,
            num_telefono: uObj.phone,
            id_rol: idRol
          }).eq('id', uObj.id);

          if (error) throw error;
          toast('👤 Colaborador actualizado en la nube');
        } else {
          // Crear nuevo usuario en auth y profiles
          let idRol = 2; // Cajero por defecto
          if (uObj.role === 'Administrador') idRol = 1;
          else if (uObj.role === 'Panadero') idRol = 3;

          // Usar la contraseña ingresada en el formulario
          const tempPassword = uObj.p || (uObj.email?.split('@')[0] + '123456') || `Temp${Date.now()}`;

          // Crear usuario en auth usando endpoint
          const authResponse = await fetch('/api/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: uObj.email,
              password: uObj.p || tempPassword,
              userData: {
                username: uObj.u,
                nombre: uObj.n.split(' ')[0] || uObj.n,
                apellido_paterno: uObj.n.split(' ').slice(1).join(' ') || '',
                id_rol: idRol
              }
            })
          });

          const authData = await authResponse.json();

          if (!authResponse.ok && !authData.message?.includes('already exists')) {
            throw new Error(authData.error || 'Error creando usuario en auth');
          }

          // El trigger handle_new_user ya insertó el perfil automáticamente.
          // Solo actualizamos los campos adicionales que el trigger no conoce.
          const userId = authData.userId;
          if (userId) {
            const { error: updateError } = await supabase.from('profiles').update({
              username: uObj.u,
              nombre: uObj.n.split(' ')[0] || uObj.n,
              apellido_paterno: uObj.n.split(' ').slice(1).join(' ') || '',
              correo: uObj.email,
              num_telefono: uObj.phone || '',
              id_rol: idRol,
              estado: 'act'
            }).eq('id', userId);

            if (updateError) {
              console.warn('Advertencia al actualizar perfil post-trigger:', updateError.message);
            }
          }

          toast(`✅ Colaborador creado. Contraseña temporal: ${tempPassword}`);
        }

        // Recargar lista desde Supabase
        const { data: profs, error: selectError } = await supabase.from('profiles').select('*, roles(nombre)');
        if (selectError) {
          console.error('Error recargar perfiles:', selectError);
        } else if (profs) {
          setUsersList((profs as any[]).map(p => ({
            id: p.id,
            u: p.username || '',
            p: '••••',
            n: (p.nombre || '') + ' ' + (p.apellido_paterno || ''),
            rs: [p.roles?.nombre || 'Cajero'],
            st: p.estado === 1 ? 'act' : 'inact',
            email: p.correo || '',
            phone: p.num_telefono || ''
          })));
        }
      } catch (err: any) {
        console.error('Error en saveUser:', err);
        toast(`❌ Error: ${err.message}`);
        // Fallback local
        const newUser = { ...uObj, id: `local_${Date.now()}`, st: 'act', rs: [uObj.role] };
        setUsersList([...usersList, newUser]);
        saveOffline('snack_users', [...usersList, newUser]);
        toast('✅ Colaborador guardado localmente (sincronización pendiente)');
      }
    } else {
      // Fallback local
      let updated;
      if (uObj.id) {
        updated = usersList.map(u => u.id === uObj.id ? { ...u, ...uObj } : u);
        toast('👤 Colaborador actualizado');
      } else {
        const newUser = { ...uObj, id: Date.now(), st: 'act', rs: [uObj.role] };
        updated = [...usersList, newUser];
        toast('👤 Colaborador registrado');
      }
      setUsersList(updated);
      saveOffline('snack_users', updated);
    }
  };

  const toggleUserStatus = async (userId: number | string) => {
    const currentUser = usersList.find(u => u.id === userId);
    const newStatus = currentUser?.st === 'act' ? 'ina' : 'act';
    const updated = usersList.map(u => u.id === userId ? { ...u, st: newStatus } : u);

    setUsersList(updated);
    saveOffline('snack_users', updated);

    if (isSupabaseConfigured && supabase && currentUser) {
      try {
        await supabase.from('profiles').update({ estado: newStatus }).eq('id', userId);
        toast('✅ Estado de colaborador actualizado en la nube');
      } catch (err: any) {
        toast(`❌ Error actualizando estado en la nube: ${err.message}`);
      }
    } else {
      toast('👤 Estado de colaborador actualizado');
    }
  };

  const lookupProfileByDni = async (dni: string) => {
    // Buscar en Supabase si está configurado
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('numero_documento', dni)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          const firstName = data.nombre || '';
          const lastName = data.apellido_paterno || '';
          const email = data.correo || '';
          const phone = data.num_telefono || '';

          return {
            firstName: firstName || lastName || '',
            lastName: lastName || '',
            email: email || undefined,
            phone: phone || undefined
          };
        }
        
        return null;
      } catch (err: any) {
        console.error('Error buscando perfil en Supabase:', err);
        throw new Error(`Error al consultar el perfil por DNI en Supabase: ${err.message}`);
      }
    }

    // Si Supabase no está configurado, intentar con API externa
    const baseUrl = process.env.NEXT_PUBLIC_PROFILE_LOOKUP_URL?.trim() || '';
    if (!baseUrl) {
      throw new Error('No se ha configurado Supabase ni NEXT_PUBLIC_PROFILE_LOOKUP_URL para la búsqueda de perfiles por DNI.');
    }

    const url = baseUrl.includes('{dni}')
      ? baseUrl.replace('{dni}', encodeURIComponent(dni))
      : `${baseUrl.replace(/\/$/, '')}${baseUrl.includes('?') ? '&' : '?'}dni=${encodeURIComponent(dni)}`;

    const authToken = process.env.NEXT_PUBLIC_PROFILE_LOOKUP_AUTH?.trim() || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (authToken) {
      headers.Authorization = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Error al consultar el servicio de perfiles: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data || typeof data !== 'object') return null;

    const firstName =
      (data as any).nombre ||
      (data as any).nombres ||
      (data as any).first_name ||
      (data as any).firstName ||
      '';

    const lastNameParts = [
      (data as any).apellido_paterno,
      (data as any).apellido_materno,
      (data as any).apellido,
      (data as any).last_name,
      (data as any).lastName
    ].filter(Boolean);
    const lastName = lastNameParts.join(' ').trim();

    const email =
      (data as any).email ||
      (data as any).correo ||
      (data as any).correo_electronico ||
      '';
    const phone =
      (data as any).telefono ||
      (data as any).celular ||
      (data as any).phone ||
      (data as any).mobile ||
      '';

    if (!firstName && !lastName && !email && !phone) {
      return null;
    }

    return {
      firstName: firstName || lastName || '',
      lastName: lastName || '',
      email: email || undefined,
      phone: phone || undefined
    };
  };

  // --- CRUD GESTION PROVEEDORES ---
  const saveProvider = async (pObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (pObj.id) {
          await supabase.from('proveedores').update({
            ruc: pObj.ruc,
            nombre_empresa: pObj.name,
            num_telefono: pObj.phone,
            direccion: pObj.address
          }).eq('id_proveedor', pObj.id);
        } else {
          await supabase.from('proveedores').insert({
            ruc: pObj.ruc,
            nombre_empresa: pObj.name,
            num_telefono: pObj.phone,
            direccion: pObj.address,
            estado: 1
          });
        }
        // Recargar datos de proveedores
        const { data } = await supabase.from('proveedores').select('*');
        if (data) {
          setProviders((data as any[]).map(pr => ({
            id: pr.id_proveedor,
            ruc: pr.ruc,
            name: pr.nombre_empresa,
            phone: pr.num_telefono,
            address: pr.direccion,
            active: pr.estado === 1
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      if (pObj.id) {
        updated = providers.map(p => p.id === pObj.id ? { ...p, ...pObj } : p);
        toast('🏭 Proveedor actualizado');
      } else {
        const newProv: Provider = { ...pObj, id: Date.now(), active: true };
        updated = [...providers, newProv];
        toast('🏭 Proveedor registrado');
      }
      setProviders(updated);
      saveOffline('snack_providers', updated);
    }
  };

  const toggleProvider = async (id: number | string) => {
    const prov = providers.find(p => p.id === id);
    if (!prov) return;
    const newActive = !prov.active;
    const updated = providers.map(p => p.id === id ? { ...p, active: newActive } : p);
    setProviders(updated);
    saveOffline('snack_providers', updated);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('proveedores').update({ estado: newActive ? 1 : 0 }).eq('id_proveedor', id);
        toast('🏭 Estado de proveedor actualizado en la nube');
      } catch (err: any) {
        toast(`❌ Error actualizando proveedor: ${err.message}`);
      }
    } else {
      toast('🏭 Estado de proveedor actualizado');
    }
  };

  // --- CRUD METODOS DE PAGO ---
  const savePaymentMethod = async (mObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (mObj.id) {
          await supabase.from('metodos_pago').update({
            tipo_pago: mObj.name,
            estado: mObj.active !== false ? 1 : 0
          }).eq('id_metodo_pago', mObj.id);
          toast('💳 Método de pago actualizado en la nube');
        } else {
          await supabase.from('metodos_pago').insert({
            tipo_pago: mObj.name,
            estado: 1
          });
          toast('💳 Nuevo método de pago registrado en la nube');
        }
        // Recargar desde Supabase
        const { data } = await supabase.from('metodos_pago').select('*');
        if (data) {
          setPaymentMethods((data as any[]).map(pm => ({
            id: pm.id_metodo_pago,
            name: pm.tipo_pago,
            desc: 'Método configurado en la nube',
            active: pm.estado === 1
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      if (mObj.id) {
        updated = paymentMethods.map(m => m.id === mObj.id ? { ...m, ...mObj } : m);
        toast('💳 Método de pago actualizado');
      } else {
        const newMethod = { ...mObj, id: Date.now(), active: true };
        updated = [...paymentMethods, newMethod];
        toast('💳 Nuevo método de pago registrado');
      }
      setPaymentMethods(updated);
      saveOffline('snack_methods', updated);
    }
  };

  const togglePaymentMethod = async (id: number) => {
    const method = paymentMethods.find(m => m.id === id);
    if (!method) return;
    const newActive = !method.active;
    const updated = paymentMethods.map(m => m.id === id ? { ...m, active: newActive } : m);
    setPaymentMethods(updated);
    saveOffline('snack_methods', updated);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('metodos_pago').update({ estado: newActive ? 1 : 0 }).eq('id_metodo_pago', id);
        toast('💳 Estado del método de pago actualizado en la nube');
      } catch (err: any) {
        toast(`❌ Error actualizando método de pago: ${err.message}`);
      }
    } else {
      toast('💳 Estado del método de pago actualizado');
    }
  };

  // --- COMPRAS (STOCK INTEGRATION) ---
  const registerPurchase = async (pObj: { providerId: number | string; items: PurchaseItem[] }) => {
    // pObj format: { providerId, items: [{ productId, qty, cost, version }] }
    const sub = pObj.items.reduce((a, b) => a + (b.qty * b.cost), 0);
    const igv = sub * 0.18;
    const tot = sub + igv;
    const provName = providers.find(p => p.id === pObj.providerId)?.name || 'Proveedor';

    // Aumentar Stock de productos/variantes
    const updatedProds = products.map(p => {
      const itemsToAdd = pObj.items.filter(c => c.productId === p.id);
      if (itemsToAdd.length === 0) return p;

      let newStock = p.stock;
      let newVersions = [...p.versions];

      itemsToAdd.forEach(item => {
        if (item.version) {
          newVersions = newVersions.map(v => 
            v.name === item.version ? { ...v, stock: v.stock + item.qty } : v
          );
        } else {
          newStock += item.qty;
        }
      });

      return { ...p, stock: newStock, versions: newVersions };
    });

    setProducts(updatedProds);
    saveOffline('snack_products', updatedProds);

    const purchaseRec: Purchase = {
      id: `COM-${Date.now()}`,
      d: new Date().toLocaleDateString(),
      prov: provName,
      subTotal: `S/. ${sub.toFixed(2)}`,
      igv: `S/. ${igv.toFixed(2)}`,
      total: `S/. ${tot.toFixed(2)}`,
      items: pObj.items
    };

    const newPurchases = [...purchases, purchaseRec];
    setPurchases(newPurchases);
    saveOffline('snack_purchases', newPurchases);

    // Registrar Kardex por cada item comprado
    const purchaseKardex: BreadLog[] = pObj.items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return {
        id: Date.now() + Math.random(),
        d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        prodName: (prod?.name || 'Producto') + (item.version ? ` (${item.version})` : ''),
        type: 'compra',
        qty: item.qty,
        reason: `Compra a proveedor: ${provName}`,
        cajero: user?.n || 'Sistema',
        ref_id: purchaseRec.id
      };
    });
    const updLogs2 = [...purchaseKardex, ...breadLogs];
    setBreadLogs(updLogs2);
    saveOffline('snack_bread_logs', updLogs2);

    toast('📥 Compra registrada e inventario actualizado');

    // Supabase Sync
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: cData } = await supabase.from('compras').insert({
          id_usuario: user?.id,
          id_proveedor: pObj.providerId,
          sub_total: sub,
          igv,
          tot_pago: tot,
          estado: 1
        }).select().single();

        if (cData) {
          const detailRows = pObj.items.map(item => {
            const prodRef = products.find(p => p.id === item.productId);
            const vRef = (item.version && prodRef) ? prodRef.versions.find(v => v.name === item.version) : null;
            return {
              id_compra: cData.id_compra,
              id_producto: item.productId,
              id_version: vRef ? vRef.id : null,
              num_cantidad: item.qty,
              precio_compra: item.cost
            };
          });
          await supabase.from('detalle_compra').insert(detailRows);
        }
      } catch (err) {
        console.error('Error al sincronizar compra con Supabase', err);
      }
    }
  };

  // --- CONTROL DE CAJA (APERTURA Y CIERRE) ---
  const openCashSession = async (initialAmount: string | number, shift: string) => {
    const parsedInit = typeof initialAmount === 'string' ? parseFloat(initialAmount) || 0 : initialAmount;
    const newSession: CashSession = {
      id: Date.now(),
      fec_apertura: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
      tot_saldo_inicial: parsedInit,
      tot_ventas_efectivo: 0,
      tot_ventas_otros: 0,
      tot_retiros: 0,
      estado: 'abierto',
      cajero: user ? user.n : 'Carlos Mendoza',
      turno: shift
    };

    setCashSession(newSession);
    saveOffline('snack_session', newSession);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from('cierres_caja').insert({
          id_usuario: user?.id,
          tot_saldo_inicial: parsedInit,
          estado: 'abierto'
        }).select().single();
        if (data) {
          setCashSession({
            ...newSession,
            id: data.id_cierre_caja
          });
        }
      } catch (err) {
        console.error('Error al abrir caja en Supabase', err);
      }
    }
    toast(`💰 Caja abierta en turno ${shift}. Ventas habilitadas.`);
  };

  const closeCashSession = async (countedAmount: string | number, observaciones: string, denominaciones?: DenominacionArqueo) => {
    if (!cashSession) return;

    const parsedCounted = typeof countedAmount === 'string' ? parseFloat(countedAmount) || 0 : countedAmount;
    const totalRetiros = cashSession.tot_retiros || 0;
    const expected = cashSession.tot_saldo_inicial + cashSession.tot_ventas_efectivo - totalRetiros;
    const diff = parsedCounted - expected;

    const closedRecord: CashHistoryRecord = {
      id: cashSession.id,
      fec_apertura: typeof cashSession.fec_apertura === 'string' ? cashSession.fec_apertura : cashSession.fec_apertura.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fec_cierre: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: cashSession.date || new Date().toLocaleDateString(),
      monto_inicial: cashSession.tot_saldo_inicial,
      monto_final: parsedCounted,
      ventas_efectivo: cashSession.tot_ventas_efectivo,
      ventas_otros: cashSession.tot_ventas_otros,
      tot_retiros: totalRetiros,
      diferencia: diff,
      estado: 'cerrado',
      cajero: cashSession.cajero,
      turno: cashSession.turno,
      observaciones: observaciones,
      denominaciones: denominaciones
    };

    const newHistory = [closedRecord, ...cashHistory];
    setCashHistory(newHistory);
    saveOffline('snack_cash_history', newHistory);
    setCashSession(null);
    if (!isSupabaseConfigured) {
      localStorage.removeItem('snack_session');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('cierres_caja').update({
          fec_cierre: new Date(),
          tot_ventas_efectivo: cashSession.tot_ventas_efectivo,
          tot_ventas_otros: cashSession.tot_ventas_otros,
          tot_saldo_final: parsedCounted,
          diferencia: diff,
          estado: 'cerrado'
        }).eq('id_cierre_caja', cashSession.id);
      } catch (err) {
        console.error('Error al cerrar caja en Supabase', err);
      }
    }

    toast('🔴 Caja cerrada correctamente. POS bloqueado.');
  };

  // --- CRUD PRODUCTOS ---
  const saveProduct = async (pObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        // Resolver id_categoria desde nombre usando el estado local
        const catMatch = categories.find((c) => c.name === pObj.cat);
        const idCat = catMatch?.id || null;

        if (pObj.id) {
          await supabase.from('productos').update({
            nombre: pObj.name,
            id_categoria: idCat,
            em: pObj.em || '📦',
            precio_unitario: pObj.price,
            num_stock: pObj.stock || 0
          }).eq('id_producto', pObj.id);
          toast('📦 Producto actualizado en la nube');
        } else {
          const { data: newProd } = await supabase.from('productos').insert({
            nombre: pObj.name,
            id_categoria: idCat,
            em: pObj.em || '📦',
            precio_unitario: pObj.price,
            num_stock: pObj.stock || 0,
            estado: 1
          }).select().single();

          // Insertar versiones si las hay
          if (newProd && pObj.versions?.length > 0) {
            const versionRows = pObj.versions.map((v: any) => ({
              id_producto: newProd.id_producto,
              nombre_version: v.name,
              precio_unitario: v.price,
              num_stock: v.stock || 0,
              estado: 1
            }));
            await supabase.from('producto_versiones').insert(versionRows);
          }
          toast('📦 Producto creado en la nube');
        }

        // Recargar productos desde Supabase
        const { data: prods } = await supabase.from('productos').select('*, producto_versiones(*), categorias(nombre)').eq('estado', 1);
        if (prods) {
          setProducts((prods as any[]).map(p => ({
            id: p.id_producto,
            name: p.nombre,
            cat: p.categorias?.nombre || 'Sin categoría',
            price: parseFloat(p.precio_unitario),
            stock: p.num_stock,
            em: p.em,
            versions: p.producto_versiones ? (p.producto_versiones as any[]).map(v => ({
              id: v.id_version,
              name: v.nombre_version,
              price: parseFloat(v.precio_unitario),
              stock: v.num_stock
            })) : []
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      if (pObj.id) {
        updated = products.map(p => p.id === pObj.id ? { ...p, ...pObj } : p);
        toast('📦 Producto actualizado');
      } else {
        const newProd = { ...pObj, id: Date.now(), stock: pObj.stock || 0, versions: pObj.versions || [] };
        updated = [...products, newProd];
        toast('📦 Producto creado');
      }
      setProducts(updated);
      saveOffline('snack_products', updated);
    }
  };

  const deleteProduct = async (id: number) => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('productos').update({ estado: 0 }).eq('id_producto', id);
        setProducts(products.filter(p => p.id !== id));
        toast('🗑 Producto eliminado de la nube');
      } catch (err: any) {
        toast(`❌ Error eliminando producto: ${err.message}`);
      }
    } else {
      const updated = products.filter(p => p.id !== id);
      setProducts(updated);
      saveOffline('snack_products', updated);
      toast('🗑 Producto eliminado');
    }
  };

  const logBreadProduction = async (prodId: number, qty: number, version: string | null = null) => {
    const updated = products.map(p => {
      if (p.id === prodId) {
        if (version) {
          const newVers = p.versions.map(v => 
            v.name === version ? { ...v, stock: v.stock + qty } : v
          );
          return { ...p, versions: newVers };
        } else {
          return { ...p, stock: p.stock + qty };
        }
      }
      return p;
    });

    setProducts(updated);
    saveOffline('snack_products', updated);

    const prod = products.find(x => x.id === prodId);
    const vRef = (version && prod) ? prod.versions.find(v => v.name === version) : null;

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      prodName: (prod?.name || 'Producto') + (version ? ` (${version})` : ''),
      type: 'produccion',
      qty,
      reason: 'Ingreso inicial de producción diaria'
    };

    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('produccion_descarte').insert({
          id_producto: prodId,
          id_version: vRef?.id || null,
          tipo_registro: 'produccion',
          num_cantidad: qty,
          id_usuario: user?.id
        });
      } catch (err) {
        console.error('Error al registrar producción en Supabase', err);
      }
    }

    toast('➕ Producción de panes registrada');
  };

  const logBreadDiscard = async (prodId: number, qty: number, reason: string, version: string | null = null) => {
    const updated = products.map(p => {
      if (p.id === prodId) {
        if (version) {
          const newVers = p.versions.map(v => 
            v.name === version ? { ...v, stock: Math.max(0, v.stock - qty) } : v
          );
          return { ...p, versions: newVers };
        } else {
          return { ...p, stock: Math.max(0, p.stock - qty) };
        }
      }
      return p;
    });

    setProducts(updated);
    saveOffline('snack_products', updated);

    const prod = products.find(x => x.id === prodId);
    const vRef = (version && prod) ? prod.versions.find(v => v.name === version) : null;

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      prodName: (prod?.name || 'Producto') + (version ? ` (${version})` : ''),
      type: 'descarte',
      qty,
      reason
    };

    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('produccion_descarte').insert({
          id_producto: prodId,
          id_version: vRef?.id || null,
          tipo_registro: 'descarte',
          num_cantidad: qty,
          motivo_descarte: reason,
          id_usuario: user?.id
        });
      } catch (err) {
        console.error('Error al registrar descarte en Supabase', err);
      }
    }

    toast('⚠️ Reporte de descarte registrado');
  };

  // --- RETIRO PARCIAL DE CAJA (CASH DROP) ---
  const registerCashDrop = async (monto: number, motivo: string) => {
    if (!cashSession) {
      toast('⚠️ No hay caja activa para registrar un retiro.');
      return;
    }
    const drop: CashDrop = {
      id: Date.now(),
      sessionId: cashSession.id,
      monto,
      motivo,
      cajero: user?.n || 'Sistema',
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const newDrops = [drop, ...cashDrops];
    setCashDrops(newDrops);
    saveOffline('snack_cash_drops', newDrops);

    // Descontar el retiro del flujo de efectivo de la sesión activa
    const updatedSession: CashSession = {
      ...cashSession,
      tot_retiros: (cashSession.tot_retiros || 0) + monto
    };
    setCashSession(updatedSession);
    saveOffline('snack_session', updatedSession);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('cierres_caja').update({
          tot_ventas_efectivo: updatedSession.tot_ventas_efectivo,
          tot_ventas_otros: updatedSession.tot_ventas_otros
        }).eq('id_cierre_caja', cashSession.id);
      } catch (err) {
        console.error('Error al registrar retiro en Supabase', err);
      }
    }

    toast(`💸 Retiro de S/. ${monto.toFixed(2)} registrado y descontado de caja.`);
  };

  // --- CRUD CLIENTES FRECUENTES ---
  const saveClient = async (cObj: any): Promise<Client | undefined> => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (cObj.id) {
          // Actualizar en Supabase
          const { error } = await supabase.from('clientes').update({
            nombre: cObj.nombre,
            dni: cObj.dni || '',
            telefono: cObj.telefono || '',
            email: cObj.email || '',
            limite_credito: cObj.limiteCred || 0
          }).eq('id_cliente', cObj.id);
          if (error) throw error;
          toast('👤 Cliente actualizado en la nube');
          return clients.find(c => c.id === cObj.id);
        } else {
          // Insertar en Supabase
          const { data, error } = await supabase.from('clientes').insert({
            nombre: cObj.nombre,
            dni: cObj.dni || '',
            telefono: cObj.telefono || '',
            email: cObj.email || '',
            limite_credito: cObj.limiteCred || 0,
            saldo_credito: 0,
            historial_pagos: [],
            estado: 1
          }).select().single();
          if (error) throw error;
          toast('👤 Cliente registrado en la nube');
          if (data) {
            const newCli: Client = {
              id: data.id_cliente,
              nombre: data.nombre,
              dni: data.dni || '',
              telefono: data.telefono || '',
              email: data.email || '',
              limiteCred: parseFloat(data.limite_credito || 0),
              saldoCred: parseFloat(data.saldo_credito || 0),
              historialPagos: [],
              active: true
            };
            setClients(prev => [...prev.filter(c => c.id !== newCli.id), newCli]);
            return newCli;
          }
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      // Modo offline
      let updated;
      let newClient: Client;
      if (cObj.id && clients.find(c => c.id === cObj.id)) {
        updated = clients.map(c => c.id === cObj.id ? { ...c, ...cObj } : c);
        toast('👤 Cliente actualizado');
        newClient = updated.find(c => c.id === cObj.id)!;
      } else {
        newClient = {
          id: Date.now(),
          nombre: cObj.nombre,
          dni: cObj.dni || '',
          telefono: cObj.telefono || '',
          email: cObj.email || '',
          limiteCred: cObj.limiteCred || 0,
          saldoCred: 0,
          historialPagos: [],
          active: true
        };
        updated = [...clients, newClient];
        toast('👤 Cliente registrado');
      }
      setClients(updated);
      saveOffline('snack_clients', updated);
      return newClient;
    }
    return undefined;
  };

  const toggleClient = async (id: number | string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const c = clients.find(x => x.id === id);
        if (!c) return;
        const newSt = c.active ? 0 : 1;

        const { error } = await supabase.from('clientes').update({
          estado: newSt
        }).eq('id_cliente', id);

        if (error) throw error;
        toast('👤 Estado de cliente actualizado en la nube');

        // Recargar clientes desde Supabase
        const { data } = await supabase.from('clientes').select('*').order('id_cliente', { ascending: true });
        if (data) {
          setClients((data as any[]).map(cl => ({
            id: cl.id_cliente,
            nombre: cl.nombre,
            dni: cl.dni || '',
            telefono: cl.telefono || '',
            email: cl.email || '',
            limiteCred: parseFloat(cl.limite_credito || 0),
            saldoCred: parseFloat(cl.saldo_credito || 0),
            historialPagos: cl.historial_pagos ? (typeof cl.historial_pagos === 'string' ? JSON.parse(cl.historial_pagos) : cl.historial_pagos) : [],
            active: cl.estado === 1
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      const updated = clients.map(c => c.id === id ? { ...c, active: !c.active } : c);
      setClients(updated);
      saveOffline('snack_clients', updated);
      toast('👤 Estado de cliente actualizado');
    }
  };

  const payCreditBalance = async (clientId: number | string, monto: number, concepto: string, metodoPago?: string) => {
    const metodoFinal = metodoPago || 'Efectivo';
    const abono: CreditPayment = {
      id: Date.now(),
      fecha: new Date().toLocaleDateString(),
      concepto: `${concepto} (${metodoFinal})`,
      monto,
      tipo: 'abono',
      metodoPago: metodoFinal
    };

    const targetClient = clients.find(c => c.id === clientId);
    if (!targetClient) return;

    const newSaldo = Math.max(0, targetClient.saldoCred - monto);
    const newHistorial = [...targetClient.historialPagos, abono];

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('clientes').update({
          saldo_credito: newSaldo,
          historial_pagos: newHistorial
        }).eq('id_cliente', clientId);
        if (error) throw error;
      } catch (err: any) {
        toast(`❌ Error en Supabase al registrar abono: ${err.message}`);
      }
    }

    const updated = clients.map(c => {
      if (c.id === clientId) {
        return { ...c, saldoCred: newSaldo, historialPagos: newHistorial };
      }
      return c;
    });
    setClients(updated);
    saveOffline('snack_clients', updated);

    // Enrutar según método de pago a la caja activa
    if (cashSession) {
      const isEfectivo = metodoFinal.toLowerCase().includes('efectivo');
      const updatedSession: CashSession = {
        ...cashSession,
        tot_ventas_efectivo: cashSession.tot_ventas_efectivo + (isEfectivo ? monto : 0),
        tot_ventas_otros: cashSession.tot_ventas_otros + (!isEfectivo ? monto : 0)
      };
      setCashSession(updatedSession);
      saveOffline('snack_session', updatedSession);
    }
    toast(`✅ Abono de S/. ${monto.toFixed(2)} vía ${metodoFinal} registrado en caja.`);
  };

  // --- CONVERSIÓN DE PAN A INSUMO (pan duro → budín, pastel, etc.) ---
  const logBreadConversion = (prodId: number, qty: number, destino: string, costoEstimado?: number, version: string | null = null) => {
    // 1. Descontar stock del producto origen (pan)
    const updated = products.map(p => {
      if (p.id === prodId) {
        if (version) {
          const newVers = p.versions.map(v =>
            v.name === version ? { ...v, stock: Math.max(0, v.stock - qty) } : v
          );
          return { ...p, versions: newVers };
        } else {
          return { ...p, stock: Math.max(0, p.stock - qty) };
        }
      }
      return p;
    });
    setProducts(updated);
    saveOffline('snack_products', updated);

    // 2. Registrar movimiento tipo 'conversion' en el Kardex
    const prodNombre = (products.find(x => x.id === prodId)?.name || 'Producto') + (version ? ` (${version})` : '');
    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      prodName: prodNombre,
      type: 'conversion',
      qty,
      reason: `Convertido en insumo para: ${destino}`,
      cajero: user?.n || 'Sistema',
      destino,
      costoEstimado
    };
    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);
    toast(`♻️ ${qty} und. de ${prodNombre} convertidos en insumo para ${destino}.`);
  };

  const saveRole = async (roleObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: existing } = await supabase.from('roles').select('id_rol').eq('nombre', roleObj.name).maybeSingle();
        if (existing) {
          const { error } = await supabase.from('roles').update({
            descripcion: roleObj.desc,
            permisos: roleObj.permissions
          }).eq('id_rol', existing.id_rol);
          if (error) throw error;
          toast('🔑 Rol actualizado en la nube');
        } else {
          const { error } = await supabase.from('roles').insert({
            nombre: roleObj.name,
            descripcion: roleObj.desc,
            permisos: roleObj.permissions,
            estado: 1
          });
          if (error) throw error;
          toast('🔑 Rol registrado en la nube');
        }

        // Recargar roles desde Supabase
        const { data } = await supabase.from('roles').select('*').order('id_rol', { ascending: true });
        if (data) {
          setRolesList((data as any[]).map(r => ({
            id: r.nombre,
            name: r.nombre,
            desc: r.descripcion || '',
            permissions: Array.isArray(r.permisos) ? r.permisos : (typeof r.permisos === 'string' ? JSON.parse(r.permisos) : [])
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase al guardar rol: ${err.message}`);
      }
    } else {
      let updated;
      const exists = rolesList.some(r => r.id === roleObj.id || r.name === roleObj.name);
      if (exists) {
        updated = rolesList.map(r => (r.id === roleObj.id || r.name === roleObj.name) ? { ...r, ...roleObj } : r);
        toast('🔑 Rol actualizado');
      } else {
        const newRole = { ...roleObj, id: roleObj.id || roleObj.name.replace(/\s+/g, '') };
        updated = [...rolesList, newRole];
        toast('🔑 Rol registrado');
      }
      setRolesList(updated);
      saveOffline('snack_custom_roles_v1', updated);
    }
  };

  const deleteRole = async (id: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('roles').delete().eq('nombre', id);
        if (error) throw error;
        toast('🔑 Rol eliminado de la nube');

        // Recargar roles desde Supabase
        const { data } = await supabase.from('roles').select('*').order('id_rol', { ascending: true });
        if (data) {
          setRolesList((data as any[]).map(r => ({
            id: r.nombre,
            name: r.nombre,
            desc: r.descripcion || '',
            permissions: Array.isArray(r.permisos) ? r.permisos : (typeof r.permisos === 'string' ? JSON.parse(r.permisos) : [])
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase al eliminar rol: ${err.message}`);
      }
    } else {
      const updated = rolesList.filter(r => r.id !== id);
      setRolesList(updated);
      saveOffline('snack_custom_roles_v1', updated);
      toast('🔑 Rol eliminado');
    }
  };

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
      toastMsg,
      toast,
      login,
      logout,
      sendRecoveryEmail,
      resetPasswordOffline,
      addToCart,
      updateCartQty,
      clearCart,
      checkoutCart,
      saveUser,
      toggleUserStatus,
      lookupProfileByDni,
      saveProvider,
      toggleProvider,
      savePaymentMethod,
      togglePaymentMethod,
      registerPurchase,
      openCashSession,
      closeCashSession,
      registerCashDrop,
      saveProduct,
      deleteProduct,
      logBreadProduction,
      logBreadDiscard,
      logBreadConversion,
      saveClient,
      toggleClient,
      payCreditBalance,
      rolesList,
      saveRole,
      deleteRole
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
