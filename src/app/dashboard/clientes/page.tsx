"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp, Client } from '@/context/AppContext';

// Métodos de pago para cobranza
const METODOS_COBRO = [
  { id: 'Efectivo', icon: '💵', label: 'Efectivo', desc: 'Va a caja como efectivo' },
  { id: 'Yape', icon: '📱', label: 'Yape', desc: 'Pago QR BCP / Yape' },
  { id: 'Plin', icon: '📲', label: 'Plin', desc: 'Pago QR Interbank/BBVA' },
  { id: 'Transferencia', icon: '🏦', label: 'Transferencia', desc: 'Cuenta bancaria' },
  { id: 'Tarjeta', icon: '💳', label: 'Tarjeta', desc: 'Terminal POS Visa/MC' },
];

export default function ClientesPage() {
  const { clients, saveClient, toggleClient, payCreditBalance, user, toast } = useApp();

  const [activeTab, setActiveTab] = useState<'lista' | 'cobranza'>('lista');
  const [search, setSearch] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);

  // Form state
  const [fNombres, setFNombres] = useState('');
  const [fApePaterno, setFApePaterno] = useState('');
  const [fApeMaterno, setFApeMaterno] = useState('');
  const [fDni, setFDni] = useState('');
  const [fTel, setFTel] = useState('');
  const [fEmail, setFEmail] = useState('');

  // DNI lookup state
  const [dniLoading, setDniLoading] = useState(false);
  const [dniError, setDniError] = useState('');
  const [dniOk, setDniOk] = useState(false);

  // Payment form state
  const [payMonto, setPayMonto] = useState('');
  const [payMetodo, setPayMetodo] = useState('Efectivo');
  const [payConcepto, setPayConcepto] = useState('Abono de deuda');

  const isAdmin = user?.rs?.includes('Administrador');

  const filteredClients = useMemo(() => {
    return clients.filter(c =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.dni || '').includes(search) ||
      (c.telefono || '').includes(search)
    );
  }, [clients, search]);

  const clientesConDeuda = useMemo(() =>
    clients.filter(c => c.saldoCred > 0 && c.active).sort((a, b) => b.saldoCred - a.saldoCred),
    [clients]
  );

  const totalDeudaPendiente = useMemo(() =>
    clients.reduce((a, c) => a + c.saldoCred, 0), [clients]
  );

  const resetDniState = () => { setDniError(''); setDniOk(false); };

  const openNewClient = () => {
    setEditingClient(null);
    setFNombres(''); setFApePaterno(''); setFApeMaterno(''); setFDni(''); setFTel(''); setFEmail('');
    resetDniState();
    setShowClientModal(true);
  };

  const consultarDni = useCallback(async (dni: string) => {
    setDniLoading(true);
    setDniError('');
    setDniOk(false);
    try {
      const res = await fetch('/api/consulta-dni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setDniError(json.message || 'No se encontraron datos para ese DNI.');
      } else {
        const d = json.data;
        setFNombres(d.nombres ? d.nombres.trim() : '');
        setFApePaterno(d.apellido_paterno ? d.apellido_paterno.trim() : '');
        setFApeMaterno(d.apellido_materno ? d.apellido_materno.trim() : '');
        setDniOk(true);
      }
    } catch {
      setDniError('Error de conexión al consultar el DNI.');
    } finally {
      setDniLoading(false);
    }
  }, []);

  // Auto-consulta cuando el DNI llega a 8 dígitos
  // Auto-consulta cuando el DNI llega a 8 dígitos con prevención de duplicados
  useEffect(() => {
    if (fDni.length === 8 && showClientModal) {
      if (!editingClient) {
        const existing = clients.find(c => c.dni && c.dni.trim() === fDni.trim());
        if (existing) {
          setDniError(`El cliente ${existing.nombre} ya está registrado con este DNI.`);
          return;
        }
      } else {
        const existing = clients.find(c => c.dni && c.dni.trim() === fDni.trim() && c.id !== editingClient.id);
        if (existing) {
          setDniError(`El cliente ${existing.nombre} ya está registrado con este DNI.`);
          return;
        }
      }
      consultarDni(fDni);
    }
  }, [fDni, showClientModal, consultarDni, editingClient, clients]);

  const openEditClient = (c: Client) => {
    setEditingClient(c);
    
    // Parsear el nombre completo de regreso a Nombres, Apellido Paterno y Apellido Materno
    const parts = c.nombre.trim().split(/\s+/);
    let nombres = '';
    let apePaterno = '';
    let apeMaterno = '';

    if (parts.length === 1) {
      nombres = parts[0];
    } else if (parts.length === 2) {
      nombres = parts[0];
      apePaterno = parts[1];
    } else {
      // 3 o más partes, ej: ["Rosa", "Quispe", "Mamani"] o ["Ana", "María", "Rodríguez", "López"]
      apeMaterno = parts[parts.length - 1];
      apePaterno = parts[parts.length - 2];
      nombres = parts.slice(0, parts.length - 2).join(' ');
    }

    setFNombres(nombres);
    setFApePaterno(apePaterno);
    setFApeMaterno(apeMaterno);
    
    setFDni(c.dni || '');
    setFTel(c.telefono || '');
    setFEmail(c.email || '');
    resetDniState();
    setShowClientModal(true);
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = editingClient ? editingClient.limiteCred : 0;
    const fullName = `${fNombres} ${fApePaterno} ${fApeMaterno}`.trim().replace(/\s+/g, ' ');
    
    // Validar nombre (solo letras/espacios)
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'\-]+$/;
    if (!nameRegex.test(fullName)) {
      toast("⚠️ El nombre del cliente solo debe contener letras.");
      return;
    }

    // Validar teléfono (máximo 9 dígitos)
    const cleanPhone = fTel.replace(/\D/g, '');
    if (cleanPhone.length > 9) {
      toast("⚠️ El teléfono no debe exceder los 9 dígitos.");
      return;
    }

    // Validar duplicado de DNI antes de enviar
    if (fDni) {
      const existing = clients.find(c => c.dni && c.dni.trim() === fDni.trim() && (!editingClient || c.id !== editingClient.id));
      if (existing) {
        toast(`⚠️ Ya existe un cliente registrado con el DNI ${fDni} (${existing.nombre}).`);
        return;
      }
    }

    saveClient({ id: editingClient?.id, nombre: fullName, dni: fDni, telefono: cleanPhone, email: fEmail, limiteCred: limit });
    setShowClientModal(false);
  };

  const openPayModal = (c: Client) => {
    setSelectedClient(c);
    setPayMonto(c.saldoCred.toFixed(2));
    setPayMetodo('Efectivo');
    setPayConcepto('Abono de deuda');
    setShowPayModal(true);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    const amt = parseFloat(payMonto);
    if (isNaN(amt) || amt <= 0) return;
    if (amt > 100) {
      toast("⚠️ El monto máximo de recarga es S/. 100.00");
      return;
    }
    if (selectedClient.saldoCred + amt > 100) {
      toast(`⚠️ El saldo total no puede superar el límite de S/. 100.00. Saldo actual: S/. ${selectedClient.saldoCred.toFixed(2)}. Máximo a recargar: S/. ${(100 - selectedClient.saldoCred).toFixed(2)}.`);
      return;
    }
    payCreditBalance(selectedClient.id, amt, payConcepto, payMetodo);
    setShowPayModal(false);
  };

  const openHistory = (c: Client) => {
    setHistoryClient(c);
    setShowHistoryModal(true);
  };

  const selectedMetodo = METODOS_COBRO.find(m => m.id === payMetodo);

  return (
    <div className="screen active">
      {/* KPI BANNER */}
      <div className="stats-4" style={{ marginBottom: '22px' }}>
        <div className="stat-tile" style={{ padding: '16px 20px' }}>
          <div className="st-lbl">Total Clientes</div>
          <div className="st-val">{clients.filter(c => c.active).length}</div>
          <div className="st-sub">clientes activos</div>
        </div>
        <div className="stat-tile" style={{ padding: '16px 20px' }}>
          <div className="st-lbl" style={{ color: 'var(--green)' }}>Saldo Prepago Total</div>
          <div className="st-val" style={{ color: 'var(--green)' }}>S/. {totalDeudaPendiente.toFixed(2)}</div>
          <div className="st-sub">{clientesConDeuda.length} clientes con saldo prepago</div>
        </div>
        <div className="stat-tile" style={{ padding: '16px 20px' }}>
          <div className="st-lbl">Sin Saldo</div>
          <div className="st-val">{clients.filter(c => c.saldoCred === 0 && c.active).length}</div>
          <div className="st-sub">sin saldo disponible</div>
        </div>
        <div className="stat-tile" style={{ padding: '16px 20px' }}>
          <div className="st-lbl">Límite Total Saldo</div>
          <div className="st-val">S/. {clients.reduce((a, c) => a + c.limiteCred, 0).toFixed(0)}</div>
          <div className="st-sub">en cupos prepago asignados</div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-2)', padding: '4px', borderRadius: '999px', border: '1px solid var(--border)', width: 'fit-content', marginBottom: '22px' }}>
        {(['lista', 'cobranza'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '6px 18px', fontSize: '12px', fontWeight: '700', borderRadius: '999px', border: 'none', background: activeTab === t ? 'var(--accent)' : 'transparent', color: activeTab === t ? '#fff' : 'var(--text-3)', cursor: 'pointer' }}
          >
            {t === 'lista' ? '👤 Directorio' : '💰 Recargas de Saldo'}
          </button>
        ))}
      </div>

      {activeTab === 'lista' ? (
        <>
          <div className="tb-bar">
            <div className="inp-wrap" style={{ flex: 1, maxWidth: '360px' }}>
              <span className="inp-icon">🔍</span>
              <input type="text" placeholder="Buscar por nombre, DNI o teléfono..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn-new" onClick={openNewClient}>+ Nuevo Cliente</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filteredClients.map(c => {
              const pct = Math.min(100, (c.saldoCred / (c.limiteCred || 100)) * 100);
              const isLow = pct < 20;
              const isMed = pct >= 20 && pct < 50;
              const barColor = isLow ? 'var(--red)' : isMed ? '#f59e0b' : 'var(--green)';
              return (
                <div key={c.id} className="panel" style={{ padding: '18px 20px', border: `1.5px solid ${c.saldoCred > 0 ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`, borderRadius: '16px', background: 'var(--bg-card)', opacity: c.active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', background: 'var(--accent-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: 'var(--accent)' }}>
                        {c.nombre[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', color: 'var(--text)', fontSize: '13.5px' }}>{c.nombre}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                          {c.dni && `DNI: ${c.dni}`}{c.telefono && ` · 📞 ${c.telefono}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="act-btn" onClick={() => openHistory(c)} title="Historial">📋</button>
                      <button className="act-btn" onClick={() => openEditClient(c)} title="Editar">✏️</button>
                      {isAdmin && <button className="act-btn del" onClick={() => toggleClient(c.id)} title={c.active ? 'Desactivar' : 'Activar'}>{c.active ? '🚫' : '✅'}</button>}
                    </div>
                  </div>

                  {c.saldoCred > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                        <span style={{ color: 'var(--text-3)', fontWeight: '600' }}>Saldo Prepago</span>
                        <span style={{ fontWeight: '800', color: barColor }}>
                          S/. {c.saldoCred.toFixed(2)} / {(c.limiteCred || 100).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-card2)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '999px', transition: 'width 0.4s ease' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>
                        Tope de Carga: S/. {(c.limiteCred || 100).toFixed(2)}
                      </div>
                    </div>
                  )}

                  <button onClick={() => openPayModal(c)} style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '700', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, var(--green), #15803d)', color: '#fff', cursor: 'pointer' }}>
                    💳 Registrar Recarga
                  </button>
                </div>
              );
            })}
            {filteredClients.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
                <p>No hay clientes registrados. ¡Agrega el primero!</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* PANEL DE COBRANZA (RECARGAS) */}
          <div className="panel" style={{ marginBottom: '20px', border: '1px solid rgba(22,163,74,0.25)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <span style={{ fontSize: '28px' }}>💳</span>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'DM Serif Display', fontSize: '20px', color: 'var(--text)' }}>Recargas de Saldo Prepago</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>
                  Agrega saldo a favor de tus clientes registrados. El monto ingresará a caja como método seleccionado.
                </p>
              </div>
            </div>

            {/* Info sobre métodos */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
              {METODOS_COBRO.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'var(--bg-card2)', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '11.5px', color: 'var(--text-2)', fontWeight: '600' }}>
                  {m.icon} {m.label}
                </div>
              ))}
            </div>

            {clientesConDeuda.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>👤</div>
                <p>No hay clientes con saldo prepago disponible. ¡Realiza la primera recarga!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {clientesConDeuda.map((c, idx) => {
                  const pct = c.limiteCred > 0 ? Math.min(100, (c.saldoCred / c.limiteCred) * 100) : 100;
                  // Último pago registrado
                  const ultimoPago = c.historialPagos.filter(p => p.tipo === 'abono').slice(-1)[0];
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'var(--bg-card2)', borderRadius: '12px', border: '1px solid rgba(22,163,74,0.15)' }}>
                      {/* Ranking */}
                      <div style={{ width: '24px', height: '24px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: idx === 0 ? 'var(--green)' : idx === 1 ? '#f59e0b' : 'var(--text-3)' }}>
                        #{idx + 1}
                      </div>
                      {/* Avatar */}
                      <div style={{ width: '36px', height: '36px', background: 'rgba(22,163,74,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: 'var(--green)', flexShrink: 0 }}>
                        {c.nombre[0].toUpperCase()}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>{c.nombre}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <div style={{ flex: 1, height: '4px', background: 'var(--bg-card)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green)', borderRadius: '999px' }} />
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            {pct.toFixed(0)}% del tope
                          </span>
                        </div>
                        {ultimoPago && (
                          <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
                            Última recarga: {ultimoPago.fecha} vía {ultimoPago.metodoPago || 'Efectivo'}
                          </div>
                        )}
                      </div>
                      {/* Monto */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: '800', color: 'var(--green)', fontSize: '16px' }}>S/. {c.saldoCred.toFixed(2)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>de S/. {c.limiteCred.toFixed(0)} tope</div>
                      </div>
                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button className="act-btn" onClick={() => openHistory(c)} title="Ver historial">📋</button>
                        <button
                          onClick={() => openPayModal(c)}
                          style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, var(--green), #15803d)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          💳 Recargar
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 4px', fontWeight: '800', fontSize: '14px', color: 'var(--text)', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                  Total Prepago Acumulado: <span style={{ color: 'var(--green)', marginLeft: '8px' }}>S/. {totalDeudaPendiente.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: NUEVO / EDITAR CLIENTE */}
      {showClientModal && (() => {
        return (
          <div className="modal-overlay open">
            <div className="modal-card" style={{ width: '460px' }}>
              <span className="mc-icon">👤</span>
              <div className="mc-title">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente Prepago'}</div>
              <p className="mc-sub">Configura los datos y el tope de recarga del cliente</p>
              <form onSubmit={handleClientSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="inp-group" style={{ gridColumn: '1/-1', textAlign: 'left' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>DNI</span>
                      {dniLoading && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '600' }}>⏳ Consultando RENIEC...</span>}
                      {!dniLoading && dniOk && <span style={{ fontSize: '10px', color: 'var(--green)', fontWeight: '700' }}>✅ Datos encontrados</span>}
                      {!dniLoading && dniError && <span style={{ fontSize: '10px', color: 'var(--red)', fontWeight: '600' }}>⚠️ {dniError}</span>}
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={fDni}
                      onChange={e => { setFDni(e.target.value.replace(/\D/g, '')); setDniOk(false); setDniError(''); }}
                      placeholder="12345678 — se autocompletará solo"
                      style={{
                        borderColor: dniOk ? 'var(--green)' : dniError ? 'var(--red)' : undefined,
                        transition: 'border-color 0.2s ease'
                      }}
                    />
                  </div>
                  <div className="inp-group" style={{ gridColumn: '1/-1', textAlign: 'left' }}>
                    <label>Nombres</label>
                    <input 
                      type="text" 
                      value={fNombres} 
                      onChange={e => setFNombres(e.target.value)} 
                      placeholder="Ej: Rosa" 
                      required 
                      readOnly={dniOk}
                      style={{
                        background: dniOk ? 'var(--bg-hover)' : undefined,
                        cursor: dniOk ? 'not-allowed' : undefined
                      }}
                    />
                  </div>
                  <div className="inp-group" style={{ textAlign: 'left' }}>
                    <label>Apellido Paterno</label>
                    <input 
                      type="text" 
                      value={fApePaterno} 
                      onChange={e => setFApePaterno(e.target.value)} 
                      placeholder="Ej: Quispe" 
                      required 
                      readOnly={dniOk}
                      style={{
                        background: dniOk ? 'var(--bg-hover)' : undefined,
                        cursor: dniOk ? 'not-allowed' : undefined
                      }}
                    />
                  </div>
                  <div className="inp-group" style={{ textAlign: 'left' }}>
                    <label>Apellido Materno</label>
                    <input 
                      type="text" 
                      value={fApeMaterno} 
                      onChange={e => setFApeMaterno(e.target.value)} 
                      placeholder="Ej: Mamani" 
                      required 
                      readOnly={dniOk}
                      style={{
                        background: dniOk ? 'var(--bg-hover)' : undefined,
                        cursor: dniOk ? 'not-allowed' : undefined
                      }}
                    />
                  </div>
                  <div className="inp-group" style={{ textAlign: 'left' }}>
                    <label>Teléfono</label>
                    <input 
                      type="tel" 
                      value={fTel} 
                      onChange={e => setFTel(e.target.value.replace(/\D/g, ''))} 
                      placeholder="987654321" 
                      maxLength={9}
                    />
                  </div>
                  <div className="inp-group" style={{ textAlign: 'left' }}>
                    <label>Correo (opcional)</label>
                    <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="cliente@gmail.com" />
                  </div>
                </div>
                <div className="mc-btns" style={{ marginTop: '16px' }}>
                  <button type="button" className="mc-sec" onClick={() => setShowClientModal(false)}>Cancelar</button>
                  <button 
                    type="submit" 
                    className="mc-pri" 
                  >
                    {editingClient ? 'Guardar Cambios' : 'Registrar Cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: RECARGA DE SALDO PREPAGO — CON SELECTOR DE MÉTODO */}
      {showPayModal && selectedClient && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '440px' }}>
            <span className="mc-icon">💳</span>
            <div className="mc-title">Recargar Saldo Prepago</div>
            <p className="mc-sub">Cliente: <strong>{selectedClient.nombre}</strong></p>

            {/* Info saldo */}
            <div style={{ background: 'var(--bg-card2)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(22,163,74,0.25)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '600' }}>SALDO PREPAGO DISPONIBLE</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--green)' }}>S/. {selectedClient.saldoCred.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Tope de carga</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-2)' }}>S/. {(selectedClient.limiteCred || 100).toFixed(2)}</div>
              </div>
            </div>

            <form onSubmit={handlePaySubmit}>
              {/* Selector de método de pago — chips visuales */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  Método de Recarga del Cliente
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {METODOS_COBRO.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayMetodo(m.id)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: `2px solid ${payMetodo === m.id ? 'var(--accent)' : 'var(--border)'}`,
                        background: payMetodo === m.id ? 'var(--accent-bg)' : 'var(--bg-card2)',
                        color: payMetodo === m.id ? 'var(--accent)' : 'var(--text-2)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{m.icon}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700' }}>{m.label}</span>
                    </button>
                  ))}
                </div>
                {selectedMetodo && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-3)', textAlign: 'center' }}>
                    {payMetodo === 'Efectivo' ? '💵 Ingresa directo a la gaveta de caja' : `📊 Se registra en "Otros medios" de la caja activa`}
                  </div>
                )}
              </div>

              {/* Monto */}
              <div className="inp-group" style={{ textAlign: 'left', marginBottom: '12px' }}>
                <label>Monto a Recargar (S/.)</label>
                <div className="inp-wrap">
                  <span className="inp-icon">💵</span>
                  <input
                    type="number" step="0.01" min="0.01" max="100"
                    value={payMonto}
                    onChange={e => setPayMonto(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  {[10, 20, 50, 100].map(amt => (
                    <button key={amt} type="button" onClick={() => setPayMonto(String(amt))}
                      style={{ padding: '3px 10px', fontSize: '10px', fontWeight: '700', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card2)', color: 'var(--text-2)', cursor: 'pointer' }}>
                      S/. {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Concepto */}
              <div className="inp-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label>Concepto / Nota</label>
                <input type="text" value={payConcepto} onChange={e => setPayConcepto(e.target.value)} placeholder="Recarga de saldo prepago..." />
              </div>

              <div className="mc-btns" style={{ marginTop: '16px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowPayModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri" style={{ background: 'linear-gradient(135deg, var(--green), #15803d)' }}>
                  ✅ Confirmar Recarga vía {payMetodo}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL MOVIMIENTOS */}
      {showHistoryModal && historyClient && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '520px', maxHeight: '80vh', overflowY: 'auto' }}>
            <span className="mc-icon">📋</span>
            <div className="mc-title">Historial de Tarjeta Prepago</div>
            <p className="mc-sub"><strong>{historyClient.nombre}</strong> — Tope de Carga: S/. {historyClient.limiteCred || 100} · Saldo Disponible: <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>S/. {historyClient.saldoCred.toFixed(2)}</span></p>
            {historyClient.historialPagos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)' }}>
                <p>Sin movimientos registrados aún.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {[...historyClient.historialPagos].reverse().map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-card2)', borderRadius: '10px', border: `1px solid ${p.tipo === 'cargo' ? 'rgba(192,72,58,0.2)' : 'rgba(22,163,74,0.2)'}` }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)' }}>{p.concepto}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                        <span>{p.fecha}</span>
                        {p.metodoPago && p.tipo === 'abono' && (
                          <span style={{ color: 'var(--green)', fontWeight: '600' }}>
                            {METODOS_COBRO.find(m => m.id === p.metodoPago)?.icon} {p.metodoPago}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: p.tipo === 'cargo' ? 'var(--red)' : 'var(--green)' }}>
                      {p.tipo === 'cargo' ? '-' : '+'}S/. {p.monto.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mc-btns" style={{ marginTop: '16px' }}>
              <button className="mc-sec" onClick={() => setShowHistoryModal(false)}>Cerrar</button>
              <button className="mc-pri" onClick={() => { setShowHistoryModal(false); openPayModal(historyClient); }} style={{ background: 'linear-gradient(135deg, var(--green), #15803d)' }}>
                💳 Registrar Recarga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
