"use client";

import React, { useState, useMemo } from 'react';
import { useApp, Pedido } from '@/context/AppContext';

export default function PedidosPage() {
  const { pedidos, clients, savePedido, updatePedidoStatus, user } = useApp();

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
    setShowModal(true);
  };

  const openEditPedido = (p: Pedido) => {
    setEditingPedido(p);
    setFClienteId(String(p.clienteId || ''));
    setClientSearch(p.clienteNombre || '');
    setShowClientDropdown(false);
    setFProductoTexto(p.productoTexto);
    // Convert to local datetime-local compatible format
    const date = new Date(p.fecEntrega);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISODate = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    setFFecEntrega(localISODate);
    setFAdelanto(String(p.adelanto));
    setFNotas(p.notas || '');
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fClienteId) {
      alert('Por favor selecciona un cliente válido de la lista sugerida.');
      return;
    }
    if (!fProductoTexto.trim()) {
      alert('Por favor describe los productos del pedido.');
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

    const payload = {
      id: editingPedido?.id || undefined,
      clienteId: parseInt(fClienteId),
      productoTexto: fProductoTexto,
      fecEntrega: new Date(fFecEntrega).toISOString(),
      adelanto: parseFloat(fAdelanto) || 0,
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
                  {p.productoTexto}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>Adelanto:</span>
                  <strong style={{ fontSize: '13px', color: 'var(--green)' }}>S/. {p.adelanto.toFixed(2)}</strong>
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
                      onClick={() => updatePedidoStatus(p.id, 'Entregado')}
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
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '480px' }}>
            <span className="mc-icon">📅</span>
        <div className="mc-title">{editingPedido ? 'Editar Reserva' : 'Registrar Nueva Reserva'}</div>
            <p className="mc-sub">Controla los detalles del pedido y la fecha pactada de entrega</p>
            
            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                 
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
                        // Clear the selected ID if typed search changes from the current client name
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
                        {/* Background click catcher overlay */}
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

                 {/* Producto/Texto Pedido */}
                <div className="inp-group">
                  <label>Productos / Descripción del Pedido *</label>
                  <textarea 
                    rows={3} 
                    value={fProductoTexto}
                    onChange={e => setFProductoTexto(e.target.value)}
                    placeholder="Ej: 1 Torta de Chocolate mediana, 24 Croissants, 4 Panes franceses..."
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg-card2)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontFamily: 'Inter, sans-serif',
                      resize: 'vertical'
                    }}
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
    </div>
  );
}
