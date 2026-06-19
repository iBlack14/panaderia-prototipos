"use client";

import React, { useState } from 'react';
import { useApp, Receta, RecetaIngrediente } from '@/context/AppContext';

export default function RecetasPage() {
  const { recetas, products, insumos, saveReceta, deleteReceta } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [productoId, setProductoId] = useState('');
  const [rendimiento, setRendimiento] = useState('1');
  const [instrucciones, setInstrucciones] = useState('');
  const [ingredientes, setIngredientes] = useState<RecetaIngrediente[]>([]);

  // Add ingredient form
  const [ingInsumoId, setIngInsumoId] = useState('');
  const [ingCantidad, setIngCantidad] = useState('');

  // Products without a recipe (available for new recipes)
  const productosDisponibles = products.filter(p =>
    p.cat !== 'Insumos' && !recetas.some(r => r.productoId === p.id && r.id !== editingId)
  );

  const handleOpenNew = () => {
    setEditingId(null);
    setProductoId('');
    setRendimiento('1');
    setInstrucciones('');
    setIngredientes([]);
    setShowModal(true);
  };

  const handleOpenEdit = (r: Receta) => {
    setEditingId(r.id);
    setProductoId(String(r.productoId));
    setRendimiento(String(r.rendimientoBase));
    setInstrucciones(r.instrucciones || '');
    setIngredientes([...r.ingredientes]);
    setShowModal(true);
  };

  const handleAddIngredient = () => {
    const iId = parseInt(ingInsumoId);
    const cant = parseFloat(ingCantidad);
    if (isNaN(iId) || isNaN(cant) || cant <= 0) return;

    // Prevent duplicate insumo
    if (ingredientes.some(ing => ing.insumoId === iId)) {
      return;
    }

    const insumo = insumos.find(i => i.id === iId);
    setIngredientes([...ingredientes, {
      insumoId: iId,
      insumoNombre: insumo?.nombre || `Insumo #${iId}`,
      cantidadRequerida: cant,
      unidadMedida: insumo?.unidadMedida || 'kg',
    }]);
    setIngInsumoId('');
    setIngCantidad('');
  };

  const handleRemoveIngredient = (insumoId: number) => {
    setIngredientes(ingredientes.filter(i => i.insumoId !== insumoId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pId = parseInt(productoId);
    if (isNaN(pId) || ingredientes.length === 0) return;

    saveReceta({
      id: editingId,
      productoId: pId,
      rendimientoBase: parseFloat(rendimiento) || 1,
      instrucciones: instrucciones.trim(),
      ingredientes,
    });
    setShowModal(false);
  };

  // Calculate production cost for display
  const calcCost = (ings: RecetaIngrediente[]) => {
    return ings.reduce((sum, ing) => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      return sum + (ing.cantidadRequerida * (insumo?.costoUnitario || 0));
    }, 0);
  };

  return (
    <div className="screen active">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", fontSize: '20px', color: 'var(--text)' }}>
            Recetas y Formulas de Produccion
          </h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-3)', marginTop: '3px' }}>
            Define que insumos necesita cada producto. Al producir, los insumos se descontaran automaticamente.
          </p>
        </div>
        <button className="btn-new" onClick={handleOpenNew}>+ Nueva Receta</button>
      </div>

      {/* Recipes Grid */}
      {recetas.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '50px' }}>
          <div style={{ fontSize: '50px', marginBottom: '12px' }}>📋</div>
          <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '15px', marginBottom: '6px' }}>
            No hay recetas registradas
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-3)', maxWidth: '400px', margin: '0 auto' }}>
            Crea una receta para vincular insumos (harina, huevos, etc.) con los productos que vendes (tortas, panes). Al registrar produccion, los insumos se descontaran automaticamente del inventario.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
          {recetas.map((r) => {
            const costoProd = calcCost(r.ingredientes);
            const prod = products.find(p => p.id === r.productoId);
            const margen = prod ? ((prod.price - costoProd) / prod.price * 100) : 0;

            return (
              <div key={r.id} className="panel" style={{ padding: '18px' }}>
                {/* Recipe Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text)' }}>
                      {r.productoNombre || `Producto #${r.productoId}`}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                      Rinde: {r.rendimientoBase} {r.rendimientoBase === 1 ? 'unidad' : 'unidades'}
                    </div>
                  </div>
                  <div className="act-row">
                    <button className="act-btn" onClick={() => handleOpenEdit(r)} title="Editar">✏️</button>
                    <button className="act-btn del" onClick={() => { if (confirm('¿Eliminar esta receta?')) deleteReceta(r.id); }} title="Eliminar">🗑</button>
                  </div>
                </div>

                {/* Ingredients List */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Ingredientes ({r.ingredientes.length})
                  </div>
                  {r.ingredientes.map((ing, idx) => {
                    const insumo = insumos.find(i => i.id === ing.insumoId);
                    const costoLinea = ing.cantidadRequerida * (insumo?.costoUnitario || 0);
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: '12.5px' }}>
                        <div style={{ color: 'var(--text)', fontWeight: '600' }}>
                          {ing.insumoNombre || `Insumo #${ing.insumoId}`}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-2)' }}>
                            {ing.cantidadRequerida} {ing.unidadMedida || 'kg'}
                          </span>
                          <span style={{ fontWeight: '700', color: 'var(--accent)', minWidth: '70px', textAlign: 'right' }}>
                            S/. {costoLinea.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cost Footer */}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)' }}>Costo de Produccion</div>
                    <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--accent)' }}>S/. {costoProd.toFixed(2)}</div>
                  </div>
                  {prod && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)' }}>Precio Venta</div>
                      <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text)' }}>S/. {prod.price.toFixed(2)}</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: margen > 30 ? 'var(--green)' : margen > 10 ? 'var(--amber)' : 'var(--red)' }}>
                        Margen: {margen.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                {r.instrucciones && (
                  <div style={{ marginTop: '10px', padding: '8px 10px', background: 'var(--bg)', borderRadius: '8px', fontSize: '11.5px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                    {r.instrucciones}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear/Editar Receta */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-hdr">
              <h3 style={{ margin: 0, fontFamily: "'DM Serif Display', serif" }}>
                {editingId ? 'Editar Receta' : 'Nueva Receta'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>X</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Product Selection */}
              <div className="inp-group">
                <label>Producto (lo que se fabrica)</label>
                <select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
                  <option value="">-- Elegir producto --</option>
                  {productosDisponibles.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.name} — {p.cat} (S/. {p.price.toFixed(2)})</option>
                  ))}
                  {/* If editing, also show the current product */}
                  {editingId && productoId && !productosDisponibles.some(p => String(p.id) === productoId) && (
                    <option value={productoId}>
                      {products.find(p => String(p.id) === productoId)?.name || `Producto #${productoId}`}
                    </option>
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="inp-group">
                  <label>Rendimiento (unidades que produce)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={rendimiento}
                    onChange={(e) => setRendimiento(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="inp-group">
                  <label>Instrucciones (opcional)</label>
                  <input
                    type="text"
                    value={instrucciones}
                    onChange={(e) => setInstrucciones(e.target.value)}
                    placeholder="Ej: Hornear 180C por 45 min"
                  />
                </div>
              </div>

              {/* Ingredients Section */}
              <div style={{ border: '1.5px dashed var(--border)', padding: '14px', borderRadius: '12px', background: 'var(--bg-card2)', margin: '14px 0' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  Agregar Ingrediente (Insumo)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>Insumo</label>
                    <select value={ingInsumoId} onChange={(e) => setIngInsumoId(e.target.value)}>
                      <option value="">-- Elegir insumo --</option>
                      {insumos.filter(i => i.active && !ingredientes.some(ing => ing.insumoId === i.id)).map(i => (
                        <option key={i.id} value={String(i.id)}>
                          {i.nombre} ({i.stock.toFixed(1)} {i.unidadMedida} disponibles)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>
                      Cantidad ({insumos.find(i => String(i.id) === ingInsumoId)?.unidadMedida || 'unidad'})
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={ingCantidad}
                      onChange={(e) => setIngCantidad(e.target.value)}
                      placeholder="0.000"
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-new"
                    onClick={handleAddIngredient}
                    style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              {/* Ingredients List */}
              {ingredientes.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>
                    Ingredientes de la Receta ({ingredientes.length})
                  </div>
                  {ingredientes.map((ing, idx) => {
                    const insumo = insumos.find(i => i.id === ing.insumoId);
                    const costoLinea = ing.cantidadRequerida * (insumo?.costoUnitario || 0);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', background: 'var(--bg-card2)', borderRadius: '8px', marginBottom: '4px'
                        }}
                      >
                        <div style={{ fontWeight: '600', fontSize: '12.5px', color: 'var(--text)' }}>
                          {ing.insumoNombre}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                            {ing.cantidadRequerida} {ing.unidadMedida || 'kg'}
                          </span>
                          <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '12px' }}>
                            S/. {costoLinea.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="act-btn del"
                            onClick={() => handleRemoveIngredient(ing.insumoId)}
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            X
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Cost Summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--accent-bg)', borderRadius: '8px', marginTop: '6px' }}>
                    <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '13px' }}>
                      Costo total de produccion:
                    </span>
                    <span style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '14px' }}>
                      S/. {calcCost(ingredientes).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn-new"
                style={{ width: '100%', padding: '12px' }}
                disabled={!productoId || ingredientes.length === 0}
              >
                {editingId ? 'Actualizar Receta' : 'Guardar Receta'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
