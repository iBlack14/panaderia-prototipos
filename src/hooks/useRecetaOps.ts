import React from 'react';
import { Receta, RecetaIngrediente, Product, Insumo, User } from '@/context/types';

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

    if (isSupabaseConfigured && supabase) {
      try {
        let recetaId: number;

        if (rObj.id) {
          // Update existing receta
          const { error } = await supabase.from('recetas').update({
            id_producto: rObj.productoId,
            rendimiento_base: rObj.rendimientoBase || 1,
            instrucciones: rObj.instrucciones || null,
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
        };

        if (rObj.id) {
          setRecetas(prev => prev.map(r => r.id === recetaId ? recetaLocal : r));
          toast('Receta actualizada correctamente');
        } else {
          setRecetas(prev => [...prev, recetaLocal]);
          toast('Receta creada correctamente');
        }
      } catch (err: any) {
        console.error('Error saving receta:', err);
        toast('Error al guardar receta: ' + (err.message || ''));
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
            ? { ...r, productoId: rObj.productoId, productoNombre: prod?.name || r.productoNombre, rendimientoBase: rObj.rendimientoBase || 1, instrucciones: rObj.instrucciones || '', ingredientes: fullIngredientes }
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
        };
        const updated = [...recetas, newReceta];
        setRecetas(updated);
        saveOffline('snack_recetas', updated);
        toast('Receta creada (offline)');
      }
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

  /**
   * Calcula el costo total de producir `cantidad` unidades de un producto
   * basándose en su receta. Retorna { costoTotal, detalles[] } o null si no hay receta.
   */
  const calcularCostoProduccion = (productoId: number, cantidad: number) => {
    const receta = recetas.find(r => r.productoId === productoId);
    if (!receta) return null;

    const factor = cantidad / (receta.rendimientoBase || 1);
    let costoTotal = 0;
    const detalles: { insumoNombre: string; cantidadNecesaria: number; unidad: string; costoLinea: number; stockDisponible: number; suficiente: boolean }[] = [];

    for (const ing of receta.ingredientes) {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      const cantidadNecesaria = ing.cantidadRequerida * factor;
      const costoLinea = cantidadNecesaria * (insumo?.costoUnitario || 0);
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
  };

  return { saveReceta, deleteReceta, calcularCostoProduccion };
}
