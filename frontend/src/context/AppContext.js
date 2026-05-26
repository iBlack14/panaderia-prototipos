"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const AppContext = createContext();

// --- SEED DATA FALLBACKS ---
const DEFAULT_PRODUCTS = [
  { id: 101, name: 'Croissant mantequilla', cat: 'Panes', price: 4.50, stock: 48, em: '🥐', versions: [] },
  { id: 102, name: 'Pan de yema especial', cat: 'Panes', price: 1.80, stock: 74, em: '🍞', versions: [] },
  { id: 103, name: 'Torta de chocolate', cat: 'Tortas', price: 45.00, stock: 8, em: '🎂', versions: [] },
  { id: 104, name: 'Empanada de pollo', cat: 'Panes', price: 3.50, stock: 32, em: '🫓', versions: [] },
  { id: 105, name: 'Alfajor triple', cat: 'Dulces', price: 2.80, stock: 40, em: '🍪', versions: [] },
  { id: 106, name: 'Queque de zanahoria', cat: 'Tortas', price: 28.00, stock: 6, em: '🍰', versions: [] },
  { id: 107, name: 'Pan integral', cat: 'Panes', price: 5.50, stock: 20, em: '🌾', versions: [] },
  { id: 108, name: 'Café americano', cat: 'Bebidas', price: 6.00, stock: 99, em: '☕', versions: [] },
  { id: 109, name: 'Bizcocho vainilla', cat: 'Dulces', price: 1.50, stock: 3, em: '🧁', versions: [] },
  { id: 110, name: 'Tarta de fresa', cat: 'Tortas', price: 38.00, stock: 5, em: '🍓', versions: [] },
  { id: 111, name: 'Pan campesino', cat: 'Panes', price: 3.80, stock: 0, em: '🥙', versions: [] },
  { id: 112, name: 'Chocolate caliente', cat: 'Bebidas', price: 7.50, stock: 99, em: '🍫', versions: [] },
];

const DEFAULT_USERS = [
  { id: 1, u: 'admin', p: '1234', n: 'Ana Rodríguez', rs: ['Administrador'], st: 'act', email: 'admin@snackroque.com', phone: '987654321' },
  { id: 2, u: 'carlos', p: '1234', n: 'Carlos Mendoza', rs: ['Cajero'], st: 'act', email: 'carlos@snackroque.com', phone: '987112233' },
  { id: 3, u: 'maria', p: '1234', n: 'María Sánchez', rs: ['Cajero'], st: 'act', email: 'maria@snackroque.com', phone: '987445566' },
  { id: 4, u: 'pedro', p: '1234', n: 'Pedro Castillo', rs: ['Administrador', 'Cajero'], st: 'ina', email: 'pedro@snackroque.com', phone: '987778899' },
];

const DEFAULT_PAYMENT_METHODS = [
  { id: 1, name: 'Efectivo', desc: 'Pago tradicional en caja', active: true },
  { id: 2, name: 'Yape', desc: 'Pago QR digital BCP', active: true },
  { id: 3, name: 'Plin', desc: 'Pago QR digital Interbank/BBVA', active: true },
  { id: 4, name: 'Tarjeta Crédito/Débito', desc: 'Terminal POS Visa/Mastercard', active: true }
];

const DEFAULT_PROVIDERS = [
  { id: 1, ruc: '20123456789', name: 'Harinas S.A.', phone: '987654321', address: 'Av. Trigo 123', active: true },
  { id: 2, ruc: '20987654321', name: 'Distribuidora Dulce', phone: '912345678', address: 'Calle Azucar 456', active: true }
];

