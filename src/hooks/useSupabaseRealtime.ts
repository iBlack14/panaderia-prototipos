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
import { isRealtimeEnabled } from '@/lib/supabase';
import { loadAllFromSupabase } from '@/lib/supabase/queries/loadAll';
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

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'polling';

const DEBOUNCE_MS = 600;
const POLL_INTERVAL_MS = 30_000;
const REALTIME_FAIL_GRACE_MS = 12_000;

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

function disconnectRealtime(supabase: SupabaseClient) {
  try {
    supabase.realtime.disconnect();
  } catch {
    // ignore — evita reintentos de WebSocket cuando Realtime no está disponible
  }
}

export function useSupabaseRealtime({
  supabase,
  enabled,
  cashSessionId,
  setters,
  setCashSession,
}: UseSupabaseRealtimeOptions) {
  const isActive = enabled && !!supabase;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isActive ? 'syncing' : 'offline');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const cashSessionIdRef = useRef(cashSessionId);
  const settersRef = useRef(setters);
  const setCashSessionRef = useRef(setCashSession);
  const debounceTimers = useRef<Partial<Record<RefetchGroup, ReturnType<typeof setTimeout>>>>({});
  const syncInFlight = useRef(0);
  const hasErrorRef = useRef(false);
  const usePollingRef = useRef(!isRealtimeEnabled);
  const realtimeWarnedRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeFailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cashSessionIdRef.current = cashSessionId;
  }, [cashSessionId]);

  useEffect(() => {
    settersRef.current = setters;
    setCashSessionRef.current = setCashSession;
  }, [setters, setCashSession]);

  useEffect(() => {
    if (!isActive || !supabase) return;

    const applyLoadedData = (data: Awaited<ReturnType<typeof loadAllFromSupabase>>) => {
      const s = settersRef.current;
      s.setProducts(data.products);
      s.setCategories(data.categories);
      s.setRolesList(data.rolesList);
      s.setPaymentMethods(data.paymentMethods);
      s.setUsersList(data.usersList);
      s.setClients(data.clients);
      s.setProviders(data.providers);
      setCashSessionRef.current(prev => {
        if (!data.cashSession) return null;
        return prev
          ? { ...data.cashSession, cajero: prev.cajero, turno: prev.turno }
          : data.cashSession;
      });
      s.setCashHistory(data.cashHistory);
      s.setCashDrops(data.cashDrops);
      s.setBreadLogs(data.breadLogs);
      s.setSales(data.sales);
      s.setPurchases(data.purchases);
      s.setPedidos(data.pedidos);
      s.setInsumos(data.insumos);
      s.setRecetas(data.recetas);
    };

    const runGroupRefetch = async (group: RefetchGroup) => {
      syncInFlight.current += 1;
      setSyncStatus(usePollingRef.current ? 'polling' : 'syncing');
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
          setSyncStatus(usePollingRef.current ? 'polling' : 'synced');
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

    const runFullPoll = async () => {
      syncInFlight.current += 1;
      setSyncStatus('polling');
      try {
        applyLoadedData(await loadAllFromSupabase(supabase));
        hasErrorRef.current = false;
        setLastSyncedAt(new Date());
      } catch (err) {
        console.error('Polling sync error', err);
        hasErrorRef.current = true;
        setSyncStatus('error');
      } finally {
        syncInFlight.current = Math.max(0, syncInFlight.current - 1);
        if (syncInFlight.current === 0 && !hasErrorRef.current) {
          setSyncStatus('polling');
        }
      }
    };

    const startPolling = (reason: 'disabled' | 'fallback') => {
      if (usePollingRef.current && pollTimerRef.current) return;

      usePollingRef.current = true;
      disconnectRealtime(supabase);

      if (!realtimeWarnedRef.current) {
        realtimeWarnedRef.current = true;
        if (reason === 'disabled') {
          console.info(
            '[Sync] Realtime desactivado (NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED=false). Usando sincronización periódica.'
          );
        } else {
          console.warn(
            '[Sync] WebSocket Realtime no disponible. Cambiando a sincronización periódica cada 30s.'
          );
        }
      }

      void runFullPoll();
      pollTimerRef.current = setInterval(() => {
        void runFullPoll();
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const switchToPolling = (reason: 'disabled' | 'fallback') => {
      if (realtimeFailTimerRef.current) {
        clearTimeout(realtimeFailTimerRef.current);
        realtimeFailTimerRef.current = null;
      }
      startPolling(reason);
    };

    let channel: ReturnType<SupabaseClient['channel']> | null = null;

    if (usePollingRef.current) {
      startPolling('disabled');
    } else {
      channel = supabase.channel('snack-roque-sync');

      for (const table of REALTIME_TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          scheduleRefetch(TABLE_TO_GROUP[table]);
        });
      }

      realtimeFailTimerRef.current = setTimeout(() => {
        if (!usePollingRef.current) {
          void supabase.removeChannel(channel!);
          channel = null;
          switchToPolling('fallback');
        }
      }, REALTIME_FAIL_GRACE_MS);

      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          if (realtimeFailTimerRef.current) {
            clearTimeout(realtimeFailTimerRef.current);
            realtimeFailTimerRef.current = null;
          }
          if (syncInFlight.current === 0 && !hasErrorRef.current) setSyncStatus('synced');
          setLastSyncedAt(prev => prev ?? new Date());
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (channel) void supabase.removeChannel(channel);
          channel = null;
          switchToPolling('fallback');
        } else if (status === 'CLOSED' && !usePollingRef.current) {
          setSyncStatus('offline');
        }
      });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && usePollingRef.current) {
        void runFullPoll();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopPolling();
      if (realtimeFailTimerRef.current) {
        clearTimeout(realtimeFailTimerRef.current);
        realtimeFailTimerRef.current = null;
      }
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      debounceTimers.current = {};
      if (channel) void supabase.removeChannel(channel);
      disconnectRealtime(supabase);
    };
  }, [isActive, supabase]);

  const effectiveStatus: SyncStatus = isActive ? syncStatus : 'offline';

  return { syncStatus: effectiveStatus, lastSyncedAt };
}