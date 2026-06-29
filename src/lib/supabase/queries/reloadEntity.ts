import { SupabaseClient } from '@supabase/supabase-js';
import {
  mapCategoriesFromDb,
  mapPaymentMethodsFromDb,
  mapProfilesFromDb,
  mapProvidersFromDb,
  mapRolesFromDb,
} from '../mappers/catalog.mapper';
import { mapCashHistoryListFromDb, mapCashSessionFromDb } from '../mappers/cash.mapper';
import { mapClientsFromDb } from '../mappers/client.mapper';
import { mapInsumosFromDb } from '../mappers/insumo.mapper';
import { mapPedidosFromDb } from '../mappers/pedido.mapper';
import { mapProductsFromDb } from '../mappers/product.mapper';
import { mapPurchasesFromDb } from '../mappers/purchase.mapper';
import { mapRecetasFromDb } from '../mappers/receta.mapper';
import { mapSalesFromDb } from '../mappers/sale.mapper';

const PRODUCTS_SELECT = '*, producto_versiones(*), categorias(nombre)';
const SALES_SELECT =
  '*, detalle_venta(*, productos(nombre), producto_versiones(nombre_version)), metodos_pago(tipo_pago), profiles(nombre, apellido_paterno)';
const PURCHASES_SELECT =
  '*, detalle_compra(*, productos(nombre), producto_versiones(nombre_version), insumos(nombre)), proveedores(nombre_empresa)';
const RECETAS_SELECT =
  '*, detalle_receta(*, insumos(nombre, unidad_medida)), productos(nombre)';

export async function fetchProducts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('productos')
    .select(PRODUCTS_SELECT)
    .eq('estado', 1);
  if (error) throw error;
  return mapProductsFromDb(data as Record<string, unknown>[]);
}

export async function fetchSales(supabase: SupabaseClient, limit = 500) {
  const { data, error } = await supabase
    .from('ventas')
    .select(SALES_SELECT)
    .order('fec_venta', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return mapSalesFromDb(data as Record<string, unknown>[]);
}

export async function fetchPurchases(supabase: SupabaseClient, limit = 200) {
  const { data, error } = await supabase
    .from('compras')
    .select(PURCHASES_SELECT)
    .eq('estado', 1)
    .order('fec_compra', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return mapPurchasesFromDb(data as Record<string, unknown>[]);
}

export async function fetchClients(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('id_cliente', { ascending: true });
  if (error) throw error;
  return mapClientsFromDb(data as Record<string, unknown>[]);
}

export async function fetchInsumos(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('insumos')
    .select('*')
    .order('id_insumo', { ascending: true });
  if (error) throw error;
  return mapInsumosFromDb(data as Record<string, unknown>[]);
}

export async function fetchOpenCashSession(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('*')
    .eq('estado', 'abierto')
    .limit(1);
  if (error) throw error;
  if (!data?.length) return null;
  return mapCashSessionFromDb(data[0] as Record<string, unknown>);
}

export async function fetchCashSessionById(supabase: SupabaseClient, sessionId: number | string) {
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('*')
    .eq('id_cierre_caja', sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data.estado === 'abierto'
    ? mapCashSessionFromDb(data as Record<string, unknown>)
    : null;
}

export async function fetchCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('categorias').select('*').order('id_categoria', { ascending: true });
  if (error) throw error;
  return mapCategoriesFromDb(data as Record<string, unknown>[]);
}

export async function fetchRoles(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('roles').select('*').order('id_rol', { ascending: true });
  if (error) throw error;
  return mapRolesFromDb(data as Record<string, unknown>[]);
}

export async function fetchPaymentMethods(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('metodos_pago').select('*');
  if (error) throw error;
  return mapPaymentMethodsFromDb(data as Record<string, unknown>[]);
}

export async function fetchProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('profiles').select('*, roles(nombre)');
  if (error) throw error;
  return mapProfilesFromDb(data as Record<string, unknown>[]);
}

export async function fetchProviders(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('proveedores').select('*');
  if (error) throw error;
  return mapProvidersFromDb(data as Record<string, unknown>[]);
}

export async function fetchCashHistory(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('*')
    .eq('estado', 'cerrado')
    .order('fec_cierre', { ascending: false });
  if (error) throw error;
  return mapCashHistoryListFromDb(data as Record<string, unknown>[]);
}

export async function fetchPedidos(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('pedidos_reserva')
    .select('*, clientes(nombre)')
    .order('fec_entrega', { ascending: true });
  if (error) throw error;
  return mapPedidosFromDb(data as Record<string, unknown>[]);
}

export async function fetchRecetas(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('recetas')
    .select(RECETAS_SELECT)
    .order('id_receta', { ascending: true });
  if (error) throw error;
  return mapRecetasFromDb(data as Record<string, unknown>[]);
}

/** Refetch entidades afectadas tras una venta (stock lo mueven los triggers SQL). */
export async function refetchAfterSale(
  supabase: SupabaseClient,
  sessionId?: number | string,
  includeClient = false
) {
  const [products, sales, cashSession, clients] = await Promise.all([
    fetchProducts(supabase),
    fetchSales(supabase),
    sessionId != null ? fetchCashSessionById(supabase, sessionId) : fetchOpenCashSession(supabase),
    includeClient ? fetchClients(supabase) : Promise.resolve(null),
  ]);
  return { products, sales, cashSession, clients };
}

/** Refetch entidades afectadas tras una compra (stock lo mueven los triggers SQL). */
export async function refetchAfterPurchase(supabase: SupabaseClient) {
  const [products, insumos, purchases] = await Promise.all([
    fetchProducts(supabase),
    fetchInsumos(supabase),
    fetchPurchases(supabase),
  ]);
  return { products, insumos, purchases };
}

/** Refetch tras producción/descarte (triggers SQL actualizan stock). */
export async function refetchAfterProduction(supabase: SupabaseClient) {
  const [products, insumos] = await Promise.all([
    fetchProducts(supabase),
    fetchInsumos(supabase),
  ]);
  return { products, insumos };
}