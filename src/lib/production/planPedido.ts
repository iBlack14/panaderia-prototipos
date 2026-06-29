import { Insumo, PedidoItem, Receta } from '@/context/types';
import { getFIFOCost } from '@/lib/fifo';

export interface InsumoRequerido {
  insumoId: number;
  insumoNombre: string;
  cantidadNecesaria: number;
  unidad: string;
  stockDisponible: number;
  suficiente: boolean;
  costoLinea: number;
  origen: string[];
}

export interface PlanPedidoResult {
  requerimientos: InsumoRequerido[];
  costoMateriaPrima: number;
  todosDisponibles: boolean;
  sinReceta: string[];
}

export interface CostoProduccionResult {
  costoTotal: number;
  detalles: {
    insumoNombre: string;
    cantidadNecesaria: number;
    unidad: string;
    costoLinea: number;
    stockDisponible: number;
    suficiente: boolean;
  }[];
  todosDisponibles: boolean;
}

export function parsePedidoPayload(productoTexto: string): {
  items: PedidoItem[];
  total: number;
} {
  if (!productoTexto?.startsWith('{')) {
    return { items: [], total: 0 };
  }
  try {
    const parsed = JSON.parse(productoTexto) as {
      items?: PedidoItem[];
      total?: number;
    };
    return {
      items: parsed.items ?? [],
      total: parseFloat(String(parsed.total ?? 0)) || 0,
    };
  } catch {
    return { items: [], total: 0 };
  }
}

export function calcularCostoProduccion(
  recetas: Receta[],
  insumos: Insumo[],
  productoId: number,
  cantidad: number
): CostoProduccionResult | null {
  const receta = recetas.find(r => r.productoId === productoId);
  if (!receta) return null;

  const factor = cantidad / (receta.rendimientoBase || 1);
  let costoTotal = 0;
  const detalles: CostoProduccionResult['detalles'] = [];

  for (const ing of receta.ingredientes) {
    const insumo = insumos.find(i => i.id === ing.insumoId);
    const cantidadNecesaria = ing.cantidadRequerida * factor;
    const costoLinea = insumo ? getFIFOCost(insumo.lotes || [], cantidadNecesaria) : 0;
    costoTotal += costoLinea;
    detalles.push({
      insumoNombre: ing.insumoNombre || insumo?.nombre || `Insumo #${ing.insumoId}`,
      cantidadNecesaria,
      unidad: ing.unidadMedida || insumo?.unidadMedida || 'kg',
      costoLinea,
      stockDisponible: insumo?.stock || 0,
      suficiente: (insumo?.stock || 0) >= cantidadNecesaria,
    });
  }

  return { costoTotal, detalles, todosDisponibles: detalles.every(d => d.suficiente) };
}

export function calcularInsumosParaPedido(
  items: PedidoItem[],
  recetas: Receta[],
  insumos: Insumo[]
): PlanPedidoResult {
  const acumulado = new Map<
    number,
    { cantidad: number; origen: string[] }
  >();
  const sinReceta: string[] = [];

  for (const item of items) {
    if (item.type === 'producto' && item.productId) {
      const receta = recetas.find(r => r.productoId === item.productId);
      if (!receta) {
        sinReceta.push(item.name);
        continue;
      }
      const factor = item.qty / (receta.rendimientoBase || 1);
      const etiqueta = item.name + (item.versionName ? ` (${item.versionName})` : '');
      for (const ing of receta.ingredientes) {
        const prev = acumulado.get(ing.insumoId) ?? { cantidad: 0, origen: [] };
        prev.cantidad += ing.cantidadRequerida * factor;
        if (!prev.origen.includes(etiqueta)) prev.origen.push(etiqueta);
        acumulado.set(ing.insumoId, prev);
      }
    } else if (item.type === 'insumo' && item.insumoId) {
      const prev = acumulado.get(item.insumoId) ?? { cantidad: 0, origen: [] };
      prev.cantidad += item.qty;
      const etiqueta = `Venta directa: ${item.name}`;
      if (!prev.origen.includes(etiqueta)) prev.origen.push(etiqueta);
      acumulado.set(item.insumoId, prev);
    }
  }

  let costoMateriaPrima = 0;
  const requerimientos: InsumoRequerido[] = [];

  for (const [insumoId, { cantidad, origen }] of acumulado) {
    const insumo = insumos.find(i => i.id === insumoId);
    const costoLinea = insumo ? getFIFOCost(insumo.lotes || [], cantidad) : 0;
    costoMateriaPrima += costoLinea;
    requerimientos.push({
      insumoId,
      insumoNombre: insumo?.nombre || `Insumo #${insumoId}`,
      cantidadNecesaria: cantidad,
      unidad: insumo?.unidadMedida || 'kg',
      stockDisponible: insumo?.stock || 0,
      suficiente: (insumo?.stock || 0) >= cantidad,
      costoLinea,
      origen,
    });
  }

  requerimientos.sort((a, b) => a.insumoNombre.localeCompare(b.insumoNombre));

  return {
    requerimientos,
    costoMateriaPrima,
    todosDisponibles: requerimientos.every(r => r.suficiente),
    sinReceta,
  };
}