"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useApp, Pedido, PedidoItem } from '@/context/AppContext';
import { MateriaPrimaPanel } from '@/components/MateriaPrimaPanel';

type PedidoMeta = {
  itemsList: PedidoItem[];
  totalVal: number;
  summary: string;
  itemCount: number;
};

function getPedidoArrivalMs(p: Pedido): number {
  if (p.createdAt) {
    const ts = new Date(p.createdAt).getTime();
    if (!isNaN(ts)) return ts;
  }
  const idStr = String(p.id);
  if (idStr.startsWith('local_')) {
    const ts = parseInt(idStr.replace('local_', ''), 10);
    if (!isNaN(ts)) return ts;
  }
  const numId = typeof p.id === 'number' ? p.id : parseInt(idStr, 10);
  return !isNaN(numId) ? numId : 0;
}

function formatArrivalDayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatRelativeArrival(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'ahora mismo';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return new Date(ms).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPedidoId(id: Pedido['id']): string {
  return String(id).startsWith('local_') ? 'Local' : `#RES-${id}`;
}

function parsePedidoMeta(p: Pedido): PedidoMeta {
  let itemsList: PedidoItem[] = [];
  let totalVal = p.adelanto;
  let summary = p.productoTexto;

  if (p.productoTexto.startsWith('{')) {
    try {
      const parsed = JSON.parse(p.productoTexto);
      itemsList = parsed.items || [];
      totalVal = parsed.total || p.adelanto;
      summary =
        parsed.legacyText ||
        itemsList.map(i => i.name).join(', ') ||
        'Reserva';
    } catch {
      summary = p.productoTexto;
    }
  }

  const trimmed = summary.replace(/\s+/g, ' ').trim();
  return {
    itemsList,
    totalVal,
    summary: trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed,
    itemCount: itemsList.length,
  };
}

function comparePedidosByArrival(a: Pedido, b: Pedido): number {
  const arrivalDiff = getPedidoArrivalMs(b) - getPedidoArrivalMs(a);
  if (arrivalDiff !== 0) return arrivalDiff;
  return new Date(a.fecEntrega).getTime() - new Date(b.fecEntrega).getTime();
}

export default function PedidosPage() {
  const {
    pedidos, clients, savePedido, saveClient, updatePedidoStatus, user, products,
    paymentMethods, deliverPedido, calcularInsumosParaPedido, toast,
  } = useApp();

  const [nowTime] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<'Todos' | 'Pendiente' | 'Listo' | 'Entregado' | 'Cancelado'>('Todos');
  const [search, setSearch] = useState('');
  const [expandedPedidoId, setExpandedPedidoId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);

  // Form states
  const [fClienteId, setFClienteId] = useState('');
  const [fProductoTexto, setFProductoTexto] = useState('');
  const [fFecEntrega, setFFecEntrega] = useState('');
  const [fAdelanto, setFAdelanto] = useState('0');
  const [fNotas, setFNotas] = useState('');

  // Client search / inline creation states
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientData, setNewClientData] = useState({ nombre: '', dni: '', telefono: '' });
  const [isDniLoading, setIsDniLoading] = useState(false);
  const [dniOk, setDniOk] = useState(false);

  const minDateStr = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const [fTotal, setFTotal] = useState('0');
  const [isTotalManual, setIsTotalManual] = useState(false);
  const [reservationItems, setReservationItems] = useState<PedidoItem[]>([]);

  const reservationPlan = useMemo(
    () => calcularInsumosParaPedido(reservationItems),
    [reservationItems, calcularInsumosParaPedido]
  );

  const MAX_MONTO_DIGITOS = 8;
  const MAX_MONTO_VALOR = 99_999_999.99;

  const calcItemsTotal = (items: PedidoItem[]) =>
    items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const capMontoValor = (raw: string) => {
    if (raw === '' || raw === '-') return raw;
    const normalized = raw.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(normalized)) return null;

    let [enteroPart = '', decimalPart = ''] = normalized.split('.');
    const hasDot = normalized.includes('.');

    if (enteroPart.length > MAX_MONTO_DIGITOS) {
      enteroPart = enteroPart.slice(0, MAX_MONTO_DIGITOS);
    }
    if (decimalPart.length > 2) {
      decimalPart = decimalPart.slice(0, 2);
    }

    const assembled = hasDot ? `${enteroPart}${decimalPart !== '' || normalized.endsWith('.') ? `.${decimalPart}` : ''}` : enteroPart;
    if (assembled === '' || assembled === '.') return assembled;

    const num = parseFloat(assembled);
    if (isNaN(num)) return assembled;
    if (num > MAX_MONTO_VALOR) return MAX_MONTO_VALOR.toFixed(2);
    if (num < 0) return '0';
    return assembled;
  };

  const formatMontoFromNumber = (value: number) => {
    const capped = Math.min(Math.max(value, 0), MAX_MONTO_VALOR);
    return capped.toFixed(2);
  };

  const effectiveFormTotal = useMemo(() => {
    if (reservationItems.length > 0 && !isTotalManual) {
      return calcItemsTotal(reservationItems);
    }
    return parseFloat(fTotal) || 0;
  }, [reservationItems, isTotalManual, fTotal]);

  const adelantoNum = parseFloat(fAdelanto) || 0;
  const adelantoExcedeTotal =
    effectiveFormTotal > 0 && adelantoNum > effectiveFormTotal + 0.001;
  const adelantoIgualTotal =
    effectiveFormTotal > 0 && Math.abs(adelantoNum - effectiveFormTotal) < 0.01;

  const clampAdelantoToTotal = (raw: string, total: number) => {
    if (raw === '' || raw === '-') return raw;
    const num = parseFloat(raw);
    if (isNaN(num)) return raw;
    if (num < 0) return '0';
    if (total > 0 && num > total) return total.toFixed(2);
    return raw;
  };

  const handleTotalChange = (raw: string) => {
    const capped = capMontoValor(raw);
    if (capped === null) return;
    setFTotal(capped);
    setIsTotalManual(true);
    const newTotal = parseFloat(capped) || 0;
    setFAdelanto(prev => clampAdelantoToTotal(prev, newTotal));
  };

  const handleAdelantoChange = (raw: string) => {
    const capped = capMontoValor(raw);
    if (capped === null) return;
    setFAdelanto(clampAdelantoToTotal(capped, effectiveFormTotal));
  };

  const totalDigitosEnteros = (fTotal.split('.')[0] || '').replace(/\D/g, '').length;
  const totalExcedeDigitos = totalDigitosEnteros > MAX_MONTO_DIGITOS;
  const totalExcedeMaximo = effectiveFormTotal > MAX_MONTO_VALOR + 0.001;

  // Product / custom picker states
  const [itemType, setItemType] = useState<'producto' | 'personalizado'>('producto');
  const [selectedProdId, setSelectedProdId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');

  // Delivery Modal states
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveringPedido, setDeliveringPedido] = useState<Pedido | null>(null);
  const [delPaymentMethodId, setDelPaymentMethodId] = useState<number | string>('');

  const selectedProdObj = useMemo(() => {
    return products.find(p => String(p.id) === String(selectedProdId)) || null;
  }, [selectedProdId, products]);

  const handleProductChange = (prodId: string) => {
    setSelectedProdId(prodId);
    setSelectedVersionId('');
    const prod = products.find(p => String(p.id) === prodId);
    if (prod) {
      if (prod.versions && prod.versions.length > 0) {
        setItemPrice('');
      } else {
        setItemPrice(String(prod.price));
      }
    } else {
      setItemPrice('');
    }
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    if (selectedProdObj) {
      const versionObj = selectedProdObj.versions.find(v => String(v.id) === versionId);
      if (versionObj) {
        setItemPrice(String(versionObj.price));
      }
    }
  };

  const handleAddItemToReservation = () => {
    let name = '';
    let price = parseFloat(itemPrice) || 0;
    let qty = parseFloat(selectedQty);
    let versionName: string | null = null;
    let unidadMedida = 'und';
    let productId: number | null = null;

    if (qty <= 0 || isNaN(qty)) {
      alert('Por favor ingresa una cantidad válida mayor a 0.');
      return;
    }

    if (itemType === 'producto') {
      if (!selectedProdId) {
        alert('Por favor selecciona un producto.');
        return;
      }
      const prod = products.find(p => String(p.id) === selectedProdId);
      if (!prod) return;
      productId = prod.id;
      name = prod.name;
      unidadMedida = prod.unidad_medida || 'und';

      if (selectedVersionId) {
        const versionObj = prod.versions.find(v => String(v.id) === selectedVersionId);
        if (versionObj) {
          versionName = versionObj.name;
          price = isNaN(price) || price === 0 ? versionObj.price : price;
        }
      } else {
        price = isNaN(price) || price === 0 ? prod.price : price;
      }
    } else {
      // Personalizado
      if (!customItemName.trim()) {
        alert('Por favor ingresa un nombre para el ítem personalizado.');
        return;
      }
      name = customItemName.trim();
      unidadMedida = 'und';
      price = isNaN(price) ? 0 : price;
    }

    const newItem = {
      type: itemType,
      productId,
      insumoId: null,
      name,
      price,
      qty,
      versionName,
      unidadMedida
    };

    const newItems = [...reservationItems, newItem];
    setReservationItems(newItems);

    if (!isTotalManual) {
      const newTotal = calcItemsTotal(newItems);
      setFTotal(formatMontoFromNumber(newTotal));
      setFAdelanto(prev => clampAdelantoToTotal(prev, Math.min(newTotal, MAX_MONTO_VALOR)));
    }

    // Reset picker states
    setSelectedProdId('');
    setSelectedVersionId('');
    setCustomItemName('');
    setItemPrice('');
    setSelectedQty('1');
  };

  const handleRemoveProductFromReservation = (index: number) => {
    const newItems = reservationItems.filter((_, idx) => idx !== index);
    setReservationItems(newItems);

    if (!isTotalManual) {
      const newTotal = calcItemsTotal(newItems);
      setFTotal(formatMontoFromNumber(newTotal));
      setFAdelanto(prev => clampAdelantoToTotal(prev, Math.min(newTotal, MAX_MONTO_VALOR)));
    }
  };

  const getPedidoDescription = (productoTexto: string) => {
    try {
      if (productoTexto.startsWith('{')) {
        const parsed = JSON.parse(productoTexto);
        if (parsed.items && parsed.items.length > 0) {
          return parsed.items.map((i: any) => `• ${i.qty} ${i.unidadMedida || 'und'} x ${i.name}${i.versionName ? ` (${i.versionName})` : ''}`).join('\n');
        }
        return parsed.legacyText || 'Reserva';
      }
    } catch (e) {
      console.error('Error parsing product text JSON', e);
    }
    return productoTexto;
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const query = clientSearch.toLowerCase();
    return clients.filter(c =>
      c.nombre.toLowerCase().includes(query) ||
      (c.dni && c.dni.includes(query))
    );
  }, [clients, clientSearch]);

  const hasExactClientMatch = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return false;
    return clients.some(
      c =>
        c.nombre.trim().toLowerCase() === q ||
        (c.dni && c.dni.trim() === clientSearch.trim())
    );
  }, [clients, clientSearch]);

  const resetNewClientForm = () => {
    setIsCreatingClient(false);
    setNewClientData({ nombre: '', dni: '', telefono: '' });
    setDniOk(false);
    setIsDniLoading(false);
  };

  const startCreatingClient = (nombrePrefill = '') => {
    const nombre = nombrePrefill.trim();
    setIsCreatingClient(true);
    setFClienteId('');
    setNewClientData({ nombre, dni: '', telefono: '' });
    setDniOk(false);
    setShowClientDropdown(false);
    if (nombre) setClientSearch(nombre);
  };

  const selectExistingClient = (c: (typeof clients)[number]) => {
    setFClienteId(String(c.id));
    setClientSearch(c.nombre);
    setShowClientDropdown(false);
    resetNewClientForm();
  };

  const handleNewClientDniChange = (rawDni: string) => {
    const dni = rawDni.replace(/\D/g, '');
    setNewClientData(prev => ({ ...prev, dni }));
    setDniOk(false);

    if (dni.length >= 8) {
      const existing = clients.find(c => c.dni && c.dni.trim() === dni.trim());
      if (existing) {
        toast(`ℹ️ Cliente ya registrado: ${existing.nombre}. Se usarán sus datos.`);
        selectExistingClient(existing);
      }
    }
  };

  useEffect(() => {
    if (!isCreatingClient || newClientData.dni.length !== 8 || newClientData.nombre) return;

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
          const fullName = `${d.nombres || ''} ${d.apellido_paterno || ''} ${d.apellido_materno || ''}`
            .replace(/\s+/g, ' ')
            .trim();
          setNewClientData(prev => ({ ...prev, nombre: fullName }));
          setClientSearch(fullName);
          setDniOk(true);
          toast('✅ Datos de DNI encontrados y completados');
        } else {
          toast('⚠️ ' + (json.message || 'DNI no encontrado en RENIEC'));
        }
      } catch (error) {
        console.error('Error fetching DNI', error);
      } finally {
        setIsDniLoading(false);
      }
    };

    void fetchDni();
  }, [isCreatingClient, newClientData.dni, newClientData.nombre, toast]);

  const resolveClienteId = async (): Promise<number | null> => {
    if (fClienteId) return parseInt(fClienteId);

    const nombre = isCreatingClient ? newClientData.nombre.trim() : clientSearch.trim();
    if (!nombre) return null;

    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'\-]+$/;
    if (!nameRegex.test(nombre)) {
      alert('El nombre del cliente solo debe contener letras.');
      return null;
    }

    const telefono = (isCreatingClient ? newClientData.telefono : '').replace(/\D/g, '');
    if (telefono.length > 9) {
      alert('El celular no debe exceder los 9 dígitos.');
      return null;
    }

    const saved = await saveClient({
      nombre,
      dni: isCreatingClient ? newClientData.dni : '',
      telefono,
    });
    if (!saved) return null;

    setFClienteId(String(saved.id));
    setClientSearch(saved.nombre);
    resetNewClientForm();
    return typeof saved.id === 'number' ? saved.id : parseInt(String(saved.id));
  };

  const isAdmin = user?.rs?.includes('Administrador');
  const isSupervisor = user?.rs?.includes('Supervisor');
  const isCajero = user?.rs?.includes('Cajero');

  // KPI Calculations
  const stats = useMemo(() => {
    const total = pedidos.length;
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente').length;
    const listos = pedidos.filter(p => p.estado === 'Listo').length;
    const adelantos = pedidos.reduce((sum, p) => sum + (p.estado !== 'Cancelado' ? p.adelanto : 0), 0);
    return { total, pendientes, listos, adelantos };
  }, [pedidos]);

  // Filtered Pedidos
  const filteredPedidos = useMemo(() => {
    return pedidos
      .filter(p => {
        const matchesTab = activeTab === 'Todos' || p.estado === activeTab;
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (p.clienteNombre || '').toLowerCase().includes(searchLower) ||
          p.productoTexto.toLowerCase().includes(searchLower) ||
          (p.notas || '').toLowerCase().includes(searchLower);
        return matchesTab && matchesSearch;
      })
      .sort(comparePedidosByArrival);
  }, [pedidos, activeTab, search]);

  const groupedPedidos = useMemo(() => {
    const buckets = new Map<string, { label: string; sortKey: number; items: Pedido[] }>();

    for (const p of filteredPedidos) {
      const arrivalMs = getPedidoArrivalMs(p);
      const day = new Date(arrivalMs);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();

      if (!buckets.has(key)) {
        buckets.set(key, {
          label: formatArrivalDayLabel(arrivalMs),
          sortKey: day.getTime(),
          items: [],
        });
      }
      buckets.get(key)!.items.push(p);
    }

    return [...buckets.values()].sort((a, b) => b.sortKey - a.sortKey);
  }, [filteredPedidos]);

  const openNewPedido = () => {
    setEditingPedido(null);
    setFClienteId('');
    setClientSearch('');
    setShowClientDropdown(false);
    resetNewClientForm();
    setFProductoTexto('');
    // Prefill with tomorrow's date at 08:00 AM as a helper
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISODate = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setFFecEntrega(localISODate);
    setFAdelanto('0');
    setFNotas('');
    setFTotal('0');
    setIsTotalManual(false);
    setReservationItems([]);
    setItemType('producto');
    setSelectedProdId('');
    setSelectedVersionId('');
    setCustomItemName('');
    setItemPrice('');
    setSelectedQty('1');
    setShowModal(true);
  };

  const openEditPedido = (p: Pedido) => {
    if (p.estado !== 'Pendiente') return;
    setEditingPedido(p);
    setFClienteId(String(p.clienteId || ''));
    setClientSearch(p.clienteNombre || '');
    setShowClientDropdown(false);
    resetNewClientForm();
    
    // Parse JSON or keep it legacy
    let parsedItems: any[] = [];
    let parsedTotal = String(p.adelanto);
    let legacyText = p.productoTexto;

    if (p.productoTexto.startsWith('{')) {
      try {
        const parsed = JSON.parse(p.productoTexto);
        parsedItems = parsed.items || [];
        parsedTotal = String(parsed.total || p.adelanto);
        legacyText = parsed.legacyText || '';
      } catch (e) {
        console.error('Error parsing booking products', e);
      }
    }
    
    setReservationItems(parsedItems);
    setFTotal(parsedTotal);
    setIsTotalManual(parsedItems.length === 0);
    setFProductoTexto(legacyText);

    // Convert to local datetime-local compatible format
    const date = new Date(p.fecEntrega);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISODate = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    setFFecEntrega(localISODate);
    setFAdelanto(String(p.adelanto));
    setFNotas(p.notas || '');
    setItemType('producto');
    setSelectedProdId('');
    setSelectedVersionId('');
    setCustomItemName('');
    setItemPrice('');
    setSelectedQty('1');
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let currentItems = [...reservationItems];
    let currentTotal = parseFloat(fTotal) || 0;

    // Si el usuario seleccionó/escribió algo pero olvidó presionar "Añadir", lo agregamos automáticamente
    if (
      (itemType === 'producto' && selectedProdId) ||
      (itemType === 'personalizado' && customItemName.trim())
    ) {
      const qty = parseFloat(selectedQty);
      if (!isNaN(qty) && qty > 0) {
        let name = '';
        let price = parseFloat(itemPrice) || 0;
        let versionName: string | null = null;
        let unidadMedida = 'und';
        let productId: number | null = null;

        if (itemType === 'producto') {
          const prod = products.find(p => String(p.id) === selectedProdId);
          if (prod) {
            productId = prod.id;
            name = prod.name;
            unidadMedida = prod.unidad_medida || 'und';
            if (selectedVersionId) {
              const versionObj = prod.versions.find(v => String(v.id) === selectedVersionId);
              if (versionObj) {
                versionName = versionObj.name;
                price = isNaN(price) || price === 0 ? versionObj.price : price;
              }
            } else {
              price = isNaN(price) || price === 0 ? prod.price : price;
            }
          }
        } else {
          name = customItemName.trim();
          unidadMedida = 'und';
          price = isNaN(price) ? 0 : price;
        }

        if (name) {
          const newItem = {
            type: itemType,
            productId,
            insumoId: null,
            name,
            price,
            qty,
            versionName,
            unidadMedida
          };
          currentItems.push(newItem);
          if (!isTotalManual) {
            currentTotal = currentItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
          }
        }
      }
    }

    const resolvedClienteId = await resolveClienteId();
    if (!resolvedClienteId) {
      alert('Por favor busca un cliente existente o regístralo como nuevo.');
      return;
    }
    if (currentItems.length === 0 && !fProductoTexto.trim()) {
      alert('Por favor agrega al menos un producto del catálogo o describe el pedido.');
      return;
    }
    if (!fFecEntrega) {
      alert('Por favor selecciona una fecha de entrega.');
      return;
    }
    const selectedDate = new Date(fFecEntrega);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      alert('La fecha de entrega no puede ser anterior al día de hoy.');
      return;
    }

    const totalVal =
      currentItems.length > 0 && !isTotalManual
        ? calcItemsTotal(currentItems)
        : parseFloat(fTotal) || currentTotal;
    const adelantoVal = parseFloat(fAdelanto) || 0;

    if (totalVal <= 0) {
      alert('El monto total del pedido debe ser mayor a S/. 0.00');
      return;
    }
    if (totalVal > MAX_MONTO_VALOR) {
      alert(`El monto total no puede superar S/. ${MAX_MONTO_VALOR.toLocaleString('es-PE', { minimumFractionDigits: 2 })} (máx. ${MAX_MONTO_DIGITOS} dígitos).`);
      return;
    }
    if (adelantoVal < 0) {
      alert('El adelanto no puede ser negativo.');
      return;
    }
    if (adelantoVal > totalVal + 0.001) {
      alert(
        `El adelanto (S/. ${adelantoVal.toFixed(2)}) no puede ser mayor al monto total (S/. ${totalVal.toFixed(2)}).`
      );
      return;
    }

    let serializedProductoTexto = fProductoTexto;
    if (currentItems.length > 0) {
      const legacyText = currentItems.map(i => `${i.qty} ${i.unidadMedida || 'und'} x ${i.name}${i.versionName ? ` (${i.versionName})` : ''}`).join(', ');
      serializedProductoTexto = JSON.stringify({
        items: currentItems,
        total: totalVal,
        legacyText
      });
    } else {
      serializedProductoTexto = JSON.stringify({
        items: [],
        total: totalVal,
        legacyText: fProductoTexto || 'Reserva Especial'
      });
    }

    const payload = {
      id: editingPedido?.id || undefined,
      clienteId: resolvedClienteId,
      productoTexto: serializedProductoTexto,
      fecEntrega: new Date(fFecEntrega).toISOString(),
      adelanto: adelantoVal,
      notes: fNotas,
      notas: fNotas,
      estado: editingPedido?.estado || 'Pendiente'
    };

    await savePedido(payload);
    setShowModal(false);
  };

  const getStatusTagClass = (status: Pedido['estado']) => {
    switch (status) {
      case 'Pendiente': return 'tg-blue';
      case 'Listo': return 'tg-peach'; // Orange/Peach
      case 'Entregado': return 'tg-ok'; // Green
      case 'Cancelado': return 'tg-danger'; // Red
      default: return '';
    }
  };

  return (
    <div className="screen active">
      <style>{`
        .client-option:hover {
          background: var(--bg-card2) !important;
          color: var(--accent) !important;
        }
        .pedidos-feed {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .pedidos-day-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 4px 6px;
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--bg);
        }
        .pedidos-day-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-2);
        }
        .pedidos-day-count {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-3);
          background: var(--bg-card2);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 3px 10px;
        }
        .pedidos-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pedido-row {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .pedido-row:hover {
          border-color: var(--border2);
          box-shadow: 0 6px 18px rgba(46, 26, 10, 0.06);
        }
        .pedido-row--overdue {
          border-left: 4px solid var(--red);
        }
        .pedido-row--expanded {
          border-color: var(--accent);
          box-shadow: 0 8px 22px rgba(176, 125, 46, 0.1);
        }
        .pedido-row__main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px 14px;
          padding: 14px 16px;
          cursor: pointer;
          align-items: start;
        }
        .pedido-row__idline {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 4px;
        }
        .pedido-row__code {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .pedido-row__client {
          font-size: 15px;
          font-weight: 800;
          color: var(--text);
          margin: 0 0 4px;
        }
        .pedido-row__summary {
          font-size: 12.5px;
          color: var(--text-2);
          line-height: 1.45;
          margin: 0;
        }
        .pedido-row__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 8px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-3);
        }
        .pedido-row__meta span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .pedido-row__meta .is-overdue {
          color: var(--red);
          font-weight: 800;
        }
        .pedido-row__aside {
          text-align: right;
          min-width: 108px;
        }
        .pedido-row__total {
          font-size: 16px;
          font-weight: 900;
          color: var(--text);
          line-height: 1.1;
        }
        .pedido-row__advance {
          font-size: 11px;
          font-weight: 700;
          color: var(--green);
          margin-top: 2px;
        }
        .pedido-row__balance {
          font-size: 11px;
          font-weight: 700;
          color: var(--red);
          margin-top: 2px;
        }
        .pedido-row__balance--paid {
          color: var(--green);
        }
        .pedido-row__toggle {
          margin-top: 8px;
          font-size: 10px;
          font-weight: 800;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .pedido-row__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 0 16px 14px;
        }
        .pedido-row__btn {
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.15s ease;
        }
        .pedido-row__btn:hover { opacity: 0.9; }
        .pedido-row__btn--pri { background: var(--accent); color: #fff; }
        .pedido-row__btn--ok { background: linear-gradient(135deg, var(--green), #15803d); color: #fff; }
        .pedido-row__btn--sec {
          background: var(--bg-card2);
          color: var(--text-2);
          border: 1px solid var(--border);
        }
        .pedido-row__btn--danger {
          background: rgba(220, 53, 69, 0.08);
          color: var(--red);
          border: 1px solid rgba(220, 53, 69, 0.3);
        }
        .pedido-row__details {
          border-top: 1px dashed var(--border);
          padding: 12px 16px 16px;
          background: var(--bg-card2);
        }
        .pedido-row__details-pre {
          background: var(--bg-card);
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 12.5px;
          color: var(--text-2);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          white-space: pre-wrap;
          border: 1px solid var(--border);
          margin-bottom: 8px;
        }
        .pedidos-sort-hint {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--text-3);
          white-space: nowrap;
        }
        .pedidos-tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          margin-left: 6px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.22);
        }
        @media (min-width: 768px) {
          .pedido-row__main {
            grid-template-columns: minmax(0, 1.6fr) minmax(220px, 0.9fr) 120px;
            align-items: center;
          }
          .pedido-row__aside {
            grid-column: 3;
            grid-row: 1 / span 2;
          }
        }
      `}</style>
      {/* KPI TILES */}
      <div className="stats-4" style={{ marginBottom: '22px' }}>
        <div className="stat-tile">
          <div className="st-lbl">Total Reservas</div>
          <div className="st-val">{stats.total}</div>
          <div className="st-sub">pedidos registrados</div>
        </div>
        <div className="stat-tile">
          <div className="st-lbl" style={{ color: 'var(--accent)' }}>Pendientes</div>
          <div className="st-val" style={{ color: 'var(--accent)' }}>{stats.pendientes}</div>
          <div className="st-sub">en producción / espera</div>
        </div>
        <div className="stat-tile">
          <div className="st-lbl" style={{ color: 'var(--green)' }}>Listos para Entregar</div>
          <div className="st-val" style={{ color: 'var(--green)' }}>{stats.listos}</div>
          <div className="st-sub">esperando al cliente</div>
        </div>
        <div className="stat-tile">
          <div className="st-lbl">Adelantos Cobrados</div>
          <div className="st-val" style={{ color: 'var(--green)' }}>S/. {stats.adelantos.toFixed(2)}</div>
          <div className="st-sub">en caja por reservas</div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-2)', padding: '4px', borderRadius: '999px', border: '1px solid var(--border)', width: 'fit-content', marginBottom: '22px', overflowX: 'auto', maxWidth: '100%' }}>
        {(['Todos', 'Pendiente', 'Listo', 'Entregado', 'Cancelado'] as const).map(t => {
          const count =
            t === 'Todos'
              ? pedidos.length
              : pedidos.filter(p => p.estado === t).length;
          const label =
            t === 'Todos'
              ? '📋 Todos'
              : t === 'Pendiente'
                ? '⏳ Pendientes'
                : t === 'Listo'
                  ? '🥐 Listos'
                  : t === 'Entregado'
                    ? '✅ Entregados'
                    : '🚫 Cancelados';

          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '6px 18px',
                fontSize: '12px',
                fontWeight: '700',
                borderRadius: '999px',
                border: 'none',
                background: activeTab === t ? 'var(--accent)' : 'transparent',
                color: activeTab === t ? '#fff' : 'var(--text-3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {label}
              <span
                className="pedidos-tab-count"
                style={
                  activeTab === t
                    ? { background: 'rgba(255,255,255,0.22)', color: '#fff', border: 'none' }
                    : undefined
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* SEARCH AND CREATE BUTTON */}
      <div className="tb-bar" style={{ marginBottom: '16px' }}>
        <div className="inp-wrap" style={{ flex: 1, maxWidth: '360px' }}>
          <span className="inp-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar por cliente, pedido..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="pedidos-sort-hint">
          {filteredPedidos.length} pedido{filteredPedidos.length === 1 ? '' : 's'} · más recientes arriba
        </span>
        <button className="btn-new" onClick={openNewPedido}>
          ➕ Nueva Reserva / Pedido
        </button>
      </div>

      {/* ORDERS LIST — feed por día de llegada */}
      <div className="pedidos-feed">
        {groupedPedidos.map(group => (
          <section key={group.label} className="pedidos-day-group">
            <div className="pedidos-day-header">
              <span className="pedidos-day-title">{group.label}</span>
              <span className="pedidos-day-count">
                {group.items.length} pedido{group.items.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="pedidos-list">
              {group.items.map(p => {
                const meta = parsePedidoMeta(p);
                const { itemsList, totalVal, summary, itemCount } = meta;
                const arrivalMs = getPedidoArrivalMs(p);
                const deliveryStr = new Date(p.fecEntrega).toLocaleString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isOverdue =
                  new Date(p.fecEntrega).getTime() < nowTime &&
                  (p.estado === 'Pendiente' || p.estado === 'Listo');
                const saldoVal = Math.max(0, totalVal - p.adelanto);
                const rowId = String(p.id);
                const isExpanded = expandedPedidoId === rowId;

                return (
                  <article
                    key={p.id}
                    className={`pedido-row${isOverdue ? ' pedido-row--overdue' : ''}${isExpanded ? ' pedido-row--expanded' : ''}`}
                  >
                    <div
                      className="pedido-row__main"
                      onClick={() => setExpandedPedidoId(isExpanded ? null : rowId)}
                    >
                      <div>
                        <div className="pedido-row__idline">
                          <span className="pedido-row__code">Reserva {formatPedidoId(p.id)}</span>
                          <span className={`tag ${getStatusTagClass(p.estado)}`}>{p.estado}</span>
                        </div>
                        <h4 className="pedido-row__client">👤 {p.clienteNombre}</h4>
                        <p className="pedido-row__summary">
                          {itemCount > 0 ? `${itemCount} ítem${itemCount === 1 ? '' : 's'} · ` : ''}
                          {summary}
                        </p>
                        <div className="pedido-row__meta">
                          <span>🕐 Llegó {formatRelativeArrival(arrivalMs)}</span>
                          <span className={isOverdue ? 'is-overdue' : ''}>
                            📅 Entrega {deliveryStr}
                            {isOverdue ? ' · Retrasado' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="pedido-row__aside">
                        <div className="pedido-row__total">S/. {totalVal.toFixed(2)}</div>
                        <div className="pedido-row__advance">Adelanto S/. {p.adelanto.toFixed(2)}</div>
                        {saldoVal > 0 ? (
                          <div className="pedido-row__balance">Saldo S/. {saldoVal.toFixed(2)}</div>
                        ) : (
                          <div className="pedido-row__balance pedido-row__balance--paid">✅ Pagado</div>
                        )}
                        <div className="pedido-row__toggle">{isExpanded ? '▲ Ocultar' : '▼ Ver detalle'}</div>
                      </div>
                    </div>

                    <div className="pedido-row__actions" onClick={e => e.stopPropagation()}>
                      {p.estado === 'Pendiente' && (
                        <button
                          type="button"
                          className="pedido-row__btn pedido-row__btn--pri"
                          onClick={() => {
                            const plan = calcularInsumosParaPedido(itemsList);
                            if (itemsList.length > 0 && !plan.todosDisponibles) {
                              const ok = window.confirm(
                                'Hay insumos insuficientes para este pedido. ¿Marcar como listo de todos modos?'
                              );
                              if (!ok) return;
                            }
                            updatePedidoStatus(p.id, 'Listo');
                            if (editingPedido?.id === p.id) {
                              setShowModal(false);
                              setEditingPedido(null);
                            }
                          }}
                        >
                          🥐 Listo
                        </button>
                      )}
                      {p.estado === 'Listo' && (
                        <button
                          type="button"
                          className="pedido-row__btn pedido-row__btn--ok"
                          onClick={() => {
                            if (new Date(p.fecEntrega).getTime() > nowTime) {
                              alert('No se puede entregar el pedido antes de la fecha y hora pactada.');
                              return;
                            }
                            setDeliveringPedido(p);
                            setDelPaymentMethodId('');
                            setShowDeliveryModal(true);
                          }}
                        >
                          ✅ Entregar
                        </button>
                      )}
                      {p.estado === 'Pendiente' && (
                        <button
                          type="button"
                          className="pedido-row__btn pedido-row__btn--sec"
                          onClick={() => openEditPedido(p)}
                          title="Editar Reserva"
                        >
                          ✏️ Editar
                        </button>
                      )}
                      {(p.estado === 'Pendiente' || p.estado === 'Listo') && (
                        <button
                          type="button"
                          className="pedido-row__btn pedido-row__btn--danger"
                          onClick={() => updatePedidoStatus(p.id, 'Cancelado')}
                          title="Cancelar Reserva"
                        >
                          🚫 Cancelar
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="pedido-row__details">
                        {itemsList.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                            {itemsList.map((item, idx) => {
                              const plan = calcularInsumosParaPedido(itemsList);
                              const isMissingRecipe = plan.sinReceta.includes(item.name);
                              return (
                                <div key={idx} style={{ padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>
                                    <strong>{item.qty} {item.unidadMedida || 'und'}</strong> x {item.name} {item.versionName ? `(${item.versionName})` : ''}
                                    {isMissingRecipe && (
                                      <span style={{ color: 'var(--amber)', fontSize: '10px', marginLeft: '8px', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                                        ⚠️ Falta receta
                                      </span>
                                    )}
                                  </span>
                                  <span style={{ color: 'var(--text-2)', fontWeight: 'bold' }}>S/. {(item.price * item.qty).toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <pre className="pedido-row__details-pre">
                            {getPedidoDescription(p.productoTexto)}
                          </pre>
                        )}
                        {itemsList.length > 0 && (p.estado === 'Pendiente' || p.estado === 'Listo') && (
                          <MateriaPrimaPanel
                            plan={calcularInsumosParaPedido(itemsList)}
                            compact
                          />
                        )}
                        {p.notas && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontStyle: 'italic', marginTop: '8px' }}>
                            📌 Nota: {p.notas}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {filteredPedidos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📅</div>
            <p>No hay reservas en esta categoría. ¡Crea una nueva!</p>
          </div>
        )}
      </div>

      {/* CREATE / EDIT PEDIDO MODAL */}
      {showModal && (
        <div className="modal-overlay open" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '580px', maxHeight: '90vh' }}>
            
            {/* Header inside modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div className="mc-title" style={{ margin: 0, textAlign: 'left' }}>
                {editingPedido ? '✏️ Editar Reserva' : '📅 Registrar Nueva Reserva'}
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

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                 
                {/* Cliente Selector */}
                <div className="inp-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>Cliente Pactado *</label>
                    {!isCreatingClient ? (
                      <button
                        type="button"
                        onClick={() => startCreatingClient(clientSearch)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        + Nuevo cliente
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          resetNewClientForm();
                          setFClienteId('');
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        Volver a buscar
                      </button>
                    )}
                  </div>

                  {!isCreatingClient ? (
                    <div className="inp-wrap" style={{ position: 'relative' }}>
                      <span className="inp-icon">👤</span>
                      <input
                        type="text"
                        placeholder="Busca por nombre o DNI del cliente..."
                        value={clientSearch}
                        onFocus={() => setShowClientDropdown(true)}
                        onChange={e => {
                          const val = e.target.value;
                          setClientSearch(val);
                          const currentClient = clients.find(c => String(c.id) === String(fClienteId));
                          if (!currentClient || currentClient.nombre !== val) {
                            setFClienteId('');
                          }
                          setShowClientDropdown(true);
                        }}
                        style={{ paddingRight: fClienteId ? '35px' : '12px' }}
                      />
                      {fClienteId && (
                        <button
                          type="button"
                          onClick={() => {
                            setFClienteId('');
                            setClientSearch('');
                          }}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-3)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            zIndex: 10,
                            padding: '4px',
                          }}
                          title="Limpiar cliente"
                        >
                          ✕
                        </button>
                      )}

                      {showClientDropdown && (
                        <>
                          <div
                            onClick={() => setShowClientDropdown(false)}
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border2)',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.12)',
                              maxHeight: '220px',
                              overflowY: 'auto',
                              zIndex: 999,
                              marginTop: '6px',
                            }}
                          >
                            {filteredClients.length === 0 && !clientSearch.trim() ? (
                              <div style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-3)', textAlign: 'center' }}>
                                Escribe para buscar o crea un cliente nuevo
                              </div>
                            ) : (
                              <>
                                {filteredClients.map(c => (
                                  <div
                                    key={c.id}
                                    onClick={() => selectExistingClient(c)}
                                    style={{
                                      padding: '10px 12px',
                                      fontSize: '13px',
                                      color: 'var(--text)',
                                      cursor: 'pointer',
                                      borderBottom: '1px solid var(--border)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      background: fClienteId === String(c.id) ? 'var(--accent-bg)' : 'transparent',
                                    }}
                                    className="client-option"
                                  >
                                    <span>👤 {c.nombre}</span>
                                    {c.dni && <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>DNI: {c.dni}</span>}
                                  </div>
                                ))}
                                {clientSearch.trim() && !hasExactClientMatch && (
                                  <div
                                    onClick={() => startCreatingClient(clientSearch)}
                                    style={{
                                      padding: '10px 12px',
                                      fontSize: '12.5px',
                                      color: 'var(--accent)',
                                      cursor: 'pointer',
                                      fontWeight: '700',
                                      background: 'var(--accent-bg)',
                                    }}
                                    className="client-option"
                                  >
                                    ➕ Registrar &quot;{clientSearch.trim()}&quot; como cliente nuevo
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                      {!fClienteId && clientSearch.trim() && !hasExactClientMatch && (
                        <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>
                          Si no está en la lista, usa <strong style={{ color: 'var(--accent)' }}>+ Nuevo cliente</strong> o el botón del desplegable.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: '8px',
                        padding: '14px',
                        background: 'var(--bg-card2)',
                        borderRadius: '12px',
                        border: '1.5px dashed var(--border)',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            placeholder="DNI (opcional)"
                            value={newClientData.dni}
                            onChange={e => handleNewClientDniChange(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '13px', background: 'var(--bg-card)' }}
                            maxLength={11}
                          />
                          {isDniLoading && (
                            <span style={{ position: 'absolute', right: '10px', top: '10px', animation: 'spin 1.5s linear infinite', fontSize: '14px' }}>
                              🥐
                            </span>
                          )}
                        </div>
                        <input
                          placeholder="Celular (máx. 9 dígitos)"
                          value={newClientData.telefono}
                          onChange={e =>
                            setNewClientData({ ...newClientData, telefono: e.target.value.replace(/\D/g, '') })
                          }
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '13px', background: 'var(--bg-card)' }}
                          maxLength={9}
                        />
                      </div>
                      <input
                        placeholder="Nombre completo *"
                        value={newClientData.nombre}
                        onChange={e => {
                          const nombre = e.target.value;
                          setNewClientData({ ...newClientData, nombre });
                          setClientSearch(nombre);
                        }}
                        readOnly={dniOk}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1.5px solid var(--border)',
                          fontSize: '13px',
                          background: dniOk ? 'var(--bg-hover)' : 'var(--bg-card)',
                          cursor: dniOk ? 'not-allowed' : undefined,
                        }}
                      />
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>
                        Se registrará al guardar la reserva si no existe en tu lista de clientes.
                      </p>
                    </div>
                  )}
                </div>

                {/* Unified Items Picker Section */}
                <div style={{ border: '1.5px dashed var(--border)', padding: '14px', borderRadius: '12px', background: 'var(--bg-card2)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    Añadir Ítems a la Reserva
                  </div>

                  {/* Tab Selector */}
                  <div style={{ display: 'flex', gap: '6px', background: 'var(--bg)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '12px' }}>
                    {(['producto', 'personalizado'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setItemType(type);
                          setSelectedProdId('');
                          setSelectedVersionId('');
                          setCustomItemName('');
                          setItemPrice('');
                          setSelectedQty('1');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: '7px',
                          border: 'none',
                          background: itemType === type ? 'var(--accent)' : 'transparent',
                          color: itemType === type ? '#fff' : 'var(--text-3)',
                          cursor: 'pointer',
                          transition: 'all 0.18s',
                          textTransform: 'uppercase'
                        }}
                      >
                        {type === 'producto' ? '🍞 Producto' : '✍️ Personalizado'}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Item Selection Selector */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        {itemType === 'producto' && (
                          <select
                            value={selectedProdId}
                            onChange={e => handleProductChange(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                          >
                            <option value="">-- Seleccionar producto del catálogo --</option>
                            {products.filter(p => p.cat !== 'Insumos').map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} (S/. {p.price.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        )}

                        {itemType === 'personalizado' && (
                          <input
                            type="text"
                            placeholder="Nombre del ítem (ej: Torta especial Frozen 3 pisos)"
                            value={customItemName}
                            onChange={e => setCustomItemName(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                          />
                        )}
                      </div>

                      {/* Select Versión (only for product if it has versions) */}
                      {itemType === 'producto' && selectedProdObj && selectedProdObj.versions && selectedProdObj.versions.length > 0 && (
                        <div style={{ width: '140px' }}>
                          <select
                            value={selectedVersionId}
                            onChange={e => handleVersionChange(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                          >
                            <option value="">-- Versión --</option>
                            {selectedProdObj.versions.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name} (S/. {v.price.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Row 2: Price, Qty and Add Button */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Precio S/.</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={itemPrice}
                          onChange={e => setItemPrice(e.target.value)}
                          style={{ padding: '8px 10px', fontSize: '13px', width: '100%' }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Cant.</span>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            placeholder="1"
                            value={selectedQty}
                            onChange={e => setSelectedQty(e.target.value)}
                            style={{ padding: '8px 10px', paddingRight: '40px', width: '100%', fontSize: '13px' }}
                          />
                          <span style={{ position: 'absolute', right: '10px', fontSize: '10px', fontWeight: 'bold', color: 'var(--text-3)', pointerEvents: 'none' }}>
                            {itemType === 'producto' && selectedProdObj ? (selectedProdObj.unidad_medida || 'und') : 'und'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddItemToReservation}
                        className="btn-new"
                        style={{ padding: '8px 16px', height: '36px', fontSize: '12px' }}
                      >
                        ＋ Añadir ítem
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  {reservationItems.length > 0 && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-card)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      {reservationItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '2px' }}>
                          <span>
                            <strong>{item.qty} {item.unidadMedida || 'und'}</strong> x {item.name} {item.versionName ? `(${item.versionName})` : ''}
                            <span style={{ color: 'var(--text-3)', fontSize: '11px', marginLeft: '6px' }}>(S/. {item.price.toFixed(2)})</span>
                            {item.type === 'personalizado' && <span style={{ fontSize: '10px', color: '#0d9488', marginLeft: '6px', background: 'rgba(20,184,166,0.1)', padding: '1px 5px', borderRadius: '8px', fontWeight: 'bold' }}>Personalizado</span>}
                            {reservationPlan.sinReceta.includes(item.name) && (
                              <span style={{ color: 'var(--amber)', fontSize: '10px', marginLeft: '6px', background: 'rgba(245,158,11,0.1)', padding: '1px 5px', borderRadius: '8px', fontWeight: 'bold' }}>Falta receta</span>
                            )}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ color: 'var(--text-2)', fontSize: '12.5px' }}>S/. {(item.price * item.qty).toFixed(2)}</strong>
                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromReservation(idx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--red)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                transition: 'background 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {reservationItems.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <MateriaPrimaPanel plan={reservationPlan} />
                    </div>
                  )}
                </div>

                {/* Monto Total del Pedido */}
                <div className="inp-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <label style={{ margin: 0 }}>Monto Total del Pedido (S/.) *</label>
                    <span style={{ fontSize: '11px', color: isTotalManual ? '#d97706' : '#16a34a', fontWeight: '700' }}>
                      {isTotalManual ? '✏️ Ajustado manualmente' : '⚡ Calculado del inventario'}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>
                    Máximo {MAX_MONTO_DIGITOS} dígitos (hasta S/. 99,999,999.99)
                  </p>
                  <div className="inp-wrap">
                    <span className="inp-icon">💵</span>
                    <input 
                      type="number" 
                      min="0.01" 
                      max={MAX_MONTO_VALOR}
                      step="0.01" 
                      value={fTotal}
                      onChange={e => handleTotalChange(e.target.value)}
                      placeholder="0.00"
                      required
                      inputMode="decimal"
                      style={{
                        paddingRight: isTotalManual && reservationItems.length > 0 ? '100px' : '16px',
                        borderColor: totalExcedeDigitos || totalExcedeMaximo ? '#ef4444' : undefined,
                      }}
                    />
                    {isTotalManual && reservationItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const autoTotal = calcItemsTotal(reservationItems);
                          const capped = Math.min(autoTotal, MAX_MONTO_VALOR);
                          setFTotal(formatMontoFromNumber(autoTotal));
                          setIsTotalManual(false);
                          setFAdelanto(prev => clampAdelantoToTotal(prev, capped));
                        }}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'var(--accent-bg)',
                          color: 'var(--accent)',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          zIndex: 10
                        }}
                      >
                        Reestablecer
                      </button>
                    )}
                  </div>
                  {(totalExcedeDigitos || totalExcedeMaximo) && (
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
                      El monto total no puede superar {MAX_MONTO_DIGITOS} dígitos (máx. S/. 99,999,999.99).
                    </p>
                  )}
                </div>

                {/* Producto/Texto Pedido libre (Opcional) */}
                <div className="inp-group">
                  <label>Descripción Libre / Notas del Pedido</label>
                  <input 
                    type="text" 
                    value={fProductoTexto}
                    onChange={e => setFProductoTexto(e.target.value)}
                    placeholder="Ej: Torta personalizada de Frozen, etc. (Opcional si usas inventario)"
                  />
                </div>

                {/* Fecha y Hora de Entrega */}
                <div className="inp-group">
                  <label>Fecha y Hora Pactada de Entrega *</label>
                  <input 
                    type="datetime-local" 
                    value={fFecEntrega}
                    onChange={e => setFFecEntrega(e.target.value)}
                    required
                    min={minDateStr}
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
                  />
                </div>

                {/* Adelanto */}
                <div className="inp-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ margin: 0 }}>Monto de Adelanto / Garantía (S/.)</label>
                    {effectiveFormTotal > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600 }}>
                        Máx: S/. {effectiveFormTotal.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="inp-wrap">
                    <span className="inp-icon">💵</span>
                    <input 
                      type="number" 
                      min="0" 
                      max={effectiveFormTotal > 0 ? Math.min(effectiveFormTotal, MAX_MONTO_VALOR) : MAX_MONTO_VALOR}
                      step="0.01" 
                      value={fAdelanto}
                      onChange={e => handleAdelantoChange(e.target.value)}
                      inputMode="decimal"
                      onBlur={() => {
                        if (fAdelanto === '' || isNaN(parseFloat(fAdelanto))) {
                          setFAdelanto('0');
                        }
                      }}
                      placeholder="0.00"
                      required
                      style={{
                        borderColor: adelantoExcedeTotal
                          ? '#ef4444'
                          : adelantoIgualTotal
                            ? '#16a34a'
                            : undefined,
                      }}
                    />
                  </div>
                  {adelantoExcedeTotal && (
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
                      El adelanto no puede superar el total del pedido (S/. {effectiveFormTotal.toFixed(2)}).
                    </p>
                  )}
                  {adelantoIgualTotal && !adelantoExcedeTotal && (
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                      Pago total adelantado — al entregar no habrá saldo pendiente.
                    </p>
                  )}
                </div>

                {/* Notas / Observaciones */}
                <div className="inp-group">
                  <label>Observaciones Adicionales</label>
                  <input 
                    type="text" 
                    value={fNotas}
                    onChange={e => setFNotas(e.target.value)}
                    placeholder="Ej: Sin crema chantilly, empaque especial para regalo..."
                  />
                </div>
              </div>

              <div className="mc-btns" style={{ marginTop: '20px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowModal(false)}>Cancelar</button>
                <button
                  type="submit"
                  className="mc-pri"
                  disabled={adelantoExcedeTotal || effectiveFormTotal <= 0 || totalExcedeDigitos || totalExcedeMaximo}
                >
                  {editingPedido ? 'Guardar Cambios' : 'Registrar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELIVERY CHECKOUT MODAL */}
      {showDeliveryModal && deliveringPedido && (() => {
        let items: any[] = [];
        let totalVal = deliveringPedido.adelanto;
        
        if (deliveringPedido.productoTexto.startsWith('{')) {
          try {
            const parsed = JSON.parse(deliveringPedido.productoTexto);
            items = parsed.items || [];
            totalVal = parsed.total || deliveringPedido.adelanto;
          } catch (e) {}
        }
        
        const saldo = Math.max(0, totalVal - deliveringPedido.adelanto);
        const activeMethods = paymentMethods.filter(m => m.active);

        return (
          <div className="modal-overlay open">
            <div className="modal-card" style={{ width: '420px' }}>
              <span className="mc-icon">🥐</span>
              <div className="mc-title">Confirmar Entrega y Pago</div>
              <p className="mc-sub">Registra el cobro final del saldo restante y descuenta del stock</p>
              
              <div style={{ background: 'var(--bg-card2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '12.5px' }}>Cliente:</span>
                  <strong style={{ color: 'var(--text)', fontSize: '13px' }}>{deliveringPedido.clienteNombre}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '12.5px' }}>Monto Total del Pedido:</span>
                  <strong style={{ color: 'var(--text)', fontSize: '13px' }}>S/. {totalVal.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '12.5px' }}>Adelanto Recibido:</span>
                  <strong style={{ color: 'var(--green)', fontSize: '13px' }}>S/. {deliveringPedido.adelanto.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 'bold' }}>Saldo Restante a Cobrar:</span>
                  <strong style={{ color: 'var(--red)', fontSize: '14.5px' }}>S/. {saldo.toFixed(2)}</strong>
                </div>
              </div>

              {saldo > 0 ? (
                <div className="inp-group" style={{ textAlign: 'left', marginBottom: '18px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px', display: 'block' }}>
                    Método de Pago para el Saldo Restante *
                  </label>
                  <select
                    value={delPaymentMethodId}
                    onChange={e => setDelPaymentMethodId(e.target.value)}
                    required
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
                    <option value="">-- Seleccionar Método de Pago --</option>
                    {activeMethods.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 'bold', margin: '10px 0' }}>
                  El pedido ya fue pagado en su totalidad con el adelanto.
                </p>
              )}

              <div className="mc-btns" style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="mc-sec"
                  onClick={() => setShowDeliveryModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="mc-pri"
                  style={{ flex: 1 }}
                  onClick={async () => {
                    if (saldo > 0 && !delPaymentMethodId) {
                      alert('Por favor selecciona el método de pago para el saldo restante.');
                      return;
                    }
                    
                    const methodId = saldo > 0 ? parseInt(String(delPaymentMethodId)) : (paymentMethods[0]?.id || 1);
                    const selectedMethod = paymentMethods.find(m => m.id === methodId);
                    const methodName = selectedMethod ? selectedMethod.name : 'Efectivo';

                    await deliverPedido(
                      deliveringPedido.id,
                      methodId,
                      methodName,
                      totalVal,
                      deliveringPedido.adelanto,
                      items
                    );
                    setShowDeliveryModal(false);
                    setDeliveringPedido(null);
                    if (editingPedido?.id === deliveringPedido.id) {
                      setShowModal(false);
                      setEditingPedido(null);
                    }
                  }}
                >
                  Confirmar Entrega
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
