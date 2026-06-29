import { useEffect, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  BreadLog,
  CashDrop,
  CashHistoryRecord,
  CashSession,
  Client,
  CustomRole,
  Insumo,
  PaymentMethod,
  Pedido,
  Product,
  Provider,
  Purchase,
  Receta,
  Sale,
  User,
} from '@/context/types';
import {
  fetchCashDrops,
  fetchCashHistory,
  fetchCashSessionById,
  fetchCategories,
  fetchClients,
  fetchInsumos,
  fetchOpenCashSession,
  fetchPaymentMethods,
  fetchPedidos,
  fetchProducts,
  fetchProfiles,
  fetchProviders,
  fetchRecetas,
  fetchRoles,
  fetchSales,
  refetchAfterProduction,
  refetchAfterPurchase,
} from '@/lib/supabase/queries/reloadEntity';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

const DEBOUNCE_MS = 600;

const REALTIME_TABLES = [
  'productos',
  'producto_versiones',
  'ventas',
  'compras',
  'cierres_caja',
  'retiros_caja',
  'produccion_descarte',
  'clientes',
  'pedidos_reserva',
  'insumos',
  'recetas',
  'detalle_receta',
  'categorias',
  'proveedores',
  'metodos_pago',
  'profiles',
  'roles',
] as const;

type TableName = (typeof REALTIME_TABLES)[number];

type RefetchGroup =
  | 'products'
  | 'sales'
  | 'purchases'
  | 'cash'
  | 'production'
  | 'clients'
  | 'pedidos'
  | 'insumos'
  | 'recetas'
  | 'catalog';

const TABLE_TO_GROUP: Record<TableName, RefetchGroup> = {
  productos: 'products',
  producto_versiones: 'products',
  ventas: 'sales',
  compras: 'purchases',
  cierres_caja: 'cash',
  retiros_caja: 'cash',
  produccion_descarte: 'production',
  clientes: 'clients',
  pedidos_reserva: 'pedidos',
  insumos: 'insumos',
  recetas: 'recetas',
  detalle_receta: 'recetas',
  categorias: 'catalog',
  proveedores: 'catalog',
  metodos_pago: 'catalog',
  profiles: 'catalog',
  roles: 'catalog',
};

export interface RealtimeSetters {
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
  setRecetas: React.Dispatch<React.SetStateAction<Receta[]>>;
  setPedidos: React.Dispatch<React.SetStateAction<Pedido[]>>;
  setCategories: React.Dispatch<React.SetStateAction<{ id: number; name: string; active: boolean }[]>>;
  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>;
  setPaymentMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
  setUsersList: React.Dispatch<React.SetStateAction<User[]>>;
  setRolesList: React.Dispatch<React.SetStateAction<CustomRole[]>>;
  setCashHistory: React.Dispatch<React.SetStateAction<CashHistoryRecord[]>>;
  setCashDrops: React.Dispatch<React.SetStateAction<CashDrop[]>>;
  setBreadLogs: React.Dispatch<React.SetStateAction<BreadLog[]>>;
}

interface UseSupabaseRealtimeOptions {
  supabase: SupabaseClient | null;
  enabled: boolean;
  cashSessionId?: number | string | null;
  setters: RealtimeSetters;
  setCashSession: React.Dispatch<React.SetStateAction<CashSession | null>>;
}

