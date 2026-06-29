import { Purchase, PurchaseItem } from '@/context/types';
import { num } from './utils';

export function mapPurchaseFromDb(row: Record<string, unknown>): Purchase {
  const detalle = Array.isArray(row.detalle_compra) ? row.detalle_compra as Record<string, unknown>[] : [];
  const proveedores = row.proveedores as Record<string, unknown> | null | undefined;
  const fecCompra = row.fec_compra ? new Date(String(row.fec_compra)) : new Date();

  const items: PurchaseItem[] = detalle.map((d) => {
    if (d.id_insumo != null) {
      return {
        type: 'insumo' as const,
        insumoId: d.id_insumo as number,
        qty: num(d.num_cantidad),
        cost: num(d.precio_compra),
        version: null,
      };
    }
    const productos = d.productos as Record<string, unknown> | null | undefined;
    const version = d.producto_versiones as Record<string, unknown> | null | undefined;
    return {
      type: 'producto' as const,
      productId: d.id_producto as number,
      qty: num(d.num_cantidad),
      cost: num(d.precio_compra),
      version: version?.nombre_version ? String(version.nombre_version) : null,
    };
  });

  return {
    id: `COM-${row.id_compra}`,
    d: fecCompra.toLocaleDateString(),
    prov: proveedores?.nombre_empresa ? String(proveedores.nombre_empresa) : 'Proveedor',
    subTotal: `S/. ${num(row.sub_total).toFixed(2)}`,
    igv: `S/. ${num(row.igv).toFixed(2)}`,
    total: `S/. ${num(row.tot_pago).toFixed(2)}`,
    items,
  };
}

export function mapPurchasesFromDb(rows: Record<string, unknown>[] | null | undefined): Purchase[] {
  if (!rows) return [];
  return rows.map(mapPurchaseFromDb);
}