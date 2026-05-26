"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function PointOfSalePage() {
  const router = useRouter();
  const { 
    products, 
    cart, 
    addToCart, 
    updateCartQty, 
    clearCart, 
    checkoutCart, 
    cashSession, 
    paymentMethods 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Checkout & Receipt Modal states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  // Variant selector states
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Filtered active products
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleProductClick = (prod) => {
    if (prod.versions && prod.versions.length > 0) {
      setSelectedProduct(prod);
      setShowVariantModal(true);
    } else {
      addToCart(prod.name, prod.price, prod.em, prod.id);
    }
  };

  const handleVariantSelect = (v) => {
    if (selectedProduct) {
      addToCart(selectedProduct.name, v.price, selectedProduct.em, selectedProduct.id, v);
      setShowVariantModal(false);
    }
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setShowCheckoutModal(true);
  };

  const handleConfirmPayment = async (methodId) => {
    const receipt = await checkoutCart(methodId);
    if (receipt) {
      setLastReceipt(receipt);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
    }
  };

  // Carrito calculations
  const cartSubtotal = cart.reduce((a, b) => a + (b.price * b.qty), 0);
  const cartIgv = cartSubtotal * 0.18;
  const cartTotal = cartSubtotal + cartIgv;

  const activeMethods = paymentMethods.filter(m => m.active);

  // --- 1. BLOQUEO SI LA CAJA ESTÁ CERRADA ---
  if (!cashSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="panel" style={{ width: '480px', textAlign: 'center', padding: '40px', border: '1.5px solid var(--border2)' }}>
          <span className="ci-em" style={{ fontSize: '54px', marginBottom: '14px', animation: 'bounce 2s infinite' }}>🔒</span>
          <h3 style={{ fontFamily: 'DM Serif Display', fontSize: '22px', color: 'var(--text)', marginBottom: '8px' }}>
            Punto de Venta Inhabilitado
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
            Por motivos de seguridad y control interno, la caja debe estar abierta antes de comenzar a registrar ventas.
          </p>
          <button 
            className="btn-new" 
            onClick={() => router.push('/dashboard/caja')}
            style={{ padding: '12px 24px', fontSize: '13.5px' }}
          >
            💰 Ir a Apertura de Caja
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen active">
      <div className="pos-2col">
        
        {/* CATALOG SIDE */}
        <div className="cat-side">
          <div className="cat-search">
            <span>🔍</span>
            <input 
              placeholder="Buscar producto en vitrina..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="cat-grid">
            {filteredProducts.length === 0 ? (
              <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
                Sin coincidencias en vitrina.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const totalStock = p.versions.length > 0 
                  ? p.versions.reduce((a, b) => a + b.stock, 0)
                  : p.stock;
                const isAgotado = totalStock <= 0;
                
                return (
                  <div 
                    key={p.id}
                    className="cat-item"
                    style={{ opacity: isAgotado ? 0.45 : 1, pointerEvents: isAgotado ? 'none' : 'auto' }}
                    onClick={() => handleProductClick(p)}
                  >
                    <span className="ci-em">{p.em}</span>
                    <div className="ci-nm">{p.name}</div>
                    <div className="ci-pr">
                      {p.versions.length > 0 
                        ? `Desde S/. ${Math.min(...p.versions.map(v => v.price)).toFixed(2)}`
                        : `S/. ${p.price.toFixed(2)}`
                      }
                    </div>
                    <div className="pc-stock">
                      {isAgotado 
                        ? 'Agotado' 
                        : p.versions.length > 0 
                          ? `${totalStock} und. (${p.versions.length} ver)`
                          : `${totalStock} disponibles`
                      }
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SHOPPING CART / ORDER PANEL */}
        <div className="order-panel">
          <div className="op-head">
            <h3>Pedido Actual</h3>
            <span>{cart.reduce((a, b) => a + b.qty, 0)} items</span>
          </div>

          <div id="orderList">
            {cart.length === 0 ? (
              <div className="order-empty">
                <div>🛒</div>
                Añade productos de la vitrina al carrito
              </div>
            ) : (
              cart.map((item) => (
                <div className="order-line" key={item.cartId || item.id}>
                  <div className="ol-name">
                    {item.name}
                  </div>
                  <div className="ol-ctrl">
                    <button className="q-btn" onClick={() => updateCartQty(item.id, -1, item.version)}>−</button>
                    <span className="q-num">{item.qty}</span>
                    <button className="q-btn" onClick={() => updateCartQty(item.id, 1, item.version)}>+</button>
                  </div>
                  <div className="ol-price">S/. {(item.price * item.qty).toFixed(2)}</div>
                </div>
              ))
            )}
          </div>

          <div className="order-summary">
            <div className="os-row">
              <span>Subtotal</span>
              <span>S/. {cartSubtotal.toFixed(2)}</span>
            </div>
            <div className="os-row">
              <span>IGV (18%)</span>
              <span>S/. {cartIgv.toFixed(2)}</span>
            </div>
            <div className="os-total">
              <span>TOTAL</span>
              <span>S/. {cartTotal.toFixed(2)}</span>
            </div>
            
            <button 
              className="btn-sell" 
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              style={{ opacity: cart.length === 0 ? 0.6 : 1, cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              💳 Proceder al Cobro
            </button>
            
            <button 
              className="btn-clear" 
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              Vaciar carrito
            </button>
          </div>
        </div>

      </div>

      {/* CHECKOUT MODAL (DYNAMIC PAYMENT SELECTOR) */}
      {showCheckoutModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '480px' }}>
            <span className="mc-icon">💳</span>
            <div className="mc-title">Seleccionar Método de Pago</div>
            <p className="mc-sub">Monto Total a Cobrar: <strong>S/. {cartTotal.toFixed(2)}</strong></p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '20px 0' }}>
              {activeMethods.length === 0 ? (
                <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '20px', color: 'var(--text-3)' }}>
                  No hay métodos de pago activos.
                </div>
              ) : (
                activeMethods.map((m) => {
                  const icons = { Efectivo: '💵', Yape: '📱', Plin: '📱', 'Tarjeta Crédito/Débito': '💳', Tarjeta: '💳' };
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleConfirmPayment(m.id)}
                      style={{
                        padding: '18px 12px',
                        border: '1.5px solid var(--border)',
                        borderRadius: '12px',
                        background: 'var(--bg-card2)',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: '700',
                        fontSize: '13px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.18s'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card2)'; }}
                    >
                      <span style={{ fontSize: '24px' }}>{icons[m.name] || '💳'}</span>
                      {m.name}
                    </button>
                  );
                })
              )}
            </div>

            <button type="button" className="mc-sec" style={{ width: '100%' }} onClick={() => setShowCheckoutModal(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* RECEIPT / PRINT TICKET MODAL */}
      {showReceiptModal && lastReceipt && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '420px' }}>
            <div className="mc-icon">✅</div>
            <div className="mc-title">¡Venta Registrada!</div>
            <p className="mc-sub">El pago ha sido procesado de forma correcta</p>

            <div className="mc-receipt">
              <div className="mcr-head">
                <strong>SNACK ROQUE</strong>
                <span>Panadería &amp; Pastelería</span><br />
                <span style={{ fontSize: '11px', opacity: 0.6 }}>{lastReceipt.d} {lastReceipt.t}</span><br />
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', marginTop: '4px', display: 'inline-block' }}>
                  BOLETA DE VENTA #B-{lastReceipt.n}
                </span>
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {lastReceipt.items.map((item, idx) => (
                  <div className="mcr-row" key={idx}>
                    <span>{item.name} x{item.qty}</span>
                    <span>S/. {(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mcr-total">
                <span>TOTAL PAGADO</span>
                <span>S/. {lastReceipt.total.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-3)', textAlign: 'center', marginTop: '10px', fontWeight: '500' }}>
                Cajero: {lastReceipt.cajero} <br />
                Método: {lastReceipt.method}
              </div>
            </div>

            <div className="mc-btns">
              <button className="mc-sec" onClick={() => setShowReceiptModal(false)}>Cerrar</button>
              <button className="mc-pri" onClick={() => { alert('Imprimiendo Boleta...'); setShowReceiptModal(false); }}>
                🖨 Imprimir Boleta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERSION SELECTOR MODAL FOR PRODUCTS WITH VARIANTS */}
      {showVariantModal && selectedProduct && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '420px' }}>
            <span className="ci-em" style={{ fontSize: '38px', textAlign: 'center' }}>{selectedProduct.em}</span>
            <div className="mc-title">{selectedProduct.name}</div>
            <p className="mc-sub">Selecciona la variante/versión a facturar</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '18px 0' }}>
              {selectedProduct.versions.map((v) => {
                const isAgotado = v.stock <= 0;
                return (
                  <button
                    key={v.id}
                    onClick={() => !isAgotado && handleVariantSelect(v)}
                    disabled={isAgotado}
                    style={{
                      padding: '14px 16px',
                      border: '1.5px solid var(--border)',
                      borderRadius: '12px',
                      background: 'var(--bg-card)',
                      cursor: isAgotado ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontFamily: 'Inter, sans-serif',
                      opacity: isAgotado ? 0.45 : 1
                    }}
                    onMouseOver={(e) => { if (!isAgotado) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; } }}
                    onMouseOut={(e) => { if (!isAgotado) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; } }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text)' }}>{v.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                        {isAgotado ? 'Agotado' : `${v.stock} disponibles`}
                      </div>
                    </div>
                    <span style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '13.5px' }}>
                      S/. {v.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>

            <button type="button" className="mc-sec" style={{ width: '100%' }} onClick={() => setShowVariantModal(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
