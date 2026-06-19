import React from 'react';
import { Insumo, User } from '@/context/types';

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
    if (isSupabaseConfigured && supabase) {
      try {
        if (iObj.id) {
          // Update existing
          const { error } = await supabase.from('insumos').update({
            nombre: iObj.nombre,
            num_stock: iObj.stock ?? 0,
            costo_unitario: iObj.costoUnitario ?? 0,
            unidad_medida: iObj.unidadMedida || 'kg',
            stock_minimo: iObj.stockMinimo ?? 0,
          }).eq('id_insumo', iObj.id);
          if (error) throw error;

          setInsumos(prev => prev.map(ins =>
            ins.id === iObj.id
              ? { ...ins, nombre: iObj.nombre, stock: iObj.stock ?? ins.stock, costoUnitario: iObj.costoUnitario ?? ins.costoUnitario, unidadMedida: iObj.unidadMedida || ins.unidadMedida, stockMinimo: iObj.stockMinimo ?? ins.stockMinimo }
              : ins
          ));
          toast('Insumo actualizado correctamente');
        } else {
          // Insert new
          const { data, error } = await supabase.from('insumos').insert({
            nombre: iObj.nombre,
            num_stock: iObj.stock ?? 0,
            costo_unitario: iObj.costoUnitario ?? 0,
            unidad_medida: iObj.unidadMedida || 'kg',
            stock_minimo: iObj.stockMinimo ?? 0,
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
          };
          setInsumos(prev => [...prev, newInsumo]);
          toast('Insumo registrado correctamente');
        }
      } catch (err: any) {
        console.error('Error saving insumo:', err);
        toast('Error al guardar insumo: ' + (err.message || ''));
      }
    } else {
      // Offline mode
      if (iObj.id) {
        const updated = insumos.map(ins =>
          ins.id === iObj.id
            ? { ...ins, nombre: iObj.nombre, stock: iObj.stock ?? ins.stock, costoUnitario: iObj.costoUnitario ?? ins.costoUnitario, unidadMedida: iObj.unidadMedida || ins.unidadMedida, stockMinimo: iObj.stockMinimo ?? ins.stockMinimo }
            : ins
        );
        setInsumos(updated);
        saveOffline('snack_insumos', updated);
        toast('Insumo actualizado (offline)');
      } else {
        const newId = insumos.length > 0 ? Math.max(...insumos.map(i => i.id)) + 1 : 1;
        const newInsumo: Insumo = {
          id: newId,
          nombre: iObj.nombre,
          stock: iObj.stock ?? 0,
          costoUnitario: iObj.costoUnitario ?? 0,
          unidadMedida: iObj.unidadMedida || 'kg',
          stockMinimo: iObj.stockMinimo ?? 0,
          active: true,
        };
        const updated = [...insumos, newInsumo];
        setInsumos(updated);
        saveOffline('snack_insumos', updated);
        toast('Insumo registrado (offline)');
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
