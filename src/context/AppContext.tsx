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
  toastMsg: string;
  toast: (msg: string) => void;
  login: (uIn: string, pIn: string) => Promise<{ success: boolean; user?: User; message?: string }>;
  logout: () => void;
  sendRecoveryEmail: (emailIn: string) => Promise<{ success: boolean; online?: boolean; userId?: number | string; message?: string }>;
  resetPasswordOffline: (userId: number | string, newPass: string) => void;
  addToCart: (productName: string, price: number, em: any, id: number, versionObj?: ProductVersion | null) => void;
  updateCartQty: (id: number, delta: number, version?: string | null) => void;
  clearCart: () => void;
  checkoutCart: (paymentMethodId: number, clienteId?: number | string) => Promise<Sale | undefined>;
  saveUser: (uObj: any) => void;
  toggleUserStatus: (userId: number | string) => Promise<void>;
  lookupProfileByDni: (dni: string) => Promise<{ firstName: string; lastName: string; email?: string; phone?: string } | null>;
  saveProvider: (pObj: any) => Promise<void>;
  toggleProvider: (id: number | string) => void;
  savePaymentMethod: (mObj: any) => void;
  togglePaymentMethod: (id: number) => void;
  registerPurchase: (pObj: { providerId: number | string; items: PurchaseItem[] }) => Promise<void>;
  openCashSession: (initialAmount: string | number, shift: string) => Promise<void>;
  closeCashSession: (countedAmount: string | number, observaciones: string, denominaciones?: DenominacionArqueo) => Promise<void>;
  registerCashDrop: (monto: number, motivo: string) => void;
  saveProduct: (pObj: any) => void;
  deleteProduct: (id: number) => void;
  logBreadProduction: (prodId: number, qty: number, version?: string | null) => void;
  logBreadDiscard: (prodId: number, qty: number, reason: string, version?: string | null) => void;
  saveClient: (cObj: any) => void;
  toggleClient: (id: number | string) => void;
  payCreditBalance: (clientId: number | string, monto: number, concepto: string, metodoPago?: string) => void;
  logBreadConversion: (prodId: number, qty: number, destino: string, costoEstimado?: number, version?: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- SEED DATA FALLBACKS ---
const DEFAULT_PRODUCTS: Product[] = [];

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

    async function loadData() {
      setLoading(true);
      if (isSupabaseConfigured && supabase) {
        try {
          // --- CARGAR DESDE SUPABASE ---
          console.log('⚡ Cargando datos desde Supabase...');
          
          // 1. Productos
          const { data: prods } = await supabase.from('productos').select('*, producto_versiones(*)').eq('estado', 1);
          if (prods) {
            setProducts((prods as any[]).map(p => ({
              id: p.id_producto,
              name: p.nombre,
              cat: p.id_categoria === 1 ? 'Panes' : p.id_categoria === 2 ? 'Tortas' : p.id_categoria === 3 ? 'Dulces' : 'Bebidas',
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

          // 2. Proveedores
          const { data: provs } = await supabase.from('proveedores').select('*');
          if (provs) {
            setProviders((provs as any[]).map(pr => ({
              id: pr.id_proveedor,
              ruc: pr.ruc,
              name: pr.nombre_empresa,
              phone: pr.num_telefono,
              address: pr.direccion,
              active: pr.estado === 1
            })));
          }

          // 3. Métodos de Pago
          const { data: paym } = await supabase.from('metodos_pago').select('*');
          if (paym) {
            setPaymentMethods((paym as any[]).map(pm => ({
              id: pm.id_metodo_pago,
              name: pm.tipo_pago,
              desc: 'Método configurado en la nube',
              active: pm.estado === 1
            })));
          }

          // 4. Sesión de Caja Activa
          const { data: ses } = await supabase.from('cierres_caja').select('*').eq('estado', 'abierto').limit(1);
          if (ses && ses.length > 0) {
            setCashSession({
              id: ses[0].id_cierre_caja,
              fec_apertura: new Date(ses[0].fec_apertura),
              tot_saldo_inicial: parseFloat(ses[0].tot_saldo_inicial),
              tot_ventas_efectivo: parseFloat(ses[0].tot_ventas_efectivo),
              tot_ventas_otros: parseFloat(ses[0].tot_ventas_otros),
              tot_retiros: parseFloat(ses[0].tot_retiros || 0),
              estado: 'abierto'
            });
          }

          // 5. Historial de Cajas
          const { data: cashHist } = await supabase.from('cierres_caja').select('*').eq('estado', 'cerrado').order('fec_cierre', { ascending: false });
          if (cashHist) {
            setCashHistory((cashHist as any[]).map(h => ({
              id: h.id_cierre_caja,
              fec_apertura: new Date(h.fec_apertura).toLocaleDateString(),
              fec_cierre: new Date(h.fec_cierre).toLocaleDateString(),
              monto_inicial: parseFloat(h.tot_saldo_inicial),
              monto_final: parseFloat(h.tot_saldo_final),
              ventas_efectivo: parseFloat(h.tot_ventas_efectivo),
              ventas_otros: parseFloat(h.tot_ventas_otros),
              estado: 'cerrado'
            })));
          }

          // 6. Colaboradores / Perfiles de Usuario
          const { data: profs } = await supabase.from('profiles').select('*, roles(nombre)');
          if (profs) {
            setUsersList((profs as any[]).map(p => ({
              id: p.id,
              u: p.username,
              p: '••••', // Contraseña oculta en la nube
              n: p.nombre + ' ' + (p.apellido_paterno || ''),
              rs: [p.roles?.nombre || 'Cajero'],
              st: p.estado,
              email: p.correo,
              phone: p.num_telefono || ''
            })));
          }
          
        } catch (err) {
          console.error('Error cargando datos de Supabase', err);
        }
      } else {
        // --- CARGAR DESDE LOCALSTORAGE (MODO OFFLINE) ---
        console.log('🔌 Modo Offline: Cargando desde LocalStorage...');
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

        setProducts(localProds ? JSON.parse(localProds) : DEFAULT_PRODUCTS);
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
      }
      setLoading(false);
    }
    loadData();
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
            email: prof.correo,
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
        toast(`✨ ¡Bienvenido, ${found.n.split(' ')[0]}!`);
        return { success: true, user: found };
      } else {
        toast('❌ Credenciales inválidas o usuario inactivo');
        return { success: false, message: 'Credenciales inválidas' };
      }
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setCart([]);
    toast('↩ Sesión cerrada');
  };

  // --- PASSWORD RECOVERY ---
  const sendRecoveryEmail = async (emailIn: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(emailIn, {
        redirectTo: `${window.location.origin}/recovery`,
      });
      if (error) {
        toast(`❌ Error: ${error.message}`);
        return { success: false, message: error.message };
      }
      toast('📧 Enlace de recuperación enviado al correo.');
      return { success: true, online: true };
    } else {
      const found = usersList.find(x => x.email === emailIn);
      if (found) {
        toast('🔓 Datos verificados. Configura tu nueva contraseña.');
        return { success: true, userId: found.id, online: false };
      }
      toast('❌ Correo electrónico no encontrado.');
      return { success: false };
    }
  };

  const resetPasswordOffline = (userId: number | string, newPass: string) => {
    const updated = usersList.map(u => {
      if (u.id === userId) {
        return { ...u, p: newPass };
      }
      return u;
    });
    setUsersList(updated);
    saveOffline('snack_users', updated);
    toast('🔒 Contraseña restablecida con éxito.');
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
      const updClients = clients.map(c => c.id === clienteId ? { ...c, saldoCred: c.saldoCred + tot, historialPagos: [...c.historialPagos, nuevoPago] } : c);
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
          id_cliente: 1,
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
          // Obtener ID del rol correspondiente
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
          toast('⚠️ Los nuevos colaboradores se registran en la nube al iniciar sesión por primera vez.');
        }

        // Recargar lista desde Supabase
        const { data: profs } = await supabase.from('profiles').select('*, roles(nombre)');
        if (profs) {
          setUsersList((profs as any[]).map(p => ({
            id: p.id,
            u: p.username,
            p: '••••',
            n: p.nombre + ' ' + (p.apellido_paterno || ''),
            rs: [p.roles?.nombre || 'Cajero'],
            st: p.estado,
            email: p.correo,
            phone: p.num_telefono || ''
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en la nube: ${err.message}`);
      }
    } else {
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
    const newStatus = currentUser?.st === 'act' ? 'inact' : 'act';
    const updated = usersList.map(u => u.id === userId ? { ...u, st: newStatus } : u);

    setUsersList(updated);
    saveOffline('snack_users', updated);

    if (isSupabaseConfigured && supabase && currentUser) {
      try {
        await supabase.from('profiles').update({ estado: newStatus === 'act' ? 1 : 0 }).eq('id', userId);
        toast('👤 Estado de colaborador actualizado en la nube');
      } catch (err: any) {
        toast(`❌ Error actualizando estado en la nube: ${err.message}`);
      }
    } else {
      toast('👤 Estado de colaborador actualizado');
    }
  };

  const lookupProfileByDni = async (dni: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_PROFILE_LOOKUP_URL?.trim() || '';
    if (!baseUrl) {
      throw new Error('No se ha configurado la URL de búsqueda de perfiles por DNI. Use NEXT_PUBLIC_PROFILE_LOOKUP_URL.');
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

  const toggleProvider = (id: number | string) => {
    const updated = providers.map(p => p.id === id ? { ...p, active: !p.active } : p);
    setProviders(updated);
    saveOffline('snack_providers', updated);
    toast('🏭 Estado de proveedor actualizado');
  };

  // --- CRUD METODOS DE PAGO ---
  const savePaymentMethod = (mObj: any) => {
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
  };

  const togglePaymentMethod = (id: number) => {
    const updated = paymentMethods.map(m => m.id === id ? { ...m, active: !m.active } : m);
    setPaymentMethods(updated);
    saveOffline('snack_methods', updated);
    toast('💳 Estado del método de pago actualizado');
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

  // --- CONTROL DE PANES (PRODUCCION Y DESCARTE) ---
  const saveProduct = (pObj: any) => {
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
  };

  const deleteProduct = (id: number) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    saveOffline('snack_products', updated);
    toast('🗑 Producto eliminado');
  };

  const logBreadProduction = (prodId: number, qty: number, version: string | null = null) => {
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

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      prodName: (products.find(x => x.id === prodId)?.name || 'Producto') + (version ? ` (${version})` : ''),
      type: 'produccion',
      qty,
      reason: 'Ingreso inicial de producción diaria'
    };

    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);
    toast('➕ Producción de panes registrada');
  };

  const logBreadDiscard = (prodId: number, qty: number, reason: string, version: string | null = null) => {
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

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      prodName: (products.find(x => x.id === prodId)?.name || 'Producto') + (version ? ` (${version})` : ''),
      type: 'descarte',
      qty,
      reason
    };

    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);
    toast('⚠️ Reporte de descarte registrado');
  };

  // --- RETIRO PARCIAL DE CAJA (CASH DROP) ---
  const registerCashDrop = (monto: number, motivo: string) => {
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
    toast(`💸 Retiro de S/. ${monto.toFixed(2)} registrado y descontado de caja.`);
  };

  // --- CRUD CLIENTES FRECUENTES ---
  const saveClient = (cObj: any) => {
    let updated;
    if (cObj.id && clients.find(c => c.id === cObj.id)) {
      updated = clients.map(c => c.id === cObj.id ? { ...c, ...cObj } : c);
      toast('👤 Cliente actualizado');
    } else {
      const newClient: Client = {
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
  };

  const toggleClient = (id: number | string) => {
    const updated = clients.map(c => c.id === id ? { ...c, active: !c.active } : c);
    setClients(updated);
    saveOffline('snack_clients', updated);
    toast('👤 Estado de cliente actualizado');
  };

  const payCreditBalance = (clientId: number | string, monto: number, concepto: string, metodoPago?: string) => {
    const metodoFinal = metodoPago || 'Efectivo';
    const abono: CreditPayment = {
      id: Date.now(),
      fecha: new Date().toLocaleDateString(),
      concepto: `${concepto} (${metodoFinal})`,
      monto,
      tipo: 'abono',
      metodoPago: metodoFinal
    };
    const updated = clients.map(c => {
      if (c.id === clientId) {
        const newSaldo = Math.max(0, c.saldoCred - monto);
        return { ...c, saldoCred: newSaldo, historialPagos: [...c.historialPagos, abono] };
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

  return (
    <AppContext.Provider value={{
      user,
      role,
      loading,
      products,
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
      payCreditBalance
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