export function useSupabaseRealtime({
  supabase,
  enabled,
  cashSessionId,
  setters,
  setCashSession,
}: UseSupabaseRealtimeOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(enabled ? 'syncing' : 'offline');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const cashSessionIdRef = useRef(cashSessionId);
  const settersRef = useRef(setters);
  const setCashSessionRef = useRef(setCashSession);
  const debounceTimers = useRef<Partial<Record<RefetchGroup, ReturnType<typeof setTimeout>>>>({});
  const syncInFlight = useRef(0);
  const hasErrorRef = useRef(false);

  useEffect(() => {
    cashSessionIdRef.current = cashSessionId;
  }, [cashSessionId]);

  useEffect(() => {
    settersRef.current = setters;
    setCashSessionRef.current = setCashSession;
  }, [setters, setCashSession]);

  useEffect(() => {
    if (!enabled || !supabase) {
      setSyncStatus('offline');
      return;
    }

    const runGroupRefetch = async (group: RefetchGroup) => {
      syncInFlight.current += 1;
      setSyncStatus('syncing');
      try {
        const s = settersRef.current;
        const sessionId = cashSessionIdRef.current;

        if (group === 'products') {
          s.setProducts(await fetchProducts(supabase));
        } else if (group === 'sales') {
          const [sales, cashSession] = await Promise.all([
            fetchSales(supabase),
            sessionId != null
              ? fetchCashSessionById(supabase, sessionId)
              : fetchOpenCashSession(supabase),
          ]);
          s.setSales(sales);
          if (cashSession) {
            setCashSessionRef.current(prev =>
              prev ? { ...cashSession, cajero: prev.cajero, turno: prev.turno } : cashSession
            );
          }
        } else if (group === 'purchases') {
          const refreshed = await refetchAfterPurchase(supabase);
          s.setProducts(refreshed.products);
          s.setInsumos(refreshed.insumos);
          s.setPurchases(refreshed.purchases);
        } else if (group === 'cash') {
          const [cashSession, cashHistory, cashDrops] = await Promise.all([
            sessionId != null
              ? fetchCashSessionById(supabase, sessionId)
              : fetchOpenCashSession(supabase),
            fetchCashHistory(supabase),
            fetchCashDrops(supabase),
          ]);
          setCashSessionRef.current(prev => {
            if (!cashSession) return null;
            return prev ? { ...cashSession, cajero: prev.cajero, turno: prev.turno } : cashSession;
          });
          s.setCashHistory(cashHistory);
          s.setCashDrops(cashDrops);
        } else if (group === 'production') {
          const refreshed = await refetchAfterProduction(supabase);
          s.setProducts(refreshed.products);
          s.setInsumos(refreshed.insumos);
          s.setBreadLogs(refreshed.breadLogs);
        } else if (group === 'clients') {
          s.setClients(await fetchClients(supabase));
        } else if (group === 'pedidos') {
          s.setPedidos(await fetchPedidos(supabase));
        } else if (group === 'insumos') {
          s.setInsumos(await fetchInsumos(supabase));
        } else if (group === 'recetas') {
          s.setRecetas(await fetchRecetas(supabase));
        } else if (group === 'catalog') {
          const [categories, providers, paymentMethods, usersList, rolesList] = await Promise.all([
            fetchCategories(supabase),
            fetchProviders(supabase),
            fetchPaymentMethods(supabase),
            fetchProfiles(supabase),
            fetchRoles(supabase),
          ]);
          s.setCategories(categories);
          s.setProviders(providers);
          s.setPaymentMethods(paymentMethods);
          s.setUsersList(usersList);
          s.setRolesList(rolesList);
        }

        hasErrorRef.current = false;
        setLastSyncedAt(new Date());
      } catch (err) {
        console.error('Realtime refetch error (' + group + ')', err);
        hasErrorRef.current = true;
        setSyncStatus('error');
      } finally {
        syncInFlight.current = Math.max(0, syncInFlight.current - 1);
        if (syncInFlight.current === 0 && !hasErrorRef.current) {
          setSyncStatus('synced');
        }
      }
    };

    const scheduleRefetch = (group: RefetchGroup) => {
      const existing = debounceTimers.current[group];
      if (existing) clearTimeout(existing);
      debounceTimers.current[group] = setTimeout(() => {
        void runGroupRefetch(group);
      }, DEBOUNCE_MS);
    };

    const channel = supabase.channel('snack-roque-sync');

    for (const table of REALTIME_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        scheduleRefetch(TABLE_TO_GROUP[table]);
      });
    }

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        if (syncInFlight.current === 0 && !hasErrorRef.current) setSyncStatus('synced');
        setLastSyncedAt(prev => prev ?? new Date());
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        hasErrorRef.current = true;
        setSyncStatus('error');
      } else if (status === 'CLOSED') {
        setSyncStatus('offline');
      }
    });

    return () => {
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      debounceTimers.current = {};
      void supabase.removeChannel(channel);
    };
  }, [enabled, supabase]);

  return { syncStatus, lastSyncedAt };
}