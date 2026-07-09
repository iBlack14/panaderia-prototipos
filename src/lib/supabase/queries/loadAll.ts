import { SupabaseClient } from '@supabase/supabase-js';
import {
  mapCategoriesFromDb,
  mapPaymentMethodsFromDb,
  mapProfilesFromDb,
  mapProvidersFromDb,
  mapRolesFromDb,
} from '../mappers/catalog.mapper';
import { mapCashDropsFromDb, mapCashHistoryListFromDb, mapCashSessionFromDb } from '../mappers/cash.mapper';
import { mapBreadLogsFromDb } from '../mappers/kardex.mapper';
import { mapClientsFromDb } from '../mappers/client.mapper';
import { mapInsumosFromDb } from '../mappers/insumo.mapper';
import { mapPedidosFromDb } from '../mappers/pedido.mapper';
import { mapProductsFromDb } from '../mappers/product.mapper';
import { mapPurchasesFromDb } from '../mappers/purchase.mapper';
import { mapRecetasFromDb } from '../mappers/receta.mapper';
import { mapSalesFromDb } from '../mappers/sale.mapper';

export interface LoadedAppData {
  products: ReturnType<typeof mapProductsFromDb>;
  categories: ReturnType<typeof mapCategoriesFromDb>;
  rolesList: ReturnType<typeof mapRolesFromDb>;
  paymentMethods: ReturnType<typeof mapPaymentMethodsFromDb>;
  usersList: ReturnType<typeof mapProfilesFromDb>;
  clients: ReturnType<typeof mapClientsFromDb>;
  providers: ReturnType<typeof mapProvidersFromDb>;
  cashSession: ReturnType<typeof mapCashSessionFromDb> | null;
  cashHistory: ReturnType<typeof mapCashHistoryListFromDb>;
  sales: ReturnType<typeof mapSalesFromDb>;
  purchases: ReturnType<typeof mapPurchasesFromDb>;
  pedidos: ReturnType<typeof mapPedidosFromDb>;
  insumos: ReturnType<typeof mapInsumosFromDb>;
  recetas: ReturnType<typeof mapRecetasFromDb>;
  cashDrops: ReturnType<typeof mapCashDropsFromDb>;
  breadLogs: ReturnType<typeof mapBreadLogsFromDb>;
}

export async function loadAllFromSupabase(supabase: SupabaseClient): Promise<LoadedAppData> {
  const [
    { data: prods },
    { data: cats },
    { data: rls },
    { data: paym },
    { data: profs },
    { data: clis },
    { data: provs },
    { data: sesAbierta },
    { data: cashHist },
    { data: ventas },
    { data: compras },
    { data: peds },
    { data: insumosData },
    { data: recetasData },
    { data: retirosData },
    { data: breadLogsData },
  ] = await Promise.all([
    supabase.from('productos').select('*, producto_versiones(*), categorias(nombre)').eq('estado', 1),
    supabase.from('categorias').select('*').order('id_categoria', { ascending: true }),
    supabase.from('roles').select('*').order('id_rol', { ascending: true }),
    supabase.from('metodos_pago').select('*'),
    supabase.from('profiles').select('*, roles(nombre)'),
    supabase.from('clientes').select('*').order('id_cliente', { ascending: true }),
    supabase.from('proveedores').select('*'),
    supabase.from('cierres_caja').select('*').eq('estado', 'abierto').limit(1),
    // Límites: evita crecer sin tope en memoria (polling cada 30s recarga todo).
    supabase
      .from('cierres_caja')
      .select('*, profiles(nombre, apellido_paterno)')
      .eq('estado', 'cerrado')
      .order('fec_cierre', { ascending: false })
      .limit(100),
    supabase
      .from('ventas')
      .select(
        '*, detalle_venta(*, productos(nombre), producto_versiones(nombre_version)), metodos_pago(tipo_pago), profiles(nombre, apellido_paterno)'
      )
      .order('fec_venta', { ascending: false })
      .limit(500),
    supabase
      .from('compras')
      .select(
        '*, detalle_compra(*, productos(nombre), producto_versiones(nombre_version), insumos(nombre)), proveedores(nombre_empresa)'
      )
      .eq('estado', 1)
      .order('fec_compra', { ascending: false })
      .limit(200),
    supabase
      .from('pedidos_reserva')
      .select('*, clientes(nombre)')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('insumos').select('*').order('id_insumo', { ascending: true }),
    supabase
      .from('recetas')
      .select('*, detalle_receta(*, insumos(nombre, unidad_medida)), productos(nombre)')
      .order('id_receta', { ascending: true }),
    supabase
      .from('retiros_caja')
      .select('*, profiles(nombre, apellido_paterno)')
      .order('fec_retiro', { ascending: false })
      .limit(200),
    supabase
      .from('produccion_descarte')
      .select('*, productos(nombre), producto_versiones(nombre_version), profiles(nombre, apellido_paterno)')
      .order('fec_registro', { ascending: false })
      .limit(500),
  ]);

  return {
    products: mapProductsFromDb(prods as Record<string, unknown>[]),
    categories: mapCategoriesFromDb(cats as Record<string, unknown>[]),
    rolesList: mapRolesFromDb(rls as Record<string, unknown>[]),
    paymentMethods: mapPaymentMethodsFromDb(paym as Record<string, unknown>[]),
    usersList: mapProfilesFromDb(profs as Record<string, unknown>[]),
    clients: mapClientsFromDb(clis as Record<string, unknown>[]),
    providers: mapProvidersFromDb(provs as Record<string, unknown>[]),
    cashSession:
      sesAbierta?.length
        ? mapCashSessionFromDb(sesAbierta[0] as Record<string, unknown>)
        : null,
    cashHistory: mapCashHistoryListFromDb(cashHist as Record<string, unknown>[]),
    sales: mapSalesFromDb(ventas as Record<string, unknown>[]),
    purchases: mapPurchasesFromDb(compras as Record<string, unknown>[]),
    pedidos: mapPedidosFromDb(peds as Record<string, unknown>[]),
    insumos: mapInsumosFromDb(insumosData as Record<string, unknown>[]),
    recetas: mapRecetasFromDb(recetasData as Record<string, unknown>[]),
    cashDrops: mapCashDropsFromDb(retirosData as Record<string, unknown>[]),
    breadLogs: mapBreadLogsFromDb(breadLogsData as Record<string, unknown>[]),
  };
}