"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, Product, ProductVersion, Sale, CartItem } from '@/context/AppContext';
import { loadJsPDF } from '@/lib/cdn';

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
    toast,
    saveClient,
    fractionateProduct
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

  // Client Selection & Payment Step state
  const [selectedClientId, setSelectedClientId] = useState<number | string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<number | null>(null);
  
  // Inline Client Creation state
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientData, setNewClientData] = useState({ nombre: '', dni: '', telefono: '' });
  const [isDniLoading, setIsDniLoading] = useState(false);
  const [dniOk, setDniOk] = useState(false);

  // Weight/Decimal Quantity Selector states
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [selectedProductForWeight, setSelectedProductForWeight] = useState<{ prod: Product; version: ProductVersion | null } | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [isEditingCartItem, setIsEditingCartItem] = useState(false);
  const [selectedCartItemId, setSelectedCartItemId] = useState('');
 
  // Auto-fractioning dialog states
  const [showAutoFractionModal, setShowAutoFractionModal] = useState(false);
  const [autoFractionData, setAutoFractionData] = useState<{ parentV: ProductVersion; childV: ProductVersion; prod: Product } | null>(null);

  // DNI duplicate detection in POS
  useEffect(() => {
    if (newClientData.dni.length >= 8) {
      const existing = clients.find(c => c.dni && c.dni.trim() === newClientData.dni.trim());
      if (existing) {
        toast(`ℹ️ Cliente ya registrado: ${existing.nombre}. Se usarán sus datos.`);
        setNewClientData({
          nombre: existing.nombre,
          dni: existing.dni,
          telefono: existing.telefono || ''
        });
        setDniOk(true);
      }
    }
  }, [newClientData.dni, clients, toast]);

  // Auto-fetch DNI effect
  useEffect(() => {
    // Solo consultar si el DNI tiene 8 caracteres y el nombre está vacío
    if (newClientData.dni.length === 8 && !newClientData.nombre) {
      const fetchDni = async () => {
        setIsDniLoading(true);
        try {
          const res = await fetch('/api/consulta-dni', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni: newClientData.dni }),
          });
          const json = await res.json();
          if (res.ok && json.success) {
            const d = json.data;
            const fullName = `${d.nombres || ''} ${d.apellido_paterno || ''} ${d.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();
            setNewClientData(prev => ({ ...prev, nombre: fullName }));
            setDniOk(true);
            toast('✅ Datos de DNI encontrados y completados');
          } else {
            toast('⚠️ ' + (json.message || 'DNI no encontrado en RENIEC'));
          }
        } catch (error) {
          console.error("Error fetching DNI", error);
        } finally {
          setIsDniLoading(false);
        }
      };
      fetchDni();
    }
  }, [newClientData.dni, newClientData.nombre, toast]);

  // WhatsApp Baileys sending states inside receipt modal
  const [showWhatsAppSubModal, setShowWhatsAppSubModal] = useState(false);
  const [waPhoneInput, setWaPhoneInput] = useState('');
  const [isWaSending, setIsWaSending] = useState(false);

  // Filtered active products (excluding Insumos since they are not sold directly)
  const filteredProducts = products.filter(p =>
    p.cat !== 'Insumos' && p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleProductClick = (prod: Product) => {
    if (prod.versions && prod.versions.length > 0) {
      setSelectedProduct(prod);
      setShowVariantModal(true);
    } else {
      if (prod.unidad_medida === 'kg' || prod.unidad_medida === 'gr') {
        setSelectedProductForWeight({ prod, version: null });
        setWeightInput('');
        setIsEditingCartItem(false);
        setShowWeightModal(true);
      } else {
        addToCart(prod.name, prod.price, prod.id);
      }
    }
  };

  const handleVariantSelect = (v: ProductVersion) => {
    if (selectedProduct) {
      if (v.stock <= 0 && v.parent_version_id) {
        const parentV = selectedProduct.versions.find(p => p.id === v.parent_version_id);
        if (parentV && parentV.stock > 0) {
          setAutoFractionData({ parentV, childV: v, prod: selectedProduct });
          setShowAutoFractionModal(true);
          setShowVariantModal(false);
          return;
        }
      }

      if (selectedProduct.unidad_medida === 'kg' || selectedProduct.unidad_medida === 'gr') {
        setSelectedProductForWeight({ prod: selectedProduct, version: v });
        setWeightInput('');
        setIsEditingCartItem(false);
        setShowWeightModal(true);
        setShowVariantModal(false);
      } else {
        addToCart(selectedProduct.name, v.price, selectedProduct.id, v);
        setShowVariantModal(false);
      }
    }
  };

  const handleConfirmAutoFraction = async () => {
    if (!autoFractionData) return;
    const { parentV, childV, prod } = autoFractionData;
    const ratio = childV.fraction_ratio || 10;

    try {
      await fractionateProduct(parentV.id, childV.id, 1, ratio);
      setShowAutoFractionModal(false);
      
      const updatedChildV = { ...childV, stock: childV.stock + ratio };
      
      if (prod.unidad_medida === 'kg' || prod.unidad_medida === 'gr') {
        setSelectedProductForWeight({ prod, version: updatedChildV });
        setWeightInput('');
        setIsEditingCartItem(false);
        setShowWeightModal(true);
      } else {
        addToCart(prod.name, childV.price, prod.id, updatedChildV);
      }
      toast(`🍰 Se fraccionó 1 ${parentV.name} para obtener ${ratio} ${childV.name}`);
    } catch (err: any) {
      toast('❌ Error al auto-fraccionar: ' + err.message);
    } finally {
      setAutoFractionData(null);
    }
  };

  const handleConfirmWeight = () => {
    if (!selectedProductForWeight) return;
    const qty = parseFloat(weightInput);
    if (isNaN(qty) || qty <= 0) {
      toast('⚠️ Por favor ingresa una cantidad válida.');
      return;
    }

    const { prod, version } = selectedProductForWeight;
    const maxStock = version ? version.stock : prod.stock;
    if (qty > maxStock) {
      toast(`⚠️ Stock insuficiente. Disponible: ${maxStock}`);
      return;
    }

    if (isEditingCartItem) {
      const existingItem = cart.find(item => version ? item.cartId === selectedCartItemId : (item.id === prod.id && !item.version));
      if (existingItem) {
        const delta = qty - existingItem.qty;
        updateCartQty(prod.id, delta, version?.name);
        toast('🛒 Cantidad actualizada');
      }
    } else {
      addToCart(prod.name, version ? version.price : prod.price, prod.id, version, qty);
    }
    setShowWeightModal(false);
    setSelectedProductForWeight(null);
  };

  const handleCartQtyClick = (item: CartItem) => {
    const prod = products.find(p => p.id === item.id);
    if (!prod) return;
    const versionObj = item.version ? prod.versions.find(v => v.name === item.version) : null;
    setSelectedProductForWeight({ prod, version: versionObj as ProductVersion | null });
    setWeightInput(String(item.qty));
    setIsEditingCartItem(true);
    setSelectedCartItemId(item.cartId || String(item.id));
    setShowWeightModal(true);
  };

  const handleCartQtyChange = (item: CartItem, isIncrement: boolean) => {
    const prod = products.find(p => p.id === item.id);
    if (!prod) return;
    if (prod.unidad_medida === 'kg' || prod.unidad_medida === 'gr') {
      const versionObj = item.version ? prod.versions.find(v => v.name === item.version) : null;
      setSelectedProductForWeight({ prod, version: versionObj as ProductVersion | null });
      setWeightInput(String(item.qty));
      setIsEditingCartItem(true);
      setSelectedCartItemId(item.cartId || String(item.id));
      setShowWeightModal(true);
    } else {
      updateCartQty(item.id, isIncrement ? 1 : -1, item.version);
    }
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setSelectedClientId(''); // Default to generic client
    setSelectedPaymentMethod(null);
    setIsCreatingClient(false);
    setNewClientData({ nombre: '', dni: '', telefono: '' });
    setDniOk(false);
    setShowCheckoutModal(true);
  };

  const handleConfirmPayment = async (methodId: number, overrideClientId?: number | string) => {
    const finalClientId = overrideClientId !== undefined ? overrideClientId : selectedClientId;
    const receipt = await checkoutCart(methodId, finalClientId || undefined);
    if (receipt) {
      setLastReceipt(receipt);
      setShowCheckoutModal(false);
      
      let clientPhone = '';
      // Auto-prefill customer phone if they exist and have a registered phone number
      if (finalClientId) {
        // Find in updated clients list or current list
        const foundCli = clients.find(c => String(c.id) === String(finalClientId));
        if (foundCli && foundCli.telefono) {
          // Normalize phone (ensure it has country code if needed, but display cleanly)
          const normPhone = foundCli.telefono.startsWith('+') ? foundCli.telefono : `+51${foundCli.telefono}`;
          setWaPhoneInput(normPhone);
          clientPhone = normPhone;
        } else {
          setWaPhoneInput('');
        }
      } else {
        setWaPhoneInput('');
      }

      setShowReceiptModal(true);

      // Auto-notify if configured
      if (typeof window !== 'undefined' && clientPhone) {
        const autoNotifySaved = localStorage.getItem('whatsapp_auto_notify');
        const isAutoNotify = autoNotifySaved === null ? true : autoNotifySaved === 'true'; // Default to true if not set
        if (isAutoNotify) {
          setTimeout(() => {
            handleSendWhatsAppBaileys(receipt, clientPhone);
          }, 800);
        }
      }
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
  const totalCartCountStr = Number.isInteger(totalCartCount) ? String(totalCartCount) : totalCartCount.toFixed(3).replace(/\.?0+$/, '');

  // Fallback wa.me redirect
  const handleShareWhatsApp = (receipt: Sale) => {
    const text = `*SNACK ROQUE 🥐*\n` +
                 `*Boleta de Venta Electrónica: B-${receipt.n}*\n` +
                 `Fecha: ${receipt.d}  Hora: ${receipt.t || '08:50'}\n` +
                 `Cajero: ${receipt.cajero || 'Admin'}\n` +
                 `----------------------------------------\n` +
                 receipt.items.map(i => {
                   const prod = products.find(p => p.id === i.id);
                   const uMedida = prod?.unidad_medida || 'und';
                   return `• ${i.name} (x${i.qty} ${uMedida}): S/. ${(i.price * i.qty).toFixed(2)}`;
                 }).join('\n') + `\n` +
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
      const prod = products.find(p => p.id === item.id);
      const uMedida = prod?.unidad_medida || 'und';
      ctx.fillText(`${item.qty} ${uMedida}`, width - 110, currentY);
      
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

  const generateTicketPdfDoc = (receipt: Sale, jsPDF: any) => {
    const itemHeight = 6;
    const baseHeight = 90;
    const height = baseHeight + (receipt.items.length * itemHeight);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, height]
    });
    
    doc.setFont('courier', 'bold');
    doc.setFontSize(14);
    doc.text('SNACK ROQUE', 40, 10, { align: 'center' });
    
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text('Av. Panamericana Sur #456, Ica', 40, 15, { align: 'center' });
    doc.text('RUC: 10432187659', 40, 19, { align: 'center' });
    doc.text('Teléfono: (056) 219876', 40, 23, { align: 'center' });
    doc.text('====================================', 40, 27, { align: 'center' });
    
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text(`BOLETA ELECTRÓNICA: B-${receipt.n}`, 40, 32, { align: 'center' });
    
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(`Fecha: ${receipt.d}`, 6, 38);
    doc.text(`Hora: ${receipt.t || '08:50'}`, 45, 38);
    doc.text(`Cajero: ${receipt.cajero || 'Admin'}`, 6, 42);
    doc.text(`Cliente: ${receipt.clienteNombre || 'Genérico'}`, 6, 46);
    doc.text('------------------------------------', 40, 50, { align: 'center' });
    
    doc.setFont('courier', 'bold');
    doc.text('DESCRIPCIÓN', 6, 54);
    doc.text('CANT', 50, 54, { align: 'right' });
    doc.text('TOTAL', 74, 54, { align: 'right' });
    doc.text('------------------------------------', 40, 58, { align: 'center' });
    
    doc.setFont('courier', 'normal');
    let currentY = 62;
    receipt.items.forEach(item => {
      const name = item.name.length > 18 ? item.name.substring(0, 18) : item.name;
      doc.text(name, 6, currentY);
      const prod = products.find(p => p.id === item.id);
      const uMedida = prod?.unidad_medida || 'und';
      doc.text(`${item.qty} ${uMedida}`, 50, currentY, { align: 'right' });
      doc.text(`S/. ${(item.price * item.qty).toFixed(2)}`, 74, currentY, { align: 'right' });
      currentY += itemHeight;
    });
    
    doc.text('------------------------------------', 40, currentY, { align: 'center' });
    currentY += 5;
    
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL A PAGAR:', 6, currentY);
    doc.text(`S/. ${receipt.total.toFixed(2)}`, 74, currentY, { align: 'right' });
    currentY += 6;
    
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(`Método de Pago: ${receipt.method || 'Efectivo'}`, 6, currentY);
    currentY += 6;
    doc.text('====================================', 40, currentY, { align: 'center' });
    currentY += 6;
    
    doc.setFont('courier', 'bold');
    doc.text('¡MUCHAS GRACIAS POR SU COMPRA!', 40, currentY, { align: 'center' });
    currentY += 4;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.text('Representación impresa de la Boleta Electrónica', 40, currentY, { align: 'center' });
    
    return doc;
  };

  const downloadTicketAsPdf = async (receipt: Sale) => {
    try {
      const jspdfModule = await loadJsPDF();
      const { jsPDF } = jspdfModule;
      const doc = generateTicketPdfDoc(receipt, jsPDF);
      doc.save(`boleta_B-${receipt.n}.pdf`);
      toast('📥 Ticket descargado como PDF con éxito');
    } catch (err: any) {
      console.error(err);
      toast('❌ Error al generar PDF: ' + err.message);
    }
  };

  // Real WhatsApp sending via Baileys API route
  const handleSendWhatsAppBaileys = async (receipt: Sale, overridePhone?: string) => {
    const targetPhone = overridePhone || waPhoneInput;
    if (!targetPhone) {
      toast('⚠️ Por favor ingresa un número de teléfono válido.');
      return;
    }
    
    setIsWaSending(true);
    try {
      // Load template from localStorage
      let template = '🧾 Tu boleta #{numero} de S/ {monto} ya está disponible. ¡Gracias por tu compra en Snack Roque!';
      if (typeof window !== 'undefined') {
        const savedTemplate = localStorage.getItem('whatsapp_msg_template');
        if (savedTemplate) {
          template = savedTemplate;
        }
      }

      const text = template
        .replace(/{numero}/g, `B-${receipt.n}`)
        .replace(/{monto}/g, receipt.total.toFixed(2))
        .replace(/{cliente}/g, receipt.clienteNombre || 'Cliente');

      // Generate PDF Base64 string from browser
      let pdfBase64 = '';
      try {
        const jspdfModule = await loadJsPDF();
        const { jsPDF } = jspdfModule;
        const doc = generateTicketPdfDoc(receipt, jsPDF);
        const dataUri = doc.output('datauristring');
        pdfBase64 = dataUri.split(',')[1];
      } catch (pdfErr) {
        console.error('Error generating PDF for WhatsApp attachment', pdfErr);
      }

      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          message: text,
          saleId: receipt.id,
          pdfBase64: pdfBase64 || null,
          fileName: `boleta_B-${receipt.n}.pdf`
        })
      });

      const resData = await response.json();
      if (resData.success) {
        toast(`✅ Comprobante y PDF enviados con éxito a ${targetPhone} vía Baileys.`);
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
                    <span className="ci-em">
                      {{
                        'Panes': '🍞',
                        'Tortas': '🎂',
                        'Dulces': '🍬',
                        'Bebidas': '🥤'
                      }[p.cat] || '📦'}
                    </span>
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
            <span>{totalCartCountStr} items</span>
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
                    <button className="q-btn" onClick={() => handleCartQtyChange(item, false)}>−</button>
                    <span 
                      className="q-num" 
                      onClick={() => handleCartQtyClick(item)}
                      style={{ cursor: 'pointer', textDecoration: 'underline decoration-dotted', padding: '0 4px', fontWeight: 'bold' }}
                      title="Haz clic para ingresar cantidad"
                    >
                      {item.qty} {products.find(p => p.id === item.id)?.unidad_medida || 'und'}
                    </span>
                    <button className="q-btn" onClick={() => handleCartQtyChange(item, true)}>+</button>
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
            <div className="mc-title">
              {!selectedPaymentMethod ? 'Seleccionar Método de Pago' : 'Vincular Cliente (Opcional)'}
            </div>
            <p className="mc-sub" style={{ marginBottom: '15px' }}>Monto Total a Cobrar: <strong>S/. {cartTotal.toFixed(2)}</strong></p>

            {!selectedPaymentMethod ? (
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
                        onClick={() => setSelectedPaymentMethod(m.id as number)}
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
                {/* Botón manual para Tarjeta Prepago */}
                <button
                  onClick={() => setSelectedPaymentMethod(999)}
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
                  <span style={{ fontSize: '24px' }}>💳</span>
                  Tarjeta Prepago
                </button>
              </div>
            ) : (
              <>
                {/* CLIENTE SELECTOR */}
                <div className="inp-group" style={{ marginBottom: '18px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                      Cliente a facturar
                    </label>
                    {!isCreatingClient ? (
                      <button type="button" onClick={() => setIsCreatingClient(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}>+ Nuevo Cliente</button>
                    ) : (
                      <button type="button" onClick={() => { setIsCreatingClient(false); setNewClientData({ nombre: '', dni: '', telefono: '' }); setDniOk(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}>Cancelar</button>
                    )}
                  </div>
                  
                  {!isCreatingClient ? (
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
                      {selectedPaymentMethod === 999 ? (
                        <option value="">-- Seleccionar Cliente Prepago (Obligatorio) --</option>
                      ) : (
                        <option value="">-- Cliente Genérico (Anonimo) --</option>
                      )}
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          👤 {c.nombre} · Saldo Prepago: S/. {c.saldoCred.toFixed(2)} {c.dni ? `(DNI: ${c.dni})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', padding: '14px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ position: 'relative' }}>
                          <input 
                            placeholder="DNI / RUC" 
                            value={newClientData.dni} 
                            onChange={e => { setNewClientData({...newClientData, dni: e.target.value.replace(/\D/g, '')}); setDniOk(false); }} 
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '13px', background: 'var(--bg-card)' }} 
                            maxLength={11}
                          />
                          {isDniLoading && <span className="ci-em" style={{ position: 'absolute', right: '10px', top: '10px', animation: 'spin 1.5s linear infinite', fontSize: '14px' }}>🥐</span>}
                        </div>
                        <input 
                          placeholder="Celular (máx. 9 dígitos)" 
                          value={newClientData.telefono} 
                          onChange={e => setNewClientData({...newClientData, telefono: e.target.value.replace(/\D/g, '')})} 
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '13px', background: 'var(--bg-card)' }} 
                          maxLength={9}
                        />
                      </div>
                      <input 
                        placeholder="Nombre Completo *" 
                        value={newClientData.nombre} 
                        onChange={e => setNewClientData({...newClientData, nombre: e.target.value})} 
                        readOnly={dniOk}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          border: '1.5px solid var(--border)', 
                          fontSize: '13px', 
                          background: dniOk ? 'var(--bg-hover)' : 'var(--bg-card)',
                          cursor: dniOk ? 'not-allowed' : undefined
                        }} 
                      />
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', margin: '20px 0' }}>
                  <button 
                    className="mc-pri" 
                    onClick={async () => {
                      if (selectedPaymentMethod === 999 && !selectedClientId && !isCreatingClient) {
                        toast('⚠️ Para pagar con Tarjeta Prepago debe seleccionar un cliente.');
                        return;
                      }
                      
                      const finalCliId = isCreatingClient ? undefined : selectedClientId;
                      if (selectedPaymentMethod === 999 && finalCliId) {
                        const targetC = clients.find(c => String(c.id) === String(finalCliId));
                        if (targetC && targetC.saldoCred < cartTotal) {
                          toast(`⚠️ Saldo prepago insuficiente. Disponible: S/. ${targetC.saldoCred.toFixed(2)}`);
                          return;
                        }
                      }

                      if (isCreatingClient) {
                        if (!newClientData.nombre.trim()) { toast('⚠️ El nombre es obligatorio para crear un cliente.'); return; }
                        const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'\-]+$/;
                        if (!nameRegex.test(newClientData.nombre.trim())) {
                          toast('⚠️ El nombre de cliente solo debe contener letras.');
                          return;
                        }
                        if (newClientData.telefono && newClientData.telefono.replace(/\D/g, '').length > 9) {
                          toast('⚠️ El celular no debe exceder los 9 dígitos.');
                          return;
                        }
                        const saved = await saveClient(newClientData);
                        if (saved) {
                          setSelectedClientId(saved.id);
                          setIsCreatingClient(false);
                          setNewClientData({ nombre: '', dni: '', telefono: '' });
                          setDniOk(false);
                          handleConfirmPayment(selectedPaymentMethod as number, saved.id);
                        }
                      } else {
                        handleConfirmPayment(selectedPaymentMethod as number, selectedClientId);
                      }
                    }}
                    style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Confirmar Cobro y Emitir
                  </button>
                  <button 
                    className="mc-sec" 
                    onClick={() => {
                      setSelectedPaymentMethod(null);
                      setIsCreatingClient(false);
                    }}
                    style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-2)', borderRadius: '10px', border: '1.5px solid var(--border)', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Volver atrás
                  </button>
                </div>
              </>
            )}

            {!selectedPaymentMethod && (
              <button type="button" className="mc-sec" style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-2)', borderRadius: '10px', border: '1.5px solid var(--border)', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setShowCheckoutModal(false)}>
                Cancelar Venta
              </button>
            )}
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
                <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '2px 0' }}>Boleta #B-{lastReceipt.n}</p>
                <p style={{ fontSize: '10.5px', color: 'var(--text-3)', margin: '2px 0' }}>{lastReceipt.d} · {lastReceipt.t || ''}</p>
              </div>

              {/* Cajero y cliente */}
              <div style={{ borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', padding: '8px 0', marginBottom: '10px', fontSize: '11.5px', color: 'var(--text-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cajero</span>
                  <span style={{ fontWeight: '600' }}>{lastReceipt.cajero || 'Admin'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span>Cliente</span>
                  <span style={{ fontWeight: '600' }}>{lastReceipt.clienteNombre || 'Cliente Genérico'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span>Método de pago</span>
                  <span style={{ fontWeight: '600' }}>{lastReceipt.method || 'Efectivo'}</span>
                </div>
              </div>

              {lastReceipt.items.map((i, idx) => {
                const prod = products.find(p => p.id === i.id);
                const uMedida = prod?.unidad_medida || 'und';
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '5px 0' }}>
                    <span>{i.name} (x{i.qty} {uMedida})</span>
                    <span>S/. {(i.price * i.qty).toFixed(2)}</span>
                  </div>
                );
              })}
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
                onClick={() => downloadTicketAsPdf(lastReceipt)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                📄 Descargar PDF
              </button>
            </div>
            <button 
              className="mc-pri" 
              onClick={() => setShowWhatsAppSubModal(!showWhatsAppSubModal)}
              style={{ 
                background: showWhatsAppSubModal ? 'var(--bg-card2)' : '#25D366', 
                color: showWhatsAppSubModal ? 'var(--text-2)' : 'white', 
                border: showWhatsAppSubModal ? '1.5px solid var(--border)' : 'none',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '6px', 
                width: '100%', 
                marginTop: '10px',
                transition: 'all 0.2s'
              }}
            >
              {showWhatsAppSubModal ? '✕ Cancelar Envío' : '💬 Enviar por WhatsApp'}
            </button>

            {/* BAILEYS SENDING SUB-PANEL */}
            {showWhatsAppSubModal && (
              <div style={{ 
                marginTop: '12px', 
                padding: '16px', 
                border: '1.5px solid rgba(37, 211, 102, 0.18)', 
                borderRadius: '12px', 
                background: 'rgba(37, 211, 102, 0.04)',
                textAlign: 'left',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                    Enviar Comprobante Digital
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#25D366', fontWeight: 'bold' }}>
                    <span style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      background: '#25D366', 
                      display: 'inline-block',
                      boxShadow: '0 0 6px #25D366'
                    }}></span>
                    Servicio Activo
                  </span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--text-3)', lineHeight: '1.4' }}>
                  El ticket de venta será generado y enviado directamente al teléfono indicado a través del Gateway.
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Ej: +51987654321" 
                    value={waPhoneInput}
                    onChange={(e) => setWaPhoneInput(e.target.value.replace(/[^\d+]/g, ''))}
                    style={{ 
                      flex: 1, 
                      padding: '10px 12px', 
                      fontSize: '13px', 
                      borderRadius: '8px', 
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text)',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#25D366'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                  <button 
                    onClick={() => handleSendWhatsAppBaileys(lastReceipt)}
                    disabled={isWaSending}
                    style={{ 
                      padding: '10px 18px', 
                      background: '#25D366', 
                      color: 'white', 
                      fontWeight: '700', 
                      borderRadius: '8px', 
                      border: 'none',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      opacity: isWaSending ? 0.7 : 1,
                      boxShadow: '0 2px 6px rgba(37, 211, 102, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isWaSending ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
                <div style={{ 
                  marginTop: '12px', 
                  display: 'flex', 
                  gap: '6px', 
                  alignItems: 'flex-start', 
                  background: 'rgba(239, 68, 68, 0.03)', 
                  border: '1px solid rgba(239, 68, 68, 0.1)', 
                  borderRadius: '8px', 
                  padding: '8px 10px' 
                }}>
                  <span style={{ fontSize: '11px', lineHeight: '1' }}>⚠️</span>
                  <p style={{ margin: 0, fontSize: '9.5px', color: 'var(--text-3)', lineHeight: '1.3' }}>
                    Requiere que el dispositivo móvil emisor esté enlazado y activo en el panel de control **WhatsApp Baileys**.
                  </p>
                </div>
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
            <span className="ci-em" style={{ fontSize: '38px', textAlign: 'center' }}>
              {{
                'Panes': '🍞',
                'Tortas': '🎂',
                'Dulces': '🍬',
                'Bebidas': '🥤',
                'Insumos': '🌾'
              }[selectedProduct.cat] || '📦'}
            </span>
            <div className="mc-title">{selectedProduct.name}</div>
            <p className="mc-sub">Selecciona la variante/versión a facturar</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '18px 0' }}>
              {selectedProduct.versions.map((v) => {
                const parent = v.parent_version_id 
                  ? selectedProduct.versions.find(p => p.id === v.parent_version_id) 
                  : null;
                const isAgotado = v.stock <= 0 && (!parent || parent.stock <= 0);
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
                        {v.stock <= 0 && parent && parent.stock > 0 
                          ? `Agotado (Cortar de ${parent.name})` 
                          : isAgotado 
                            ? 'Agotado' 
                            : `${v.stock} disponibles`
                        }
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

      {/* WEIGHT & DECIMAL QUANTITY MODAL */}
      {showWeightModal && selectedProductForWeight && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '400px' }}>
            <span className="ci-em" style={{ fontSize: '38px', textAlign: 'center' }}>
              {{
                'Panes': '🍞',
                'Tortas': '🎂',
                'Dulces': '🍬',
                'Bebidas': '🥤',
                'Insumos': '🌾'
              }[selectedProductForWeight.prod.cat] || '📦'}
            </span>
            <div className="mc-title">
              {isEditingCartItem ? 'Editar Cantidad' : 'Ingresar Cantidad / Peso'}
            </div>
            <div className="mc-sub" style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px' }}>
              {selectedProductForWeight.prod.name} 
              {selectedProductForWeight.version ? ` (${selectedProductForWeight.version.name})` : ''}
            </div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-3)' }}>Precio: </span>
              <strong style={{ fontSize: '16px', color: 'var(--accent)' }}>
                S/. {(selectedProductForWeight.version ? selectedProductForWeight.version.price : selectedProductForWeight.prod.price).toFixed(2)}
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                {' '}por {selectedProductForWeight.prod.unidad_medida || 'unidades'}
              </span>
            </div>

            {/* Display Screen */}
            <div style={{
              background: 'var(--bg)',
              border: '2px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'right',
              marginBottom: '16px',
              position: 'relative'
            }}>
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                color: 'var(--text-3)',
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                Cantidad
              </span>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text)' }}>
                {weightInput || '0'}
                <span style={{ fontSize: '16px', marginLeft: '6px', color: 'var(--text-3)' }}>
                  {selectedProductForWeight.prod.unidad_medida || 'unidades'}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>
                Subtotal: S/. {((selectedProductForWeight.version ? selectedProductForWeight.version.price : selectedProductForWeight.prod.price) * (parseFloat(weightInput) || 0)).toFixed(2)}
              </div>
            </div>

            {/* Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              {selectedProductForWeight.prod.unidad_medida === 'kg' ? (
                <>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('0.100')}>0.100 kg</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('0.250')}>0.250 kg</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('0.500')}>0.500 kg</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('1.000')}>1.000 kg</button>
                </>
              ) : selectedProductForWeight.prod.unidad_medida === 'gr' ? (
                <>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('100')}>100 gr</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('250')}>250 gr</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('500')}>500 gr</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('1000')}>1000 gr</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('1')}>1 und</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('2')}>2 und</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('5')}>5 und</button>
                  <button type="button" className="btn-new" style={{ padding: '8px', fontSize: '12px' }} onClick={() => setWeightInput('10')}>10 und</button>
                </>
              )}
            </div>

            {/* Keypad */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              marginBottom: '20px'
            }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setWeightInput(prev => prev + String(num))}
                  style={{
                    padding: '16px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    background: 'var(--bg-card2)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (!weightInput.includes('.')) {
                    setWeightInput(prev => prev === '' ? '0.' : prev + '.');
                  }
                }}
                style={{
                  padding: '16px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: 'var(--bg-card2)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                .
              </button>
              <button
                type="button"
                onClick={() => setWeightInput(prev => prev + '0')}
                style={{
                  padding: '16px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: 'var(--bg-card2)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setWeightInput(prev => prev.slice(0, -1))}
                style={{
                  padding: '16px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: 'var(--bg-card2)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                ⌫
              </button>
              
              <button
                type="button"
                onClick={() => setWeightInput('')}
                style={{
                  gridColumn: 'span 3',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  color: 'var(--red)',
                  cursor: 'pointer'
                }}
              >
                Limpiar todo
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className="mc-sec"
                onClick={() => {
                  setShowWeightModal(false);
                  setSelectedProductForWeight(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mc-pri"
                onClick={handleConfirmWeight}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-FRACTIONING OPTIONAL POPUP */}
      {showAutoFractionModal && autoFractionData && (
        <div className="modal-overlay open">
          <div className="modal-card" style={{ width: '420px', padding: '24px' }}>
            <span className="mc-icon" style={{ fontSize: '42px', textAlign: 'center', display: 'block' }}>🍰</span>
            <div className="mc-title">Auto-Fraccionamiento Dinámico</div>
            <p className="mc-sub" style={{ marginBottom: '16px' }}>
              No quedan existencias de <strong>{autoFractionData.childV.name}</strong> en vitrina.
            </p>

            <div style={{
              background: 'rgba(20, 184, 166, 0.05)',
              border: '1px solid rgba(20, 184, 166, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-2)' }}>
                Se detectó stock disponible de <strong>{autoFractionData.parentV.name}</strong> ({autoFractionData.parentV.stock} und).
              </p>
              <strong style={{ fontSize: '15px', color: '#0d9488' }}>
                ¿Deseas cortar 1 {autoFractionData.parentV.name} para obtener {autoFractionData.childV.fraction_ratio || 10} {autoFractionData.childV.name}?
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className="mc-sec"
                onClick={() => {
                  setShowAutoFractionModal(false);
                  setAutoFractionData(null);
                }}
              >
                No, cancelar
              </button>
              <button
                type="button"
                className="mc-pri"
                style={{ background: '#0d9488' }}
                onClick={handleConfirmAutoFraction}
              >
                Sí, fraccionar y vender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
