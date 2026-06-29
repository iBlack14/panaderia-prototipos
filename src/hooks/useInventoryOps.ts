import React from 'react';
import { Product, BreadLog, User, Insumo, Receta } from '@/context/types';
import { consumeLotesFIFO, getLotesUnitCost } from '@/lib/fifo';
import { fetchProducts, refetchAfterProduction } from '@/lib/supabase/queries/reloadEntity';

interface InventoryOpsParams {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: { id: number; name: string; active: boolean }[];
  setCategories: React.Dispatch<React.SetStateAction<{ id: number; name: string; active: boolean }[]>>;
  breadLogs: BreadLog[];
  setBreadLogs: React.Dispatch<React.SetStateAction<BreadLog[]>>;
  user: User | null;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
  insumos: Insumo[];
  setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
  recetas: Receta[];
}

export function useInventoryOps({
  products,
  setProducts,
  categories,
  setCategories,
  breadLogs,
  setBreadLogs,
  user,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline,
  insumos,
  setInsumos,
  recetas
}: InventoryOpsParams) {

  const saveProduct = async (pObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const catMatch = categories.find((c) => c.name === pObj.cat);
        const idCat = catMatch?.id || null;

        const syncProductVersions = async (productId: number, versions: any[]) => {
          if (!versions || versions.length === 0) {
            await supabase.from('producto_versiones').delete().eq('id_producto', productId);
            return;
          }

          // Step 1: Delete versions no longer in the list
          const realIds = versions.map((v: any) => v.id).filter((id: number) => id < 1000000000);
          if (realIds.length > 0) {
            await supabase.from('producto_versiones').delete().eq('id_producto', productId).not('id_version', 'in', `(${realIds.join(',')})`);
          } else {
            await supabase.from('producto_versiones').delete().eq('id_producto', productId);
          }

          // Step 2: Insert or update all versions (without parent_version_id first to prevent constraint issues)
          const versionRows = versions.map((v: any) => {
            const row: any = {
              id_producto: productId,
              nombre_version: v.name,
              precio_unitario: v.price,
              num_stock: v.stock || 0,
              estado: 1,
              fraction_ratio: v.fraction_ratio || 1
            };
            if (v.id && v.id < 1000000000) {
              row.id_version = v.id;
            }
            return row;
          });

          const { data: savedVersions, error } = await supabase.from('producto_versiones').upsert(versionRows).select();
          if (error) throw error;

          // Step 3: Set parent_version_id on children based on parent-child relations
          if (savedVersions) {
            const updatePromises = savedVersions.map(async (vSaved: any) => {
              const orig = versions.find((v: any) => v.name === vSaved.nombre_version);
              if (orig && orig.parent_version_id) {
                const origParent = versions.find((v: any) => v.id === orig.parent_version_id);
                if (origParent) {
                  const realParentSaved = savedVersions.find((v: any) => v.nombre_version === origParent.name);
                  if (realParentSaved) {
                    await supabase.from('producto_versiones').update({
                      parent_version_id: realParentSaved.id_version
                    }).eq('id_version', vSaved.id_version);
                  }
                }
              } else {
                await supabase.from('producto_versiones').update({
                  parent_version_id: null
                }).eq('id_version', vSaved.id_version);
              }
            });
            await Promise.all(updatePromises);
          }
        };

        if (pObj.id) {
          const { error: updateError } = await supabase.from('productos').update({
            nombre: pObj.name,
            id_categoria: idCat,
            precio_unitario: pObj.price,
            num_stock: pObj.stock || 0,
            unidad_medida: pObj.unidad_medida || 'unidades'
          }).eq('id_producto', pObj.id);
          if (updateError) throw updateError;

          await syncProductVersions(pObj.id, pObj.versions || []);
          toast('📦 Producto actualizado en la nube');
        } else {
          const { data: newProd, error: insertError } = await supabase.from('productos').insert({
            nombre: pObj.name,
            id_categoria: idCat,
            precio_unitario: pObj.price,
            num_stock: pObj.stock || 0,
            unidad_medida: pObj.unidad_medida || 'unidades',
            estado: 1
          }).select().single();
          if (insertError) throw insertError;

          if (newProd) {
            await syncProductVersions(newProd.id_producto, pObj.versions || []);
          }
          toast('📦 Producto creado en la nube');
        }

        const mapped = await fetchProducts(supabase);
        setProducts(mapped);
        if (pObj.id) {
          return mapped.find(p => p.id === pObj.id) ?? null;
        }
        return mapped.find(p => p.name === pObj.name) ?? null;
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      let returnedProduct: any = null;
      if (pObj.id) {
        returnedProduct = products.find(p => p.id === pObj.id) ? { ...products.find(p => p.id === pObj.id), ...pObj } : pObj;
        updated = products.map(p => p.id === pObj.id ? returnedProduct : p);
        toast('📦 Producto actualizado');
      } else {
        returnedProduct = { ...pObj, id: Date.now(), stock: pObj.stock || 0, versions: pObj.versions || [], unidad_medida: pObj.unidad_medida || 'unidades' };
        updated = [...products, returnedProduct];
        toast('📦 Producto creado');
      }
      setProducts(updated);
      saveOffline('snack_products', updated);
      return returnedProduct;
    }
  };

  const deleteProduct = async (id: number) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('productos').update({ estado: 0 }).eq('id_producto', id);
        if (error) throw error;
        setProducts(products.filter(p => p.id !== id));
        toast('🗑 Producto eliminado de la nube');
      } catch (err: any) {
        toast(`❌ Error eliminando producto: ${err.message}`);
      }
    } else {
      const updated = products.filter(p => p.id !== id);
      setProducts(updated);
      saveOffline('snack_products', updated);
      toast('🗑 Producto eliminado');
    }
  };

  const logBreadProduction = async (prodId: number, qty: number, version: string | null = null) => {
    const prod = products.find(x => x.id === prodId);
    const vRef = version && prod ? prod.versions.find(v => v.name === version) : null;

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      prodName: (prod?.name || 'Producto') + (version ? ` (${version})` : ''),
      type: 'produccion',
      qty,
      reason: 'Ingreso inicial de producción diaria',
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('produccion_descarte').insert({
          id_producto: prodId,
          id_version: vRef?.id || null,
          tipo_registro: 'produccion',
          num_cantidad: qty,
          id_usuario: user?.id,
        });
        if (error) throw error;

        const refreshed = await refetchAfterProduction(supabase);
        setProducts(refreshed.products);
        setInsumos(refreshed.insumos);
        setBreadLogs([log, ...breadLogs]);
        toast('➕ Producción de panes registrada');
      } catch (err) {
        console.error('Error al registrar producción en Supabase', err);
        toast('❌ Error al registrar producción en la nube');
      }
      return;
    }

    const updated = products.map(p => {
      if (p.id !== prodId) return p;
      if (version) {
        const newVers = p.versions.map(v =>
          v.name === version ? { ...v, stock: v.stock + qty } : v
        );
        return { ...p, versions: newVers };
      }
      return { ...p, stock: p.stock + qty };
    });

    setProducts(updated);
    saveOffline('snack_products', updated);

    const receta = recetas.find(r => r.productoId === prodId);
    if (receta && receta.ingredientes.length > 0) {
      const factor = qty / (receta.rendimientoBase || 1);
      const updatedInsumos = insumos.map(ins => {
        const ing = receta.ingredientes.find(i => i.insumoId === ins.id);
        if (!ing) return ins;

        const qtyToConsume = ing.cantidadRequerida * factor;
        const newLotes = consumeLotesFIFO(ins.lotes || [], qtyToConsume);
        return {
          ...ins,
          stock: Math.max(0, ins.stock - qtyToConsume),
          lotes: newLotes,
          costoUnitario: getLotesUnitCost(newLotes),
        };
      });
      setInsumos(updatedInsumos);
      saveOffline('snack_insumos', updatedInsumos);
    }

    setBreadLogs([log, ...breadLogs]);
    saveOffline('snack_bread_logs', [log, ...breadLogs]);
    toast('➕ Producción de panes registrada');
  };

  const logBreadDiscard = async (prodId: number, qty: number, reason: string, version: string | null = null) => {
    const prod = products.find(x => x.id === prodId);
    const vRef = version && prod ? prod.versions.find(v => v.name === version) : null;

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      prodName: (prod?.name || 'Producto') + (version ? ` (${version})` : ''),
      type: 'descarte',
      qty,
      reason,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('produccion_descarte').insert({
          id_producto: prodId,
          id_version: vRef?.id || null,
          tipo_registro: 'descarte',
          num_cantidad: qty,
          motivo_descarte: reason,
          id_usuario: user?.id,
        });
        if (error) throw error;

        const refreshed = await refetchAfterProduction(supabase);
        setProducts(refreshed.products);
        setInsumos(refreshed.insumos);
        setBreadLogs([log, ...breadLogs]);
        toast('⚠️ Reporte de descarte registrado');
      } catch (err) {
        console.error('Error al registrar descarte en Supabase', err);
        toast('❌ Error al registrar descarte en la nube');
      }
      return;
    }

    const updated = products.map(p => {
      if (p.id !== prodId) return p;
      if (version) {
        const newVers = p.versions.map(v =>
          v.name === version ? { ...v, stock: Math.max(0, v.stock - qty) } : v
        );
        return { ...p, versions: newVers };
      }
      return { ...p, stock: Math.max(0, p.stock - qty) };
    });

    setProducts(updated);
    saveOffline('snack_products', updated);
    setBreadLogs([log, ...breadLogs]);
    saveOffline('snack_bread_logs', [log, ...breadLogs]);
    toast('⚠️ Reporte de descarte registrado');
  };

  const logBreadConversion = (prodId: number, qty: number, destino: string, costoEstimado?: number, version: string | null = null) => {
    const updated = products.map(p => {
      if (p.id === prodId) {
        if (version) {
          const newVers = p.versions.map(v =>
            v.name === version ? { ...v, stock: Math.max(0, v.stock - qty) } : v
          );
          return { ...p, versions: newVers };
        } else {
          return { ...p, stock: Math.max(0, p.stock - qty) };
        }
      }
      return p;
    });
    setProducts(updated);
    saveOffline('snack_products', updated);

    const prodNombre = (products.find(x => x.id === prodId)?.name || 'Producto') + (version ? ` (${version})` : '');
    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      prodName: prodNombre,
      type: 'conversion',
      qty,
      reason: `Convertido en insumo para: ${destino}`,
      cajero: user?.n || 'Sistema',
      destino,
      costoEstimado
    };
    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);
    toast(`♻️ ${qty} und. de ${prodNombre} convertidos en insumo para ${destino}.`);
  };

  const fractionateProduct = async (parentVersionId: number, childVersionId: number, qtyToDeduct: number, qtyToAdd: number) => {
    let parentName = `Var #${parentVersionId}`;
    let childName = `Var #${childVersionId}`;
    products.forEach(p => {
      const par = p.versions.find(v => v.id === parentVersionId);
      const ch = p.versions.find(v => v.id === childVersionId);
      if (par) parentName = `${p.name} (${par.name})`;
      if (ch) childName = `${p.name} (${ch.name})`;
    });

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      prodName: parentName,
      type: 'conversion',
      qty: qtyToDeduct,
      reason: `Fraccionado en ${qtyToAdd} de ${childName}`,
      cajero: user?.n || 'Sistema',
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const parentProductId = products.find(p => p.versions.some(v => v.id === parentVersionId))?.id ?? null;
        const childProductId = products.find(p => p.versions.some(v => v.id === childVersionId))?.id ?? null;

        await Promise.all([
          supabase.from('produccion_descarte').insert({
            id_producto: parentProductId,
            id_version: parentVersionId,
            tipo_registro: 'descarte',
            num_cantidad: qtyToDeduct,
            motivo_descarte: `Fraccionado a ${childName}`,
            id_usuario: user?.id,
          }),
          supabase.from('produccion_descarte').insert({
            id_producto: childProductId,
            id_version: childVersionId,
            tipo_registro: 'produccion',
            num_cantidad: qtyToAdd,
            motivo_descarte: 'Ingreso por fraccionamiento',
            id_usuario: user?.id,
          }),
        ]);

        const refreshed = await refetchAfterProduction(supabase);
        setProducts(refreshed.products);
        setInsumos(refreshed.insumos);
        setBreadLogs([log, ...breadLogs]);
        toast('✂️ Fraccionamiento registrado con éxito.');
      } catch (err) {
        console.error('Error fraccionando en Supabase', err);
        toast('❌ Error al fraccionar en la nube');
      }
      return;
    }

    const updated = products.map(p => {
      const parent = p.versions.find(v => v.id === parentVersionId);
      const child = p.versions.find(v => v.id === childVersionId);
      if (!parent || !child) return p;
      const newVersions = p.versions.map(v => {
        if (v.id === parentVersionId) return { ...v, stock: Math.max(0, v.stock - qtyToDeduct) };
        if (v.id === childVersionId) return { ...v, stock: v.stock + qtyToAdd };
        return v;
      });
      return { ...p, versions: newVersions };
    });

    setProducts(updated);
    saveOffline('snack_products', updated);
    setBreadLogs([log, ...breadLogs]);
    saveOffline('snack_bread_logs', [log, ...breadLogs]);
    toast('✂️ Fraccionamiento registrado con éxito.');
  };

  const saveCategory = async (cObj: { id?: number; name: string; active: boolean }) => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (cObj.id) {
          const { error } = await supabase
            .from('categorias')
            .update({ nombre: cObj.name, estado: cObj.active ? 1 : 0 })
            .eq('id_categoria', cObj.id);
          if (error) throw error;
          toast('🏷️ Categoría actualizada');
        } else {
          const { error } = await supabase
            .from('categorias')
            .insert({ nombre: cObj.name, estado: cObj.active ? 1 : 0 });
          if (error) throw error;
          toast('🏷️ Categoría creada');
        }
        
        const { data } = await supabase
          .from('categorias')
          .select('*')
          .order('id_categoria', { ascending: true });
        if (data) {
          setCategories(data.map((c: any) => ({
            id: c.id_categoria,
            name: c.nombre,
            active: c.estado === 1
          })));
        }
      } catch (err: any) {
        toast(`❌ Error al guardar categoría: ${err.message}`);
      }
    } else {
      let updated;
      if (cObj.id) {
        updated = categories.map(c => c.id === cObj.id ? { ...c, name: cObj.name, active: cObj.active } : c);
        toast('🏷️ Categoría actualizada');
      } else {
        const newCat = { id: Date.now(), name: cObj.name, active: cObj.active };
        updated = [...categories, newCat];
        toast('🏷️ Categoría creada');
      }
      setCategories(updated);
      saveOffline('snack_categorias', updated);
    }
  };

  const toggleCategory = async (id: number) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const newActive = !cat.active;
    
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('categorias')
          .update({ estado: newActive ? 1 : 0 })
          .eq('id_categoria', id);
        if (error) throw error;
        toast(`🏷️ Categoría ${newActive ? 'activada' : 'desactivada'}`);
        
        const { data } = await supabase
          .from('categorias')
          .select('*')
          .order('id_categoria', { ascending: true });
        if (data) {
          setCategories(data.map((c: any) => ({
            id: c.id_categoria,
            name: c.nombre,
            active: c.estado === 1
          })));
        }
      } catch (err: any) {
        toast(`❌ Error: ${err.message}`);
      }
    } else {
      const updated = categories.map(c => c.id === id ? { ...c, active: newActive } : c);
      setCategories(updated);
      saveOffline('snack_categorias', updated);
      toast(`🏷️ Categoría ${newActive ? 'activada' : 'desactivada'}`);
    }
  };

  return {
    saveProduct,
    deleteProduct,
    logBreadProduction,
    logBreadDiscard,
    logBreadConversion,
    fractionateProduct,
    saveCategory,
    toggleCategory
  };
}
