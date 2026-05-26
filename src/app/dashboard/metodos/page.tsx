"use client";

import React, { useState } from 'react';
import { useApp, PaymentMethod } from '@/context/AppContext';

export default function MetodosPagoPage() {
  const { paymentMethods, savePaymentMethod, togglePaymentMethod } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const filteredMethods = paymentMethods.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenNew = () => {
    setEditingId(null);
    setName('');
    setDesc('');
    setShowModal(true);
  };

  const handleOpenEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setName(method.name);
    setDesc(method.desc || '');
    setShowModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const methodObj = {
      id: editingId,
      name,
      desc
    };

    savePaymentMethod(methodObj);
    setShowModal(false);
  };

  return (
    <div className="screen active">
      {/* TOOLBAR */}
      <div className="tb-bar">
        <div className="tb-left">
          <div className="srch-box">
            <span>🔍</span>
            <input 
              placeholder="Buscar método de pago..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-new" onClick={handleOpenNew}>+ Nuevo método</button>
      </div>

      {/* TABLE PANEL */}
      <div className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>ID</th>
              <th style={{ textAlign: 'left' }}>Método de Pago</th>
              <th style={{ textAlign: 'left' }}>Descripción</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
              <th style={{ textAlign: 'left' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredMethods.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
                  Sin métodos de pago configurados.
                </td>
              </tr>
            ) : (
              filteredMethods.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: '700', color: 'var(--text-3)' }}>#{String(m.id).slice(-3)}</td>
                  <td style={{ fontWeight: '700', color: 'var(--accent)' }}>{m.name}</td>
                  <td style={{ color: 'var(--text-2)' }}>{m.desc || '-'}</td>
                  <td>
                    <span className={`tag ${m.active ? 'tg-ok' : 'tg-err'}`}>
                      {m.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="act-row">
                      <button className="act-btn" onClick={() => handleOpenEdit(m)} title="Editar">✏️</button>
                      <button 
                        className={`act-btn ${m.active ? 'del' : ''}`} 
                        onClick={() => togglePaymentMethod(m.id)}
                        title={m.active ? 'Desactivar' : 'Activar'}
                      >
                        {m.active ? '❌' : '✅'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* REGISTRATION MODAL */}
      {showModal && (
        <div className="modal-overlay open">
          <div className="modal-card">
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>
              {editingId ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="inp-group">
                <label>Nombre del Método</label>
                <div className="inp-wrap">
                  <input 
                    type="text" 
                    placeholder="Ej: Mastercard, Bitcoin, Transferencia Interbancaria" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Descripción corta</label>
                <div className="inp-wrap">
                  <input 
                    type="text" 
                    placeholder="Ej: Transferencia directa al banco X" 
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="mc-btns" style={{ marginTop: '22px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">
                  {editingId ? 'Guardar Cambios' : 'Crear Método'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
