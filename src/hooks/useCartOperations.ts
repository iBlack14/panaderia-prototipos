import React from 'react';
import { CartItem, Product, ProductVersion, Sale, PaymentMethod, CashSession, Client, BreadLog, User, CreditPayment } from '@/context/types';
import { refetchAfterSale } from '@/lib/supabase/queries/reloadEntity';

interface CartOpsParams {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  paymentMethods: PaymentMethod[];
  setPaymentMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
  cashSession: CashSession | null;
  setCashSession: React.Dispatch<React.SetStateAction<CashSession | null>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  breadLogs: BreadLog[];
  setBreadLogs: React.Dispatch<React.SetStateAction<BreadLog[]>>;
  user: User | null;
  toast: (msg: string) => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  saveOffline: (key: string, data: any) => void;
}

export function useCartOperations({
  cart,
  setCart,
  products,
  setProducts,
  sales,
  setSales,
  paymentMethods,
  setPaymentMethods,
  cashSession,
  setCashSession,
  clients,
  setClients,
  breadLogs,
  setBreadLogs,
  user,
  toast,
  isSupabaseConfigured,
  supabase,
  saveOffline
}: CartOpsParams) {

  const addToCart = (productName: string, price: number, id: number, versionObj: ProductVersion | null = null, customQty?: number) => {
    if (!cashSession) {
      toast('⚠️ Debe iniciar caja para realizar ventas.');
      return;
    }

    const prod = products.find(x => x.id === id);
    if (!prod) return;

    const qtyToAdd = customQty !== undefined ? customQty : 1;

    if (versionObj) {
      const cartId = `${id}-${versionObj.name}`;
      const existing = cart.find(x => x.cartId === cartId);
      
      if (existing) {
        if (existing.qty + qtyToAdd > versionObj.stock) {
          toast('⚠️ Sin existencias adicionales');
          return;
        }
        setCart(cart.map(x => x.cartId === cartId ? { ...x, qty: x.qty + qtyToAdd } : x));
      } else {
        if (versionObj.stock <= 0) {
          toast('⚠️ Variante agotada');
          return;
        }
        if (qtyToAdd > versionObj.stock) {
          toast('⚠️ Cantidad supera el stock disponible');
          return;
        }
        setCart([...cart, { cartId, id, name: `${prod.name} (${versionObj.name})`, price: versionObj.price, qty: qtyToAdd, version: versionObj.name }]);
      }
    } else {
      if (prod.stock <= 0) {
        toast('⚠️ Producto agotado');
        return;
      }
      const existing = cart.find(x => x.id === id && !x.version);
      if (existing) {
        if (existing.qty + qtyToAdd > prod.stock) {
          toast('⚠️ Sin existencias adicionales');
          return;
        }
        setCart(cart.map(x => (x.id === id && !x.version) ? { ...x, qty: x.qty + qtyToAdd } : x));
      } else {
        if (qtyToAdd > prod.stock) {
          toast('⚠️ Cantidad supera el stock disponible');
          return;
        }
        setCart([...cart, { id, name: prod.name, price, qty: qtyToAdd, version: null }]);
      }
    }
    toast('🥐 Añadido al carrito');
  };

  const updateCartQty = (id: number, delta: number, version: string | null = null) => {
    const cartId = version ? `${id}-${version}` : null;
    const item = cart.find(x => version ? x.cartId === cartId : (x.id === id && !x.version));
    if (!item) return;

    const prod = products.find(p => p.id === id);
    if (!prod) return;

    if (delta > 0) {
      if (version) {
        const vObj = prod.versions.find(v => v.name === version);
        if (vObj && item.qty >= vObj.stock) return;
      } else {
        if (item.qty >= prod.stock) return;
      }
    }

    const updated = cart.map(x => {
      const match = version ? x.cartId === cartId : (x.id === id && !x.version);
      if (match) {
        return { ...x, qty: x.qty + delta };
      }
      return x;
    }).filter(x => x.qty > 0);

    setCart(updated);
  };

  const clearCart = () => setCart([]);

  const checkoutCart = async (paymentMethodId: number, clienteId?: number | string): Promise<Sale | undefined> => {
    if (cart.length === 0) return;
    
    let activeSession = cashSession;
    const isAdmin = user?.rs?.includes('Administrador');

    if (!activeSession) {
      if (isAdmin) {
        const newSession: CashSession = {
          id: Date.now(),
          fec_apertura: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString(),
          tot_saldo_inicial: 0,
          tot_ventas_efectivo: 0,
          tot_ventas_otros: 0,
          tot_retiros: 0,
          estado: 'abierto',
          cajero: user ? user.n : 'Administrador',
          turno: 'Administrativo'
        };
        setCashSession(newSession);
        saveOffline('snack_session', newSession);
        
        if (isSupabaseConfigured && supabase) {
          try {
            const { data } = await supabase.from('cierres_caja').insert({
              id_usuario: user?.id,
              tot_saldo_inicial: 0,
              estado: 'abierto'
            }).select().single();
            if (data) {
              newSession.id = data.id_cierre_caja;
              setCashSession(newSession);
            }
          } catch (err) {
            console.error('Error al auto-abrir caja administrativa', err);
          }
        }
        activeSession = newSession;
        toast('💼 Turno Administrativo auto-inicializado para esta venta.');
      } else {
        toast('⚠️ Debe iniciar caja para realizar ventas.');
        return;
      }
    }

    const sub = cart.reduce((a, b) => a + (b.price * b.qty), 0);
    const igv = sub * 0.18;
    const tot = sub + igv;
    
    const pm = paymentMethods.find(m => m.id === paymentMethodId) || { name: 'Efectivo' };
    const methodStr = pm.name;

    const isPrepago = paymentMethodId === 999;
    const clienteObj = clienteId ? clients.find(c => String(c.id) === String(clienteId)) : null;

    if (isPrepago && clienteObj && tot > clienteObj.saldoCred) {
      toast(`⚠️ Saldo prepago insuficiente. Disponible: S/. ${clienteObj.saldoCred.toFixed(2)}`);
      return;
    }

    const applyLocalStockDeduction = (prods: Product[]) =>
      prods.map(p => {
        const itemsToDeduct = cart.filter(c => c.id === p.id);
        if (itemsToDeduct.length === 0) return p;

        let newStock = p.stock;
        let newVersions = [...p.versions];

        itemsToDeduct.forEach(item => {
          if (item.version) {
            newVersions = newVersions.map(v =>
              v.name === item.version ? { ...v, stock: v.stock - item.qty } : v
            );
          } else {
            newStock -= item.qty;
          }
        });

        return { ...p, stock: newStock, versions: newVersions };
      });

    const isEfectivo = methodStr.toLowerCase().includes('efectivo');
    const updatedSession = {
      ...activeSession,
      tot_ventas_efectivo: activeSession.tot_ventas_efectivo + (isEfectivo ? tot : 0),
      tot_ventas_otros: activeSession.tot_ventas_otros + (!isEfectivo ? tot : 0),
    };

    let updClients = clients;
    let nuevoPago: CreditPayment | null = null;
    let newSaldo = 0;
    let newHistorial: CreditPayment[] = [];
    if (isPrepago && clienteObj) {
      nuevoPago = { id: Date.now(), fecha: new Date().toLocaleDateString(), concepto: `Consumo Prepago — ${cart.map(i => i.name).join(', ')}`, monto: tot, tipo: 'cargo' };
      newSaldo = clienteObj.saldoCred - tot;
      newHistorial = [...clienteObj.historialPagos, nuevoPago];
      updClients = clients.map(c => String(c.id) === String(clienteId) ? { ...c, saldoCred: newSaldo, historialPagos: newHistorial } : c);
    }

    const saleObj: Sale = {
      id: Date.now(),
      n: sales.length + 501,
      items: [...cart],
      total: tot,
      method: isPrepago ? `Prepago${clienteObj ? ' — ' + clienteObj.nombre : ''}` : methodStr,
      methodId: paymentMethodId,
      d: new Date().toLocaleDateString(),
      t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cajero: user ? user.n : 'Carlos Mendoza',
      clienteId: clienteId || undefined,
      clienteNombre: clienteObj?.nombre || undefined
    };

    const newSales = [...sales, saleObj];

    const saleRef = `VTA-${saleObj.id}`;
    const newKardexEntries: BreadLog[] = cart.map(item => ({
      id: Date.now() + Math.random(),
      d: `${saleObj.d} ${saleObj.t}`,
      prodName: item.name,
      type: 'venta',
      qty: item.qty,
      reason: `Venta POS #${saleObj.n}`,
      cajero: user?.n || 'Sistema',
      ref_id: saleRef
    }));
    const updLogs = [...newKardexEntries, ...breadLogs];

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Si es prepago, actualiza saldo de cliente en Supabase
        if (isPrepago && clienteObj) {
          const { error: cliError } = await supabase.from('clientes').update({
            saldo_credito: newSaldo,
            historial_pagos: newHistorial
          }).eq('id_cliente', clienteId);
          if (cliError) throw cliError;
        }

        // 2. Inserta cabecera de la venta en Supabase
        const { data: vData, error: vError } = await supabase.from('ventas').insert({
          id_cliente: clienteId || null,
          id_usuario: user?.id,
          id_cierre_caja: activeSession.id,
          id_metodo_pago: paymentMethodId,
          sub_total: sub,
          igv,
          tot_pago: tot
        }).select().single();

        if (vError) throw vError;

        // 3. Inserta detalles de la venta
        if (vData) {
          const detailRows = cart.map(item => {
            const prodRef = products.find(p => p.id === item.id);
            const vRef = (item.version && prodRef) ? prodRef.versions.find(v => v.name === item.version) : null;
            return {
              id_venta: vData.id_venta,
              id_producto: item.id,
              id_version: vRef ? vRef.id : null,
              num_cantidad: item.qty,
              precio_unitario: item.price
            };
          });
          const { error: detError } = await supabase.from('detalle_venta').insert(detailRows);
          if (detError) throw detError;
        }

        // 4. Actualizar saldos de cierres_caja en Supabase
        const { error: cashError } = await supabase.from('cierres_caja').update({
          tot_ventas_efectivo: updatedSession.tot_ventas_efectivo,
          tot_ventas_otros: updatedSession.tot_ventas_otros
        }).eq('id_cierre_caja', activeSession.id);
        if (cashError) throw cashError;

        // Stock lo descuentan los triggers SQL — refetch desde BD como fuente de verdad
        const refreshed = await refetchAfterSale(
          supabase,
          activeSession.id,
          isPrepago && !!clienteObj
        );
        setProducts(refreshed.products);
        if (refreshed.cashSession) setCashSession(refreshed.cashSession);
        setSales(refreshed.sales);
        if (refreshed.clients) setClients(refreshed.clients);

        setBreadLogs(updLogs);

        setCart([]);
        toast('✅ Venta registrada correctamente');

        const savedSale = vData
          ? refreshed.sales.find(s => s.id === vData.id_venta)
          : undefined;
        return savedSale ?? { ...saleObj, id: vData?.id_venta ?? saleObj.id, n: vData?.id_venta ?? saleObj.n };

      } catch (err: any) {
        console.error('Error al sincronizar venta con Supabase', err);
        toast(`❌ Error en la nube: ${err.message || err}`);
        return undefined;
      }
    } else {
      const updatedProds = applyLocalStockDeduction(products);
      setProducts(updatedProds);
      saveOffline('snack_products', updatedProds);

      setCashSession(updatedSession);
      saveOffline('snack_session', updatedSession);

      if (isPrepago && clienteObj) {
        setClients(updClients);
        saveOffline('snack_clients', updClients);
      }

      setSales(newSales);
      saveOffline('snack_sales', newSales);

      setBreadLogs(updLogs);
      saveOffline('snack_bread_logs', updLogs);

      setCart([]);
      toast('✅ Venta registrada correctamente');
      return saleObj;
    }
  };

  const savePaymentMethod = async (mObj: any) => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (mObj.id) {
          await supabase.from('metodos_pago').update({
            tipo_pago: mObj.name,
            estado: mObj.active !== false ? 1 : 0
          }).eq('id_metodo_pago', mObj.id);
          toast('💳 Método de pago actualizado en la nube');
        } else {
          await supabase.from('metodos_pago').insert({
            tipo_pago: mObj.name,
            estado: 1
          });
          toast('💳 Nuevo método de pago registrado en la nube');
        }
        
        const { data } = await supabase.from('metodos_pago').select('*');
        if (data) {
          setPaymentMethods((data as any[]).map(pm => ({
            id: pm.id_metodo_pago,
            name: pm.tipo_pago,
            desc: 'Método configurado en la nube',
            active: pm.estado === 1
          })));
        }
      } catch (err: any) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      if (mObj.id) {
        updated = paymentMethods.map(m => m.id === mObj.id ? { ...m, ...mObj } : m);
        toast('💳 Método de pago actualizado');
      } else {
        const newMethod = { ...mObj, id: Date.now(), active: true };
        updated = [...paymentMethods, newMethod];
        toast('💳 Nuevo método de pago registrado');
      }
      setPaymentMethods(updated);
      saveOffline('snack_methods', updated);
    }
  };

  const togglePaymentMethod = async (id: number) => {
    const method = paymentMethods.find(m => m.id === id);
    if (!method) return;
    const newActive = !method.active;
    const updated = paymentMethods.map(m => m.id === id ? { ...m, active: newActive } : m);
    setPaymentMethods(updated);
    saveOffline('snack_methods', updated);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('metodos_pago').update({ estado: newActive ? 1 : 0 }).eq('id_metodo_pago', id);
        toast('💳 Estado del método de pago actualizado en la nube');
      } catch (err: any) {
        toast(`❌ Error actualizando método de pago: ${err.message}`);
      }
    } else {
      toast('💳 Estado del método de pago actualizado');
    }
  };

  return {
    addToCart,
    updateCartQty,
    clearCart,
    checkoutCart,
    savePaymentMethod,
    togglePaymentMethod
  };
}
