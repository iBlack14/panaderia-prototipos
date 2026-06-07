"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface Category {
  id: number;
  name: string;
  status: number;
}

export default function CategoriasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catStatus, setCatStatus] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // --- CARGAR CATEGORÍAS ---
  const loadCategories = async () => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('id_categoria', { ascending: true });
      if (error) {
        toast(`❌ Error cargando categorías: ${error.message}`);
      } else if (data) {
        setCategories(data.map((c: any) => ({
          id: c.id_categoria,
          name: c.nombre,
          status: c.estado
        })));
      }
    } else {
      // Fallback local
      const local = localStorage.getItem('snack_categorias');
      setCategories(local ? JSON.parse(local) : [
        { id: 1, name: 'Panes', status: 1 },
        { id: 2, name: 'Tortas', status: 1 },
        { id: 3, name: 'Dulces', status: 1 },
        { id: 4, name: 'Bebidas', status: 1 },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

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
    setCatStatus(c.status);
    setShowModal(true);
  };

  const handleToggleStatus = async (c: Category) => {
    const newStatus = c.status === 1 ? 0 : 1;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('categorias')
        .update({ estado: newStatus })
        .eq('id_categoria', c.id);
      if (error) {
        toast(`❌ Error: ${error.message}`);
        return;
      }
    } else {
      const updated = categories.map(x => x.id === c.id ? { ...x, status: newStatus } : x);
      setCategories(updated);
      localStorage.setItem('snack_categorias', JSON.stringify(updated));
    }
    toast(`🏷️ Categoría ${newStatus === 1 ? 'activada' : 'desactivada'}`);
    await loadCategories();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSaving(true);

    if (isSupabaseConfigured && supabase) {
      if (editingId) {
        const { error } = await supabase
          .from('categorias')
          .update({ nombre: catName.trim(), estado: catStatus })
          .eq('id_categoria', editingId);
        if (error) {
          toast(`❌ Error: ${error.message}`);
          setSaving(false);
          return;
        }
        toast('🏷️ Categoría actualizada en la nube');
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert({ nombre: catName.trim(), estado: catStatus });
        if (error) {
          toast(`❌ Error: ${error.message}`);
          setSaving(false);
          return;
        }
        toast('🏷️ Categoría creada en la nube');
      }
      await loadCategories();
    } else {
      if (editingId) {
        const updated = categories.map(c => c.id === editingId ? { ...c, name: catName.trim(), status: catStatus } : c);
        setCategories(updated);
        localStorage.setItem('snack_categorias', JSON.stringify(updated));
        toast('🏷️ Categoría actualizada');
      } else {
        const newCat: Category = { id: Date.now(), name: catName.trim(), status: catStatus };
        const updated = [...categories, newCat];
        setCategories(updated);
        localStorage.setItem('snack_categorias', JSON.stringify(updated));
        toast('🏷️ Categoría creada');
      }
    }

    setSaving(false);
    setShowModal(false);
    setCatName('');
    setCatStatus(1);
    setEditingId(null);
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
                    <span className={`tag ${c.status === 1 ? 'tg-ok' : 'tg-err'}`}>
                      {c.status === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="act-row">
                      <button className="act-btn" onClick={() => handleOpenEdit(c)} title="Editar">✏️</button>
                      <button
                        className="act-btn"
                        onClick={() => handleToggleStatus(c)}
                        title={c.status === 1 ? 'Desactivar' : 'Activar'}
                        style={{ color: c.status === 1 ? 'var(--red)' : 'var(--green)' }}
                      >
                        {c.status === 1 ? '🔴' : '🟢'}
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

      {/* TOAST */}
      {toastMsg && <div className="snack" style={{ display: 'block' }}>{toastMsg}</div>}
    </div>
  );
}
