import React from 'react';
import { Product, BreadLog, User } from '@/context/types';

interface InventoryOpsParams {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: { id: number; name: string }[];
  breadLogs: BreadLog[];
  setBreadLogs: React.Dispatch<React.SetStateAction<BreadLog[]>>;
  user: User | null;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
}

export function useInventoryOps({
  products,
  setProducts,
  categories,
  breadLogs,
  setBreadLogs,
  user,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline
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
          await supabase.from('productos').update({
            nombre: pObj.name,
            id_categoria: idCat,
            em: pObj.em || '📦',
            precio_unitario: pObj.price,
            num_stock: pObj.stock || 0,
            unidad_medida: pObj.unidad_medida || 'unidades'
          }).eq('id_producto', pObj.id);
          await syncProductVersions(pObj.id, pObj.versions || []);
          toast('📦 Producto actualizado en la nube');
        } else {
          const { data: newProd } = await supabase.from('productos').insert({
            nombre: pObj.name,
            id_categoria: idCat,
            em: pObj.em || '📦',
            precio_unitario: pObj.price,
            num_stock: pObj.stock || 0,
            unidad_medida: pObj.unidad_medida || 'unidades',
            estado: 1
          }).select().single();

          if (newProd) {
            await syncProductVersions(newProd.id_producto, pObj.versions || []);
          }
          toast('📦 Producto creado en la nube');
        }

        const { data: prods } = await supabase.from('productos').select('*, producto_versiones(*), categorias(nombre)').eq('estado', 1);
        if (prods) {
          setProducts((prods as any[]).map(p => ({
            id: p.id_producto,
            name: p.nombre,
            cat: p.categorias?.nombre || 'Sin categoría',
            price: parseFloat(p.precio_unitario),
            stock: parseFloat(p.num_stock || 0),
            em: p.em,
            unidad_medida: p.unidad_medida || 'unidades',
            versions: p.producto_versiones ? (p.producto_versiones as any[]).map(v => ({
              id: v.id_version,
              name: v.nombre_version,
              price: parseFloat(v.precio_unitario),
              stock: parseFloat(v.num_stock || 0),
              parent_version_id: v.parent_version_id,
              fraction_ratio: v.fraction_ratio ? parseFloat(v.fraction_ratio) : 1
            })) : []
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      if (pObj.id) {
        updated = products.map(p => p.id === pObj.id ? { ...p, ...pObj } : p);
        toast('📦 Producto actualizado');
      } else {
        const newProd = { ...pObj, id: Date.now(), stock: pObj.stock || 0, versions: pObj.versions || [], unidad_medida: pObj.unidad_medida || 'unidades' };
        updated = [...products, newProd];
        toast('📦 Producto creado');
      }
      setProducts(updated);
      saveOffline('snack_products', updated);
    }
  };

  const deleteProduct = async (id: number) => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('productos').update({ estado: 0 }).eq('id_producto', id);
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
    const updated = products.map(p => {
      if (p.id === prodId) {
        if (version) {
          const newVers = p.versions.map(v => 
            v.name === version ? { ...v, stock: v.stock + qty } : v
          );
          return { ...p, versions: newVers };
        } else {
          return { ...p, stock: p.stock + qty };
        }
      }
      return p;
    });

    setProducts(updated);
    saveOffline('snack_products', updated);

    const prod = products.find(x => x.id === prodId);
    const vRef = (version && prod) ? prod.versions.find(v => v.name === version) : null;

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      prodName: (prod?.name || 'Producto') + (version ? ` (${version})` : ''),
      type: 'produccion',
      qty,
      reason: 'Ingreso inicial de producción diaria'
    };

    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('produccion_descarte').insert({
          id_producto: prodId,
          id_version: vRef?.id || null,
          tipo_registro: 'produccion',
          num_cantidad: qty,
          id_usuario: user?.id
        });
      } catch (err) {
        console.error('Error al registrar producción en Supabase', err);
      }
    }

    toast('➕ Producción de panes registrada');
  };

  const logBreadDiscard = async (prodId: number, qty: number, reason: string, version: string | null = null) => {
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

    const prod = products.find(x => x.id === prodId);
    const vRef = (version && prod) ? prod.versions.find(v => v.name === version) : null;

    const log: BreadLog = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      prodName: (prod?.name || 'Producto') + (version ? ` (${version})` : ''),
      type: 'descarte',
      qty,
      reason
    };

    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('produccion_descarte').insert({
          id_producto: prodId,
          id_version: vRef?.id || null,
          tipo_registro: 'descarte',
          num_cantidad: qty,
          motivo_descarte: reason,
          id_usuario: user?.id
        });
      } catch (err) {
        console.error('Error al registrar descarte en Supabase', err);
      }
    }

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
    const updated = products.map(p => {
      const parent = p.versions.find(v => v.id === parentVersionId);
      const child = p.versions.find(v => v.id === childVersionId);
      if (parent && child) {
        const newVersions = p.versions.map(v => {
          if (v.id === parentVersionId) return { ...v, stock: Math.max(0, v.stock - qtyToDeduct) };
          if (v.id === childVersionId) return { ...v, stock: v.stock + qtyToAdd };
          return v;
        });
        return { ...p, versions: newVersions };
      }
      return p;
    });
    setProducts(updated);
    saveOffline('snack_products', updated);

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
      cajero: user?.n || 'Sistema'
    };
    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);

    if (isSupabaseConfigured && supabase) {
      try {
        const [
          { data: vParent },
          { data: vChild }
        ] = await Promise.all([
          supabase.from('producto_versiones').select('num_stock').eq('id_version', parentVersionId).single(),
          supabase.from('producto_versiones').select('num_stock').eq('id_version', childVersionId).single()
        ]);

        const nextParentStock = Math.max(0, parseFloat(vParent?.num_stock || 0) - qtyToDeduct);
        const nextChildStock = parseFloat(vChild?.num_stock || 0) + qtyToAdd;

        await Promise.all([
          supabase.from('producto_versiones').update({ num_stock: nextParentStock }).eq('id_version', parentVersionId),
          supabase.from('producto_versiones').update({ num_stock: nextChildStock }).eq('id_version', childVersionId),
          supabase.from('produccion_descarte').insert({
            id_producto: products.find(p => p.versions.some(v => v.id === parentVersionId))?.id || null,
            id_version: parentVersionId,
            tipo_registro: 'descarte',
            num_cantidad: qtyToDeduct,
            motivo_descarte: `Fraccionado a ${childName}`,
            id_usuario: user?.id
          }),
          supabase.from('produccion_descarte').insert({
            id_producto: products.find(p => p.versions.some(v => v.id === childVersionId))?.id || null,
            id_version: childVersionId,
            tipo_registro: 'produccion',
            num_cantidad: qtyToAdd,
            motivo_descarte: 'Ingreso por fraccionamiento',
            id_usuario: user?.id
          })
        ]);
      } catch (err) {
        console.error('Error fraccionando en Supabase', err);
      }
    }
    toast('✂️ Fraccionamiento registrado con éxito.');
  };

  return {
    saveProduct,
    deleteProduct,
    logBreadProduction,
    logBreadDiscard,
    logBreadConversion,
    fractionateProduct
  };
}
