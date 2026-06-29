import { Insumo } from '@/context/types';
import { num } from './utils';

export function mapInsumoFromDb(row: Record<string, unknown>): Insumo {
  return {
    id: row.id_insumo as number,
    nombre: String(row.nombre ?? ''),
    stock: num(row.num_stock),
    costoUnitario: num(row.costo_unitario),
    unidadMedida: String(row.unidad_medida || 'kg'),
    stockMinimo: num(row.stock_minimo),
    active: row.estado === 1,
    lotes: Array.isArray(row.lotes) ? row.lotes as Insumo['lotes'] : [],
  };
}

export function mapInsumosFromDb(rows: Record<string, unknown>[] | null | undefined): Insumo[] {
  if (!rows) return [];
  return rows.map(mapInsumoFromDb);
}