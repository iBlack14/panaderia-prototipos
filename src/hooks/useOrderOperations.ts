import React from 'react';
import { Pedido, Purchase, Sale, Product, Client, Provider, BreadLog, User, PurchaseItem, CashSession, Insumo } from '@/context/types';
import { getLotesUnitCost } from '@/lib/fifo';
import { fetchPedidos, refetchAfterPurchase, refetchAfterSale } from '@/lib/supabase/queries/reloadEntity';

interface OrderOpsParams {
  pedidos: Pedido[];
  setPedidos: React.Dispatch<React.SetStateAction<Pedido[]>>;
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  providers: Provider[];
  breadLogs: BreadLog[];
  setBreadLogs: React.Dispatch<React.SetStateAction<BreadLog[]>>;
  cashSession: CashSession | null;
  setCashSession: React.Dispatch<React.SetStateAction<CashSession | null>>;
  user: User | null;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
  insumos: Insumo[];
  setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
}

/**
 * Hook personalizado que encapsula las operaciones relacionadas con la gestión de pedidos,
 * reservas y compras a proveedores.
 * 
 * @param params Parámetros de estado y funciones utilitarias necesarias para operar.
 * @returns Funciones operativas para guardar pedidos, actualizar estados y registrar compras.
 */
export function useOrderOperations({
  pedidos,
  setPedidos,
  purchases,
  setPurchases,
  sales,
  setSales,
  products,
  setProducts,
  clients,
  setClients,
  providers,
  breadLogs,
  setBreadLogs,
  cashSession,
  setCashSession,
  user,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline,
  insumos,
  setInsumos
}: OrderOpsParams) {

  /**
   * Guarda o actualiza una reserva/pedido en la base de datos (Supabase) o en LocalStorage
   * si se opera de modo local/desconectado.
   * 
   * @param pedidoObj El objeto con los detalles del pedido (id, clienteId, productoTexto, fecEntrega, adelanto, notas).
   */
  const savePedido = async (pedidoObj: any) => {
    let savedObj: Pedido;

    if (isSupabaseConfigured && supabase) {
      try {
        if (pedidoObj.id && !String(pedidoObj.id).startsWith('local_')) {
          const { data, error } = await supabase.from('pedidos_reserva').update({
            id_cliente: pedidoObj.clienteId || null,
            producto_texto: pedidoObj.productoTexto,
            fec_entrega: pedidoObj.fecEntrega,
            adelanto: pedidoObj.adelanto,
            notas: pedidoObj.notas || null,
            estado: pedidoObj.estado || 'Pendiente',
            updated_at: new Date().toISOString()
          }).eq('id_pedido', pedidoObj.id).select('*, clientes(nombre)').single();
          if (error) throw error;

          savedObj = {
            id: data.id_pedido,
            clienteId: data.id_cliente,
            clienteNombre: data.clientes?.nombre || 'Cliente Genérico',
            productoTexto: data.producto_texto,
            fecEntrega: data.fec_entrega,
            adelanto: parseFloat(data.adelanto || 0),
            notas: data.notas || '',
            estado: data.estado,
            idUsuario: data.id_usuario,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };

          setPedidos(prev => prev.map(p => p.id === savedObj.id ? savedObj : p));
          toast('📅 Pedido actualizado en la nube');
        } else {
          const { data, error } = await supabase.from('pedidos_reserva').insert({
            id_cliente: pedidoObj.clienteId || null,
            producto_texto: pedidoObj.productoTexto,
            fec_entrega: pedidoObj.fecEntrega,
            adelanto: pedidoObj.adelanto,
            notas: pedidoObj.notas || null,
            estado: pedidoObj.estado || 'Pendiente',
            id_usuario: user?.id
          }).select('*, clientes(nombre)').single();
          if (error) throw error;

          savedObj = {
            id: data.id_pedido,
            clienteId: data.id_cliente,
            clienteNombre: data.clientes?.nombre || 'Cliente Genérico',
            productoTexto: data.producto_texto,
            fecEntrega: data.fec_entrega,
            adelanto: parseFloat(data.adelanto || 0),
            notas: data.notas || '',
            estado: data.estado,
            idUsuario: data.id_usuario,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };

          setPedidos(prev => [...prev.filter(p => p.id !== pedidoObj.id), savedObj]);
          toast('📅 Pedido registrado en la nube');
        }
      } catch (err: any) {
        console.error('Error saving pedido in Supabase', err);
        toast('❌ Error al guardar pedido: ' + err.message);
        const localId = pedidoObj.id || `local_${Date.now()}`;
        const fallbackCli = clients.find(c => String(c.id) === String(pedidoObj.clienteId));
        savedObj = {
          ...pedidoObj,
          id: localId,
          clienteNombre: fallbackCli?.nombre || 'Cliente Genérico',
          estado: pedidoObj.estado || 'Pendiente',
          createdAt: pedidoObj.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setPedidos(prev => {
          const exists = prev.some(p => p.id === localId);
          return exists ? prev.map(p => p.id === localId ? savedObj : p) : [...prev, savedObj];
        });
      }
    } else {
      const localId = pedidoObj.id || `local_${Date.now()}`;
      const fallbackCli = clients.find(c => String(c.id) === String(pedidoObj.clienteId));
      savedObj = {
        ...pedidoObj,
        id: localId,
        clienteNombre: fallbackCli?.nombre || 'Cliente Genérico',
        estado: pedidoObj.estado || 'Pendiente',
        createdAt: pedidoObj.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setPedidos(prev => {
        const exists = prev.some(p => p.id === localId);
        const next = exists ? prev.map(p => p.id === localId ? savedObj : p) : [...prev, savedObj];
        localStorage.setItem('snack_pedidos', JSON.stringify(next));
        return next;
      });
      toast('📅 Pedido guardado localmente');
    }
  };

  /**
   * Actualiza el estado de una reserva/pedido (Pendiente, Listo, Entregado, Cancelado) y 
   * sincroniza el cambio con la base de datos o almacenamiento local.
   * 
   * @param pedidoId ID del pedido a actualizar.
   * @param nuevoEstado El nuevo estado que se le asignará al pedido.
   */
  const updatePedidoStatus = async (pedidoId: number | string, nuevoEstado: 'Pendiente' | 'Listo' | 'Entregado' | 'Cancelado') => {
    setPedidos(prev => {
      const next = prev.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado, updatedAt: new Date().toISOString() } : p);
      localStorage.setItem('snack_pedidos', JSON.stringify(next));
      return next;
    });

    if (isSupabaseConfigured && supabase && !String(pedidoId).startsWith('local_')) {
      try {
        const { error } = await supabase.from('pedidos_reserva').update({
          estado: nuevoEstado,
          updated_at: new Date().toISOString()
        }).eq('id_pedido', pedidoId);
        if (error) throw error;
        toast('📅 Estado del pedido actualizado en la nube');
      } catch (err: any) {
        console.error('Error updating status in Supabase', err);
        toast('❌ Error actualizando estado: ' + err.message);
      }
    } else {
      toast('📅 Estado del pedido actualizado');
    }
  };

  /**
   * Registra una compra de insumos/productos realizada a un proveedor, calculando subtotales,
   * IGV (18%) e incrementando el inventario/stock de los productos correspondientes.
   * 
   * @param pObj Objeto con el ID del proveedor y la lista de ítems comprados (productId, qty, cost, version).
   */
  const registerPurchase = async (pObj: { providerId: number | string; items: PurchaseItem[] }) => {
    const tot = pObj.items.reduce((a, b) => a + (b.qty * b.cost), 0);
    const sub = tot / 1.18;
    const igv = tot - sub;
    const provName = providers.find(p => p.id === pObj.providerId)?.name || 'Proveedor';
    const prodItems = pObj.items.filter(i => i.type !== 'insumo');
    const insItems = pObj.items.filter(i => i.type === 'insumo');

    const appendPurchaseKardex = (purchaseId: string) => {
      const purchaseKardex: BreadLog[] = prodItems.map(item => {
        const prod = products.find(p => p.id === item.productId);
        return {
          id: Date.now() + Math.random(),
          d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          prodName: (prod?.name || 'Producto') + (item.version ? ` (${item.version})` : ''),
          type: 'compra',
          qty: item.qty,
          reason: `Compra a proveedor: ${provName}`,
          cajero: user?.n || 'Sistema',
          ref_id: purchaseId,
        };
      });
      const updLogs2 = [...purchaseKardex, ...breadLogs];
      setBreadLogs(updLogs2);
      saveOffline('snack_bread_logs', updLogs2);
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: cData, error: cError } = await supabase.from('compras').insert({
          id_usuario: user?.id,
          id_proveedor: pObj.providerId,
          sub_total: sub,
          igv,
          tot_pago: tot,
          estado: 1,
        }).select().single();
        if (cError) throw cError;

        if (cData) {
          const detailRows = pObj.items.map(item => {
            if (item.type === 'insumo') {
              return {
                id_compra: cData.id_compra,
                id_producto: null,
                id_insumo: item.insumoId,
                id_version: null,
                num_cantidad: item.qty,
                precio_compra: item.cost,
              };
            }
            const prodRef = products.find(p => p.id === item.productId);
            const vRef = item.version && prodRef
              ? prodRef.versions.find(v => v.name === item.version)
              : null;
            return {
              id_compra: cData.id_compra,
              id_producto: item.productId,
              id_insumo: null,
              id_version: vRef ? vRef.id : null,
              num_cantidad: item.qty,
              precio_compra: item.cost,
            };
          });
          const { error: detError } = await supabase.from('detalle_compra').insert(detailRows);
          if (detError) throw detError;
        }

        const refreshed = await refetchAfterPurchase(supabase);
        setProducts(refreshed.products);
        setInsumos(refreshed.insumos);
        setPurchases(refreshed.purchases);
        appendPurchaseKardex(`COM-${cData?.id_compra ?? Date.now()}`);
        toast('📥 Compra registrada e inventario actualizado');
      } catch (err) {
        console.error('Error al sincronizar compra con Supabase', err);
        toast('❌ Error al registrar la compra en la nube');
      }
      return;
    }

    if (prodItems.length > 0) {
      const updatedProds = products.map(p => {
        const itemsToAdd = prodItems.filter(c => c.productId === p.id);
        if (itemsToAdd.length === 0) return p;

        let newStock = p.stock;
        let newVersions = [...p.versions];

        itemsToAdd.forEach(item => {
          if (item.version) {
            newVersions = newVersions.map(v =>
              v.name === item.version ? { ...v, stock: v.stock + item.qty } : v
            );
          } else {
            newStock += item.qty;
          }
        });

        return { ...p, stock: newStock, versions: newVersions };
      });
      setProducts(updatedProds);
      saveOffline('snack_products', updatedProds);
    }

    if (insItems.length > 0) {
      const updatedInsumos = insumos.map(ins => {
        const itemsToAdd = insItems.filter(item => item.insumoId === ins.id);
        if (itemsToAdd.length === 0) return ins;

        let newStock = ins.stock;
        let newLotes = [...(ins.lotes || [])];

        itemsToAdd.forEach(item => {
          newStock += item.qty;
          newLotes.push({ qty: item.qty, cost: item.cost });
        });

        return {
          ...ins,
          stock: newStock,
          lotes: newLotes,
          costoUnitario: getLotesUnitCost(newLotes),
        };
      });

      setInsumos(updatedInsumos);
      saveOffline('snack_insumos', updatedInsumos);
    }

    const purchaseRec: Purchase = {
      id: `COM-${Date.now()}`,
      d: new Date().toLocaleDateString(),
      prov: provName,
      subTotal: `S/. ${sub.toFixed(2)}`,
      igv: `S/. ${igv.toFixed(2)}`,
      total: `S/. ${tot.toFixed(2)}`,
      items: pObj.items,
    };

    setPurchases([...purchases, purchaseRec]);
    saveOffline('snack_purchases', [...purchases, purchaseRec]);
    appendPurchaseKardex(purchaseRec.id);
    toast('📥 Compra registrada e inventario actualizado');
  };

  const deliverPedido = async (
    pedidoId: number | string,
    paymentMethodId: number,
    paymentMethodName: string,
    totalVal: number,
    adelantoVal: number,
    items: any[]
  ) => {
    if (!cashSession) {
      toast('⚠️ Debe iniciar caja para poder realizar cobros y entregar el pedido.');
      return;
    }

    const saldo = Math.max(0, totalVal - adelantoVal);
    const cartItems = items.map(i => ({
      id: i.productId,
      name: i.name + (i.versionName ? ` (${i.versionName})` : ''),
      price: i.price,
      qty: i.qty,
      version: i.versionName || null,
    }));
    const targetPedido = pedidos.find(p => p.id === pedidoId);

    const appendDeliveryKardex = (saleRef: string, d: string, t: string) => {
      const newKardexEntries = cartItems.map(item => ({
        id: Date.now() + Math.random(),
        d: `${d} ${t}`,
        prodName: item.name,
        type: 'venta' as const,
        qty: item.qty,
        reason: `Entrega Reserva #${pedidoId}`,
        cajero: user?.n || 'Sistema',
        ref_id: saleRef,
      }));
      setBreadLogs(prev => [...newKardexEntries, ...prev]);
      saveOffline('snack_bread_logs', [...newKardexEntries, ...breadLogs]);
    };

    if (isSupabaseConfigured && supabase && !String(pedidoId).startsWith('local_')) {
      try {
        const { error: pedError } = await supabase.from('pedidos_reserva').update({
          estado: 'Entregado',
          updated_at: new Date().toISOString(),
        }).eq('id_pedido', pedidoId);
        if (pedError) throw pedError;

        const sub = totalVal / 1.18;
        const igv = totalVal - sub;
        const { data: vData, error: vError } = await supabase.from('ventas').insert({
          id_cliente: targetPedido?.clienteId || null,
          id_usuario: user?.id,
          id_cierre_caja: cashSession.id,
          id_metodo_pago: paymentMethodId,
          sub_total: sub,
          igv,
          tot_pago: totalVal,
        }).select().single();
        if (vError) throw vError;

        if (vData) {
          const detailRows = cartItems.map(item => {
            const prodRef = products.find(p => p.id === item.id);
            const vRef = item.version && prodRef
              ? prodRef.versions.find(v => v.name === item.version)
              : null;
            return {
              id_venta: vData.id_venta,
              id_producto: item.id,
              id_version: vRef ? vRef.id : null,
              num_cantidad: item.qty,
              precio_unitario: item.price,
            };
          });
          const { error: detError } = await supabase.from('detalle_venta').insert(detailRows);
          if (detError) throw detError;
        }

        if (saldo > 0) {
          const isEfectivo = paymentMethodName.toLowerCase().includes('efectivo');
          const updatedSession = {
            ...cashSession,
            tot_ventas_efectivo: cashSession.tot_ventas_efectivo + (isEfectivo ? saldo : 0),
            tot_ventas_otros: cashSession.tot_ventas_otros + (!isEfectivo ? saldo : 0),
          };
          const { error: cashError } = await supabase.from('cierres_caja').update({
            tot_ventas_efectivo: updatedSession.tot_ventas_efectivo,
            tot_ventas_otros: updatedSession.tot_ventas_otros,
          }).eq('id_cierre_caja', cashSession.id);
          if (cashError) throw cashError;
        }

        const [refreshed, refreshedPedidos] = await Promise.all([
          refetchAfterSale(supabase, cashSession.id),
          fetchPedidos(supabase),
        ]);
        setProducts(refreshed.products);
        setSales(refreshed.sales);
        if (refreshed.cashSession) setCashSession(refreshed.cashSession);
        setPedidos(refreshedPedidos);

        const savedSale = vData
          ? refreshed.sales.find(s => s.id === vData.id_venta)
          : undefined;
        const d = savedSale?.d ?? new Date().toLocaleDateString();
        const t = savedSale?.t ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        appendDeliveryKardex(`VTA-${vData?.id_venta ?? Date.now()}`, d, t);
        toast('✅ Reserva entregada y venta registrada correctamente en la nube');
      } catch (err: any) {
        console.error('Error delivering order in Supabase', err);
        toast(`❌ Error al entregar reserva: ${err.message || err}`);
      }
      return;
    }

    const updatedProds = products.map(p => {
      const itemsToDeduct = items.filter(c => c.productId === p.id);
      if (itemsToDeduct.length === 0) return p;

      let newStock = p.stock;
      let newVersions = [...p.versions];

      itemsToDeduct.forEach(item => {
        if (item.versionName) {
          newVersions = newVersions.map(v =>
            v.name === item.versionName ? { ...v, stock: v.stock - item.qty } : v
          );
        } else {
          newStock -= item.qty;
        }
      });

      return { ...p, stock: newStock, versions: newVersions };
    });

    setProducts(updatedProds);
    saveOffline('snack_products', updatedProds);

    if (saldo > 0) {
      const isEfectivo = paymentMethodName.toLowerCase().includes('efectivo');
      const updatedSession = {
        ...cashSession,
        tot_ventas_efectivo: cashSession.tot_ventas_efectivo + (isEfectivo ? saldo : 0),
        tot_ventas_otros: cashSession.tot_ventas_otros + (!isEfectivo ? saldo : 0),
      };
      setCashSession(updatedSession);
      saveOffline('snack_session', updatedSession);
    }

    const saleObj: Sale = {
      id: Date.now(),
      n: sales.length + 501,
      items: cartItems,
      total: totalVal,
      method: `Reserva - Saldo via ${paymentMethodName}`,
      methodId: paymentMethodId,
      d: new Date().toLocaleDateString(),
      t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cajero: user ? user.n : 'Sistema',
      clienteId: targetPedido?.clienteId || undefined,
      clienteNombre: targetPedido?.clienteNombre || undefined,
    };

    setSales([...sales, saleObj]);
    saveOffline('snack_sales', [...sales, saleObj]);

    setPedidos(prev => {
      const next = prev.map(p =>
        p.id === pedidoId ? { ...p, estado: 'Entregado' as const, updatedAt: new Date().toISOString() } : p
      );
      localStorage.setItem('snack_pedidos', JSON.stringify(next));
      return next;
    });

    appendDeliveryKardex(`VTA-${saleObj.id}`, saleObj.d, saleObj.t);
    toast('✅ Reserva entregada y venta registrada localmente');
  };

  return {
    savePedido,
    updatePedidoStatus,
    deliverPedido,
    registerPurchase
  };
}
