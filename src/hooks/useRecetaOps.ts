import React from 'react';
import { Receta, RecetaIngrediente, Product, Insumo, User } from '@/context/types';
import {
  calcularCostoProduccion as calcCostoProduccion,
  calcularInsumosParaPedido as calcInsumosPedido,
} from '@/lib/production/planPedido';
import { PedidoItem } from '@/context/types';

interface RecetaOpsParams {
  recetas: Receta[];
  setRecetas: React.Dispatch<React.SetStateAction<Receta[]>>;
  products: Product[];
  insumos: Insumo[];
  user: User | null;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
}

export function useRecetaOps({
  recetas,
  setRecetas,
  products,
  insumos,
  user,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline
}: RecetaOpsParams) {

  const saveReceta = async (rObj: any) => {
    const ingredientes: RecetaIngrediente[] = rObj.ingredientes || [];

// Validate margenDeseado > 10%
if (rObj.margenDeseado && rObj.margenDeseado <= 10) {
  toast('El margen de ganancia deseado debe ser mayor a 10%.');
  return { success: false, message: 'Margen deseado debe ser mayor a 10%' };
}

    if (isSupabaseConfigured && supabase) {
      try {
        let recetaId: number;

        if (rObj.id) {
          // Update existing receta
          const { error } = await supabase.from('recetas').update({
            id_producto: rObj.productoId,
            rendimiento_base: rObj.rendimientoBase || 1,
            instrucciones: rObj.instrucciones || null,
            margen_deseado: rObj.margenDeseado || 30
          }).eq('id_receta', rObj.id);
          if (error) throw error;
          recetaId = rObj.id;

          // Delete old detail rows and re-insert
          await supabase.from('detalle_receta').delete().eq('id_receta', recetaId);
        } else {
          // Insert new receta
          const { data, error } = await supabase.from('recetas').insert({
            id_producto: rObj.productoId,
            rendimiento_base: rObj.rendimientoBase || 1,
            instrucciones: rObj.instrucciones || null,
            margen_deseado: rObj.margenDeseado || 30
          }).select().single();
          if (error) throw error;
          recetaId = data.id_receta;
        }

        // Insert detail rows
        if (ingredientes.length > 0) {
          const rows = ingredientes.map((ing: RecetaIngrediente) => ({
            id_receta: recetaId,
            id_insumo: ing.insumoId,
            cantidad_requerida: ing.cantidadRequerida,
          }));
          const { error: detError } = await supabase.from('detalle_receta').insert(rows);
          if (detError) throw detError;
        }

        // Rebuild local state
        const prod = products.find(p => p.id === rObj.productoId);
        const fullIngredientes: RecetaIngrediente[] = ingredientes.map(ing => {
          const insumo = insumos.find(i => i.id === ing.insumoId);
          return {
            ...ing,
            insumoNombre: insumo?.nombre || `Insumo #${ing.insumoId}`,
            unidadMedida: insumo?.unidadMedida || 'kg',
          };
        });

        const recetaLocal: Receta = {
          id: recetaId,
          productoId: rObj.productoId,
          productoNombre: prod?.name || `Producto #${rObj.productoId}`,
          rendimientoBase: rObj.rendimientoBase || 1,
          instrucciones: rObj.instrucciones || '',
          ingredientes: fullIngredientes,
          margenDeseado: rObj.margenDeseado || 30
        };

        if (rObj.id) {
          setRecetas(prev => prev.map(r => r.id === recetaId ? recetaLocal : r));
          toast('Receta actualizada correctamente');
        } else {
          setRecetas(prev => [...prev, recetaLocal]);
          toast('Receta creada correctamente');
        }
        return { success: true };
      } catch (err: any) {
        console.error('Error saving receta:', err);
        toast('Error al guardar receta: ' + (err.message || ''));
        return { success: false, message: err.message };
      }
    } else {
      // Offline mode
      const prod = products.find(p => p.id === rObj.productoId);
      const fullIngredientes: RecetaIngrediente[] = ingredientes.map(ing => {
        const insumo = insumos.find(i => i.id === ing.insumoId);
        return {
          ...ing,
          insumoNombre: insumo?.nombre || `Insumo #${ing.insumoId}`,
          unidadMedida: insumo?.unidadMedida || 'kg',
        };
      });

      if (rObj.id) {
        const updated = recetas.map(r =>
          r.id === rObj.id
            ? { ...r, productoId: rObj.productoId, productoNombre: prod?.name || r.productoNombre, rendimientoBase: rObj.rendimientoBase || 1, instrucciones: rObj.instrucciones || '', ingredientes: fullIngredientes, margenDeseado: rObj.margenDeseado || 30 }
            : r
        );
        setRecetas(updated);
        saveOffline('snack_recetas', updated);
        toast('Receta actualizada (offline)');
      } else {
        const newId = recetas.length > 0 ? Math.max(...recetas.map(r => r.id)) + 1 : 1;
        const newReceta: Receta = {
          id: newId,
          productoId: rObj.productoId,
          productoNombre: prod?.name || `Producto #${rObj.productoId}`,
          rendimientoBase: rObj.rendimientoBase || 1,
          instrucciones: rObj.instrucciones || '',
          ingredientes: fullIngredientes,
          margenDeseado: rObj.margenDeseado || 30
        };
        const updated = [...recetas, newReceta];
        setRecetas(updated);
        saveOffline('snack_recetas', updated);
        toast('Receta creada (offline)');
      }
      return { success: true };
    }
  };

  const deleteReceta = async (id: number) => {
    if (isSupabaseConfigured && supabase) {
      try {
        // detalle_receta cascade-deletes
        const { error } = await supabase.from('recetas').delete().eq('id_receta', id);
        if (error) throw error;
        setRecetas(prev => prev.filter(r => r.id !== id));
        toast('Receta eliminada');
      } catch (err: any) {
        console.error('Error deleting receta:', err);
        toast('Error al eliminar receta: ' + (err.message || ''));
      }
    } else {
      const updated = recetas.filter(r => r.id !== id);
      setRecetas(updated);
      saveOffline('snack_recetas', updated);
      toast('Receta eliminada (offline)');
    }
  };

  const calcularCostoProduccion = (productoId: number, cantidad: number) =>
    calcCostoProduccion(recetas, insumos, productoId, cantidad);

  const calcularInsumosParaPedido = (items: PedidoItem[]) =>
    calcInsumosPedido(items, recetas, insumos);

  return { saveReceta, deleteReceta, calcularCostoProduccion, calcularInsumosParaPedido };
}
