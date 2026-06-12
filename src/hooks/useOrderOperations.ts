import React from 'react';
import { Pedido, ReturnRecord, Purchase, Sale, Product, Client, Provider, BreadLog, User, ReturnedItem, PurchaseItem, CreditPayment } from '@/context/types';

interface OrderOpsParams {
  pedidos: Pedido[];
  setPedidos: React.Dispatch<React.SetStateAction<Pedido[]>>;
  devoluciones: ReturnRecord[];
  setDevoluciones: React.Dispatch<React.SetStateAction<ReturnRecord[]>>;
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
  user: User | null;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
}

/**
 * Hook personalizado que encapsula las operaciones relacionadas con la gestión de pedidos,
 * reservas, compras a proveedores y procesamiento de devoluciones de productos.
 * 
 * @param params Parámetros de estado y funciones utilitarias necesarias para operar.
 * @returns Funciones operativas para guardar pedidos, actualizar estados, registrar compras y devoluciones.
 */
export function useOrderOperations({
  pedidos,
  setPedidos,
  devoluciones,
  setDevoluciones,
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
  user,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline
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
    const sub = pObj.items.reduce((a, b) => a + (b.qty * b.cost), 0);
    const igv = sub * 0.18;
    const tot = sub + igv;
    const provName = providers.find(p => p.id === pObj.providerId)?.name || 'Proveedor';

    const updatedProds = products.map(p => {
      const itemsToAdd = pObj.items.filter(c => c.productId === p.id);
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

    const purchaseRec: Purchase = {
      id: `COM-${Date.now()}`,
      d: new Date().toLocaleDateString(),
      prov: provName,
      subTotal: `S/. ${sub.toFixed(2)}`,
      igv: `S/. ${igv.toFixed(2)}`,
      total: `S/. ${tot.toFixed(2)}`,
      items: pObj.items
    };

    const newPurchases = [...purchases, purchaseRec];
    setPurchases(newPurchases);
    saveOffline('snack_purchases', newPurchases);

    const purchaseKardex: BreadLog[] = pObj.items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return {
        id: Date.now() + Math.random(),
        d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        prodName: (prod?.name || 'Producto') + (item.version ? ` (${item.version})` : ''),
        type: 'compra',
        qty: item.qty,
        reason: `Compra a proveedor: ${provName}`,
        cajero: user?.n || 'Sistema',
        ref_id: purchaseRec.id
      };
    });
    const updLogs2 = [...purchaseKardex, ...breadLogs];
    setBreadLogs(updLogs2);
    saveOffline('snack_bread_logs', updLogs2);

    toast('📥 Compra registrada e inventario actualizado');

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: cData } = await supabase.from('compras').insert({
          id_usuario: user?.id,
          id_proveedor: pObj.providerId,
          sub_total: sub,
          igv,
          tot_pago: tot,
          estado: 1
        }).select().single();

        if (cData) {
          const detailRows = pObj.items.map(item => {
            const prodRef = products.find(p => p.id === item.productId);
            const vRef = (item.version && prodRef) ? prodRef.versions.find(v => v.name === item.version) : null;
            return {
              id_compra: cData.id_compra,
              id_producto: item.productId,
              id_version: vRef ? vRef.id : null,
              num_cantidad: item.qty,
              precio_compra: item.cost
            };
          });
          await supabase.from('detalle_compra').insert(detailRows);
        }
      } catch (err) {
        console.error('Error al sincronizar compra con Supabase', err);
      }
    }
  };

  /**
   * Procesa la devolución de productos de una venta realizada, devolviendo el stock al inventario,
   * actualizando el saldo de crédito del cliente si aplica y registrando la transacción.
   * 
   * @param saleId ID de la venta original asociada a la devolución.
   * @param items Lista de productos y cantidades a devolver.
   * @param motivo Explicación/razón por la cual se devuelve la mercancía.
   */
  const processReturn = async (saleId: number, items: ReturnedItem[], motivo: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) {
      toast('❌ No se encontró la venta especificada');
      return;
    }

    const totalReturned = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const updatedProducts = products.map(p => {
      const returns = items.filter(r => r.productId === p.id);
      if (returns.length === 0) return p;

      let newStock = p.stock;
      let newVersions = [...p.versions];

      returns.forEach(ret => {
        if (ret.version) {
          newVersions = newVersions.map(v => v.name === ret.version ? { ...v, stock: v.stock + ret.qty } : v);
        } else {
          newStock += ret.qty;
        }
      });

      return { ...p, stock: newStock, versions: newVersions };
    });

    setProducts(updatedProducts);
    saveOffline('snack_products', updatedProducts);

    const saleTotalQty = sale.items.reduce((sum, i) => sum + i.qty, 0);
    const pastReturns = devoluciones.filter(r => r.saleId === saleId);
    const pastReturnedQty = pastReturns.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.qty, 0), 0);
    const thisReturnQty = items.reduce((sum, i) => sum + i.qty, 0);
    const isTotalReturn = (pastReturnedQty + thisReturnQty) >= saleTotalQty;

    setSales(prev => prev.map(s => s.id === saleId ? { ...s, estado: isTotalReturn ? 0 : s.estado } : s));
    
    const localSales = localStorage.getItem('snack_sales');
    if (localSales) {
      try {
        const parsed = JSON.parse(localSales);
        const updated = (parsed as Sale[]).map(s => s.id === saleId ? { ...s, estado: isTotalReturn ? 0 : s.estado } : s);
        localStorage.setItem('snack_sales', JSON.stringify(updated));
      } catch(e) {}
    }

    if (sale.clienteId) {
      const client = clients.find(c => String(c.id) === String(sale.clienteId));
      if (client) {
        const creditBack = totalReturned;
        const newSaldo = Math.max(0, client.saldoCred - creditBack);
        const newPayment: CreditPayment = {
          id: Date.now(),
          fecha: new Date().toLocaleDateString(),
          concepto: `Devolución venta #B-${sale.n} (Nota de Crédito)`,
          monto: creditBack,
          tipo: 'abono'
        };
        const newHistorial = [...client.historialPagos, newPayment];

        setClients(prev => prev.map(c => String(c.id) === String(sale.clienteId) ? { ...c, saldoCred: newSaldo, historialPagos: newHistorial } : c));
        
        const localClients = localStorage.getItem('snack_clients');
        if (localClients) {
          try {
            const parsed = JSON.parse(localClients);
            const updated = (parsed as Client[]).map(c => String(c.id) === String(sale.clienteId) ? { ...c, saldoCred: newSaldo, historialPagos: newHistorial } : c);
            localStorage.setItem('snack_clients', JSON.stringify(updated));
          } catch(e) {}
        }

        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('clientes').update({
              saldo_credito: newSaldo,
              historial_pagos: newHistorial
            }).eq('id_cliente', sale.clienteId);
          } catch (err) {
            console.error('Error al actualizar saldo de cliente en Supabase', err);
          }
        }
      }
    }

    const returnRec: ReturnRecord = {
      id: `RET-${Date.now()}`,
      saleId,
      clienteId: sale.clienteId,
      clienteNombre: sale.clienteNombre,
      motivo,
      totalReturned,
      cajero: user?.n || 'Sistema',
      date: new Date().toLocaleDateString(),
      items
    };

    const nextDevoluciones = [returnRec, ...devoluciones];
    setDevoluciones(nextDevoluciones);
    localStorage.setItem('snack_devoluciones', JSON.stringify(nextDevoluciones));

    const returnRef = `RET-${returnRec.id}`;
    const newKardexEntries: BreadLog[] = items.map(item => ({
      id: Date.now() + Math.random(),
      d: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      prodName: products.find(p => p.id === item.productId)?.name || `Prod #${item.productId}`,
      type: 'conversion',
      qty: item.qty,
      reason: `Devolución Venta #${sale.n}: ${motivo}`,
      cajero: user?.n || 'Sistema',
      ref_id: returnRef
    }));
    setBreadLogs(prev => [...newKardexEntries, ...prev]);
    const localBreadLogs = localStorage.getItem('snack_bread_logs');
    if (localBreadLogs) {
      try {
        const parsed = JSON.parse(localBreadLogs);
        localStorage.setItem('snack_bread_logs', JSON.stringify([...newKardexEntries, ...parsed]));
      } catch(e) {}
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: retData, error: retErr } = await supabase.from('devoluciones').insert({
          id_venta: saleId,
          id_cliente: sale.clienteId || null,
          motivo,
          total_devuelto: totalReturned,
          id_usuario: user?.id
        }).select().single();

        if (retErr) throw retErr;

        if (retData) {
          const detailRows = items.map(item => {
            const prodRef = products.find(p => p.id === item.productId);
            const vRef = (item.version && prodRef) ? prodRef.versions.find(v => v.name === item.version) : null;
            return {
              id_devolucion: retData.id_devolucion,
              id_producto: item.productId,
              id_version: vRef ? vRef.id : null,
              num_cantidad: item.qty,
              precio_unitario: item.price
            };
          });
          const { error: detErr } = await supabase.from('detalle_devolucion').insert(detailRows);
          if (detErr) throw detErr;
        }

        for (const item of items) {
          const prodRef = products.find(p => p.id === item.productId);
          const vRef = (item.version && prodRef) ? prodRef.versions.find(v => v.name === item.version) : null;

          if (vRef) {
            const { data: currentVersion } = await supabase.from('producto_versiones').select('num_stock').eq('id_version', vRef.id).single();
            const currentStock = currentVersion ? currentVersion.num_stock : 0;
            await supabase.from('producto_versiones').update({ num_stock: currentStock + item.qty }).eq('id_version', vRef.id);
          } else {
            const { data: currentProd } = await supabase.from('productos').select('num_stock').eq('id_producto', item.productId).single();
            const currentStock = currentProd ? currentProd.num_stock : 0;
            await supabase.from('productos').update({ num_stock: currentStock + item.qty }).eq('id_producto', item.productId);
          }
        }

        if (isTotalReturn) {
          await supabase.from('ventas').update({ estado: 0 }).eq('id_venta', saleId);
        }

        toast('↩ Devolución sincronizada con éxito en la nube');
      } catch (err: any) {
        console.error('Error syncing return to Supabase', err);
        toast('⚠️ Devolución guardada localmente (error al sincronizar en la nube)');
      }
    } else {
      toast('↩ Devolución registrada correctamente localmente');
    }
  };

  return {
    savePedido,
    updatePedidoStatus,
    registerPurchase,
    processReturn
  };
}
