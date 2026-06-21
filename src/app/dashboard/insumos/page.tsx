"use client";

import React, { useState } from 'react';
import { useApp, Insumo } from '@/context/AppContext';

export default function InsumosPage() {
  const { insumos, saveInsumo, toggleInsumo } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [nombre, setNombre] = useState('');
  const [stock, setStock] = useState('0');
  const [costo, setCosto] = useState('0');
  const [unidad, setUnidad] = useState('kg');
  const [minStock, setMinStock] = useState('0');
  const [ruc, setRuc] = useState(''); // SUNAT RUC of provider

  const UNIDADES = ['kg', 'sacos', 'jabas', 'cajas', 'litros', 'unidades', 'gr'];

  const filtered = insumos.filter(i =>
    i.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenNew = () => {
    setEditingId(null);
    setNombre('');
    setStock('0');
    setCosto('0');
    setUnidad('kg');
    setMinStock('0');
    setRuc('');
    setShowModal(true);
  };

  const handleOpenEdit = (ins: Insumo) => {
    setEditingId(ins.id);
    setNombre(ins.nombre);
    setStock(String(ins.stock));
    setCosto(String(ins.costoUnitario));
    setUnidad(ins.unidadMedida);
    setRuc('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    // Validate RUC against SUNAT API (public endpoint, no auth)
    if (ruc.trim()) {
      try {
        const res = await fetch(`https://api.sunat.cloud/v1/ruc/${ruc.trim()}`);
        if (res.ok) {
          // RUC exists in SUNAT, block the operation
          alert('RUC encontrado en SUNAT. No se permite registrar el insumo.');
          return;
        }
      } catch (err) {
        console.error('Error checking SUNAT RUC:', err);
        // If the check fails, allow proceeding (optional)
      }
    }

    saveInsumo({
      id: editingId,
      nombre: nombre.trim(),
      stock: parseFloat(stock) || 0,
      costoUnitario: parseFloat(costo) || 0,
      unidadMedida: unidad,
      stockMinimo: parseFloat(minStock) || 0,
    });
    setShowModal(false);
  };

  // Stats
  const totalInsumos = insumos.length;
  const stockBajo = insumos.filter(i => i.stock <= i.stockMinimo && i.stock > 0 && i.active).length;
  const agotados = insumos.filter(i => i.stock <= 0 && i.active).length;
  const valorTotal = insumos.reduce((sum, i) => {
    const lotesVal = i.lotes && i.lotes.length > 0
      ? i.lotes.reduce((s, l) => s + (l.qty * l.cost), 0)
      : (i.stock * i.costoUnitario);
    return sum + lotesVal;
  }, 0);

  return (
    <div className="screen active">
      {/* KPI Cards */}
      <div className="stats-4">
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-lav">🌾</div>
          </div>
          <div className="st-val">{totalInsumos}</div>
          <div className="st-lbl">Insumos Registrados</div>
        </div>
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-blush">⚠️</div>
          </div>
          <div className="st-val" style={{ color: stockBajo > 0 ? 'var(--amber)' : 'var(--green)' }}>{stockBajo}</div>
          <div className="st-lbl">Stock Bajo</div>
        </div>
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-err">🚫</div>
          </div>
          <div className="st-val" style={{ color: agotados > 0 ? 'var(--red)' : 'var(--green)' }}>{agotados}</div>
          <div className="st-lbl">Agotados</div>
        </div>
        <div className="stat-tile">
          <div className="st-header">
            <div className="st-icon ic-ok">💰</div>
          </div>
          <div className="st-val">S/. {valorTotal.toFixed(2)}</div>
          <div className="st-lbl">Valor en Inventario</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="tb-bar">
        <div className="tb-left">
          <div className="srch-box">
            <span>🔍</span>
            <input
              placeholder="Buscar insumo por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-new" onClick={handleOpenNew}>+ Nuevo Insumo</button>
      </div>

      {/* Table */}
      <div className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Insumo</th>
              <th style={{ textAlign: 'left' }}>Unidad</th>
              <th style={{ textAlign: 'left' }}>Stock Actual</th>
              <th style={{ textAlign: 'left' }}>Stock Minimo</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
              <th style={{ textAlign: 'left' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
                  <div style={{ fontSize: '40px', marginBottom: '8px' }}>🌾</div>
                  No hay insumos registrados. Agrega materias primas para empezar.
                </td>
              </tr>
            ) : (
              filtered.map((ins) => {
                const isAgotado = ins.stock <= 0;
                const isBajo = ins.stock > 0 && ins.stock <= ins.stockMinimo;
                const stockPercent = ins.stockMinimo > 0 ? Math.min((ins.stock / (ins.stockMinimo * 3)) * 100, 100) : 100;
                const barColor = isAgotado ? 'var(--red)' : isBajo ? 'var(--amber)' : 'var(--green)';

                return (
                  <tr key={ins.id} style={{ opacity: ins.active ? 1 : 0.5 }}>
                    <td>
                      <div className="row-chip">
                        <div className="chip-icon">🌾</div>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '13.5px' }}>{ins.nombre}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>ID #{ins.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="tag tg-blue">{ins.unidadMedida}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '800', color: 'var(--text)', marginBottom: '4px' }}>
                        {ins.stock.toFixed(3)} <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{ins.unidadMedida}</span>
                      </div>
                      <div style={{ width: '80px', height: '5px', borderRadius: '10px', background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ width: `${stockPercent}%`, height: '100%', borderRadius: '10px', background: barColor, transition: 'width 0.5s ease' }} />
                      </div>
                    </td>
                    <td style={{ fontWeight: '600', color: 'var(--text-2)' }}>
                      {ins.stockMinimo.toFixed(3)} {ins.unidadMedida}
                    </td>
                    <td>
                      {!ins.active ? (
                        <span className="tag tg-err">Inactivo</span>
                      ) : isAgotado ? (
                        <span className="tag tg-err">Agotado</span>
                      ) : isBajo ? (
                        <span className="tag tg-warn">Stock bajo</span>
                      ) : (
                        <span className="tag tg-ok">Disponible</span>
                      )}
                    </td>
                    <td>
                      <div className="act-row">
                        <button className="act-btn" onClick={() => handleOpenEdit(ins)} title="Editar">✏️</button>
                        <button
                          className={`act-btn ${ins.active ? 'del' : ''}`}
                          onClick={() => toggleInsumo(ins.id)}
                          title={ins.active ? 'Desactivar' : 'Reactivar'}
                        >
                          {ins.active ? '⏸' : '▶️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar Insumo */}
      {showModal && (
        <div className="modal-overlay open" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '520px', maxHeight: '90vh' }}>
            {/* Header inside modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div className="mc-title" style={{ margin: 0, textAlign: 'left' }}>
                {editingId ? '✏️ Editar Insumo' : '🌾 Registrar Nuevo Insumo'}
              </div>
{/* RUC Field */}
<div className="inp-group" style={{ marginTop: '8px' }}>
  <label>RUC del Proveedor</label>
  <input
    type="text"
    value={ruc}
    onChange={(e) => setRuc(e.target.value)}
    placeholder="Ej: 20512345678"
    pattern="[0-9]{11}"
  />
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

            <form onSubmit={handleSubmit}>
              <div className="inp-group">
                <label>Nombre del Insumo</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Harina saco 50kg"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="inp-group">
                  <label>Unidad de Medida</label>
                  <select value={unidad} onChange={(e) => setUnidad(e.target.value)}>
                    {UNIDADES.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className="inp-group">
                  <label>Stock Actual</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>

                <div className="inp-group" style={{ gridColumn: 'span 2' }}>
                  <label>Stock Minimo (alerta)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>



              <div className="mc-btns" style={{ marginTop: '24px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">
                  {editingId ? 'Actualizar Insumo' : 'Registrar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
