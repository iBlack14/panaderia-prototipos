import { Sale } from '@/context/types';
import { num } from './utils';

export function mapSaleFromDb(row: Record<string, unknown>): Sale {
  const detalle = Array.isArray(row.detalle_venta) ? row.detalle_venta as Record<string, unknown>[] : [];
  const metodos = row.metodos_pago as Record<string, unknown> | null | undefined;
  const profiles = row.profiles as Record<string, unknown> | null | undefined;
  const fecVenta = row.fec_venta ? new Date(String(row.fec_venta)) : new Date();

  return {
    id: row.id_venta as number,
    n: row.id_venta as number,
    items: detalle.map((d) => {
      const productos = d.productos as Record<string, unknown> | null | undefined;
      const version = d.producto_versiones as Record<string, unknown> | null | undefined;
      const versionName = version?.nombre_version ? String(version.nombre_version) : null;
      const baseName = productos?.nombre ? String(productos.nombre) : '';
      return {
        id: d.id_producto as number,
        name: baseName + (versionName ? ` (${versionName})` : ''),
        price: num(d.precio_unitario),
        qty: num(d.num_cantidad),
        version: versionName,
      };
    }),
    total: num(row.tot_pago),
    method: metodos?.tipo_pago ? String(metodos.tipo_pago) : 'Efectivo',
    methodId: row.id_metodo_pago as number | undefined,
    d: fecVenta.toLocaleDateString(),
    t: fecVenta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cajero: profiles
      ? `${profiles.nombre ?? ''} ${profiles.apellido_paterno ?? ''}`.trim() || 'Sistema'
      : 'Sistema',
    clienteId: row.id_cliente != null ? (row.id_cliente as number) : undefined,
    estado: row.estado as number | undefined,
  };
}

export function mapSalesFromDb(rows: Record<string, unknown>[] | null | undefined): Sale[] {
  if (!rows) return [];
  return rows.map(mapSaleFromDb);
}