"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

interface Category {
  id: number;
  name: string;
  active: boolean;
}

export default function CategoriasPage() {
  const { categories, saveCategory, toggleCategory, loading } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catStatus, setCatStatus] = useState(1);
  const [saving, setSaving] = useState(false);

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenNew = () => {
    setEditingId(null);
    setCatName('');
    setCatStatus(1);
    setShowModal(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingId(c.id);
    setCatName(c.name);
    setCatStatus(c.active ? 1 : 0);
    setShowModal(true);
  };

  const handleToggleStatus = async (c: Category) => {
    await toggleCategory(c.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSaving(true);

    try {
      await saveCategory({
        id: editingId || undefined,
        name: catName.trim(),
        active: catStatus === 1
      });
      setShowModal(false);
      setCatName('');
      setCatStatus(1);
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
        <button className="btn-new" onClick={handleOpenNew}>+ Nueva categoría</button>
      </div>

      {/* TABLE PANEL */}
      <div className="panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>Cargando categorías...</div>
        ) : (
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
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
                    No se encontraron categorías
                  </td>
                </tr>
              ) : filteredCategories.map((c) => (
                <tr key={c.id}>
                  <td>#{c.id}</td>
                  <td style={{ fontWeight: '700', color: 'var(--text)' }}>{c.name}</td>
                  <td>
                    <span className={`tag ${c.active ? 'tg-ok' : 'tg-err'}`}>
                      {c.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="act-row">
                      <button className="act-btn" onClick={() => handleOpenEdit(c)} title="Editar">✏️</button>
                      <button
                        className="act-btn"
                        onClick={() => handleToggleStatus(c)}
                        title={c.active ? 'Desactivar' : 'Activar'}
                        style={{ color: c.active ? 'var(--red)' : 'var(--green)' }}
                      >
                        {c.active ? '🔴' : '🟢'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay open">
          <div className="modal-card">
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>
              {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="inp-group">
                <label>Nombre de la Categoría</label>
                <div className="inp-wrap">
                  <input
                    type="text"
                    placeholder="Ej: Salados, Galletas, Cafetería"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Estado</label>
                <select value={catStatus} onChange={(e) => setCatStatus(Number(e.target.value))}>
                  <option value={1}>Activa</option>
                  <option value={0}>Inactiva</option>
                </select>
              </div>

              <div className="mc-btns" style={{ marginTop: '22px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri" disabled={saving}>
                  {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
