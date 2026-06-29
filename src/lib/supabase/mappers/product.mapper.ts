import { Product, ProductVersion } from '@/context/types';
import { num } from './utils';

export function mapProductVersionFromDb(row: Record<string, unknown>): ProductVersion {
  return {
    id: row.id_version as number,
    name: String(row.nombre_version ?? ''),
    price: num(row.precio_unitario),
    stock: num(row.num_stock),
    parent_version_id: (row.parent_version_id as number | null) ?? null,
    fraction_ratio: row.fraction_ratio != null ? num(row.fraction_ratio, 1) : 1,
  };
}

export function mapProductFromDb(row: Record<string, unknown>): Product {
  const versions = Array.isArray(row.producto_versiones)
    ? (row.producto_versiones as Record<string, unknown>[]).map(mapProductVersionFromDb)
    : [];

  const categorias = row.categorias as Record<string, unknown> | null | undefined;

  return {
    id: row.id_producto as number,
    name: String(row.nombre ?? ''),
    cat: categorias?.nombre ? String(categorias.nombre) : 'Sin categoria',
    price: num(row.precio_unitario),
    stock: num(row.num_stock),
    unidad_medida: String(row.unidad_medida || 'unidades'),
    versions,
  };
}

export function mapProductsFromDb(rows: Record<string, unknown>[] | null | undefined): Product[] {
  if (!rows) return [];
  return rows.map(mapProductFromDb);
}