"use client";

import React, { useState } from 'react';

export default function CategoriasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catStatus, setCatStatus] = useState('1');

  interface Category {
    id: number;
    name: string;
    status: string;
  }

  const [localCategories, setLocalCategories] = useState<Category[]>([
    { id: 1, name: 'Panes', status: '1' },
    { id: 2, name: 'Tortas', status: '1' },
    { id: 3, name: 'Dulces', status: '1' },
    { id: 4, name: 'Bebidas', status: '1' },
  ]);

  const filteredCategories = localCategories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;

    const newCat: Category = {
      id: Date.now(),
      name: catName,
      status: catStatus
    };

    setLocalCategories([...localCategories, newCat]);
    setShowModal(false);
    setCatName('');
    setCatStatus('1');
  };

  return (
    <div className="screen active">
      {/* TOOLBAR */}
      <div className="tb-bar">
        <div className="tb-left">
          <div className="srch-box">
            <span>🔍</span>
            <input 
              placeholder="Buscar categoría..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-new" onClick={() => setShowModal(true)}>+ Nueva categoría</button>
      </div>

      {/* TABLE PANEL */}
      <div className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>ID</th>
              <th style={{ textAlign: 'left' }}>Nombre Categoría</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
              <th style={{ textAlign: 'left' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map((c) => (
              <tr key={c.id}>
                <td>#{c.id}</td>
                <td style={{ fontWeight: '700', color: 'var(--text)' }}>{c.name}</td>
                <td>
                  <span className={`tag ${c.status === '1' ? 'tg-ok' : 'tg-err'}`}>
                    {c.status === '1' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="act-row">
                    <button className="act-btn" onClick={() => alert('Función de edición de categoría')}>✏️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CATEGORY REGISTRATION MODAL */}
      {showModal && (
        <div className="modal-overlay open">
          <div className="modal-card">
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>Nueva Categoría</div>
            
            <form onSubmit={handleAddCategory}>
              <div className="inp-group">
                <label>Nombre de la Categoría</label>
                <div className="inp-wrap">
                  <input 
                    type="text" 
                    placeholder="Ej: Salados, Galletas, Cafetería" 
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Estado</label>
                <select value={catStatus} onChange={(e) => setCatStatus(e.target.value)}>
                  <option value="1">Activa</option>
                  <option value="0">Inactiva</option>
                </select>
              </div>

              <div className="mc-btns" style={{ marginTop: '22px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">Crear Categoría</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