export function AppProvider({ children }) {
  // --- STATE VARIABLES ---
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [providers, setProviders] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cart, setCart] = useState([]);
  
  const [cashSession, setCashSession] = useState(null);
  const [cashHistory, setCashHistory] = useState([]);
  const [breadLogs, setBreadLogs] = useState([]);

  const [toastMsg, setToastMsg] = useState('');

  // --- SHOW TOAST HELPER ---
  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // --- INITIAL LOAD ---
  useEffect(() => {
    // Proactively clean obsolete localStorage keys from old prototypes to avoid conflicts
    const cleaned = localStorage.getItem('snack_ls_cleaned');
    if (!cleaned) {
      localStorage.clear();
      localStorage.setItem('snack_ls_cleaned', 'true');
      console.log('🧹 LocalStorage limpiado con éxito para evitar conflictos.');
    }

    async function loadData() {
      setLoading(true);
      if (isSupabaseConfigured && supabase) {
        try {
          // --- CARGAR DESDE SUPABASE ---
          console.log('⚡ Cargando datos desde Supabase...');
          
          // 1. Productos
          const { data: prods } = await supabase.from('productos').select('*, producto_versiones(*)').eq('estado', 1);
          if (prods) {
            setProducts(prods.map(p => ({
              id: p.id_producto,
              name: p.nombre,
              cat: p.id_categoria === 1 ? 'Panes' : p.id_categoria === 2 ? 'Tortas' : p.id_categoria === 3 ? 'Dulces' : 'Bebidas',
              price: parseFloat(p.precio_unitario),
              stock: p.num_stock,
              em: p.em,
              versions: p.producto_versiones ? p.producto_versiones.map(v => ({
                id: v.id_version,
                name: v.nombre_version,
                price: parseFloat(v.precio_unitario),
                stock: v.num_stock
              })) : []
            })));
          }

          // 2. Proveedores
          const { data: provs } = await supabase.from('proveedores').select('*');
          if (provs) {
            setProviders(provs.map(pr => ({
              id: pr.id_proveedor,
              ruc: pr.ruc,
              name: pr.nombre_empresa,
              phone: pr.num_telefono,
              address: pr.direccion,
              active: pr.estado === 1
            })));
          }

          // 3. Métodos de Pago
          const { data: paym } = await supabase.from('metodos_pago').select('*');
          if (paym) {
            setPaymentMethods(paym.map(pm => ({
              id: pm.id_metodo_pago,
              name: pm.tipo_pago,
              desc: 'Método configurado en la nube',
              active: pm.estado === 1
            })));
          }

          // 4. Sesión de Caja Activa
          const { data: ses } = await supabase.from('cierres_caja').select('*').eq('estado', 'abierto').limit(1);
          if (ses && ses.length > 0) {
            setCashSession({
              id: ses[0].id_cierre_caja,
              fec_apertura: new Date(ses[0].fec_apertura),
              tot_saldo_inicial: parseFloat(ses[0].tot_saldo_inicial),
              tot_ventas_efectivo: parseFloat(ses[0].tot_ventas_efectivo),
              tot_ventas_otros: parseFloat(ses[0].tot_ventas_otros),
              estado: 'abierto'
            });
          }

          // 5. Historial de Cajas
          const { data: cashHist } = await supabase.from('cierres_caja').select('*').eq('estado', 'cerrado').order('fec_cierre', { ascending: false });
          if (cashHist) {
            setCashHistory(cashHist.map(h => ({
              id: h.id_cierre_caja,
              fec_apertura: new Date(h.fec_apertura).toLocaleDateString(),
              fec_cierre: new Date(h.fec_cierre).toLocaleDateString(),
              monto_inicial: parseFloat(h.tot_saldo_inicial),
              monto_final: parseFloat(h.tot_saldo_final),
              ventas_efectivo: parseFloat(h.tot_ventas_efectivo),
              ventas_otros: parseFloat(h.tot_ventas_otros),
              estado: 'cerrado'
            })));
          }
          
        } catch (err) {
          console.error('Error cargando datos de Supabase', err);
        }
      } else {
        // --- CARGAR DESDE LOCALSTORAGE (MODO OFFLINE) ---
        console.log('🔌 Modo Offline: Cargando desde LocalStorage...');
        const localProds = localStorage.getItem('snack_products');
        const localUsers = localStorage.getItem('snack_users');
        const localProviders = localStorage.getItem('snack_providers');
        const localMethods = localStorage.getItem('snack_methods');
        const localSales = localStorage.getItem('snack_sales');
        const localPurchases = localStorage.getItem('snack_purchases');
        const localSession = localStorage.getItem('snack_session');
        const localCashHist = localStorage.getItem('snack_cash_history');
        const localBreadLogs = localStorage.getItem('snack_bread_logs');

        setProducts(localProds ? JSON.parse(localProds) : DEFAULT_PRODUCTS);
        setUsersList(localUsers ? JSON.parse(localUsers) : DEFAULT_USERS);
        setProviders(localProviders ? JSON.parse(localProviders) : DEFAULT_PROVIDERS);
        setPaymentMethods(localMethods ? JSON.parse(localMethods) : DEFAULT_PAYMENT_METHODS);
        setSales(localSales ? JSON.parse(localSales) : []);
        setPurchases(localPurchases ? JSON.parse(localPurchases) : []);
        setCashSession(localSession ? JSON.parse(localSession) : null);
        setCashHistory(localCashHist ? JSON.parse(localCashHist) : []);
        setBreadLogs(localBreadLogs ? JSON.parse(localBreadLogs) : []);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // --- SAVE LOCALSTORAGE HELPER ---
  const saveOffline = (key, data) => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  // --- AUTH OPERATIONS ---
  const login = async (uIn, pIn) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: uIn.includes('@') ? uIn : `${uIn}@snackroque.com`,
          password: pIn,
        });
        if (error) throw error;
        
        // Obtener perfil asociado
        const { data: prof } = await supabase.from('profiles').select('*, roles(nombre)').eq('id', data.user.id).single();
        if (prof) {
          const userObj = {
            id: prof.id,
            u: prof.username,
            n: prof.nombre + ' ' + prof.apellido_paterno,
            rs: [prof.roles.nombre],
            email: prof.correo,
            phone: prof.num_telefono,
            st: prof.estado
          };
          setUser(userObj);
          setRole(prof.roles.nombre);
          toast(`✨ ¡Bienvenido, ${prof.nombre}!`);
          return { success: true, user: userObj };
        }
      } catch (err) {
        toast(`❌ Error de login: ${err.message}`);
        return { success: false, message: err.message };
      }
    } else {
      // Login offline
      const found = usersList.find(x => x.u === uIn && x.p === pIn && x.st === 'act');
      if (found) {
        setUser(found);
        setRole(found.rs[0]);
        toast(`✨ ¡Bienvenido, ${found.n.split(' ')[0]}!`);
        return { success: true, user: found };
      } else {
        toast('❌ Credenciales inválidas o usuario inactivo');
        return { success: false, message: 'Credenciales inválidas' };
      }
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setCart([]);
    toast('↩ Sesión cerrada');
  };

  // --- PASSWORD RECOVERY ---
  const sendRecoveryEmail = async (uIn, emailIn) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(emailIn, {
        redirectTo: `${window.location.origin}/recovery`,
      });
      if (error) {
        toast(`❌ Error: ${error.message}`);
        return false;
      }
      toast('📧 Enlace de recuperación enviado al correo.');
      return true;
    } else {
      const found = usersList.find(x => x.u === uIn && x.email === emailIn);
      if (found) {
        toast('🔓 Datos verificados. Configura tu nueva contraseña.');
        return { success: true, userId: found.id };
      }
      toast('❌ Datos incorrectos. No coinciden usuario y correo.');
      return false;
    }
  };

  const resetPasswordOffline = (userId, newPass) => {
    const updated = usersList.map(u => {
      if (u.id === userId) {
        return { ...u, p: newPass };
      }
      return u;
    });
    setUsersList(updated);
    saveOffline('snack_users', updated);
    toast('🔒 Contraseña restablecida con éxito.');
  };

  // --- POS BASICS ---
  const addToCart = (productName, price, em, id, versionObj = null) => {
    // Verificar sesión de caja obligatoria
    if (!cashSession) {
      toast('⚠️ Debe iniciar caja para realizar ventas.');
      return;
    }

    const prod = products.find(x => x.id === id);
    if (!prod) return;

    if (versionObj) {
      const cartId = `${id}-${versionObj.name}`;
      const existing = cart.find(x => x.cartId === cartId);
      
      if (existing) {
        if (existing.qty >= versionObj.stock) {
          toast('⚠️ Sin existencias adicionales');
          return;
        }
        setCart(cart.map(x => x.cartId === cartId ? { ...x, qty: x.qty + 1 } : x));
      } else {
        if (versionObj.stock <= 0) {
          toast('⚠️ Variante agotada');
          return;
        }
        setCart([...cart, { cartId, id, name: `${prod.name} (${versionObj.name})`, price: versionObj.price, qty: 1, version: versionObj.name }]);
      }
    } else {
      if (prod.stock <= 0) {
        toast('⚠️ Producto agotado');
        return;
      }
      const existing = cart.find(x => x.id === id && !x.version);
      if (existing) {
        if (existing.qty >= prod.stock) {
          toast('⚠️ Sin existencias adicionales');
          return;
        }
        setCart(cart.map(x => (x.id === id && !x.version) ? { ...x, qty: x.qty + 1 } : x));
      } else {
        setCart([...cart, { id, name: prod.name, price, qty: 1, version: null }]);
      }
    }
    toast('🥐 Añadido al carrito');
  };

  const updateCartQty = (id, delta, version = null) => {
    const cartId = version ? `${id}-${version}` : null;
    const item = cart.find(x => version ? x.cartId === cartId : (x.id === id && !x.version));
    if (!item) return;

    const prod = products.find(p => p.id === id);
    if (!prod) return;

    if (delta > 0) {
      if (version) {
        const vObj = prod.versions.find(v => v.name === version);
        if (item.qty >= vObj.stock) return;
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

  const checkoutCart = async (paymentMethodId) => {
    if (cart.length === 0) return;
    if (!cashSession) {
      toast('⚠️ Debe iniciar caja para realizar ventas.');
      return;
    }

    const sub = cart.reduce((a, b) => a + (b.price * b.qty), 0);
    const igv = sub * 0.18;
    const tot = sub + igv;
    
    const pm = paymentMethods.find(m => m.id === paymentMethodId) || { name: 'Efectivo' };
    const methodStr = pm.name;

    // Descontar Stock
    const updatedProds = products.map(p => {
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

    setProducts(updatedProds);
    saveOffline('snack_products', updatedProds);

    // Sumar a la caja activa
    const isEfectivo = methodStr.toLowerCase().includes('efectivo');
    const updatedSession = {
      ...cashSession,
      tot_ventas_efectivo: cashSession.tot_ventas_efectivo + (isEfectivo ? tot : 0),
      tot_ventas_otros: cashSession.tot_ventas_otros + (!isEfectivo ? tot : 0),
    };
    setCashSession(updatedSession);
    saveOffline('snack_session', updatedSession);

    // Registrar Venta
    const saleObj = {
      id: Date.now(),
      n: sales.length + 501,
      items: [...cart],
      total: tot,
      method: methodStr,
      d: new Date().toLocaleDateString(),
      t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cajero: user ? user.n : 'Carlos Mendoza'
    };

    const newSales = [...sales, saleObj];
    setSales(newSales);
    saveOffline('snack_sales', newSales);

    // Supabase Sync
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: vData } = await supabase.from('ventas').insert({
          id_cliente: 1,
          id_usuario: user.id,
          id_cierre_caja: cashSession.id,
          id_metodo_pago: paymentMethodId,
          sub_total: sub,
          igv,
          tot_pago: tot
        }).select().single();

        if (vData) {
          const detailRows = cart.map(item => {
            const prodRef = products.find(p => p.id === item.id);
            const vRef = item.version ? prodRef.versions.find(v => v.name === item.version) : null;
            return {
              id_venta: vData.id_venta,
              id_producto: item.id,
              id_version: vRef ? vRef.id : null,
              num_cantidad: item.qty,
              precio_unitario: item.price
            };
          });
          await supabase.from('detalle_venta').insert(detailRows);
        }
      } catch (err) {
        console.error('Error al sincronizar venta con Supabase', err);
      }
    }

    setCart([]);
    toast('✅ Venta registrada correctamente');
    return saleObj;
  };

  // --- CRUD GESTION USUARIOS ---
  const saveUser = (uObj) => {
    let updated;
    if (uObj.id) {
      updated = usersList.map(u => u.id === uObj.id ? { ...u, ...uObj } : u);
      toast('👤 Colaborador actualizado');
    } else {
      const newUser = { ...uObj, id: Date.now(), st: 'act', rs: [uObj.role] };
      updated = [...usersList, newUser];
      toast('👤 Colaborador registrado');
    }
    setUsersList(updated);
    saveOffline('snack_users', updated);
  };

  const toggleUserStatus = (userId) => {
    const updated = usersList.map(u => u.id === userId ? { ...u, st: u.st === 'act' ? 'ina' : 'act' } : u);
    setUsersList(updated);
    saveOffline('snack_users', updated);
    toast('👤 Estado de usuario actualizado');
  };

  // --- CRUD GESTION PROVEEDORES ---
  const saveProvider = async (pObj) => {
    if (isSupabaseConfigured && supabase) {
      try {
        if (pObj.id) {
          await supabase.from('proveedores').update({
            ruc: pObj.ruc,
            nombre_empresa: pObj.name,
            num_telefono: pObj.phone,
            direccion: pObj.address
          }).eq('id_proveedor', pObj.id);
        } else {
          await supabase.from('proveedores').insert({
            ruc: pObj.ruc,
            nombre_empresa: pObj.name,
            num_telefono: pObj.phone,
            direccion: pObj.address,
            estado: 1
          });
        }
        // Recargar datos de proveedores
        const { data } = await supabase.from('proveedores').select('*');
        if (data) {
          setProviders(data.map(pr => ({
            id: pr.id_proveedor,
            ruc: pr.ruc,
            name: pr.nombre_empresa,
            phone: pr.num_telefono,
            address: pr.direccion,
            active: pr.estado === 1
          })));
        }
      } catch (err) {
        toast(`❌ Error en Supabase: ${err.message}`);
      }
    } else {
      let updated;
      if (pObj.id) {
        updated = providers.map(p => p.id === pObj.id ? { ...p, ...pObj } : p);
        toast('🏭 Proveedor actualizado');
      } else {
        const newProv = { ...pObj, id: Date.now(), active: true };
        updated = [...providers, newProv];
        toast('🏭 Proveedor registrado');
      }
      setProviders(updated);
      saveOffline('snack_providers', updated);
    }
  };

  const toggleProvider = (id) => {
    const updated = providers.map(p => p.id === id ? { ...p, active: !p.active } : p);
    setProviders(updated);
    saveOffline('snack_providers', updated);
    toast('🏭 Estado de proveedor actualizado');
  };

  // --- CRUD METODOS DE PAGO ---
  const savePaymentMethod = (mObj) => {
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
  };

  const togglePaymentMethod = (id) => {
    const updated = paymentMethods.map(m => m.id === id ? { ...m, active: !m.active } : m);
    setPaymentMethods(updated);
    saveOffline('snack_methods', updated);
    toast('💳 Estado del método de pago actualizado');
  };

  // --- COMPRAS (STOCK INTEGRATION) ---
  const registerPurchase = async (pObj) => {
    // pObj format: { providerId, items: [{ productId, qty, cost, version }] }
    const sub = pObj.items.reduce((a, b) => a + (b.qty * b.cost), 0);
    const igv = sub * 0.18;
    const tot = sub + igv;
    const provName = providers.find(p => p.id === pObj.providerId)?.name || 'Proveedor';

    // Aumentar Stock de productos/variantes
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

    const purchaseRec = {
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
    toast('📥 Compra registrada e inventario actualizado');
  };

  // --- CONTROL DE CAJA (APERTURA Y CIERRE) ---
  const openCashSession = async (initialAmount) => {
    const parsedInit = parseFloat(initialAmount) || 0;
    const newSession = {
      id: Date.now(),
      fec_apertura: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
      tot_saldo_inicial: parsedInit,
      tot_ventas_efectivo: 0,
      tot_ventas_otros: 0,
      estado: 'abierto',
      cajero: user ? user.n : 'Carlos Mendoza'
    };

    setCashSession(newSession);
    saveOffline('snack_session', newSession);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from('cierres_caja').insert({
          id_usuario: user.id,
          tot_saldo_inicial: parsedInit,
          estado: 'abierto'
        }).select().single();
        if (data) {
          setCashSession({
            ...newSession,
            id: data.id_cierre_caja
          });
        }
      } catch (err) {
        console.error('Error al abrir caja en Supabase', err);
      }
    }
    toast('💰 Caja abierta. Ventas habilitadas.');
  };

  const closeCashSession = async (countedAmount) => {
    if (!cashSession) return;

    const parsedCounted = parseFloat(countedAmount) || 0;
    const expected = cashSession.tot_saldo_inicial + cashSession.tot_ventas_efectivo;
    const diff = parsedCounted - expected;

    const closedRecord = {
      id: cashSession.id,
      fec_apertura: cashSession.fec_apertura,
      fec_cierre: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: cashSession.date || new Date().toLocaleDateString(),
      monto_inicial: cashSession.tot_saldo_inicial,
      monto_final: parsedCounted,
      ventas_efectivo: cashSession.tot_ventas_efectivo,
      ventas_otros: cashSession.tot_ventas_otros,
      diferencia: diff,
      estado: 'cerrado',
      cajero: cashSession.cajero
    };

    const newHistory = [closedRecord, ...cashHistory];
    setCashHistory(newHistory);
    saveOffline('snack_cash_history', newHistory);
    setCashSession(null);
    if (!isSupabaseConfigured) {
      localStorage.removeItem('snack_session');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('cierres_caja').update({
          fec_cierre: new Date(),
          tot_ventas_efectivo: cashSession.tot_ventas_efectivo,
          tot_ventas_otros: cashSession.tot_ventas_otros,
          tot_saldo_final: parsedCounted,
          diferencia: diff,
          estado: 'cerrado'
        }).eq('id_cierre_caja', cashSession.id);
      } catch (err) {
        console.error('Error al cerrar caja en Supabase', err);
      }
    }

    toast('🔴 Caja cerrada correctamente. POS bloqueado.');
  };

  // --- CONTROL DE PANES (PRODUCCION Y DESCARTE) ---
  const saveProduct = (pObj) => {
    let updated;
    if (pObj.id) {
      updated = products.map(p => p.id === pObj.id ? { ...p, ...pObj } : p);
      toast('📦 Producto actualizado');
    } else {
      const newProd = { ...pObj, id: Date.now(), stock: pObj.stock || 0, versions: pObj.versions || [] };
      updated = [...products, newProd];
      toast('📦 Producto creado');
    }
    setProducts(updated);
    saveOffline('snack_products', updated);
  };

  const deleteProduct = (id) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    saveOffline('snack_products', updated);
    toast('🗑 Producto eliminado');
  };

  const logBreadProduction = (prodId, qty, version = null) => {
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

    const log = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      prodName: products.find(x => x.id === prodId)?.name + (version ? ` (${version})` : ''),
      type: 'produccion',
      qty,
      reason: 'Ingreso inicial de producción diaria'
    };

    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);
    toast('➕ Producción de panes registrada');
  };

  const logBreadDiscard = (prodId, qty, reason, version = null) => {
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

    const log = {
      id: Date.now(),
      d: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      prodName: products.find(x => x.id === prodId)?.name + (version ? ` (${version})` : ''),
      type: 'descarte',
      qty,
      reason
    };

    const newLogs = [log, ...breadLogs];
    setBreadLogs(newLogs);
    saveOffline('snack_bread_logs', newLogs);
    toast('⚠️ Reporte de descarte registrado');
  };

  return (
    <AppContext.Provider value={{
      user,
      role,
      loading,
      products,
      usersList,
      providers,
      paymentMethods,
      sales,
      purchases,
      cart,
      cashSession,
      cashHistory,
      breadLogs,
      toastMsg,
      toast,
      login,
      logout,
      sendRecoveryEmail,
      resetPasswordOffline,
      addToCart,
      updateCartQty,
      clearCart,
      checkoutCart,
      saveUser,
      toggleUserStatus,
      saveProvider,
      toggleProvider,
      savePaymentMethod,
      togglePaymentMethod,
      registerPurchase,
      openCashSession,
      closeCashSession,
      saveProduct,
      deleteProduct,
      logBreadProduction,
      logBreadDiscard
    }}>
      {children}
      {toastMsg && <div className="snack" style={{ display: 'block' }}>{toastMsg}</div>}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
