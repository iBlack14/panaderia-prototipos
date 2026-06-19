"use client";

import React, { useState } from 'react';
import { useApp, Product, ProductVersion } from '@/context/AppContext';

export default function ProductosPage() {
  const { 
    products, 
    categories,
    saveProduct, 
    deleteProduct, 
    breadLogs, 
    logBreadProduction, 
    logBreadDiscard,
    logBreadConversion,
    fractionateProduct
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBreadModal, setShowBreadModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'mermas' | 'kardex'>('list');

  // --- FORM STATES FOR PRODUCT CRUD ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [unidadMedida, setUnidadMedida] = useState('unidades');
  
  // Variants states
  const [variantsList, setVariantsList] = useState<ProductVersion[]>([]);
  const [vName, setVName] = useState('');
  const [vPrice, setVPrice] = useState('');
  const [vStock, setVStock] = useState('0');
  const [vParentVersionId, setVParentVersionId] = useState<number | null>(null);
  const [vFractionRatio, setVFractionRatio] = useState('1');

  // Fraction modal states
  const [showFractionModal, setShowFractionModal] = useState(false);
  const [fractionProduct, setFractionProduct] = useState<Product | null>(null);
  const [parentVersionId, setParentVersionId] = useState<number>(0);
  const [childVersionId, setChildVersionId] = useState<number>(0);
  const [qtyToDeduct, setQtyToDeduct] = useState('1');
  const [qtyToAdd, setQtyToAdd] = useState('10');

  // --- FORM STATES FOR PRODUCTION/DISCARD LOGS ---
  const [logProductId, setLogProductId] = useState('');
  const [logVariant, setLogVariant] = useState('');
  const [logType, setLogType] = useState<'produccion' | 'descarte' | 'conversion'>('produccion');
  const [logQty, setLogQty] = useState('');
  const [logReason, setLogReason] = useState('Ingreso inicial de producción diaria');
  const [logConvDest, setLogConvDest] = useState('');     // Para conversión: producto destino
  const [logCostoEst, setLogCostoEst] = useState('');    // Costo estimado del insumo

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const breadProducts = products.filter(p => p.cat === 'Panes');

  // --- VARIANT LOGIC IN MODAL ---
  const handleAddVariant = () => {
    if (!vName || !vPrice) return;
    const newV: ProductVersion = {
      id: Date.now(),
      name: vName,
      price: parseFloat(vPrice),
      stock: parseFloat(vStock) || 0,
      parent_version_id: vParentVersionId,
      fraction_ratio: parseFloat(vFractionRatio) || 1
    };
    setVariantsList([...variantsList, newV]);
    setVName('');
    setVPrice('');
    setVStock('0');
    setVParentVersionId(null);
    setVFractionRatio('1');
  };

  const handleRemoveVariant = (id: number) => {
    setVariantsList(variantsList.filter(x => x.id !== id));
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setName('');
    setCat(categories[0]?.name || 'Panes');
    setPrice('');
    setStock('0');
    setVariantsList([]);
    setUnidadMedida('unidades');
    setVParentVersionId(null);
    setVFractionRatio('1');
    setShowProductModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setCat(p.cat);
    setPrice(String(p.price));
    setStock(String(p.stock));
    setVariantsList(p.versions || []);
    setUnidadMedida(p.unidad_medida || 'unidades');
    setVParentVersionId(null);
    setVFractionRatio('1');
    setShowProductModal(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const prodObj = {
      id: editingId,
      name,
      cat,
      price: parseFloat(price) || 0,
      stock: parseFloat(stock) || 0,
      versions: variantsList,
      unidad_medida: unidadMedida
    };

    saveProduct(prodObj);
    setShowProductModal(false);
  };

  const handleOpenFractionModal = (p: Product) => {
    setFractionProduct(p);
    if (p.versions && p.versions.length >= 2) {
      setParentVersionId(p.versions[0].id);
      setChildVersionId(p.versions[1].id);
    }
    setQtyToDeduct('1');
    setQtyToAdd('10');
    setShowFractionModal(true);
  };

  const handleFractionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fractionProduct || !parentVersionId || !childVersionId) return;
    const parentV = fractionProduct.versions.find(v => v.id === parentVersionId);
    const deductVal = parseFloat(qtyToDeduct);
    const addVal = parseFloat(qtyToAdd);

    if (isNaN(deductVal) || deductVal <= 0 || isNaN(addVal) || addVal <= 0) {
      alert('Por favor ingrese cantidades válidas.');
      return;
    }

    if (parentV && parentV.stock < deductVal) {
      if (!confirm(`La cantidad a restar (${deductVal}) supera el stock actual (${parentV.stock}). ¿Desea continuar de todos modos?`)) {
        return;
      }
    }

    try {
      await fractionateProduct(parentVersionId, childVersionId, deductVal, addVal);
      setShowFractionModal(false);
    } catch (err: any) {
      alert('Error al fraccionar variante: ' + err.message);
    }
  };

  // --- PRODUCTION, DISCARD & CONVERSION SUBMIT ---
  const handleBreadLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pId = parseInt(logProductId);
    const qty = parseFloat(logQty);
    if (isNaN(pId) || isNaN(qty) || qty <= 0) return;

    if (logType === 'produccion') {
      logBreadProduction(pId, qty, logVariant || null);
    } else if (logType === 'conversion') {
      if (!logConvDest.trim()) return;
      logBreadConversion(pId, qty, logConvDest, logCostoEst ? parseFloat(logCostoEst) : undefined, logVariant || null);
    } else {
      logBreadDiscard(pId, qty, logReason, logVariant || null);
    }

    setShowBreadModal(false);
    setLogProductId('');
    setLogVariant('');
    setLogQty('');
    setLogReason('Ingreso inicial de producción diaria');
    setLogConvDest('');
    setLogCostoEst('');
  };

  const handleProductChangeForLogs = (id: string) => {
    setLogProductId(id);
    setLogVariant('');
  };

  const selectedBreadProd = products.find(x => x.id === parseInt(logProductId));

  return (
    <div className="screen active">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <button 
          onClick={() => setActiveTab('list')}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', background: activeTab === 'list' ? 'var(--accent-bg)' : 'transparent', color: activeTab === 'list' ? 'var(--accent)' : 'var(--text-3)', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer' }}
        >
          📦 Catálogo de Productos
        </button>
        <button 
          onClick={() => setActiveTab('mermas')}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', background: activeTab === 'mermas' ? 'var(--accent-bg)' : 'transparent', color: activeTab === 'mermas' ? 'var(--accent)' : 'var(--text-3)', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer' }}
        >
          🥖 Control de Panes y Descartes
        </button>
        <button 
          onClick={() => setActiveTab('kardex')}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', background: activeTab === 'kardex' ? 'var(--accent-bg)' : 'transparent', color: activeTab === 'kardex' ? 'var(--accent)' : 'var(--text-3)', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer' }}
        >
          📊 Kardex — Trazabilidad Completa
        </button>
      </div>

      {/* --- TAB 1: PRODUCT LIST & CRUD --- */}
      {activeTab === 'list' && (
        <div>
          {/* TOOLBAR */}
          <div className="tb-bar">
            <div className="tb-left">
              <div className="srch-box">
                <span>🔍</span>
                <input 
                  placeholder="Filtrar catálogo por nombre..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <button className="btn-new" onClick={handleOpenNew}>+ Nuevo producto</button>
          </div>

          {/* TABLE PANEL */}
          <div className="panel">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Producto</th>
                  <th style={{ textAlign: 'left' }}>Categoría</th>
                  <th style={{ textAlign: 'left' }}>Precio Base</th>
                  <th style={{ textAlign: 'left' }}>Stock Disponible</th>
                  <th style={{ textAlign: 'left' }}>Variantes</th>
                  <th style={{ textAlign: 'left' }}>Estado</th>
                  <th style={{ textAlign: 'left' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const catColor: Record<string, string> = { 'Panes': 'tg-blue', 'Tortas': 'tg-blue', 'Dulces': 'tg-warn', 'Bebidas': 'tg-ok', 'Insumos': 'tg-warn' };
                  const totalStock = p.versions.length > 0 
                    ? p.versions.reduce((a, b) => a + b.stock, 0)
                    : p.stock;
                  
                  const isAgotado = totalStock <= 0;
                  const isBajoStock = totalStock < 10;

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="row-chip">
                          <div className="chip-icon">
                            {{
                              'Panes': '🍞',
                              'Tortas': '🎂',
                              'Dulces': '🍬',
                              'Bebidas': '🥤',
                              'Insumos': '🌾'
                            }[p.cat] || '📦'}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '13.5px' }}>{p.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>ID #{p.id}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`tag ${catColor[p.cat] || 'tg-blue'}`}>{p.cat}</span></td>
                      <td style={{ fontWeight: '800', color: 'var(--accent)' }}>
                        {p.versions.length > 0
                          ? `Desde S/. ${Math.min(...p.versions.map(v => v.price)).toFixed(2)}`
                          : `S/. ${p.price.toFixed(2)}`
                        }
                      </td>
                      <td style={{ fontWeight: '700', color: 'var(--text)' }}>
                        {totalStock} <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{p.unidad_medida || 'unidades'}</span>
                      </td>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-2)' }}>
                        {p.versions.length > 0 
                          ? p.versions.map(v => `${v.name} (${v.stock})`).join(', ')
                          : 'Sin variantes'
                        }
                      </td>
                      <td>
                        {isAgotado ? (
                          <span className="tag tg-err">Agotado</span>
                        ) : isBajoStock ? (
                          <span className="tag tg-warn">Stock bajo</span>
                        ) : (
                          <span className="tag tg-ok">Disponible</span>
                        )}
                      </td>
                      <td>
                        <div className="act-row">
                          <button className="act-btn" onClick={() => handleOpenEdit(p)} title="Editar">✏️</button>
                          {p.versions && p.versions.length >= 2 && (
                            <button 
                              className="act-btn" 
                              style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#0d9488', border: '1px solid rgba(20, 184, 166, 0.2)' }} 
                              onClick={() => handleOpenFractionModal(p)} 
                              title="Fraccionar Variante"
                            >
                              ✂️
                            </button>
                          )}
                          <button className="act-btn del" onClick={() => { if(confirm('¿Eliminar?')) deleteProduct(p.id); }} title="Eliminar">🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: CONTROL DE PANES Y MERMAS --- */}
      {activeTab === 'mermas' && (
        <div>
          {/* TOOLBAR FOR MERMAS */}
          <div className="tb-bar">
            <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '600' }}>
              Registra la producción de panes del inicio del día o las mermas (descartes) mermadas durante el turno.
            </div>
            <button className="btn-new" onClick={() => setShowBreadModal(true)}>
              ➕ Registrar Producción / Descarte
            </button>
          </div>

          {/* HISTORIAL DE PANES Y MERMAS */}
          <div className="panel">
            <div className="p-title">Historial de Producción y Descartes (Mermas)</div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Fecha y Hora</th>
                  <th style={{ textAlign: 'left' }}>Pan (Presentación)</th>
                  <th style={{ textAlign: 'left' }}>Tipo de Movimiento</th>
                  <th style={{ textAlign: 'left' }}>Cantidad</th>
                  <th style={{ textAlign: 'left' }}>Detalle / Motivo</th>
                </tr>
              </thead>
              <tbody>
                {breadLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
                      No se han registrado movimientos de panes hoy.
                    </td>
                  </tr>
                ) : (
                  breadLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.d}</td>
                      <td style={{ fontWeight: '700', color: 'var(--text)' }}>{log.prodName}</td>
                      <td>
                        <span className={`tag ${log.type === 'produccion' ? 'tg-ok' : 'tg-err'}`}>
                          {log.type === 'produccion' ? 'Producción' : 'Descarte (Merma)'}
                        </span>
                      </td>
                      <td style={{ fontWeight: '800', color: log.type === 'produccion' ? 'var(--green)' : 'var(--red)' }}>
                        {log.type === 'produccion' ? `+${log.qty} und.` : `-${log.qty} und.`}
                      </td>
                      <td style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>{log.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 3: KARDEX COMPLETO --- */}
      {activeTab === 'kardex' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'DM Serif Display', fontSize: '20px', color: 'var(--text)' }}>Kardex de Productos</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Trazabilidad completa: ventas, compras, producción, recetas y descartes.</p>
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
              <span className="tag tg-ok">➕ Producción</span>
              <span className="tag tg-blue">📥 Compra</span>
              <span className="tag tg-warn">💰 Venta</span>
              <span className="tag tg-err">⚠️ Descarte</span>
              <span className="tag" style={{ background: 'rgba(20,184,166,0.1)', color: '#0d9488', border: '1px solid rgba(20,184,166,0.3)' }}>♻️ Conversión</span>
            </div>
          </div>

          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Fecha y Hora</th>
                  <th style={{ textAlign: 'left' }}>Producto</th>
                  <th style={{ textAlign: 'left' }}>Tipo</th>
                  <th style={{ textAlign: 'left' }}>Cantidad</th>
                  <th style={{ textAlign: 'left' }}>Detalle / Origen</th>
                  <th style={{ textAlign: 'left' }}>Cajero</th>
                  <th style={{ textAlign: 'left' }}>Ref.</th>
                </tr>
              </thead>
              <tbody>
                {breadLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '50px', color: 'var(--text-3)', fontWeight: '600' }}>
                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>📊</div>
                      Sin movimientos aún. Aparecerán aquí cuando realices ventas, compras o ingresos de producción.
                    </td>
                  </tr>
                ) : (
                  breadLogs.map((log) => {
                    const typeMap: Record<string, { label: string; cls: string; sign: string; color: string }> = {
                      produccion: { label: 'Producción',  cls: 'tg-ok',  sign: '+', color: 'var(--green)' },
                      compra:     { label: 'Compra',      cls: 'tg-blue', sign: '+', color: 'var(--blue)'  },
                      venta:      { label: 'Venta POS',   cls: 'tg-warn', sign: '-', color: '#f59e0b'      },
                      descarte:   { label: 'Descarte',    cls: 'tg-err',  sign: '-', color: 'var(--red)'   },
                      conversion: { label: '♻️ Conv.',    cls: '',        sign: '-', color: '#0d9488'      }
                    };
                    const tm = typeMap[log.type] || typeMap.produccion;
                    const isConversion = log.type === 'conversion';
                    return (
                      <tr key={log.id} style={{ background: isConversion ? 'rgba(20,184,166,0.04)' : undefined }}>
                        <td style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>{log.d}</td>
                        <td style={{ fontWeight: '700', color: 'var(--text)', fontSize: '13px' }}>{log.prodName}</td>
                        <td>
                          {isConversion ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(20,184,166,0.1)', color: '#0d9488', fontWeight: '700', fontSize: '11px', border: '1px solid rgba(20,184,166,0.3)' }}>
                              ♻️ Conversión
                            </span>
                          ) : (
                            <span className={`tag ${tm.cls}`}>{tm.label}</span>
                          )}
                        </td>
                        <td style={{ fontWeight: '800', color: tm.color, fontSize: '14px' }}>{tm.sign}{log.qty} und.</td>
                        <td style={{ color: 'var(--text-2)', fontSize: '12px' }}>
                          {log.reason}
                          {isConversion && log.destino && (
                            <span style={{ display: 'block', color: '#0d9488', fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>→ Para: {log.destino}</span>
                          )}
                          {isConversion && log.costoEstimado && (
                            <span style={{ display: 'block', color: 'var(--text-3)', fontSize: '10px' }}>Costo est.: S/. {log.costoEstimado.toFixed(2)}</span>
                          )}
                        </td>
                        <td style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>{log.cajero || '—'}</td>
                        <td style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'monospace' }}>{log.ref_id || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: PRODUCTO (CRUD + VARIANTES) */}
      {showProductModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '560px' }}>
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </div>

            <form onSubmit={handleProductSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="inp-group" style={{ gridColumn: 'span 2' }}>
                <label>Nombre del Producto</label>
                <div className="inp-wrap">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Croissant de chocolate" required />
                </div>
              </div>

              <div className="inp-group" style={{ gridColumn: 'span 2' }}>
                <label>Categoría</label>
                <select value={cat} onChange={(e) => setCat(e.target.value)}>
                  {categories.length > 0 ? (
                    categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="Panes">🍞 Panes</option>
                      <option value="Tortas">🎂 Tortas</option>
                      <option value="Dulces">🍬 Dulces</option>
                      <option value="Bebidas">☕ Bebidas</option>
                    </>
                  )}
                </select>
              </div>

              <div className="inp-group" style={{ gridColumn: 'span 2' }}>
                <label>Unidad de Medida</label>
                <select value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)}>
                  <option value="unidades">Unidades (und)</option>
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="gr">Gramos (gr)</option>
                  <option value="porciones">Porciones (porc)</option>
                </select>
              </div>

              {/* Si tiene variantes, bloqueamos el precio/stock base */}
              <div className="inp-group" style={{ opacity: variantsList.length > 0 ? 0.5 : 1 }}>
                <label>Precio Unitario S/.</label>
                <div className="inp-wrap">
                  <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" disabled={variantsList.length > 0} required={variantsList.length === 0} />
                </div>
              </div>

              <div className="inp-group" style={{ opacity: variantsList.length > 0 ? 0.5 : 1 }}>
                <label>Stock Base</label>
                <div className="inp-wrap">
                  <input type="number" step="any" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" disabled={variantsList.length > 0} required={variantsList.length === 0} />
                </div>
              </div>

              {/* SECCIÓN VARIANTES/VERSIONES */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px' }}>
                  ⚙️ Versiones / Presentaciones (Opcional)
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '10px' }}>
                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9.5px' }}>Nombre Versión</label>
                    <input type="text" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Ej: Porción" style={{ padding: '8px 10px', fontSize: '12px' }} />
                  </div>
                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9.5px' }}>Precio (S/.)</label>
                    <input type="number" step="0.01" value={vPrice} onChange={(e) => setVPrice(e.target.value)} placeholder="0.00" style={{ padding: '8px 10px', fontSize: '12px' }} />
                  </div>
                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9.5px' }}>Stock</label>
                    <input type="number" step="any" value={vStock} onChange={(e) => setVStock(e.target.value)} placeholder="0" style={{ padding: '8px 10px', fontSize: '12px' }} />
                  </div>
                </div>

                {/* Parent-child relation (equivalences) */}
                {variantsList.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 40px', gap: '8px', marginTop: '8px', alignItems: 'end' }}>
                    <div className="inp-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '9.5px' }}>¿Es porción/fracción de otra variante?</label>
                      <select 
                        value={vParentVersionId || ''} 
                        onChange={e => setVParentVersionId(e.target.value ? parseInt(e.target.value) : null)}
                        style={{ padding: '8px 10px', fontSize: '12px', width: '100%', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}
                      >
                        <option value="">-- No, es independiente --</option>
                        {variantsList.map(pv => (
                          <option key={pv.id} value={pv.id}>{pv.name} (Stock: {pv.stock})</option>
                        ))}
                      </select>
                    </div>
                    <div className="inp-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '9.5px' }}>Ratio (ej: 10 del hijo por 1 del padre)</label>
                      <input 
                        type="number" 
                        step="any" 
                        value={vFractionRatio} 
                        onChange={e => setVFractionRatio(e.target.value)} 
                        disabled={!vParentVersionId}
                        style={{ padding: '8px 10px', fontSize: '12px', width: '100%' }} 
                      />
                    </div>
                    <button type="button" onClick={handleAddVariant} className="btn-new" style={{ padding: '8px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', width: '100%', margin: 0 }}>
                      ＋
                    </button>
                  </div>
                )}
                
                {/* Fallback add button when variantsList is empty */}
                {variantsList.length === 0 && (
                  <button type="button" onClick={handleAddVariant} className="btn-new" style={{ marginTop: '8px', width: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    ＋ Añadir Variante
                  </button>
                )}

                {/* Lista de variantes añadidas */}
                {variantsList.length > 0 && (
                  <div style={{ marginTop: '12px', background: 'var(--bg-card2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {variantsList.map((v, idx) => {
                      const parent = variantsList.find(p => p.id === v.parent_version_id);
                      return (
                        <div key={v.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                          <span>
                            <strong>{v.name}</strong> · S/. {v.price.toFixed(2)} · <span style={{ color: 'var(--text-3)' }}>{v.stock} und.</span>
                            {parent && (
                              <span style={{ fontSize: '10px', color: '#0d9488', marginLeft: '6px', background: 'rgba(20,184,166,0.1)', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>
                                ✂️ Fracciona de: {parent.name} (Ratio: {v.fraction_ratio})
                              </span>
                            )}
                          </span>
                          <span onClick={() => handleRemoveVariant(v.id)} style={{ color: 'var(--red)', fontWeight: '700', cursor: 'pointer' }}>✕</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mc-btns" style={{ gridColumn: 'span 2', marginTop: '18px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowProductModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">Guardar Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBreadModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '480px' }}>
            <span className="mc-icon">🥖</span>
            <div className="mc-title">Producción / Descarte / Conversión</div>
            <p className="mc-sub">Registro de movimientos diarios de vitrina y reaprovechamiento</p>

            <form onSubmit={handleBreadLogSubmit}>
              <div className="inp-group">
                <label>Selecciona el Pan u Origen</label>
                <select value={logProductId} onChange={(e) => handleProductChangeForLogs(e.target.value)} required>
                  <option value="">-- Seleccionar producto --</option>
                  {breadProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {selectedBreadProd && selectedBreadProd.versions && selectedBreadProd.versions.length > 0 && (
                <div className="inp-group">
                  <label>Presentación / Versión</label>
                  <select value={logVariant} onChange={(e) => setLogVariant(e.target.value)} required>
                    <option value="">-- Seleccionar variante --</option>
                    {selectedBreadProd.versions.map(v => (
                      <option key={v.name} value={v.name}>{v.name} (Stock: {v.stock})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="inp-group">
                <label>Tipo de Movimiento</label>
                <select
                  value={logType}
                  onChange={(e) => {
                    const t = e.target.value as 'produccion' | 'descarte' | 'conversion';
                    setLogType(t);
                    setLogReason(t === 'produccion' ? 'Ingreso inicial de producción diaria' : t === 'descarte' ? 'Quemado' : '');
                    setLogConvDest('');
                  }}
                >
                  <option value="produccion">➕ Producción — Ingreso de panes al día</option>
                  <option value="descarte">⚠️ Descarte / Merma — Pérdida definitiva</option>
                  <option value="conversion">♻️ Conversión a Insumo — Pan reutilizado para otro producto</option>
                </select>
              </div>

              {/* Explicación contextual */}
              {logType === 'conversion' && (
                <div style={{ background: 'linear-gradient(135deg, rgba(176,125,46,0.08), transparent)', border: '1px solid rgba(176,125,46,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-2)' }}>
                  ♻️ <strong>Conversión a Insumo:</strong> El pan se da de baja del stock y se registra como materia prima invertida. No es pérdida pura — es un costo de producción del producto destino.
                </div>
              )}

              <div className="inp-group">
                <label>Cantidad (unidades)</label>
                <div className="inp-wrap">
                  <input type="number" min="1" value={logQty} onChange={(e) => setLogQty(e.target.value)} placeholder="0" required />
                </div>
              </div>

              {logType === 'conversion' ? (
                <>
                  <div className="inp-group">
                    <label>Producto Destino (¿Para qué se usa?)</label>
                    <div className="inp-wrap">
                      <span className="inp-icon">🎂</span>
                      <input
                        type="text"
                        value={logConvDest}
                        onChange={e => setLogConvDest(e.target.value)}
                        placeholder="Ej: Budín de pan, Torta húmeda, Pastel de yema..."
                        required
                      />
                    </div>
                  </div>
                  <div className="inp-group">
                    <label>Costo Estimado del Insumo (S/.) — Opcional</label>
                    <div className="inp-wrap">
                      <span className="inp-icon">💰</span>
                      <input
                        type="number"
                        step="0.10"
                        min="0"
                        value={logCostoEst}
                        onChange={e => setLogCostoEst(e.target.value)}
                        placeholder="0.00 (para costeo del producto final)"
                      />
                    </div>
                  </div>
                </>
              ) : logType === 'descarte' ? (
                <div className="inp-group">
                  <label>Motivo de Merma / Baja</label>
                  <select value={logReason} onChange={(e) => setLogReason(e.target.value)}>
                    <option value="Quemado">🔥 Quemado en Horno</option>
                    <option value="Seco / Duro">🥖 Seco o Duro — días anteriores</option>
                    <option value="Dañado / Caído">🧹 Caído al suelo / Dañado</option>
                    <option value="Devolución">↩ Devolución de cliente</option>
                    <option value="Vencido">⏰ Vencido / No apto para venta</option>
                  </select>
                </div>
              ) : (
                <div className="inp-group">
                  <label>Detalle de Producción</label>
                  <div className="inp-wrap">
                    <input type="text" value={logReason} onChange={(e) => setLogReason(e.target.value)} placeholder="Detalle del ingreso..." />
                  </div>
                </div>
              )}

              <div className="mc-btns" style={{ marginTop: '20px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowBreadModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">
                  {logType === 'conversion' ? '♻️ Registrar Conversión' : logType === 'descarte' ? '⚠️ Registrar Merma' : '✅ Registrar Producción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: FRACCIONAMIENTO MANUAL DE VARIANTES */}
      {showFractionModal && fractionProduct && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '480px' }}>
            <span className="mc-icon" style={{ fontSize: '36px', textAlign: 'center', display: 'block', marginBottom: '8px' }}>✂️</span>
            <div className="mc-title">Fraccionar Variante / Versión</div>
            <p className="mc-sub" style={{ marginBottom: '18px' }}>
              Divide una presentación grande en porciones o variantes más pequeñas (Ej: Torta Entera → Porciones).
            </p>

            <form onSubmit={handleFractionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="inp-group">
                <label>Variante Origen (Se restará stock)</label>
                <select 
                  value={parentVersionId} 
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setParentVersionId(val);
                    if (val === childVersionId) {
                      const other = fractionProduct.versions.find(v => v.id !== val);
                      if (other) setChildVersionId(other.id);
                    }
                  }}
                  required
                >
                  {fractionProduct.versions.map(v => (
                    <option key={v.id} value={v.id}>{v.name} (Stock: {v.stock})</option>
                  ))}
                </select>
              </div>

              <div className="inp-group">
                <label>Cantidad a Restar de Origen</label>
                <div className="inp-wrap">
                  <input 
                    type="number" 
                    step="any" 
                    min="0.001" 
                    value={qtyToDeduct} 
                    onChange={e => setQtyToDeduct(e.target.value)} 
                    placeholder="Ej: 1" 
                    required 
                  />
                </div>
              </div>

              <div className="inp-group">
                <label>Variante Destino (Se sumará stock)</label>
                <select 
                  value={childVersionId} 
                  onChange={e => setChildVersionId(parseInt(e.target.value))} 
                  required
                >
                  {fractionProduct.versions.filter(v => v.id !== parentVersionId).map(v => (
                    <option key={v.id} value={v.id}>{v.name} (Stock: {v.stock})</option>
                  ))}
                </select>
              </div>

              <div className="inp-group">
                <label>Cantidad a Sumar a Destino</label>
                <div className="inp-wrap">
                  <input 
                    type="number" 
                    step="any" 
                    min="0.001" 
                    value={qtyToAdd} 
                    onChange={e => setQtyToAdd(e.target.value)} 
                    placeholder="Ej: 10" 
                    required 
                  />
                </div>
              </div>

              <div style={{ 
                background: 'rgba(20, 184, 166, 0.06)', 
                border: '1px solid rgba(20, 184, 166, 0.15)', 
                borderRadius: '8px', 
                padding: '12px', 
                fontSize: '12px', 
                color: 'var(--text-2)', 
                lineHeight: '1.5' 
              }}>
                ℹ️ Esta acción disminuirá el stock de la variante origen y aumentará el stock de la variante destino. Se registrará un evento de tipo conversión en el Kardex.
              </div>

              <div className="mc-btns" style={{ marginTop: '10px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowFractionModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri" style={{ background: '#0d9488' }}>Realizar Fraccionamiento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
