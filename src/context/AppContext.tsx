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
  Purchase,
  Insumo,
  Receta,
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
  PurchaseItem,
  Purchase,
  DenominacionArqueo,
  Insumo,
  Receta,
  RecetaIngrediente,
  AppContextType 
} from './types';

// Import custom hooks
import { useAuthOperations } from '@/hooks/useAuthOperations';
import { useInventoryOps } from '@/hooks/useInventoryOps';
import { useCartOperations } from '@/hooks/useCartOperations';
import { useCashOperations } from '@/hooks/useCashOperations';
import { useClientOps } from '@/hooks/useClientOps';
import { useOrderOperations } from '@/hooks/useOrderOperations';
import { useInsumoOps } from '@/hooks/useInsumoOps';
import { useRecetaOps } from '@/hooks/useRecetaOps';
import { loadAllFromSupabase } from '@/lib/supabase/queries/loadAll';

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
  { id: 1, nombre: 'Rosa Quispe Mamani', dni: '43218765', telefono: '987654321', email: '', saldoCred: 0, historialPagos: [], active: true },
  { id: 2, nombre: 'Juan Torres Huanca', dni: '56781234', telefono: '912345678', email: '', saldoCred: 35, historialPagos: [{ id: 1, fecha: '24/05/2026', concepto: 'Compra a crédito — 4 panes y 1 torta', monto: 35, tipo: 'cargo' }], active: true },
  { id: 3, nombre: 'Carmen Flores Díaz', dni: '29876543', telefono: '945612378', email: '', saldoCred: 0, historialPagos: [], active: true }
];

export function AppProvider({ children }: { children: ReactNode }) {
  // --- STATE VARIABLES ---
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string; active: boolean }[]>([]);
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

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);

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
          const data = await loadAllFromSupabase(supabase);
          setProducts(data.products);
          setCategories(data.categories);
          setRolesList(data.rolesList);
          setPaymentMethods(data.paymentMethods);
          setUsersList(data.usersList);
          setClients(data.clients);
          setProviders(data.providers);
          setCashSession(data.cashSession);
          setCashHistory(data.cashHistory);
          setSales(data.sales);
          setPurchases(data.purchases);
          setPedidos(data.pedidos);
          setInsumos(data.insumos);
          setRecetas(data.recetas);
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

        const localCats = localStorage.getItem('snack_categorias');
        setCategories(localCats ? JSON.parse(localCats) : [
          { id: 1, name: 'Panes', active: true },
          { id: 2, name: 'Tortas', active: true },
          { id: 3, name: 'Dulces', active: true },
          { id: 4, name: 'Bebidas', active: true },
          { id: 5, name: 'Insumos', active: true },
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

        const localInsumos = localStorage.getItem('snack_insumos');
        const localRecetas = localStorage.getItem('snack_recetas');
        setInsumos(localInsumos ? JSON.parse(localInsumos) : []);
        setRecetas(localRecetas ? JSON.parse(localRecetas) : []);
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
    categories, setCategories,
    breadLogs, setBreadLogs,
    user,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline,
    insumos,
    setInsumos,
    recetas
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
    purchases, setPurchases,
    sales, setSales,
    products, setProducts,
    clients, setClients,
    providers,
    breadLogs, setBreadLogs,
    cashSession, setCashSession,
    user,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline,
    insumos,
    setInsumos
  });

  const insumoOps = useInsumoOps({
    insumos, setInsumos,
    user,
    toast,
    isSupabaseConfigured,
    supabase,
    saveOffline
  });

  const recetaOps = useRecetaOps({
    recetas, setRecetas,
    products,
    insumos,
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
      insumos,
      recetas,
      toast,
      ...authOps,
      ...inventoryOps,
      ...cartOps,
      ...cashOps,
      ...clientOps,
      ...orderOps,
      ...insumoOps,
      ...recetaOps
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
