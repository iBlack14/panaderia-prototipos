import { Receta } from '@/context/types';
import { num } from './utils';

export function mapRecetaFromDb(row: Record<string, unknown>): Receta {
  const productos = row.productos as Record<string, unknown> | null | undefined;
  const detalle = Array.isArray(row.detalle_receta) ? row.detalle_receta as Record<string, unknown>[] : [];

  return {
    id: row.id_receta as number,
    productoId: row.id_producto as number,
    productoNombre: productos?.nombre ? String(productos.nombre) : `Producto #${row.id_producto}`,
    rendimientoBase: num(row.rendimiento_base, 1),
    instrucciones: row.instrucciones ? String(row.instrucciones) : '',
    ingredientes: detalle.map((d) => {
      const insumos = d.insumos as Record<string, unknown> | null | undefined;
      return {
        id: d.id_detalle as number,
        insumoId: d.id_insumo as number,
        insumoNombre: insumos?.nombre ? String(insumos.nombre) : `Insumo #${d.id_insumo}`,
        cantidadRequerida: num(d.cantidad_requerida),
        unidadMedida: insumos?.unidad_medida ? String(insumos.unidad_medida) : 'kg',
      };
    }),
    margenDeseado: num(row.margen_deseado, 30),
  };
}

export function mapRecetasFromDb(rows: Record<string, unknown>[] | null | undefined): Receta[] {
  if (!rows) return [];
  return rows.map(mapRecetaFromDb);
}