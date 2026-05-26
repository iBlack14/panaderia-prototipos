"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientStatus, setClientStatus] = useState('1');

  // Para modo offline, manejamos clientes dinámicos
  const [localClients, setLocalClients] = useState([
    { id: 1, name: 'Público General', phone: '-', email: '-', status: '1' },
    { id: 2, name: 'Juan Pérez', phone: '987654321', email: 'juan.perez@email.com', status: '1' },
    { id: 3, name: 'María López', phone: '912345678', email: 'maria.lopez@email.com', status: '1' },
  ]);

  const filteredClients = localClients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const handleAddClient = (e) => {
    e.preventDefault();
    if (!clientName) return;

    const newClient = {
      id: Date.now(),
      name: clientName,
      phone: clientPhone || '-',
      email: clientEmail || '-',
      status: clientStatus
    };

    setLocalClients([...localClients, newClient]);
    setShowModal(false);
    
    // Reset Form
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientStatus('1');
  };

  return (
    <div className="screen active">
      {/* TOOLBAR */}
      <div className="tb-bar">
        <div className="tb-left">
          <div className="srch-box">
            <span>🔍</span>
            <input 
              placeholder="Buscar cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-new" onClick={() => setShowModal(true)}>+ Nuevo cliente</button>
      </div>

      {/* TABLE PANEL */}
      <div className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>ID</th>
              <th style={{ textAlign: 'left' }}>Nombre / Empresa</th>
              <th style={{ textAlign: 'left' }}>Teléfono</th>
              <th style={{ textAlign: 'left' }}>Correo</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
              <th style={{ textAlign: 'left' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((c) => (
              <tr key={c.id}>
                <td>#C-{String(c.id).slice(-3)}</td>
                <td style={{ fontWeight: '600', color: 'var(--text)' }}>{c.name}</td>
                <td>{c.phone}</td>
                <td>{c.email}</td>
                <td>
                  <span className={`tag ${c.status === '1' ? 'tg-ok' : 'tg-err'}`}>
                    {c.status === '1' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="act-row">
                    <button className="act-btn" onClick={() => alert('Función de edición de cliente')}>✏️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REGISTRATION MODAL */}
      {showModal && (
        <div className="modal-overlay open">
          <div className="modal-card">
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>Nuevo Cliente</div>
            
            <form onSubmit={handleAddClient}>
              <div className="inp-group">
                <label>Nombre o Razón Social</label>
                <div className="inp-wrap">
                  <input 
                    type="text" 
                    placeholder="Ej: Juan Perez / Inversiones SAC" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Teléfono</label>
                <div className="inp-wrap">
                  <input 
                    type="text" 
                    placeholder="Ej: 987654321" 
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Correo Electrónico</label>
                <div className="inp-wrap">
                  <input 
                    type="email" 
                    placeholder="ejemplo@email.com" 
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Estado</label>
                <select value={clientStatus} onChange={(e) => setClientStatus(e.target.value)}>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </div>

              <div className="mc-btns" style={{ marginTop: '22px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">Crear Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
