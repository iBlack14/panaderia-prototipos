"use client";

import React, { useState, useMemo } from 'react';
import { useApp, Pedido } from '@/context/AppContext';

export default function PedidosPage() {
  const { pedidos, clients, savePedido, updatePedidoStatus, user, products, paymentMethods, deliverPedido, insumos } = useApp();

  const [nowTime] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<'Todos' | 'Pendiente' | 'Listo' | 'Entregado' | 'Cancelado'>('Todos');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);

  // Form states
  const [fClienteId, setFClienteId] = useState('');
  const [fProductoTexto, setFProductoTexto] = useState('');
  const [fFecEntrega, setFFecEntrega] = useState('');
  const [fAdelanto, setFAdelanto] = useState('0');
  const [fNotas, setFNotas] = useState('');

  // Client search states
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const minDateStr = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const [fTotal, setFTotal] = useState('0');
  const [isTotalManual, setIsTotalManual] = useState(false);
  const [reservationItems, setReservationItems] = useState<any[]>([]);

  // Product/Insumo/Custom picker states
  const [itemType, setItemType] = useState<'producto' | 'insumo' | 'personalizado'>('producto');
  const [selectedProdId, setSelectedProdId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [selectedInsumoId, setSelectedInsumoId] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');

  // Delivery Modal states
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveringPedido, setDeliveringPedido] = useState<Pedido | null>(null);
  const [delPaymentMethodId, setDelPaymentMethodId] = useState<number | string>('');

  const selectedProdObj = useMemo(() => {
    return products.find(p => String(p.id) === String(selectedProdId)) || null;
  }, [selectedProdId, products]);

  const handleProductChange = (prodId: string) => {
    setSelectedProdId(prodId);
    setSelectedVersionId('');
    const prod = products.find(p => String(p.id) === prodId);
    if (prod) {
      if (prod.versions && prod.versions.length > 0) {
        setItemPrice('');
      } else {
        setItemPrice(String(prod.price));
      }
    } else {
      setItemPrice('');
    }
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    if (selectedProdObj) {
      const versionObj = selectedProdObj.versions.find(v => String(v.id) === versionId);
      if (versionObj) {
        setItemPrice(String(versionObj.price));
      }
    }
  };

  const handleInsumoChange = (insumoId: string) => {
    setSelectedInsumoId(insumoId);
    const ins = insumos.find(i => String(i.id) === insumoId);
    if (ins) {
      setItemPrice(String(ins.costoUnitario));
    } else {
      setItemPrice('');
    }
  };

  const handleAddItemToReservation = () => {
    let name = '';
    let price = parseFloat(itemPrice) || 0;
    let qty = parseFloat(selectedQty);
    let versionName: string | null = null;
    let unidadMedida = 'und';
    let productId: number | null = null;
    let insumoId: number | null = null;

    if (qty <= 0 || isNaN(qty)) {
      alert('Por favor ingresa una cantidad válida mayor a 0.');
      return;
    }

    if (itemType === 'producto') {
      if (!selectedProdId) {
        alert('Por favor selecciona un producto.');
        return;
      }
      const prod = products.find(p => String(p.id) === selectedProdId);
      if (!prod) return;
      productId = prod.id;
      name = prod.name;
      unidadMedida = prod.unidad_medida || 'und';

      if (selectedVersionId) {
        const versionObj = prod.versions.find(v => String(v.id) === selectedVersionId);
        if (versionObj) {
          versionName = versionObj.name;
          price = isNaN(price) || price === 0 ? versionObj.price : price;
        }
      } else {
        price = isNaN(price) || price === 0 ? prod.price : price;
      }
    } else if (itemType === 'insumo') {
      if (!selectedInsumoId) {
        alert('Por favor selecciona un insumo.');
        return;
      }
      const ins = insumos.find(i => String(i.id) === selectedInsumoId);
      if (!ins) return;
      insumoId = ins.id;
      name = ins.nombre;
      unidadMedida = ins.unidadMedida || 'kg';
      price = isNaN(price) || price === 0 ? ins.costoUnitario : price;
    } else {
      // Personalizado
      if (!customItemName.trim()) {
        alert('Por favor ingresa un nombre para el ítem personalizado.');
        return;
      }
      name = customItemName.trim();
      unidadMedida = 'und';
      price = isNaN(price) ? 0 : price;
    }

    const newItem = {
      type: itemType,
      productId,
      insumoId,
      name,
      price,
      qty,
      versionName,
      unidadMedida
    };

    const newItems = [...reservationItems, newItem];
    setReservationItems(newItems);

    if (!isTotalManual) {
      const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
      setFTotal(newTotal.toFixed(2));
    }

    // Reset picker states
    setSelectedProdId('');
    setSelectedVersionId('');
    setSelectedInsumoId('');
    setCustomItemName('');
    setItemPrice('');
    setSelectedQty('1');
  };

  const handleRemoveProductFromReservation = (index: number) => {
    const newItems = reservationItems.filter((_, idx) => idx !== index);
    setReservationItems(newItems);

    if (!isTotalManual) {
      const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
      setFTotal(newTotal.toFixed(2));
    }
  };

  const getPedidoDescription = (productoTexto: string) => {
    try {
      if (productoTexto.startsWith('{')) {
        const parsed = JSON.parse(productoTexto);
        if (parsed.items && parsed.items.length > 0) {
          return parsed.items.map((i: any) => `• ${i.qty} ${i.unidadMedida || 'und'} x ${i.name}${i.versionName ? ` (${i.versionName})` : ''}`).join('\n');
        }
        return parsed.legacyText || 'Reserva';
      }
    } catch (e) {
      console.error('Error parsing product text JSON', e);
    }
    return productoTexto;
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const query = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.nombre.toLowerCase().includes(query) || 
      (c.dni && c.dni.includes(query))
    );
  }, [clients, clientSearch]);

  const isAdmin = user?.rs?.includes('Administrador');
  const isSupervisor = user?.rs?.includes('Supervisor');
  const isCajero = user?.rs?.includes('Cajero');

  // KPI Calculations
  const stats = useMemo(() => {
    const total = pedidos.length;
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente').length;
    const listos = pedidos.filter(p => p.estado === 'Listo').length;
    const adelantos = pedidos.reduce((sum, p) => sum + (p.estado !== 'Cancelado' ? p.adelanto : 0), 0);
    return { total, pendientes, listos, adelantos };
  }, [pedidos]);

  // Filtered Pedidos
  const filteredPedidos = useMemo(() => {
    return pedidos
      .filter(p => {
        const matchesTab = activeTab === 'Todos' || p.estado === activeTab;
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (p.clienteNombre || '').toLowerCase().includes(searchLower) ||
          p.productoTexto.toLowerCase().includes(searchLower) ||
          (p.notas || '').toLowerCase().includes(searchLower);
        return matchesTab && matchesSearch;
      })
      .sort((a, b) => new Date(a.fecEntrega).getTime() - new Date(b.fecEntrega).getTime());
  }, [pedidos, activeTab, search]);

  const openNewPedido = () => {
    setEditingPedido(null);
    setFClienteId('');
    setClientSearch('');
    setShowClientDropdown(false);
    setFProductoTexto('');
    // Prefill with tomorrow's date at 08:00 AM as a helper
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISODate = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setFFecEntrega(localISODate);
    setFAdelanto('0');
    setFNotas('');
    setFTotal('0');
    setIsTotalManual(false);
    setReservationItems([]);
    setItemType('producto');
    setSelectedProdId('');
    setSelectedVersionId('');
    setSelectedInsumoId('');
    setCustomItemName('');
    setItemPrice('');
    setSelectedQty('1');
    setShowModal(true);
  };

  const openEditPedido = (p: Pedido) => {
    setEditingPedido(p);
    setFClienteId(String(p.clienteId || ''));
    setClientSearch(p.clienteNombre || '');
    setShowClientDropdown(false);
    
    // Parse JSON or keep it legacy
    let parsedItems: any[] = [];
    let parsedTotal = String(p.adelanto);
    let legacyText = p.productoTexto;

    if (p.productoTexto.startsWith('{')) {
      try {
        const parsed = JSON.parse(p.productoTexto);
        parsedItems = parsed.items || [];
        parsedTotal = String(parsed.total || p.adelanto);
        legacyText = parsed.legacyText || '';
      } catch (e) {
        console.error('Error parsing booking products', e);
      }
    }
    
    setReservationItems(parsedItems);
    setFTotal(parsedTotal);
    setIsTotalManual(parsedItems.length === 0);
    setFProductoTexto(legacyText);

    // Convert to local datetime-local compatible format
    const date = new Date(p.fecEntrega);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISODate = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    setFFecEntrega(localISODate);
    setFAdelanto(String(p.adelanto));
    setFNotas(p.notas || '');
    setItemType('producto');
    setSelectedProdId('');
    setSelectedVersionId('');
    setSelectedInsumoId('');
    setCustomItemName('');
    setItemPrice('');
    setSelectedQty('1');
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let currentItems = [...reservationItems];
    let currentTotal = parseFloat(fTotal) || 0;

    // Si el usuario seleccionó/escribió algo pero olvidó presionar "Añadir", lo agregamos automáticamente
    if (
      (itemType === 'producto' && selectedProdId) ||
      (itemType === 'insumo' && selectedInsumoId) ||
      (itemType === 'personalizado' && customItemName.trim())
    ) {
      const qty = parseFloat(selectedQty);
      if (!isNaN(qty) && qty > 0) {
        let name = '';
        let price = parseFloat(itemPrice) || 0;
        let versionName: string | null = null;
        let unidadMedida = 'und';
        let productId: number | null = null;
        let insumoId: number | null = null;

        if (itemType === 'producto') {
          const prod = products.find(p => String(p.id) === selectedProdId);
          if (prod) {
            productId = prod.id;
            name = prod.name;
            unidadMedida = prod.unidad_medida || 'und';
            if (selectedVersionId) {
              const versionObj = prod.versions.find(v => String(v.id) === selectedVersionId);
              if (versionObj) {
                versionName = versionObj.name;
                price = isNaN(price) || price === 0 ? versionObj.price : price;
              }
            } else {
              price = isNaN(price) || price === 0 ? prod.price : price;
            }
          }
        } else if (itemType === 'insumo') {
          const ins = insumos.find(i => String(i.id) === selectedInsumoId);
          if (ins) {
            insumoId = ins.id;
            name = ins.nombre;
            unidadMedida = ins.unidadMedida || 'kg';
            price = isNaN(price) || price === 0 ? ins.costoUnitario : price;
          }
        } else {
          name = customItemName.trim();
          unidadMedida = 'und';
          price = isNaN(price) ? 0 : price;
        }

        if (name) {
          const newItem = {
            type: itemType,
            productId,
            insumoId,
            name,
            price,
            qty,
            versionName,
            unidadMedida
          };
          currentItems.push(newItem);
          if (!isTotalManual) {
            currentTotal = currentItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
          }
        }
      }
    }

    if (!fClienteId) {
      alert('Por favor selecciona un cliente válido de la lista sugerida.');
      return;
    }
    if (currentItems.length === 0 && !fProductoTexto.trim()) {
      alert('Por favor agrega al menos un producto del inventario, insumo o describe el pedido.');
      return;
    }
    if (!fFecEntrega) {
      alert('Por favor selecciona una fecha de entrega.');
      return;
    }
    const selectedDate = new Date(fFecEntrega);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      alert('La fecha de entrega no puede ser anterior al día de hoy.');
      return;
    }

    const totalVal = isTotalManual ? (parseFloat(fTotal) || 0) : currentTotal;
    const adelantoVal = parseFloat(fAdelanto) || 0;

    if (adelantoVal > totalVal) {
      alert('El adelanto no puede ser mayor al monto total de la reserva.');
      return;
    }

    let serializedProductoTexto = fProductoTexto;
    if (currentItems.length > 0) {
      const legacyText = currentItems.map(i => `${i.qty} ${i.unidadMedida || 'und'} x ${i.name}${i.versionName ? ` (${i.versionName})` : ''}`).join(', ');
      serializedProductoTexto = JSON.stringify({
        items: currentItems,
        total: totalVal,
        legacyText
      });
    } else {
      serializedProductoTexto = JSON.stringify({
        items: [],
        total: totalVal,
        legacyText: fProductoTexto || 'Reserva Especial'
      });
    }

    const payload = {
      id: editingPedido?.id || undefined,
      clienteId: parseInt(fClienteId),
      productoTexto: serializedProductoTexto,
      fecEntrega: new Date(fFecEntrega).toISOString(),
      adelanto: adelantoVal,
      notes: fNotas,
      notas: fNotas,
      estado: editingPedido?.estado || 'Pendiente'
    };

    await savePedido(payload);
    setShowModal(false);
  };

  const getStatusTagClass = (status: Pedido['estado']) => {
    switch (status) {
      case 'Pendiente': return 'tg-blue';
      case 'Listo': return 'tg-peach'; // Orange/Peach
      case 'Entregado': return 'tg-ok'; // Green
      case 'Cancelado': return 'tg-danger'; // Red
      default: return '';
    }
  };

  return (
    <div className="screen active">
      <style>{`
        .client-option:hover {
          background: var(--bg-card2) !important;
          color: var(--accent) !important;
        }
      `}</style>
      {/* KPI TILES */}
      <div className="stats-4" style={{ marginBottom: '22px' }}>
        <div className="stat-tile">
          <div className="st-lbl">Total Reservas</div>
          <div className="st-val">{stats.total}</div>
          <div className="st-sub">pedidos registrados</div>
        </div>
        <div className="stat-tile">
          <div className="st-lbl" style={{ color: 'var(--accent)' }}>Pendientes</div>
          <div className="st-val" style={{ color: 'var(--accent)' }}>{stats.pendientes}</div>
          <div className="st-sub">en producción / espera</div>
        </div>
        <div className="stat-tile">
          <div className="st-lbl" style={{ color: 'var(--green)' }}>Listos para Entregar</div>
          <div className="st-val" style={{ color: 'var(--green)' }}>{stats.listos}</div>
          <div className="st-sub">esperando al cliente</div>
        </div>
        <div className="stat-tile">
          <div className="st-lbl">Adelantos Cobrados</div>
          <div className="st-val" style={{ color: 'var(--green)' }}>S/. {stats.adelantos.toFixed(2)}</div>
          <div className="st-sub">en caja por reservas</div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-2)', padding: '4px', borderRadius: '999px', border: '1px solid var(--border)', width: 'fit-content', marginBottom: '22px', overflowX: 'auto', maxWidth: '100%' }}>
        {(['Todos', 'Pendiente', 'Listo', 'Entregado', 'Cancelado'] as const).map(t => (
          <button 
            key={t} 
            onClick={() => setActiveTab(t)}
            style={{ 
              padding: '6px 18px', 
              fontSize: '12px', 
              fontWeight: '700', 
              borderRadius: '999px', 
              border: 'none', 
              background: activeTab === t ? 'var(--accent)' : 'transparent', 
              color: activeTab === t ? '#fff' : 'var(--text-3)', 
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {t === 'Todos' ? '📋 Todos' : t === 'Pendiente' ? '⏳ Pendientes' : t === 'Listo' ? '🥐 Listos' : t === 'Entregado' ? '✅ Entregados' : '🚫 Cancelados'}
          </button>
        ))}
      </div>

      {/* SEARCH AND CREATE BUTTON */}
      <div className="tb-bar" style={{ marginBottom: '20px' }}>
        <div className="inp-wrap" style={{ flex: 1, maxWidth: '360px' }}>
          <span className="inp-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por cliente, pedido..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <button className="btn-new" onClick={openNewPedido}>
          ➕ Nueva Reserva / Pedido
        </button>
      </div>

      {/* ORDERS LIST */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {filteredPedidos.map(p => {
          const dateStr = new Date(p.fecEntrega).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          const isOverdue = new Date(p.fecEntrega).getTime() < nowTime && (p.estado === 'Pendiente' || p.estado === 'Listo');
          
          let itemsList: any[] = [];
          let totalVal = p.adelanto;
          if (p.productoTexto.startsWith('{')) {
            try {
              const parsed = JSON.parse(p.productoTexto);
              itemsList = parsed.items || [];
              totalVal = parsed.total || p.adelanto;
            } catch (e) {}
          }
          const saldoVal = Math.max(0, totalVal - p.adelanto);

          return (
            <div 
              key={p.id} 
              className="panel" 
              style={{ 
                padding: '18px 20px', 
                border: isOverdue ? '2.5px solid rgba(220,53,69,0.5)' : '1.5px solid var(--border)',
                borderRadius: '16px',
                background: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              {/* Card Header */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Reserva {String(p.id).startsWith('local_') ? '(Local)' : `#RES-${p.id}`}
                    </span>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '2px 0 0 0', color: 'var(--text)' }}>
                      👤 {p.clienteNombre}
                    </h4>
                  </div>
                  <span className={`tag ${getStatusTagClass(p.estado)}`}>
                    {p.estado}
                  </span>
                </div>
 
                {/* Delivery Date */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '12px', 
                  color: isOverdue ? 'var(--red)' : 'var(--accent)', 
                  fontWeight: 700,
                  marginBottom: '10px'
                }}>
                  <span>📅</span>
                  <span>Entrega: {dateStr} {isOverdue && '(Retrasado)'}</span>
                </div>
 
                {/* Products text */}
                <div style={{ 
                  background: 'var(--bg-card2)', 
                  padding: '10px 12px', 
                  borderRadius: '10px', 
                  fontSize: '12.5px', 
                  color: 'var(--text-2)', 
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid var(--border)',
                  marginBottom: '8px'
                }}>
                  {getPedidoDescription(p.productoTexto)}
                </div>
 
                {/* Notes */}
                {p.notas && (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontStyle: 'italic', marginBottom: '8px' }}>
                    📌 Nota: {p.notas}
                  </div>
                )}
              </div>
 
              {/* Card Footer Actions */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>Total Pedido:</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text)' }}>S/. {totalVal.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>Adelanto:</span>
                    <strong style={{ fontSize: '13px', color: 'var(--green)' }}>S/. {p.adelanto.toFixed(2)}</strong>
                  </div>
                  {saldoVal > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>Saldo Restante:</span>
                      <strong style={{ fontSize: '13px', color: 'var(--red)' }}>S/. {saldoVal.toFixed(2)}</strong>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>Saldo Restante:</span>
                      <strong style={{ fontSize: '12px', color: 'var(--green)' }}>✅ Pagado</strong>
                    </div>
                  )}
                </div>
 
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {p.estado === 'Pendiente' && (
                    <button 
                      onClick={() => updatePedidoStatus(p.id, 'Listo')}
                      style={{ flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: '800', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
                    >
                      🥐 Listo para Entregar
                    </button>
                  )}
                  {p.estado === 'Listo' && (
                    <button 
                      onClick={() => {
                        setDeliveringPedido(p);
                        setDelPaymentMethodId('');
                        setShowDeliveryModal(true);
                      }}
                      style={{ flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: '800', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, var(--green), #15803d)', color: '#fff', cursor: 'pointer' }}
                    >
                      ✅ Entregar Pedido
                    </button>
                  )}
                  
                  {/* Cancel button for non-finalized orders */}
                  {(p.estado === 'Pendiente' || p.estado === 'Listo') && (
                    <button 
                      onClick={() => updatePedidoStatus(p.id, 'Cancelado')}
                      style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(220,53,69,0.3)', background: 'rgba(220,53,69,0.08)', color: 'var(--red)', cursor: 'pointer' }}
                      title="Cancelar Reserva"
                    >
                      🚫 Cancelar
                    </button>
                  )}
 
                  {/* Edit button */}
                  {p.estado !== 'Entregado' && p.estado !== 'Cancelado' && (
                    <button 
                      onClick={() => openEditPedido(p)}
                      style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card2)', color: 'var(--text-2)', cursor: 'pointer' }}
                      title="Editar Reserva"
                    >
                      ✏️ Editar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredPedidos.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📅</div>
            <p>No hay reservas en esta categoría. ¡Crea una nueva!</p>
          </div>
        )}
      </div>

      {/* CREATE / EDIT PEDIDO MODAL */}
      {showModal && (
        <div className="modal-overlay open" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '580px', maxHeight: '90vh' }}>
            
            {/* Header inside modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div className="mc-title" style={{ margin: 0, textAlign: 'left' }}>
                {editingPedido ? '✏️ Editar Reserva' : '📅 Registrar Nueva Reserva'}
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-3)'; }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                 
                {/* Cliente Selector */}
                <div className="inp-group">
                  <label>Cliente Pactado *</label>
                  <div className="inp-wrap" style={{ position: 'relative' }}>
                    <span className="inp-icon">👤</span>
                    <input 
                      type="text"
                      placeholder="Escribe el nombre o DNI del cliente..."
                      value={clientSearch}
                      onFocus={() => setShowClientDropdown(true)}
                      onChange={e => {
                        const val = e.target.value;
                        setClientSearch(val);
                        const currentClient = clients.find(c => String(c.id) === String(fClienteId));
                        if (!currentClient || currentClient.nombre !== val) {
                          setFClienteId('');
                        }
                        setShowClientDropdown(true);
                      }}
                      required
                      style={{
                        paddingRight: fClienteId ? '35px' : '12px'
                      }}
                    />
                    {fClienteId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setFClienteId('');
                          setClientSearch('');
                        }}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-3)',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          zIndex: 10,
                          padding: '4px'
                        }}
                        title="Limpiar cliente"
                      >
                        ✕
                      </button>
                    )}

                    {showClientDropdown && (
                      <>
                        <div 
                          onClick={() => setShowClientDropdown(false)} 
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 998
                          }}
                        />
                        <div 
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border2)',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.12)',
                            maxHeight: '180px',
                            overflowY: 'auto',
                            zIndex: 999,
                            marginTop: '6px'
                          }}
                        >
                          {filteredClients.length === 0 ? (
                            <div style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-3)', textAlign: 'center' }}>
                              No se encontraron clientes
                            </div>
                          ) : (
                            filteredClients.map(c => (
                              <div 
                                key={c.id}
                                onClick={() => {
                                  setFClienteId(String(c.id));
                                  setClientSearch(c.nombre);
                                  setShowClientDropdown(false);
                                }}
                                style={{
                                  padding: '10px 12px',
                                  fontSize: '13px',
                                  color: 'var(--text)',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--border)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  background: fClienteId === String(c.id) ? 'var(--accent-bg)' : 'transparent'
                                }}
                                className="client-option"
                              >
                                <span>👤 {c.nombre}</span>
                                {c.dni && <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>DNI: {c.dni}</span>}
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Unified Items Picker Section */}
                <div style={{ border: '1.5px dashed var(--border)', padding: '14px', borderRadius: '12px', background: 'var(--bg-card2)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    Añadir Ítems a la Reserva
                  </div>

                  {/* Tab Selector */}
                  <div style={{ display: 'flex', gap: '6px', background: 'var(--bg)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '12px' }}>
                    {(['producto', 'insumo', 'personalizado'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setItemType(type);
                          setSelectedProdId('');
                          setSelectedVersionId('');
                          setSelectedInsumoId('');
                          setCustomItemName('');
                          setItemPrice('');
                          setSelectedQty('1');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: '7px',
                          border: 'none',
                          background: itemType === type ? 'var(--accent)' : 'transparent',
                          color: itemType === type ? '#fff' : 'var(--text-3)',
                          cursor: 'pointer',
                          transition: 'all 0.18s',
                          textTransform: 'uppercase'
                        }}
                      >
                        {type === 'producto' ? '🍞 Producto' : type === 'insumo' ? '🌾 Insumo' : '✍️ Personalizado'}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Item Selection Selector */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        {itemType === 'producto' && (
                          <select
                            value={selectedProdId}
                            onChange={e => handleProductChange(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                          >
                            <option value="">-- Seleccionar producto del catálogo --</option>
                            {products.filter(p => p.cat !== 'Insumos').map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} (S/. {p.price.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        )}

                        {itemType === 'insumo' && (
                          <select
                            value={selectedInsumoId}
                            onChange={e => handleInsumoChange(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                          >
                            <option value="">-- Seleccionar insumo / ingrediente --</option>
                            {insumos.map(i => (
                              <option key={i.id} value={i.id}>
                                {i.nombre} (Costo ref: S/. {i.costoUnitario.toFixed(2)} / {i.unidadMedida})
                              </option>
                            ))}
                          </select>
                        )}

                        {itemType === 'personalizado' && (
                          <input
                            type="text"
                            placeholder="Nombre del ítem (ej: Torta especial Frozen 3 pisos)"
                            value={customItemName}
                            onChange={e => setCustomItemName(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                          />
                        )}
                      </div>

                      {/* Select Versión (only for product if it has versions) */}
                      {itemType === 'producto' && selectedProdObj && selectedProdObj.versions && selectedProdObj.versions.length > 0 && (
                        <div style={{ width: '140px' }}>
                          <select
                            value={selectedVersionId}
                            onChange={e => handleVersionChange(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                          >
                            <option value="">-- Versión --</option>
                            {selectedProdObj.versions.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name} (S/. {v.price.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Row 2: Price, Qty and Add Button */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Precio S/.</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={itemPrice}
                          onChange={e => setItemPrice(e.target.value)}
                          style={{ padding: '8px 10px', fontSize: '13px', width: '100%' }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Cant.</span>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            placeholder="1"
                            value={selectedQty}
                            onChange={e => setSelectedQty(e.target.value)}
                            style={{ padding: '8px 10px', paddingRight: '40px', width: '100%', fontSize: '13px' }}
                          />
                          <span style={{ position: 'absolute', right: '10px', fontSize: '10px', fontWeight: 'bold', color: 'var(--text-3)', pointerEvents: 'none' }}>
                            {itemType === 'producto' && selectedProdObj ? (selectedProdObj.unidad_medida || 'und') :
                             itemType === 'insumo' && selectedInsumoId ? (insumos.find(i => String(i.id) === selectedInsumoId)?.unidadMedida || 'kg') :
                             'und'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddItemToReservation}
                        className="btn-new"
                        style={{ padding: '8px 16px', height: '36px', fontSize: '12px' }}
                      >
                        ＋ Añadir ítem
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  {reservationItems.length > 0 && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-card)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      {reservationItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '2px' }}>
                          <span>
                            <strong>{item.qty} {item.unidadMedida || 'und'}</strong> x {item.name} {item.versionName ? `(${item.versionName})` : ''}
                            <span style={{ color: 'var(--text-3)', fontSize: '11px', marginLeft: '6px' }}>(S/. {item.price.toFixed(2)})</span>
                            {item.type === 'insumo' && <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '6px', background: 'var(--accent-bg)', padding: '1px 5px', borderRadius: '8px', fontWeight: 'bold' }}>Insumo</span>}
                            {item.type === 'personalizado' && <span style={{ fontSize: '10px', color: '#0d9488', marginLeft: '6px', background: 'rgba(20,184,166,0.1)', padding: '1px 5px', borderRadius: '8px', fontWeight: 'bold' }}>Personalizado</span>}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ color: 'var(--text-2)', fontSize: '12.5px' }}>S/. {(item.price * item.qty).toFixed(2)}</strong>
                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromReservation(idx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--red)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                transition: 'background 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Monto Total del Pedido */}
                <div className="inp-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ margin: 0 }}>Monto Total del Pedido (S/.) *</label>
                    <span style={{ fontSize: '11px', color: isTotalManual ? '#d97706' : '#16a34a', fontWeight: '700' }}>
                      {isTotalManual ? '✏️ Ajustado manualmente' : '⚡ Calculado del inventario'}
                    </span>
                  </div>
                  <div className="inp-wrap">
                    <span className="inp-icon">💵</span>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.5" 
                      value={fTotal}
                      onChange={e => {
                        setFTotal(e.target.value);
                        setIsTotalManual(true);
                      }}
                      placeholder="0.00"
                      required
                      style={{
                        paddingRight: isTotalManual && reservationItems.length > 0 ? '100px' : '16px'
                      }}
                    />
                    {isTotalManual && reservationItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const autoTotal = reservationItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
                          setFTotal(autoTotal.toFixed(2));
                          setIsTotalManual(false);
                        }}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'var(--accent-bg)',
                          color: 'var(--accent)',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          zIndex: 10
                        }}
                      >
                        Reestablecer
                      </button>
                    )}
                  </div>
                </div>

                {/* Producto/Texto Pedido libre (Opcional) */}
                <div className="inp-group">
                  <label>Descripción Libre / Notas del Pedido</label>
                  <input 
                    type="text" 
                    value={fProductoTexto}
                    onChange={e => setFProductoTexto(e.target.value)}
                    placeholder="Ej: Torta personalizada de Frozen, etc. (Opcional si usas inventario)"
                  />
                </div>

                {/* Fecha y Hora de Entrega */}
                <div className="inp-group">
                  <label>Fecha y Hora Pactada de Entrega *</label>
                  <input 
                    type="datetime-local" 
                    value={fFecEntrega}
                    onChange={e => setFFecEntrega(e.target.value)}
                    required
                    min={minDateStr}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg-card2)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  />
                </div>

                {/* Adelanto */}
                <div className="inp-group">
                  <label>Monto de Adelanto / Garantía (S/.)</label>
                  <div className="inp-wrap">
                    <span className="inp-icon">💵</span>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.5" 
                      value={fAdelanto}
                      onChange={e => setFAdelanto(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Notas / Observaciones */}
                <div className="inp-group">
                  <label>Observaciones Adicionales</label>
                  <input 
                    type="text" 
                    value={fNotas}
                    onChange={e => setFNotas(e.target.value)}
                    placeholder="Ej: Sin crema chantilly, empaque especial para regalo..."
                  />
                </div>
              </div>

              <div className="mc-btns" style={{ marginTop: '20px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">
                  {editingPedido ? 'Guardar Cambios' : 'Registrar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELIVERY CHECKOUT MODAL */}
      {showDeliveryModal && deliveringPedido && (() => {
        let items: any[] = [];
        let totalVal = deliveringPedido.adelanto;
        
        if (deliveringPedido.productoTexto.startsWith('{')) {
          try {
            const parsed = JSON.parse(deliveringPedido.productoTexto);
            items = parsed.items || [];
            totalVal = parsed.total || deliveringPedido.adelanto;
          } catch (e) {}
        }
        
        const saldo = Math.max(0, totalVal - deliveringPedido.adelanto);
        const activeMethods = paymentMethods.filter(m => m.active);

        return (
          <div className="modal-overlay open">
            <div className="modal-card" style={{ width: '420px' }}>
              <span className="mc-icon">🥐</span>
              <div className="mc-title">Confirmar Entrega y Pago</div>
              <p className="mc-sub">Registra el cobro final del saldo restante y descuenta del stock</p>
              
              <div style={{ background: 'var(--bg-card2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '12.5px' }}>Cliente:</span>
                  <strong style={{ color: 'var(--text)', fontSize: '13px' }}>{deliveringPedido.clienteNombre}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '12.5px' }}>Monto Total del Pedido:</span>
                  <strong style={{ color: 'var(--text)', fontSize: '13px' }}>S/. {totalVal.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '12.5px' }}>Adelanto Recibido:</span>
                  <strong style={{ color: 'var(--green)', fontSize: '13px' }}>S/. {deliveringPedido.adelanto.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 'bold' }}>Saldo Restante a Cobrar:</span>
                  <strong style={{ color: 'var(--red)', fontSize: '14.5px' }}>S/. {saldo.toFixed(2)}</strong>
                </div>
              </div>

              {saldo > 0 ? (
                <div className="inp-group" style={{ textAlign: 'left', marginBottom: '18px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px', display: 'block' }}>
                    Método de Pago para el Saldo Restante *
                  </label>
                  <select
                    value={delPaymentMethodId}
                    onChange={e => setDelPaymentMethodId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg-card2)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    <option value="">-- Seleccionar Método de Pago --</option>
                    {activeMethods.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 'bold', margin: '10px 0' }}>
                  El pedido ya fue pagado en su totalidad con el adelanto.
                </p>
              )}

              <div className="mc-btns" style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="mc-sec"
                  onClick={() => setShowDeliveryModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="mc-pri"
                  style={{ flex: 1 }}
                  onClick={async () => {
                    if (saldo > 0 && !delPaymentMethodId) {
                      alert('Por favor selecciona el método de pago para el saldo restante.');
                      return;
                    }
                    
                    const methodId = saldo > 0 ? parseInt(String(delPaymentMethodId)) : (paymentMethods[0]?.id || 1);
                    const selectedMethod = paymentMethods.find(m => m.id === methodId);
                    const methodName = selectedMethod ? selectedMethod.name : 'Efectivo';

                    await deliverPedido(
                      deliveringPedido.id,
                      methodId,
                      methodName,
                      totalVal,
                      deliveringPedido.adelanto,
                      items
                    );
                    setShowDeliveryModal(false);
                  }}
                >
                  Confirmar Entrega
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
