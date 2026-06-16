"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function ComprasPage() {
  const router = useRouter();
  const { purchases, providers, products, registerPurchase } = useApp();
  
  const [showModal, setShowModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');

  // Keyboard shortcut listener to redirect to new provider view when modal is open
  React.useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        router.push('/dashboard/proveedores?new=true');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, router]);
  
  interface BuyItem {
    id: number;
    productId: number;
    name: string;
    qty: number;
    cost: number;
    version: string | null;
  }

  // Lista de items que se están comprando en este registro
  const [itemsToBuy, setItemsToBuy] = useState<BuyItem[]>([]);
  
  // Estados para añadir un item de compra
  const [prodId, setProdId] = useState('');
  const [vName, setVName] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');

  const activeProviders = providers.filter(p => p.active);

  const handleAddPurchaseItem = () => {
    const pId = parseInt(prodId);
    const q = parseInt(qty);
    const c = parseFloat(cost);

    if (isNaN(pId) || isNaN(q) || isNaN(c) || q <= 0 || c <= 0) return;

    const prod = products.find(p => p.id === pId);
    if (!prod) return;

    const newItem: BuyItem = {
      id: Date.now(),
      productId: pId,
      name: prod.name + (vName ? ` (${vName})` : ''),
      qty: q,
      cost: c,
      version: vName || null
    };

    setItemsToBuy([...itemsToBuy, newItem]);
    
    // Reset item inputs
    setProdId('');
    setVName('');
    setQty('');
    setCost('');
  };

  const handleRemovePurchaseItem = (id: number) => {
    setItemsToBuy(itemsToBuy.filter(x => x.id !== id));
  };

  const handleOpenNew = () => {
    setSelectedProvider('');
    setItemsToBuy([]);
    setProdId('');
    setVName('');
    setQty('');
    setCost('');
    setShowModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const provId = parseInt(selectedProvider);
    if (isNaN(provId) || itemsToBuy.length === 0) return;

    registerPurchase({
      providerId: provId,
      items: itemsToBuy.map(item => ({
        productId: item.productId,
        qty: item.qty,
        cost: item.cost,
        version: item.version
      }))
    });

    setShowModal(false);
  };

  const selectedProduct = products.find(x => x.id === parseInt(prodId));

  // Totales de la compra actual
  const buySubtotal = itemsToBuy.reduce((a, b) => a + (b.qty * b.cost), 0);
  const buyIgv = buySubtotal * 0.18;
  const buyTotal = buySubtotal + buyIgv;

  return (
    <div className="screen active">
      {/* TOOLBAR */}
      <div className="tb-bar">
        <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '600' }}>
          Registra el ingreso de mercadería e insumos de tus proveedores estratégicos.
        </div>
        <button className="btn-new" onClick={handleOpenNew}>+ Registrar compra</button>
      </div>

      {/* TABLE PANEL */}
      <div className="panel">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Código Compra</th>
              <th style={{ textAlign: 'left' }}>Fecha</th>
              <th style={{ textAlign: 'left' }}>Proveedor</th>
              <th style={{ textAlign: 'left' }}>Artículos Adquiridos</th>
              <th style={{ textAlign: 'left' }}>Subtotal</th>
              <th style={{ textAlign: 'left' }}>IGV (18%)</th>
              <th style={{ textAlign: 'left' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
                  Aún no se han registrado compras.
                </td>
              </tr>
            ) : (
              purchases.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: '700', color: 'var(--accent)' }}>#{p.id}</td>
                  <td>{p.d}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text)' }}>{p.prov}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: '12.5px' }}>
                    {p.items ? p.items.map(i => {
                      const prodRef = products.find(prod => prod.id === i.productId);
                      const displayName = prodRef ? (prodRef.name + (i.version ? ` (${i.version})` : '')) : 'Producto';
                      return `${displayName} x${i.qty}`;
                    }).join(', ') : 'Insumos varios'}
                  </td>
                  <td>{p.subTotal}</td>
                  <td>{p.igv}</td>
                  <td style={{ fontWeight: '800', color: 'var(--green)' }}>{p.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* REGISTRATION MODAL */}
      {showModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '560px' }}>
            <span className="mc-icon">📥</span>
            <div className="mc-title" style={{ textAlign: 'left' }}>Registrar Abastecimiento (Compra)</div>
            <p className="mc-sub" style={{ textAlign: 'left' }}>Ingresa los detalles del pedido para sumar al stock</p>

            <form onSubmit={handleFormSubmit}>
              <div className="inp-group">
                <label>Selecciona el Proveedor</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} required style={{ flex: 1 }}>
                    <option value="">-- Seleccionar proveedor --</option>
                    {activeProviders.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (RUC: {p.ruc})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-new"
                    onClick={() => router.push('/dashboard/proveedores?new=true')}
                    style={{ padding: '10px 14px', fontSize: '12.5px', whiteSpace: 'nowrap' }}
                    title="Agregar nuevo proveedor (Alt + P)"
                  >
                    ➕ Nuevo (Alt + P)
                  </button>
                </div>
              </div>

              {/* AÑADIR ITEM DE COMPRA FORM */}
              <div style={{ border: '1.5px dashed var(--border)', padding: '14px', borderRadius: '12px', background: 'var(--bg-card2)', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px' }}>
                  Añadir Insumo al Pedido
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>Insumo</label>
                    <select value={prodId} onChange={(e) => setProdId(e.target.value)}>
                      <option value="">-- Elegir insumo --</option>
                      {products.filter(p => p.cat === 'Insumos').map(p => (
                        <option key={p.id} value={String(p.id)}>{p.em} {p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de variantes si aplica */}
                  <div className="inp-group" style={{ margin: 0, opacity: (selectedProduct && selectedProduct.versions && selectedProduct.versions.length > 0) ? 1 : 0.5 }}>
                    <label style={{ fontSize: '9px' }}>Variante</label>
                    <select 
                      value={vName} 
                      onChange={(e) => setVName(e.target.value)}
                      disabled={!(selectedProduct && selectedProduct.versions && selectedProduct.versions.length > 0)}
                    >
                      <option value="">-- Ninguna --</option>
                      {selectedProduct?.versions?.map(v => (
                        <option key={v.name} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>Cantidad</label>
                    <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={{ padding: '8px 10px', fontSize: '12px' }} />
                  </div>

                  <div className="inp-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '9px' }}>Costo Compra Unitario S/.</label>
                    <input type="number" step="0.01" min="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" style={{ padding: '8px 10px', fontSize: '12px' }} />
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={handleAddPurchaseItem}
                  className="btn-new"
                  style={{ width: '100%', marginTop: '12px', padding: '10px' }}
                >
                  ＋ Añadir Artículo
                </button>
              </div>

              {/* LISTA DE ITEMS AÑADIDOS */}
              {itemsToBuy.length > 0 && (
                <div style={{ background: 'white', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                    Detalle del Pedido Actual:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                    {itemsToBuy.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                        <span>
                          <strong>{item.name}</strong> x{item.qty} · <span style={{ color: 'var(--text-3)' }}>Costo: S/. {item.cost.toFixed(2)} c/u</span>
                        </span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', color: 'var(--text)' }}>S/. {(item.qty * item.cost).toFixed(2)}</span>
                          <span onClick={() => handleRemovePurchaseItem(item.id)} style={{ color: 'var(--red)', fontWeight: '700', cursor: 'pointer' }}>✕</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700' }}>
                    <span>Total Estimado Compra:</span>
                    <span style={{ color: 'var(--green)' }}>S/. {buyTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="mc-btns" style={{ marginTop: '22px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button 
                  type="submit" 
                  className="mc-pri" 
                  disabled={itemsToBuy.length === 0 || !selectedProvider}
                  style={{ opacity: (itemsToBuy.length === 0 || !selectedProvider) ? 0.6 : 1 }}
                >
                  Registrar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
