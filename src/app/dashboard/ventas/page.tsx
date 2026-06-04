"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, Product, ProductVersion, Sale } from '@/context/AppContext';

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
    paymentMethods,
    user,
    clients,
    toast
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Mobile sub-tab toggle state
  const [activeMobileTab, setActiveMobileTab] = useState<'vitrina' | 'pedido'>('vitrina');

  // Checkout & Receipt Modal states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<Sale | null>(null);

  // Variant selector states
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Client Selection state
  const [selectedClientId, setSelectedClientId] = useState<number | string>('');

  // WhatsApp Baileys sending states inside receipt modal
  const [showWhatsAppSubModal, setShowWhatsAppSubModal] = useState(false);
  const [waPhoneInput, setWaPhoneInput] = useState('');
  const [isWaSending, setIsWaSending] = useState(false);

  // Filtered active products
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleProductClick = (prod: Product) => {
    if (prod.versions && prod.versions.length > 0) {
      setSelectedProduct(prod);
      setShowVariantModal(true);
    } else {
      addToCart(prod.name, prod.price, prod.em, prod.id);
    }
  };

  const handleVariantSelect = (v: ProductVersion) => {
    if (selectedProduct) {
      addToCart(selectedProduct.name, v.price, selectedProduct.em, selectedProduct.id, v);
      setShowVariantModal(false);
    }
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setSelectedClientId(''); // Default to generic client
    setShowCheckoutModal(true);
  };

  const handleConfirmPayment = async (methodId: number) => {
    const receipt = await checkoutCart(methodId, selectedClientId || undefined);
    if (receipt) {
      setLastReceipt(receipt);
      setShowCheckoutModal(false);
      
      // Auto-prefill customer phone if they exist and have a registered phone number
      if (selectedClientId) {
        const foundCli = clients.find(c => String(c.id) === String(selectedClientId));
        if (foundCli && foundCli.telefono) {
          // Normalize phone (ensure it has country code if needed, but display cleanly)
          const normPhone = foundCli.telefono.startsWith('+') ? foundCli.telefono : `+51${foundCli.telefono}`;
          setWaPhoneInput(normPhone);
        } else {
          setWaPhoneInput('');
        }
      } else {
        setWaPhoneInput('');
      }

      setShowReceiptModal(true);
    }
  };

  // Carrito calculations
  const cartSubtotal = cart.reduce((a, b) => a + (b.price * b.qty), 0);
  const cartIgv = cartSubtotal * 0.18;
  const cartTotal = cartSubtotal + cartIgv;

  const activeMethods = paymentMethods.filter(m => m.active);

  // --- 1. BLOQUEO SI LA CAJA ESTÁ CERRADA (ADMIN TIENE ACCESO DIRECTO) ---
  const isAdmin = user?.rs?.includes('Administrador');
  if (!cashSession && !isAdmin) {
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

  const totalCartCount = cart.reduce((a, b) => a + b.qty, 0);

  // Fallback wa.me redirect
  const handleShareWhatsApp = (receipt: Sale) => {
    const text = `*SNACK ROQUE 🥐*\n` +
                 `*Boleta de Venta Electrónica: B-${receipt.n}*\n` +
                 `Fecha: ${receipt.d}  Hora: ${receipt.t || '08:50'}\n` +
                 `Cajero: ${receipt.cajero || 'Admin'}\n` +
                 `----------------------------------------\n` +
                 receipt.items.map(i => `• ${i.name} (x${i.qty}): S/. ${(i.price * i.qty).toFixed(2)}`).join('\n') + `\n` +
                 `----------------------------------------\n` +
                 `*TOTAL COMPRA: S/. ${receipt.total.toFixed(2)}*\n` +
                 `Método de pago: ${receipt.method || 'Efectivo'}\n\n` +
                 `¡Muchas gracias por su preferencia!`;
                 
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  // Real-time canvas drawing function to generate and download a pixel-perfect thermal ticket image
  const downloadTicketAsImage = (receipt: Sale) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Define dimensions: width 380px, height dynamic based on items
    const width = 380;
    const padding = 22;
    const itemHeight = 24;
    const headerHeight = 158;
    const footerHeight = 130;
    const itemsCount = receipt.items.length;
    const height = headerHeight + (itemsCount * itemHeight) + footerHeight;

    canvas.width = width;
    canvas.height = height;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw thermal ticket background texture / border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // Drawing settings
    ctx.fillStyle = '#1e293b'; // Charcoal ink
    
    // Header - Brand Name
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Courier New, monospace';
    ctx.fillText('SNACK ROQUE', width / 2, 42);
    
    ctx.font = '11px Courier New, monospace';
    ctx.fillText('Av. Panamericana Sur #456, Ica', width / 2, 60);
    ctx.fillText('RUC: 10432187659', width / 2, 74);
    ctx.fillText('Teléfono: (056) 219876', width / 2, 88);
    
    // Ticket separator line
    ctx.font = '12px Courier New, monospace';
    ctx.fillText('========================================', width / 2, 102);
    
    ctx.font = 'bold 12.5px Courier New, monospace';
    ctx.fillText(`BOLETA ELECTRÓNICA: B-${receipt.n}`, width / 2, 118);
    
    ctx.font = '10.5px Courier New, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Fecha: ${receipt.d}  Hora: ${receipt.t || '08:50'}`, padding, 134);
    ctx.fillText(`Cajero: ${receipt.cajero || 'Admin'}`, padding, 146);
    
    // Table Header
    ctx.fillText('----------------------------------------', padding, 158);
    ctx.font = 'bold 10.5px Courier New, monospace';
    ctx.fillText('DESCRIPCIÓN', padding, 170);
    ctx.textAlign = 'right';
    ctx.fillText('CANT', width - 110, 170);
    ctx.fillText('TOTAL', width - padding, 170);
    
    ctx.textAlign = 'left';
    ctx.fillText('----------------------------------------', padding, 180);
    
    // Drawing Items
    let currentY = 194;
    ctx.font = '10.5px Courier New, monospace';
    receipt.items.forEach((item) => {
      // Description
      ctx.textAlign = 'left';
      ctx.fillText(item.name.substring(0, 20), padding, currentY);
      
      // Qty
      ctx.textAlign = 'right';
      ctx.fillText(String(item.qty), width - 110, currentY);
      
      // Price / Total
      ctx.fillText(`S/. ${(item.price * item.qty).toFixed(2)}`, width - padding, currentY);
      
      currentY += itemHeight;
    });
    
    // Totals Section
    ctx.textAlign = 'left';
    ctx.fillText('----------------------------------------', padding, currentY);
    currentY += 12;
    
    ctx.font = 'bold 13px Courier New, monospace';
    ctx.fillText('TOTAL A PAGAR:', padding, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(`S/. ${receipt.total.toFixed(2)}`, width - padding, currentY);
    currentY += 24;
    
    // Payment method
    ctx.font = '10.5px Courier New, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Método de Pago: ${receipt.method || 'Efectivo'}`, padding, currentY);
    currentY += 16;
    
    // Tear line
    ctx.fillText('========================================', padding, currentY);
    currentY += 20;
    
    // Footer Greeting
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Courier New, monospace';
    ctx.fillText('¡MUCHAS GRACIAS POR SU COMPRA!', width / 2, currentY);
    currentY += 14;
    ctx.font = '9px Courier New, monospace';
    ctx.fillText('Representación impresa de la Boleta Electrónica', width / 2, currentY);

    // Convert canvas to image and trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `boleta_B-${receipt.n}.png`;
    link.href = dataUrl;
    link.click();
    toast('📥 Ticket descargado como PNG con éxito');
  };

  // Real WhatsApp sending via Baileys API route
  const handleSendWhatsAppBaileys = async (receipt: Sale) => {
    if (!waPhoneInput) {
      toast('⚠️ Por favor ingresa un número de teléfono válido.');
      return;
    }
    
    setIsWaSending(true);
    try {
      const text = `*SNACK ROQUE 🥐*\n` +
                   `*Boleta de Venta Electrónica: B-${receipt.n}*\n` +
                   `Fecha: ${receipt.d}  Hora: ${receipt.t || '08:50'}\n` +
                   `Cajero: ${receipt.cajero || 'Admin'}\n` +
                   `----------------------------------------\n` +
                   receipt.items.map(i => `• ${i.name} (x${i.qty}): S/. ${(i.price * i.qty).toFixed(2)}`).join('\n') + `\n` +
                   `----------------------------------------\n` +
                   `*TOTAL COMPRA: S/. ${receipt.total.toFixed(2)}*\n` +
                   `Método de pago: ${receipt.method || 'Efectivo'}\n\n` +
                   `¡Muchas gracias por su preferencia! Su ticket ha sido procesado automáticamente vía Baileys Gateway.`;

      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: waPhoneInput,
          message: text,
          saleId: receipt.id
        })
      });

      const resData = await response.json();
      if (resData.success) {
        toast(`✅ Comprobante enviado con éxito a ${waPhoneInput} vía Baileys.`);
        setShowWhatsAppSubModal(false);
      } else {
        toast(`❌ Error en Baileys: ${resData.error}`);
      }
    } catch (error: any) {
      console.error(error);
      toast('❌ Error al enviar mensaje.');
    } finally {
      setIsWaSending(false);
    }
  };

  return (
    <div className="screen active">
      {/* MOBILE POS TABS TOGGLE BAR (Visible only on mobile via CSS) */}
      <div className="mobile-pos-tabs">
        <button 
          className={`mpt-btn ${activeMobileTab === 'vitrina' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('vitrina')}
        >
          🛍️ Vitrina de Productos
        </button>
        <button 
          className={`mpt-btn ${activeMobileTab === 'pedido' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('pedido')}
        >
          🛒 Mi Pedido ({totalCartCount})
        </button>
      </div>

      <div className="pos-2col">
        
        {/* CATALOG SIDE */}
        <div className={`cat-side ${activeMobileTab === 'vitrina' ? 'mobile-active' : 'mobile-hidden'}`}>
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
        <div className={`order-panel ${activeMobileTab === 'pedido' ? 'mobile-active' : 'mobile-hidden'}`}>
          <div className="op-head">
            <h3>Pedido Actual</h3>
            <span>{totalCartCount} items</span>
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

      {/* CHECKOUT MODAL (DYNAMIC PAYMENT SELECTOR + CLIENT SELECTOR) */}
      {showCheckoutModal && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '480px' }}>
            <span className="mc-icon">💳</span>
            <div className="mc-title">Seleccionar Método de Pago</div>
            <p className="mc-sub" style={{ marginBottom: '15px' }}>Monto Total a Cobrar: <strong>S/. {cartTotal.toFixed(2)}</strong></p>

            {/* CLIENTE SELECTOR */}
            <div className="inp-group" style={{ marginBottom: '18px', textAlign: 'left' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                Vincular Cliente (Opcional)
              </label>
              <select 
                value={selectedClientId} 
                onChange={(e) => setSelectedClientId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg-card2)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <option value="">-- Cliente Genérico (Anonimo) --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    👤 {c.nombre} (DNI: {c.dni || 'S/D'} · Cel: {c.telefono || 'S/T'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '20px 0' }}>
              {activeMethods.length === 0 ? (
                <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '20px', color: 'var(--text-3)' }}>
                  No hay métodos de pago activos.
                </div>
              ) : (
                activeMethods.map((m) => {
                  const icons: Record<string, string> = { Efectivo: '💵', Yape: '📱', Plin: '📱', 'Tarjeta Crédito/Débito': '💳', Tarjeta: '💳' };
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

      {/* PREMIUM RECEIPT MODAL WITH DYNAMIC BAILEYS INTEGRATION */}
      {showReceiptModal && lastReceipt && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '400px', padding: '24px' }}>
            <div className="mc-icon" style={{ fontSize: '40px' }}>🎫</div>
            <div className="mc-title">Comprobante de Pago</div>
            
            <div className="mc-receipt" style={{ border: '2px dashed var(--border)', padding: '20px', borderRadius: '8px', background: 'var(--bg-card)', marginTop: '15px' }}>
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h4 style={{ margin: 0, fontSize: '18px' }}>SNACK ROQUE</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>Boleta #B-{lastReceipt.n}</p>
              </div>
              {lastReceipt.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '5px 0' }}>
                  <span>{i.name} (x{i.qty})</span>
                  <span>S/. {(i.price * i.qty).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>TOTAL</span>
                <span>S/. {lastReceipt.total.toFixed(2)}</span>
              </div>
            </div>

            {/* DOWNLOAD & WHATSAPP BUTTONS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
              <button 
                className="mc-pri" 
                onClick={() => downloadTicketAsImage(lastReceipt)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                📥 Descargar PNG
              </button>
              <button 
                className="mc-pri" 
                onClick={() => {
                  setShowWhatsAppSubModal(true);
                }}
                style={{ background: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                💬 Enviar WhatsApp
              </button>
            </div>

            {/* BAILEYS SENDING SUB-PANEL */}
            {showWhatsAppSubModal && (
              <div style={{ 
                marginTop: '15px', 
                padding: '14px', 
                border: '1.5px solid var(--border)', 
                borderRadius: '10px', 
                background: 'var(--bg-card2)',
                textAlign: 'left'
              }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '12.5px', color: 'var(--text)', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>💬 Enviar vía Baileys API</span>
                  <span style={{ fontSize: '10px', color: 'var(--green)', fontWeight: 'bold' }}>● Gateway real</span>
                </h5>
                <p style={{ margin: '0 0 10px 0', fontSize: '10.5px', color: 'var(--text-3)' }}>
                  La boleta electrónica se despachará de forma directa y automatizada a través del servidor de mensajería.
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Ej: +51987654321" 
                    value={waPhoneInput}
                    onChange={(e) => setWaPhoneInput(e.target.value.replace(/[^\d+]/g, ''))}
                    style={{ 
                      flex: 1, 
                      padding: '8px 10px', 
                      fontSize: '12.5px', 
                      borderRadius: '8px', 
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text)'
                    }}
                  />
                  <button 
                    onClick={() => handleSendWhatsAppBaileys(lastReceipt)}
                    disabled={isWaSending}
                    style={{ 
                      padding: '8px 14px', 
                      background: '#25D366', 
                      color: 'white', 
                      fontWeight: '700', 
                      borderRadius: '8px', 
                      border: 'none',
                      fontSize: '12px',
                      cursor: 'pointer',
                      opacity: isWaSending ? 0.6 : 1
                    }}
                  >
                    {isWaSending ? 'Enviando...' : 'Enviar ahora'}
                  </button>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '9.5px', color: 'var(--accent)', fontStyle: 'italic' }}>
                  ⚠️ Requiere WhatsApp vinculado en el panel WhatsApp Baileys. Si no está conectado, el envío será rechazado.
                </p>
                <button 
                  onClick={() => setShowWhatsAppSubModal(false)}
                  style={{ 
                    marginTop: '8px', 
                    background: 'transparent', 
                    border: 'none', 
                    fontSize: '10px', 
                    color: 'var(--text-3)', 
                    cursor: 'pointer', 
                    padding: '2px 0', 
                    textDecoration: 'underline' 
                  }}
                >
                  Ocultar panel
                </button>
              </div>
            )}

            <button className="mc-sec" style={{ width: '100%', marginTop: '15px' }} onClick={() => { setShowReceiptModal(false); setShowWhatsAppSubModal(false); clearCart(); }}>Cerrar</button>
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
