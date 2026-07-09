"use client";

import React, { useState } from 'react';
import { useApp, Receta, RecetaIngrediente } from '@/context/AppContext';
import { getFIFOCost } from '@/lib/fifo';

export default function RecetasPage() {
  const { recetas, products, insumos, saveReceta, deleteReceta } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [productoId, setProductoId] = useState('');
  const [rendimiento, setRendimiento] = useState('1');
  const [instrucciones, setInstrucciones] = useState('');
  const [ingredientes, setIngredientes] = useState<RecetaIngrediente[]>([]);
  const [margenDeseado, setMargenDeseado] = useState('30');

  // Add ingredient form
  const [ingInsumoId, setIngInsumoId] = useState('');
  const [ingCantidad, setIngCantidad] = useState('');
  const [ingUnidadSeleccionada, setIngUnidadSeleccionada] = useState('');

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
    setMargenDeseado('30');
    setShowModal(true);
  };

  const handleOpenEdit = (r: Receta) => {
    setEditingId(r.id);
    setProductoId(String(r.productoId));
    setRendimiento(String(r.rendimientoBase));
    setInstrucciones(r.instrucciones || '');
    setIngredientes([...r.ingredientes]);
    setMargenDeseado(String(r.margenDeseado || 30));
    setShowModal(true);
  };

  const formatQuantity = (cant: number, unit: string) => {
    if (!unit) return `${cant}`;
    const u = unit.toLowerCase();
    if (cant > 0 && cant < 1 && u === 'kg') return `${+(cant * 1000).toFixed(2)} g`;
    if (cant > 0 && cant < 1 && (u === 'l' || u === 'litros')) return `${+(cant * 1000).toFixed(2)} ml`;
    return `${cant} ${unit}`;
  };

  const handleAddIngredient = () => {
    const iId = parseInt(ingInsumoId);
    let cant = parseFloat(ingCantidad);
    if (isNaN(iId)) {
      alert('Por favor, selecciona un insumo.');
      return;
    }
    if (isNaN(cant) || cant <= 0) {
      alert('Por favor, ingresa una cantidad válida mayor a 0.');
      return;
    }

    // Prevent duplicate insumo
    if (ingredientes.some(ing => ing.insumoId === iId)) {
      alert('Este insumo ya fue agregado a la receta. Si deseas cambiar la cantidad, elimínalo primero.');
      return;
    }

    const insumo = insumos.find(i => i.id === iId);
    const baseUnit = insumo?.unidadMedida || 'kg';
    
    if (baseUnit.toLowerCase() === 'kg' && ingUnidadSeleccionada === 'g') {
      cant = cant / 1000;
    } else if ((baseUnit.toLowerCase() === 'l' || baseUnit.toLowerCase() === 'litros') && ingUnidadSeleccionada === 'ml') {
      cant = cant / 1000;
    }

    setIngredientes([...ingredientes, {
      insumoId: iId,
      insumoNombre: insumo?.nombre || `Insumo #${iId}`,
      cantidadRequerida: cant,
      unidadMedida: baseUnit,
    }]);
    setIngInsumoId('');
    setIngCantidad('');
    setIngUnidadSeleccionada('');
  };

  const handleRemoveIngredient = (insumoId: number) => {
    setIngredientes(ingredientes.filter(i => i.insumoId !== insumoId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pId = parseInt(productoId);
    
    if (isNaN(pId)) {
      alert('Por favor, selecciona un producto para la receta.');
      return;
    }
    
    if (ingredientes.length === 0) {
      alert('Por favor, agrega al menos un ingrediente (insumo) a la receta.');
      return;
    }

    const marg = parseFloat(margenDeseado);
    if (isNaN(marg) || marg <= 10) {
      alert('El margen de ganancia deseado debe ser mayor a 10%.');
      return;
    }

    const res = await saveReceta({
      id: editingId,
      productoId: pId,
      rendimientoBase: parseFloat(rendimiento) || 1,
      instrucciones: instrucciones.trim(),
      ingredientes,
      margenDeseado: marg
    });
    
    if (res && res.success) {
      setShowModal(false);
    } else {
      const errMsg = res?.message || "Error desconocido";
      if (errMsg.includes("violates unique constraint")) {
        alert("Error de sincronización en la base de datos o receta duplicada. Verifica el SQL o si ya existe una receta para este producto.\nDetalle: " + errMsg);
      } else {
        alert("Ocurrió un error al guardar la receta: " + errMsg);
      }
    }
  };

  // Calculate production cost for display
  const calcCost = (ings: RecetaIngrediente[]) => {
    return ings.reduce((sum, ing) => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      return sum + (insumo ? getFIFOCost(insumo.lotes || [], ing.cantidadRequerida) : 0);
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
            const costoUnitarioProd = costoProd / (r.rendimientoBase || 1);
            const margen = prod && prod.price > 0 ? ((prod.price - costoUnitarioProd) / prod.price * 100) : 0;

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
                            {formatQuantity(ing.cantidadRequerida, ing.unidadMedida || 'kg')}
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
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '10px', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)' }}>Costo Receta</div>
                    <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--accent)' }}>S/. {costoProd.toFixed(2)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-2)', marginTop: '2px' }}>
                      S/. {costoUnitarioProd.toFixed(2)} / ud
                    </div>
                  </div>
                  {prod && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)' }}>Precio Venta (Actual)</div>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text)' }}>S/. {prod.price.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: margen >= (r.margenDeseado || 30) ? 'var(--green)' : 'var(--red)', marginTop: '2px' }}>
                        Margen: {margen.toFixed(1)}% (Des. {r.margenDeseado}%)
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ 
                  marginTop: '8px', 
                  padding: '6px 10px', 
                  background: 'var(--bg-card2)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  fontSize: '11px' 
                }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-2)' }}>Precio Sugerido (+{r.margenDeseado}%):</span>
                  <span style={{ fontWeight: '800', color: 'var(--accent)' }}>
                    S/. {(costoUnitarioProd * (1 + (r.margenDeseado || 30) / 100)).toFixed(2)}
                  </span>
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
      {showModal && (() => {
        const selectedProduct = products.find(p => String(p.id) === productoId);
        const costoTotalReceta = calcCost(ingredientes);
        const cantRendimiento = parseFloat(rendimiento) || 1;
        const costoPorUnidad = costoTotalReceta / cantRendimiento;
        const precioVenta = selectedProduct?.price || 0;
        const utilidadPorUnidad = precioVenta - costoPorUnidad;
        const margenPorcentaje = precioVenta > 0 ? (utilidadPorUnidad / precioVenta) * 100 : 0;

        return (
          <div className="modal-overlay open" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '580px', maxHeight: '90vh' }}>
              {/* Header inside modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className="mc-title" style={{ margin: 0, textAlign: 'left' }}>
                  {editingId ? '✏️ Editar Receta' : '🍞 Nueva Receta'}
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
                {/* Product Selection */}
                <div className="inp-group">
                  <label>Producto (lo que se fabrica)</label>
                  <select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
                    <option value="">-- Elegir producto --</option>
                    {productosDisponibles?.map(p => (
                      <option key={p?.id} value={String(p?.id)}>{p?.name} — {p?.cat}</option>
                    ))}
                    {/* If editing, also show the current product */}
                    {editingId && productoId && !productosDisponibles?.some(p => String(p?.id) === productoId) && (
                      <option value={productoId}>
                        {products?.find(p => String(p?.id) === productoId)?.name || `Producto #${productoId}`}
                      </option>
                    )}
                  </select>
                </div>

                {/* Ingredients Section */}
                <div style={{ border: '1.5px dashed var(--border)', padding: '14px', borderRadius: '12px', background: 'var(--bg-card2)', margin: '14px 0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    Agregar Ingrediente (Insumo)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                    <div className="inp-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '9px' }}>Insumo</label>
                      <select value={ingInsumoId} onChange={(e) => {
                        setIngInsumoId(e.target.value);
                        const ins = insumos?.find(i => String(i.id) === e.target.value);
                        setIngUnidadSeleccionada(ins?.unidadMedida || '');
                      }}>
                        <option value="">-- Elegir insumo --</option>
                        {insumos?.filter(i => i?.active && !ingredientes?.some(ing => ing?.insumoId === i?.id))?.map(i => (
                          <option key={i?.id} value={String(i?.id)}>
                            {i?.nombre} (S/. {i?.costoUnitario?.toFixed(2)} / {i?.unidadMedida}) — Stock: {i?.stock?.toFixed(1)} {i?.unidadMedida}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="inp-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '9px' }}>Cantidad</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={ingCantidad}
                          onChange={(e) => setIngCantidad(e.target.value)}
                          placeholder="0.000"
                          style={{ paddingRight: ingInsumoId && (insumos.find(i => String(i.id) === ingInsumoId)?.unidadMedida?.toLowerCase() === 'kg' || insumos.find(i => String(i.id) === ingInsumoId)?.unidadMedida?.toLowerCase() === 'l' || insumos.find(i => String(i.id) === ingInsumoId)?.unidadMedida?.toLowerCase() === 'litros') ? '60px' : '45px' }}
                        />
                        {ingInsumoId && (() => {
                          const baseU = insumos.find(i => String(i.id) === ingInsumoId)?.unidadMedida || 'und';
                          const isKg = baseU.toLowerCase() === 'kg';
                          const isL = baseU.toLowerCase() === 'l' || baseU.toLowerCase() === 'litros';
                          
                          if (isKg || isL) {
                            return (
                              <select
                                value={ingUnidadSeleccionada}
                                onChange={(e) => setIngUnidadSeleccionada(e.target.value)}
                                style={{
                                  position: 'absolute',
                                  right: '2px',
                                  height: 'calc(100% - 4px)',
                                  border: 'none',
                                  borderLeft: '1px solid var(--border)',
                                  background: 'transparent',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  color: 'var(--text-2)',
                                  padding: '0 4px',
                                  cursor: 'pointer',
                                  outline: 'none'
                                }}
                              >
                                <option value={baseU}>{baseU}</option>
                                {isKg && <option value="g">g</option>}
                                {isL && <option value="ml">ml</option>}
                              </select>
                            );
                          } else {
                            return (
                              <span style={{
                                position: 'absolute',
                                right: '12px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: 'var(--text-3)',
                                pointerEvents: 'none'
                              }}>
                                {baseU}
                              </span>
                            );
                          }
                        })()}
                      </div>
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
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: 'var(--bg-card2)',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            marginBottom: '6px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)' }}>
                              {ing.insumoNombre}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                              {formatQuantity(ing.cantidadRequerida, ing.unidadMedida || 'kg')} · S/. {insumo?.costoUnitario?.toFixed(2) || '0.00'} / {ing.unidadMedida}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                            <span style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '13px' }}>
                              S/. {costoLinea.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(ing.insumoId)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--red)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                transition: 'background 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                              title="Quitar ingrediente"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="inp-group">
                    <label>Rendimiento (unidades)</label>
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
                    <label>Ganancia Deseada (%) (&gt; 10%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="10.01"
                      value={margenDeseado}
                      onChange={(e) => setMargenDeseado(e.target.value)}
                      placeholder="30"
                      required
                    />
                  </div>
                </div>
                
                <div className="inp-group">
                  <label>Instrucciones de Preparación (opcional)</label>
                  <input
                    type="text"
                    value={instrucciones}
                    onChange={(e) => setInstrucciones(e.target.value)}
                    placeholder="Ej: Hornear 180C por 45 min"
                  />
                </div>

                {/* Dynamic Cost and Margin Summary Box */}
                {ingredientes.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    {selectedProduct ? (
                      <div style={{
                        marginTop: '16px',
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, rgba(254, 246, 232, 0.9) 0%, rgba(255, 253, 248, 0.9) 100%)',
                        borderRadius: '16px',
                        border: '1px solid rgba(176, 125, 46, 0.25)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: '10px' }}>
                          Análisis de Costos y Margen
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '12px' }}>
                          <div style={{ background: 'var(--bg-card2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase' }}>Costo Receta</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>S/. {costoTotalReceta.toFixed(2)}</div>
                            <div style={{ fontSize: '9.5px', color: 'var(--text-2)', marginTop: '2px' }}>
                              S/. {costoPorUnidad.toFixed(2)} / ud
                            </div>
                          </div>
                          <div style={{ background: 'var(--bg-card2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase' }}>Precio Venta</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>S/. {precioVenta.toFixed(2)}</div>
                            <div style={{ fontSize: '9.5px', color: 'var(--text-2)', marginTop: '2px' }}>S/. {precioVenta.toFixed(2)} / ud</div>
                          </div>
                          <div style={{
                            background: margenPorcentaje >= (parseFloat(margenDeseado) || 30) ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            padding: '10px',
                            borderRadius: '10px',
                            border: `1px solid ${margenPorcentaje >= (parseFloat(margenDeseado) || 30) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                          }}>
                            <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase' }}>Margen Est.</div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '800',
                              color: margenPorcentaje >= (parseFloat(margenDeseado) || 30) ? 'var(--green)' : 'var(--red)'
                            }}>
                              {margenPorcentaje.toFixed(1)}%
                            </div>
                            <div style={{ fontSize: '9.5px', color: 'var(--text-2)', marginTop: '2px' }}>
                              Deseado: {margenDeseado}%
                            </div>
                          </div>
                          <div style={{ background: 'var(--bg-card2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase' }}>Precio Sugerido</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)' }}>
                              S/. {(costoPorUnidad * (1 + (parseFloat(margenDeseado) || 30) / 100)).toFixed(2)}
                            </div>
                            <div style={{ fontSize: '9.5px', color: 'var(--text-2)', marginTop: '2px' }}>Con +{margenDeseado}% margen</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--accent-bg)', borderRadius: '8px', marginTop: '6px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '13px' }}>
                          Costo total de produccion:
                        </span>
                        <span style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '14px' }}>
                          S/. {costoTotalReceta.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mc-btns" style={{ marginTop: '24px' }}>
                  <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="mc-pri">
                    {editingId ? 'Actualizar Receta' : 'Guardar Receta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
