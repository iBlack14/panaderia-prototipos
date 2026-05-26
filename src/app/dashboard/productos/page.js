"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function InventarioPage() {
  const { 
    products, 
    saveProduct, 
    deleteProduct, 
    breadLogs, 
    logBreadProduction, 
    logBreadDiscard 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBreadModal, setShowBreadModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' o 'mermas'

  // --- FORM STATES FOR PRODUCT CRUD ---
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('Panes');
  const [em, setEm] = useState('🥐');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  
  // Variants states
  const [variantsList, setVariantsList] = useState([]);
  const [vName, setVName] = useState('');
  const [vPrice, setVPrice] = useState('');
  const [vStock, setVStock] = useState('0');

  // --- FORM STATES FOR PRODUCTION/DISCARD LOGS ---
  const [logProductId, setLogProductId] = useState('');
  const [logVariant, setLogVariant] = useState('');
  const [logType, setLogType] = useState('produccion'); // 'produccion' o 'descarte'
  const [logQty, setLogQty] = useState('');
  const [logReason, setLogReason] = useState('Ingreso inicial de producción diaria');

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const breadProducts = products.filter(p => p.cat === 'Panes');

  // --- VARIANT LOGIC IN MODAL ---
  const handleAddVariant = () => {
    if (!vName || !vPrice) return;
    const newV = {
      id: Date.now(),
      name: vName,
      price: parseFloat(vPrice),
      stock: parseInt(vStock) || 0
    };
    setVariantsList([...variantsList, newV]);
    setVName('');
    setVPrice('');
    setVStock('0');
  };

  const handleRemoveVariant = (id) => {
    setVariantsList(variantsList.filter(x => x.id !== id));
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setName('');
    setCat('Panes');
    setEm('🥐');
    setPrice('');
    setStock('0');
    setVariantsList([]);
    setShowProductModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditingId(p.id);
    setName(p.name);
    setCat(p.cat);
    setEm(p.em);
    setPrice(p.price);
    setStock(p.stock);
    setVariantsList(p.versions || []);
    setShowProductModal(true);
  };

  const handleProductSubmit = (e) => {
    e.preventDefault();
    if (!name) return;

    const prodObj = {
      id: editingId,
      name,
      cat,
      em: em || '📦',
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      versions: variantsList
    };

    saveProduct(prodObj);
    setShowProductModal(false);
  };

  // --- PRODUCTION & DISCARD SUBMIT ---
  const handleBreadLogSubmit = (e) => {
    e.preventDefault();
    const pId = parseInt(logProductId);
    const qty = parseInt(logQty);
    if (isNaN(pId) || isNaN(qty) || qty <= 0) return;

    if (logType === 'produccion') {
      logBreadProduction(pId, qty, logVariant || null);
    } else {
      logBreadDiscard(pId, qty, logReason, logVariant || null);
    }

    setShowBreadModal(false);
    setLogProductId('');
    setLogVariant('');
    setLogQty('');
    setLogReason('Ingreso inicial de producción diaria');
  };

  const handleProductChangeForLogs = (id) => {
    setLogProductId(id);
    setLogVariant('');
  };

  const selectedBreadProd = products.find(x => x.id === parseInt(logProductId));

  return (
    <div className="screen active">
      {/* TABS SELECTOR */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <button 
          onClick={() => setActiveTab('list')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '20px',
            background: activeTab === 'list' ? 'var(--accent-bg)' : 'transparent',
            color: activeTab === 'list' ? 'var(--accent)' : 'var(--text-3)',
            fontWeight: '700',
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          📦 Catálogo e Inventario
        </button>
        <button 
          onClick={() => setActiveTab('mermas')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '20px',
            background: activeTab === 'mermas' ? 'var(--accent-bg)' : 'transparent',
            color: activeTab === 'mermas' ? 'var(--accent)' : 'var(--text-3)',
            fontWeight: '700',
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          🥖 Control de Panes y Descartes (Mermas)
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
                  placeholder="Filtrar inventario por nombre..." 
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
                  <th style={{ textAlign: 'left' }}>Stock Total</th>
                  <th style={{ textAlign: 'left' }}>Variantes</th>
                  <th style={{ textAlign: 'left' }}>Estado</th>
                  <th style={{ textAlign: 'left' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const catColor = { 'Panes': 'tg-blue', 'Tortas': 'tg-blue', 'Dulces': 'tg-warn', 'Bebidas': 'tg-ok' };
                  const totalStock = p.versions.length > 0 
                    ? p.versions.reduce((a, b) => a + b.stock, 0)
                    : p.stock;
                  
                  const stTag = totalStock <= 0 
                    ? '<span class="tag tg-err">Agotado</span>'
                    : totalStock < 10 
                      ? '<span class="tag tg-warn">Stock bajo</span>'
                      : '<span class="tag tg-ok">Disponible</span>';

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="row-chip">
                          <div className="chip-icon">{p.em}</div>
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
                        {totalStock} <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>und.</span>
                      </td>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-2)' }}>
                        {p.versions.length > 0 
                          ? p.versions.map(v => `${v.name} (${v.stock})`).join(', ')
                          : 'Sin variantes'
                        }
                      </td>
                      <td dangerouslySetInnerHTML={{ __html: stTag }}></td>
                      <td>
                        <div className="act-row">
                          <button className="act-btn" onClick={() => handleOpenEdit(p)} title="Editar">✏️</button>
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
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
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

      {/* MODAL 1: PRODUCTO (CRUD + VARIANTES) */}
      {showProductModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '560px' }}>
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '20px' }}>
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </div>

            <form onSubmit={handleProductChangeForLogs} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="inp-group" style={{ gridColumn: 'span 2' }}>
                <label>Nombre del Producto</label>
                <div className="inp-wrap">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Croissant de chocolate" required />
                </div>
              </div>

              <div className="inp-group">
                <label>Categoría</label>
                <select value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="Panes">🍞 Panes</option>
                  <option value="Tortas">🎂 Tortas</option>
                  <option value="Dulces">🍬 Dulces</option>
                  <option value="Bebidas">☕ Bebidas</option>
                </select>
              </div>

              <div className="inp-group">
                <label>Ícono (emoji)</label>
                <div className="inp-wrap">
                  <input type="text" value={em} onChange={(e) => setEm(e.target.value)} maxLength="2" placeholder="🥐" />
                </div>
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
                  <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" disabled={variantsList.length > 0} required={variantsList.length === 0} />
                </div>
              </div>

              {/* SECCIÓN VARIANTES/VERSIONES */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px' }}>
                  ⚙️ Versiones / Presentaciones (Opcional)
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 40px', gap: '8px', alignItems: 'end', marginTop: '10px' }}>
                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>Nombre Versión</label>
                    <input type="text" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Ej: Grande" style={{ padding: '8px 10px', fontSize: '12px' }} />
                  </div>
                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>Precio (S/.)</label>
                    <input type="number" step="0.01" value={vPrice} onChange={(e) => setVPrice(e.target.value)} placeholder="0.00" style={{ padding: '8px 10px', fontSize: '12px' }} />
                  </div>
                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>Stock</label>
                    <input type="number" value={vStock} onChange={(e) => setVStock(e.target.value)} placeholder="0" style={{ padding: '8px 10px', fontSize: '12px' }} />
                  </div>
                  <button type="button" onClick={handleAddVariant} className="btn-new" style={{ padding: '8px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', width: '100%', margin: 0 }}>
                    ＋
                  </button>
                </div>

                {/* Lista de variantes añadidas */}
                {variantsList.length > 0 && (
                  <div style={{ marginTop: '12px', background: 'var(--bg-card2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {variantsList.map((v, idx) => (
                      <div key={v.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                        <span>
                          <strong>{v.name}</strong> · S/. {parseFloat(v.price).toFixed(2)} · <span style={{ color: 'var(--text-3)' }}>{v.stock} und.</span>
                        </span>
                        <span onClick={() => handleRemoveVariant(v.id)} style={{ color: 'var(--red)', fontWeight: '700', cursor: 'pointer' }}>✕</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mc-btns" style={{ gridColumn: 'span 2', marginTop: '18px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowProductModal(false)}>Cancelar</button>
                <button type="button" className="mc-pri" onClick={handleProductSubmit}>Guardar Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRO DE PRODUCCION Y DESCARTE DE PANES */}
      {showBreadModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '480px' }}>
            <span className="mc-icon">🥖</span>
            <div className="mc-title">Producción / Descarte de Panes</div>
            <p className="mc-sub">Control diario de vitrina</p>

            <form onSubmit={handleBreadLogSubmit}>
              <div className="inp-group">
                <label>Selecciona el Pan</label>
                <select value={logProductId} onChange={(e) => handleProductChangeForLogs(e.target.value)} required>
                  <option value="">-- Seleccionar pan --</option>
                  {breadProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.em} {p.name}</option>
                  ))}
                </select>
              </div>

              {/* Si el pan seleccionado tiene variantes, mostramos selector */}
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
                <label>Tipo de Registro</label>
                <select value={logType} onChange={(e) => { setLogType(e.target.value); setLogReason(e.target.value === 'produccion' ? 'Ingreso inicial de producción diaria' : 'Quemado'); }}>
                  <option value="produccion">➕ Registrar Producción (Ingreso)</option>
                  <option value="descarte">⚠️ Registrar Descarte / Merma (Salida)</option>
                </select>
              </div>

              <div className="inp-group">
                <label>Cantidad (unidades)</label>
                <div className="inp-wrap">
                  <input type="number" min="1" value={logQty} onChange={(e) => setLogQty(e.target.value)} placeholder="0" required />
                </div>
              </div>

              {logType === 'descarte' ? (
                <div className="inp-group">
                  <label>Motivo de Merma</label>
                  <select value={logReason} onChange={(e) => setLogReason(e.target.value)}>
                    <option value="Quemado">🔥 Quemado en Horno</option>
                    <option value="Seco / Duro">🥖 Seco o Duro (Días anteriores)</option>
                    <option value="Dañado / Caído">🧹 Caído al suelo / Dañado</option>
                    <option value="Devolución">↩ Devolución de cliente</option>
                  </select>
                </div>
              ) : (
                <div className="inp-group">
                  <label>Detalle</label>
                  <div className="inp-wrap">
                    <input type="text" value={logReason} onChange={(e) => setLogReason(e.target.value)} placeholder="Detalles de producción..." />
                  </div>
                </div>
              )}

              <div className="mc-btns" style={{ marginTop: '20px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowBreadModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">
                  Registrar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
