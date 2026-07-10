"use client";

import React, { useState } from 'react';
import { useApp, Receta, RecetaIngrediente } from '@/context/AppContext';
import { getFIFOCost } from '@/lib/fifo';

export default function RecetasPage() {
  const { recetas, products, insumos, saveReceta, deleteReceta, saveProduct } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [productoId, setProductoId] = useState('');
  const [rendimiento, setRendimiento] = useState('1');
  const [instrucciones, setInstrucciones] = useState('');
  const [ingredientes, setIngredientes] = useState<RecetaIngrediente[]>([]);
  const [margenDeseado, setMargenDeseado] = useState('30');
  const [precioVentaEdit, setPrecioVentaEdit] = useState('');

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
    setPrecioVentaEdit('');
    setShowModal(true);
  };

  const handleOpenEdit = (r: Receta) => {
    setEditingId(r.id);
    setProductoId(String(r.productoId));
    setRendimiento(String(r.rendimientoBase));
    setInstrucciones(r.instrucciones || '');
    setIngredientes([...r.ingredientes]);
    setMargenDeseado(String(r.margenDeseado || 30));
    
    const prod = products.find(p => p.id === r.productoId);
    setPrecioVentaEdit(prod ? String(prod.price) : '');
    
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

    const prod = products.find(p => p.id === pId);
    const newPrice = parseFloat(precioVentaEdit);
    if (prod && !isNaN(newPrice) && newPrice !== prod.price) {
      await saveProduct({ ...prod, price: newPrice });
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
        const precioVenta = parseFloat(precioVentaEdit) || 0;
        const utilidadPorUnidad = precioVenta - costoPorUnidad;
        const margenPorcentaje = precioVenta > 0 ? (utilidadPorUnidad / precioVenta) * 100 : 0;

        return (
          <div className="modal-overlay open" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '640px', maxHeight: '90vh', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div className="mc-title" style={{ margin: 0, textAlign: 'left', fontSize: '22px' }}>
                  {editingId ? '✏️ Editar Receta' : '🍞 Nueva Receta'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    fontSize: '16px',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--text-3)'; }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* SECCIÓN 1: DATOS DE PRODUCCIÓN */}
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    1. Datos de Producción
                  </div>
                  
                  <div className="inp-group">
                    <label>Producto (lo que se fabrica)</label>
                    <select value={productoId} onChange={(e) => {
                      setProductoId(e.target.value);
                      const p = products.find(prod => String(prod.id) === e.target.value);
                      if (p) setPrecioVentaEdit(String(p.price));
                    }} required>
                      <option value="">-- Elegir producto --</option>
                      {productosDisponibles?.map(p => (
                        <option key={p?.id} value={String(p?.id)}>{p?.name} — {p?.cat}</option>
                      ))}
                      {editingId && productoId && !productosDisponibles?.some(p => String(p?.id) === productoId) && (
                        <option value={productoId}>
                          {products?.find(p => String(p?.id) === productoId)?.name || `Producto #${productoId}`}
                        </option>
                      )}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="inp-group" style={{ margin: 0 }}>
                      <label>Rendimiento (unidades)</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={rendimiento}
                        onChange={(e) => setRendimiento(e.target.value)}
                        placeholder="Ej: 50"
                        style={{ padding: '10px 12px' }}
                      />
                    </div>
                    <div className="inp-group" style={{ margin: 0 }}>
                      <label>Ganancia Deseada (%) (&gt; 10%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="10.01"
                        value={margenDeseado}
                        onChange={(e) => setMargenDeseado(e.target.value)}
                        placeholder="Ej: 30"
                        style={{ padding: '10px 12px' }}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 2: FÓRMULA E INSUMOS */}
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    2. Fórmula e Insumos
                  </div>

                  <div style={{ border: '1.5px dashed var(--border)', padding: '16px', borderRadius: '10px', background: 'var(--bg-card2)', marginBottom: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                      <div className="inp-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '10px' }}>Insumo</label>
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
                        <label style={{ fontSize: '10px' }}>Cantidad</label>
                        <div style={{ display: 'flex', alignItems: 'stretch' }}>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={ingCantidad}
                            onChange={(e) => setIngCantidad(e.target.value)}
                            placeholder="0.000"
                            style={{ 
                              flex: 1, 
                              minWidth: 0, 
                              borderTopRightRadius: ingInsumoId ? 0 : undefined, 
                              borderBottomRightRadius: ingInsumoId ? 0 : undefined 
                            }}
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
                                    width: '55px',
                                    border: '1px solid var(--border)',
                                    borderLeft: 'none',
                                    borderTopRightRadius: '6px',
                                    borderBottomRightRadius: '6px',
                                    background: 'var(--bg)',
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
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '0 12px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  color: 'var(--text-3)',
                                  border: '1px solid var(--border)',
                                  borderLeft: 'none',
                                  borderTopRightRadius: '6px',
                                  borderBottomRightRadius: '6px',
                                  background: 'var(--bg)'
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

                  {ingredientes.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '8px' }}>
                        Ingredientes de la Receta ({ingredientes.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                padding: '12px 16px',
                                background: 'var(--bg)',
                                borderRadius: '10px',
                                border: '1px solid var(--border)'
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
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
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
                                    padding: '6px',
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
                    </div>
                  )}

                  <div className="inp-group" style={{ margin: 0 }}>
                    <label>Instrucciones de Preparación (opcional)</label>
                    <input
                      type="text"
                      value={instrucciones}
                      onChange={(e) => setInstrucciones(e.target.value)}
                      placeholder="Ej: Hornear a 180°C por 45 minutos..."
                      style={{ padding: '10px 12px' }}
                    />
                  </div>
                </div>

                {/* SECCIÓN 3: RESUMEN FINANCIERO */}
                {ingredientes.length > 0 && (
                  <div style={{
                    padding: '20px',
                    background: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      3. Resumen Financiero
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {/* Costo por Unidad */}
                      <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '8px' }}>Costo por Unidad</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>S/. {costoPorUnidad.toFixed(2)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                          Costo total receta: S/. {costoTotalReceta.toFixed(2)}
                        </div>
                      </div>
                      
                      {/* Precio Sugerido */}
                      <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '8px' }}>Precio Sugerido</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent)' }}>
                          S/. {(costoPorUnidad * (1 + (parseFloat(margenDeseado) || 30) / 100)).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                          Para ganar el {margenDeseado}% deseado
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mc-btns" style={{ marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <button type="button" className="mc-sec" onClick={() => setShowModal(false)} style={{ padding: '12px 24px', fontSize: '14px' }}>Cancelar</button>
                  <button type="submit" className="mc-pri" style={{ padding: '12px 24px', fontSize: '14px' }}>
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
