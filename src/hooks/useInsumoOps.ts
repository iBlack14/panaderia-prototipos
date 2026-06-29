import React from 'react';
import { Insumo, User } from '@/context/types';
import { consumeLotesFIFO, getLotesUnitCost } from '@/lib/fifo';

interface InsumoOpsParams {
  insumos: Insumo[];
  setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
  user: User | null;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
}

export function useInsumoOps({
  insumos,
  setInsumos,
  user,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline
}: InsumoOpsParams) {

  const saveInsumo = async (iObj: any) => {
    // 1. Determine existing lotes & stock
    const existing = insumos.find(i => i.id === iObj.id);
    const oldStock = existing ? existing.stock : 0;
    let newLotes = existing && existing.lotes ? [...existing.lotes] : [];
    
    if (iObj.id) {
      // Edit mode: check if stock has changed
      if (iObj.stock !== oldStock) {
        const diff = iObj.stock - oldStock;
        if (diff > 0) {
          // Increased: append batch with last known cost
          const lastCost = newLotes.length > 0 ? newLotes[newLotes.length - 1].cost : 0;
          newLotes.push({ qty: diff, cost: lastCost });
        } else if (diff < 0) {
          // Decreased: consume FIFO style
          newLotes = consumeLotesFIFO(newLotes, -diff);
        }
      }
    } else {
      const initialCost = parseFloat(String(iObj.costoUnitario ?? 0)) || 0;
      newLotes = iObj.stock > 0 ? [{ qty: iObj.stock, cost: initialCost }] : [];
    }

    const calculatedCost =
      newLotes.length > 0 ? getLotesUnitCost(newLotes) : parseFloat(String(iObj.costoUnitario ?? 0)) || 0;

    if (isSupabaseConfigured && supabase) {
      try {
        if (iObj.id) {
          // Update existing
          const { error } = await supabase.from('insumos').update({
            nombre: iObj.nombre,
            num_stock: iObj.stock ?? 0,
            costo_unitario: calculatedCost,
            unidad_medida: iObj.unidadMedida || 'kg',
            stock_minimo: iObj.stockMinimo ?? 0,
            lotes: newLotes
          }).eq('id_insumo', iObj.id);
          if (error) throw error;

          const updatedInsumo = { 
            id: iObj.id, 
            nombre: iObj.nombre, 
            stock: iObj.stock ?? (existing ? existing.stock : 0), 
            costoUnitario: calculatedCost, 
            unidadMedida: iObj.unidadMedida || (existing ? existing.unidadMedida : 'kg'), 
            stockMinimo: iObj.stockMinimo ?? (existing ? existing.stockMinimo : 0), 
            lotes: newLotes,
            active: existing ? existing.active : true
          };

          setInsumos(prev => prev.map(ins =>
            ins.id === iObj.id ? updatedInsumo : ins
          ));
          toast('Insumo actualizado correctamente');
          return updatedInsumo;
        } else {
          // Insert new
          const { data, error } = await supabase.from('insumos').insert({
            nombre: iObj.nombre,
            num_stock: iObj.stock ?? 0,
            costo_unitario: calculatedCost,
            unidad_medida: iObj.unidadMedida || 'kg',
            stock_minimo: iObj.stockMinimo ?? 0,
            lotes: newLotes
          }).select().single();
          if (error) throw error;

          const newInsumo: Insumo = {
            id: data.id_insumo,
            nombre: data.nombre,
            stock: parseFloat(data.num_stock) || 0,
            costoUnitario: parseFloat(data.costo_unitario) || 0,
            unidadMedida: data.unidad_medida || 'kg',
            stockMinimo: parseFloat(data.stock_minimo) || 0,
            active: data.estado === 1,
            lotes: data.lotes || newLotes
          };
          setInsumos(prev => [...prev, newInsumo]);
          toast('Insumo registrado correctamente');
          return newInsumo;
        }
      } catch (err: any) {
        console.error('Error saving insumo:', err);
        toast('Error al guardar insumo: ' + (err.message || ''));
      }
    } else {
      // Offline mode
      if (iObj.id) {
        const updatedInsumo = { 
          id: iObj.id, 
          nombre: iObj.nombre, 
          stock: iObj.stock, 
          costoUnitario: calculatedCost, 
          unidadMedida: iObj.unidadMedida, 
          stockMinimo: iObj.stockMinimo, 
          lotes: newLotes,
          active: existing ? existing.active : true
        };
        const updated = insumos.map(ins =>
          ins.id === iObj.id ? updatedInsumo : ins
        );
        setInsumos(updated);
        saveOffline('snack_insumos', updated);
        toast('Insumo actualizado (offline)');
        return updatedInsumo;
      } else {
        const newId = insumos.length > 0 ? Math.max(...insumos.map(i => i.id)) + 1 : 1;
        const newInsumo: Insumo = {
          id: newId,
          nombre: iObj.nombre,
          stock: iObj.stock ?? 0,
          costoUnitario: calculatedCost,
          unidadMedida: iObj.unidadMedida || 'kg',
          stockMinimo: iObj.stockMinimo ?? 0,
          active: true,
          lotes: newLotes
        };
        const updated = [...insumos, newInsumo];
        setInsumos(updated);
        saveOffline('snack_insumos', updated);
        toast('Insumo registrado (offline)');
        return newInsumo;
      }
    }
  };

  const toggleInsumo = async (id: number) => {
    const ins = insumos.find(i => i.id === id);
    if (!ins) return;
    const newEstado = ins.active ? 0 : 1;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('insumos').update({ estado: newEstado }).eq('id_insumo', id);
        if (error) throw error;
        setInsumos(prev => prev.map(i => i.id === id ? { ...i, active: !i.active } : i));
        toast(newEstado === 1 ? 'Insumo reactivado' : 'Insumo desactivado');
      } catch (err: any) {
        console.error('Error toggling insumo:', err);
        toast('Error al cambiar estado del insumo');
      }
    } else {
      const updated = insumos.map(i => i.id === id ? { ...i, active: !i.active } : i);
      setInsumos(updated);
      saveOffline('snack_insumos', updated);
      toast(newEstado === 1 ? 'Insumo reactivado (offline)' : 'Insumo desactivado (offline)');
    }
  };

  return { saveInsumo, toggleInsumo };
}
