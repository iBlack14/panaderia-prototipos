"use client";

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import type { Purchase } from '@/context/types';
import { loadExcelJS } from '@/lib/cdn';

type PeriodKey = 'hoy' | 'semana' | 'mes' | 'todo' | 'custom';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'todo', label: 'Todo' },
  { key: 'custom', label: 'Rango' },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parsePurchaseDate(d: string): Date | null {
  if (!d) return null;
  if (d.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
  }
  const parts = d.trim().split(/[\/\-.]/).map(p => p.trim());
  if (parts.length === 3) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    const c = parseInt(parts[2], 10);
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) return null;
    // YYYY-MM-DD
    if (parts[0].length === 4) return startOfDay(new Date(a, b - 1, c));
    // DD/MM/YYYY (locale es-PE)
    return startOfDay(new Date(c, b - 1, a));
  }
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromInputDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return startOfDay(new Date(y, m - 1, d));
}

function moneyNum(value: string | number) {
  return parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0;
}

function resolveDateRange(
  period: PeriodKey,
  customFrom: string,
  customTo: string
): { from: Date | null; to: Date | null; label: string } {
  const today = startOfDay(new Date());
  if (period === 'todo') return { from: null, to: null, label: 'Todo el historial' };
  if (period === 'hoy') return { from: today, to: today, label: 'Hoy' };
  if (period === 'semana') {
    const from = new Date(today);
    from.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // lunes
    return { from: startOfDay(from), to: today, label: 'Semana actual' };
  }
  if (period === 'mes') {
    const from = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
    return { from, to: today, label: 'Mes actual' };
  }
  const from = fromInputDate(customFrom);
  const to = fromInputDate(customTo) || today;
  const label =
    from && to
      ? `${toInputDate(from)} → ${toInputDate(to)}`
      : 'Rango personalizado';
  return { from, to, label };
}

function inDateRange(dateStr: string, from: Date | null, to: Date | null) {
  if (!from && !to) return true;
  const d = parsePurchaseDate(dateStr);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export default function ComprasPage() {
  const router = useRouter();
  const { purchases, providers, products, insumos, registerPurchase, categories, saveInsumo, saveProduct } = useApp();
  
  const [showModal, setShowModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

  // Filtros de listado / exportación
  const [period, setPeriod] = useState<PeriodKey>('todo');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterProvider, setFilterProvider] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const handleOpenDetails = (purchase: any) => {
    setSelectedPurchase(purchase);
    setShowDetailsModal(true);
  };

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
    type: 'producto' | 'insumo';
    productId?: number;
    insumoId?: number;
    name: string;
    qty: number;
    cost: number;
    version: string | null;
  }

  // Lista de items que se están comprando en este registro
  const [itemsToBuy, setItemsToBuy] = useState<BuyItem[]>([]);
  
  // Estados para añadir un item de compra
  const [itemType, setItemType] = useState<'producto' | 'insumo'>('insumo');
  const [prodId, setProdId] = useState('');
  const [insId, setInsId] = useState('');
  const [vName, setVName] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');

  // Quick modals states
  const [showQuickInsumoModal, setShowQuickInsumoModal] = useState(false);
  const [showQuickProductModal, setShowQuickProductModal] = useState(false);

  // Quick Insumo states
  const [quickInsumoNombre, setQuickInsumoNombre] = useState('');
  const [quickInsumoUnidad, setQuickInsumoUnidad] = useState('kg');
  const [quickInsumoMinStock, setQuickInsumoMinStock] = useState('0');

  // Quick Product states
  const [quickProductNombre, setQuickProductNombre] = useState('');
  const [quickProductCat, setQuickProductCat] = useState('');
  const [quickProductPrice, setQuickProductPrice] = useState('');

  const handleQuickInsumoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInsumoNombre.trim()) return;

    const res = await saveInsumo({
      nombre: quickInsumoNombre.trim(),
      stock: 0,
      costoUnitario: 0,
      unidadMedida: quickInsumoUnidad,
      stockMinimo: parseFloat(quickInsumoMinStock) || 0,
    });

    if (res && res.id) {
      setInsId(String(res.id));
    }
    setQuickInsumoNombre('');
    setQuickInsumoUnidad('kg');
    setQuickInsumoMinStock('0');
    setShowQuickInsumoModal(false);
  };

  const handleQuickProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProductNombre.trim()) return;

    const selectedCat = quickProductCat || (categories.find(c => c.active && c.name !== 'Insumos')?.name || 'Sin categoría');

    const res = await saveProduct({
      name: quickProductNombre.trim(),
      cat: selectedCat,
      price: parseFloat(quickProductPrice) || 0,
      stock: 0,
      versions: [],
      unidad_medida: 'unidades'
    });

    if (res && res.id) {
      setProdId(String(res.id));
    }
    setQuickProductNombre('');
    setQuickProductCat('');
    setQuickProductPrice('');
    setShowQuickProductModal(false);
  };

  const activeProviders = providers.filter(p => p.active);

  const dateRange = useMemo(
    () => resolveDateRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const providerOptions = useMemo(() => {
    const names = new Set<string>();
    purchases.forEach(p => {
      if (p.prov) names.add(p.prov);
    });
    providers.forEach(p => {
      if (p.name) names.add(p.name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
  }, [purchases, providers]);

  const getItemsLabel = (p: Purchase) => {
    if (!p.items?.length) return 'Artículos varios';
    return p.items.map(i => {
      if (i.type === 'insumo') {
        const insRef = insumos.find(ins => ins.id === i.insumoId);
        return `${insRef?.nombre || 'Insumo'} x${i.qty}`;
      }
      const prodRef = products.find(prod => prod.id === i.productId);
      const displayName = prodRef
        ? prodRef.name + (i.version ? ` (${i.version})` : '')
        : 'Producto';
      return `${displayName} x${i.qty}`;
    }).join(', ');
  };

  const filteredPurchases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return purchases.filter(p => {
      if (!inDateRange(p.d, dateRange.from, dateRange.to)) return false;
      if (filterProvider !== 'todos' && p.prov !== filterProvider) return false;
      if (q) {
        const haystack = [
          String(p.id),
          p.prov,
          p.d,
          p.total,
          getItemsLabel(p),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [purchases, dateRange, filterProvider, searchTerm, insumos, products]);

  const activeFiltersCount = [
    period !== 'todo',
    filterProvider !== 'todos',
    searchTerm.trim() !== '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setPeriod('todo');
    setCustomFrom('');
    setCustomTo('');
    setFilterProvider('todos');
    setSearchTerm('');
  };

  const filterSummaryLines = (): string[] => {
    const lines = [
      `Periodo: ${dateRange.label}`,
      `Proveedor: ${filterProvider === 'todos' ? 'Todos' : filterProvider}`,
      `Búsqueda: ${searchTerm.trim() ? `"${searchTerm.trim()}"` : 'Sin texto'}`,
      `Registros exportados: ${filteredPurchases.length} de ${purchases.length}`,
      `Fecha generación: ${new Date().toLocaleString('es-PE')}`,
    ];
    return lines;
  };

  const handleAddPurchaseItem = () => {
    const q = parseFloat(qty);
    const c = parseFloat(cost);
    if (isNaN(q) || isNaN(c) || q <= 0 || c <= 0) return;

    let newItem: BuyItem;

    if (itemType === 'producto') {
      const pId = parseInt(prodId);
      if (isNaN(pId)) return;
      const prod = products.find(p => p.id === pId);
      if (!prod) return;
      newItem = {
        id: Date.now(),
        type: 'producto',
        productId: pId,
        name: prod.name + (vName ? ` (${vName})` : ''),
        qty: q,
        cost: c,
        version: vName || null
      };
    } else {
      const iId = parseInt(insId);
      if (isNaN(iId)) return;
      const ins = insumos.find(i => i.id === iId);
      if (!ins) return;
      newItem = {
        id: Date.now(),
        type: 'insumo',
        insumoId: iId,
        name: ins.nombre,
        qty: q,
        cost: c,
        version: null
      };
    }

    setItemsToBuy([...itemsToBuy, newItem]);
    
    // Reset item inputs
    setProdId('');
    setInsId('');
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
    setItemType('insumo');
    setProdId('');
    setInsId('');
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
        type: item.type,
        productId: item.productId,
        insumoId: item.insumoId,
        qty: item.qty,
        cost: item.cost,
        version: item.version
      }))
    });

    setShowModal(false);
  };

  const selectedProduct = products.find(x => x.id === parseInt(prodId));

  // Totales de la compra actual
  const buyTotal = itemsToBuy.reduce((a, b) => a + (b.qty * b.cost), 0);
  const buySubtotal = buyTotal / 1.18;
  const buyIgv = buyTotal - buySubtotal;

  // Función para exportar a Excel (solo compras con filtros activos)
  const exportToExcel = async () => {
    try {
      const ExcelJS = await loadExcelJS();
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Snack Roque POS';
      workbook.created = new Date();

      // Exporta únicamente el conjunto filtrado de la pantalla
      const exportData = filteredPurchases;
      const meta = filterSummaryLines();
      const headerRow = 11; // filas 4–9 = filtros, 10 = espacio, 11 = cabecera

      if (exportData.length === 0) {
        alert('No hay compras con los filtros actuales para exportar');
        return;
      }

      const brandColor = 'B07D2E';
      const headerBg = 'FFF8E7';
      const titleBg = 'B07D2E';
      const titleFg = 'FFFFFF';
      const totalsBg = 'F5F5DC';

      const styleHeaderRow = (sheet: any, row: number, colCount: number) => {
        for (let c = 1; c <= colCount; c++) {
          const cell = sheet.getCell(row, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
          cell.font = { bold: true, size: 11, color: { argb: brandColor } };
          cell.border = {
            top: { style: 'medium', color: { argb: brandColor } },
            bottom: { style: 'medium', color: { argb: brandColor } },
            left: { style: 'thin', color: { argb: 'D4D4D4' } },
            right: { style: 'thin', color: { argb: 'D4D4D4' } },
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      };

      const styleDataCell = (cell: any, rowIndex: number) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFF' : 'F9F9F9' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'D4D4D4' } },
          bottom: { style: 'thin', color: { argb: 'D4D4D4' } },
          left: { style: 'thin', color: { argb: 'D4D4D4' } },
          right: { style: 'thin', color: { argb: 'D4D4D4' } },
        };
      };

      const styleTotalsRow = (sheet: any, row: number) => {
        sheet.getRow(row).eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalsBg } };
          cell.font = { bold: true, size: 11, color: { argb: brandColor } };
          cell.border = {
            top: { style: 'medium', color: { argb: brandColor } },
            bottom: { style: 'medium', color: { argb: brandColor } },
            left: { style: 'thin', color: { argb: 'D4D4D4' } },
            right: { style: 'thin', color: { argb: 'D4D4D4' } },
          };
        });
      };

      const writeTitle = (sheet: any, lastCol: string, title: string) => {
        sheet.mergeCells(`A1:${lastCol}1`);
        const t = sheet.getCell('A1');
        t.value = title;
        t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: titleBg } };
        t.font = { bold: true, size: 16, color: { argb: titleFg } };
        t.alignment = { horizontal: 'center' };

        sheet.mergeCells(`A2:${lastCol}2`);
        const s = sheet.getCell('A2');
        s.value = 'Snack Roque — Sistema POS / Gestión';
        s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: titleBg } };
        s.font = { bold: true, size: 11, color: { argb: titleFg } };
        s.alignment = { horizontal: 'center' };
      };

      const writeFilterBlock = (sheet: any) => {
        sheet.getCell('A4').value = 'CRITERIOS DE FILTRO (aplicados en pantalla)';
        sheet.getCell('A4').font = { bold: true, size: 10, color: { argb: brandColor } };
        sheet.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
        meta.forEach((line, i) => {
          const r = 5 + i;
          sheet.getCell(`A${r}`).value = line;
          sheet.getCell(`A${r}`).font = { size: 9, color: { argb: '666666' } };
        });
      };

      const totalCompras = exportData.reduce((a, p) => a + moneyNum(p.total), 0);
      const totalSubtotal = exportData.reduce((a, p) => a + moneyNum(p.subTotal), 0);
      const totalIGV = exportData.reduce((a, p) => a + moneyNum(p.igv), 0);

      // ── Hoja 1: Resumen ──
      const resumenSheet = workbook.addWorksheet('1. Resumen');
      writeTitle(resumenSheet, 'B', 'REPORTE DE COMPRAS — RESUMEN');
      writeFilterBlock(resumenSheet);

      resumenSheet.getCell(`A${headerRow}`).value = 'Indicador';
      resumenSheet.getCell(`B${headerRow}`).value = 'Valor';
      styleHeaderRow(resumenSheet, headerRow, 2);

      const resumenRows: [string, number][] = [
        ['Total compras (S/.)', totalCompras],
        ['Subtotal neto (S/.)', totalSubtotal],
        ['IGV total (S/.)', totalIGV],
        ['Promedio por compra (S/.)', exportData.length ? totalCompras / exportData.length : 0],
        ['Cantidad de compras filtradas', exportData.length],
      ];
      resumenRows.forEach((row, rowIndex) => {
        const rowNumber = headerRow + 1 + rowIndex;
        resumenSheet.getCell(`A${rowNumber}`).value = row[0];
        resumenSheet.getCell(`B${rowNumber}`).value = row[1];
        if (rowIndex < 4) {
          resumenSheet.getCell(`B${rowNumber}`).numFmt = '"S/." #,##0.00';
        }
        resumenSheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'right' };
        resumenSheet.getRow(rowNumber).eachCell((cell: any) => styleDataCell(cell, rowIndex));
      });
      resumenSheet.getColumn('A').width = 32;
      resumenSheet.getColumn('B').width = 18;
      resumenSheet.views = [{ state: 'frozen', ySplit: headerRow }];

      // ── Hoja 2: Detalle ──
      const detalleSheet = workbook.addWorksheet('2. Detalle compras');
      writeTitle(detalleSheet, 'I', 'REPORTE DE COMPRAS — DETALLE');
      writeFilterBlock(detalleSheet);

      const headers = ['Código', 'Fecha', 'Proveedor', 'RUC', 'Teléfono', 'Artículos (con costo)', 'Subtotal (S/.)', 'IGV (18%)', 'Total (S/.)'];
      headers.forEach((header, colIndex) => {
        detalleSheet.getCell(headerRow, colIndex + 1).value = header;
      });
      styleHeaderRow(detalleSheet, headerRow, headers.length);

      const detalleRows = exportData.map(p => {
        const provRef = providers.find(pr => pr.name === p.prov);
        const itemsText = p.items?.length
          ? p.items.map(i => {
              if (i.type === 'insumo') {
                const insRef = insumos.find(ins => ins.id === i.insumoId);
                return `${insRef?.nombre || 'Insumo'} x${i.qty} (S/. ${i.cost.toFixed(2)})`;
              }
              const prodRef = products.find(prod => prod.id === i.productId);
              const displayName = prodRef ? (prodRef.name + (i.version ? ` (${i.version})` : '')) : 'Producto';
              return `${displayName} x${i.qty} (S/. ${i.cost.toFixed(2)})`;
            }).join('; ')
          : 'Artículos varios';

        return [
          `#${p.id}`,
          p.d,
          p.prov,
          provRef?.ruc || '',
          provRef?.phone || '',
          itemsText,
          moneyNum(p.subTotal),
          moneyNum(p.igv),
          moneyNum(p.total),
        ];
      });

      detalleRows.forEach((row, rowIndex) => {
        const rowNumber = headerRow + 1 + rowIndex;
        row.forEach((value, colIndex) => {
          const cell = detalleSheet.getCell(rowNumber, colIndex + 1);
          cell.value = value;
          if (colIndex >= 6 && typeof value === 'number') {
            cell.numFmt = '"S/." #,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
          styleDataCell(cell, rowIndex);
        });
      });

      const totalRowNumber = headerRow + 1 + detalleRows.length + 1;
      detalleSheet.getCell(`A${totalRowNumber}`).value = 'TOTALES';
      detalleSheet.getCell(`G${totalRowNumber}`).value = totalSubtotal;
      detalleSheet.getCell(`H${totalRowNumber}`).value = totalIGV;
      detalleSheet.getCell(`I${totalRowNumber}`).value = totalCompras;
      ['G', 'H', 'I'].forEach(col => {
        const cell = detalleSheet.getCell(`${col}${totalRowNumber}`);
        cell.numFmt = '"S/." #,##0.00';
        cell.alignment = { horizontal: 'right' };
      });
      styleTotalsRow(detalleSheet, totalRowNumber);

      [10, 14, 28, 14, 14, 55, 14, 14, 14].forEach((w, i) => {
        detalleSheet.getColumn(i + 1).width = w;
      });
      detalleSheet.views = [{ state: 'frozen', ySplit: headerRow }];
      detalleSheet.autoFilter = {
        from: `A${headerRow}`,
        to: `I${headerRow + detalleRows.length}`,
      };

      // ── Hoja 3: Por artículo ──
      const articuloSheet = workbook.addWorksheet('3. Por artículo');
      writeTitle(articuloSheet, 'F', 'REPORTE DE COMPRAS — POR ARTÍCULO');
      writeFilterBlock(articuloSheet);

      const articuloHeaders = ['Artículo', 'Tipo', 'Unidad', 'Cantidad total', 'Costo unit. (S/.)', 'Total (S/.)'];
      articuloHeaders.forEach((header, colIndex) => {
        articuloSheet.getCell(headerRow, colIndex + 1).value = header;
      });
      styleHeaderRow(articuloSheet, headerRow, articuloHeaders.length);

      const articuloMap: Record<string, { name: string; type: string; unidad: string; qty: number; cost: number; total: number }> = {};
      exportData.forEach(p => {
        p.items?.forEach(i => {
          let name = '';
          let type = '';
          let unidad = '';
          if (i.type === 'insumo') {
            const insRef = insumos.find(ins => ins.id === i.insumoId);
            name = insRef?.nombre || 'Insumo';
            type = 'Insumo';
            unidad = insRef?.unidadMedida || 'und';
          } else {
            const prodRef = products.find(prod => prod.id === i.productId);
            name = prodRef ? (prodRef.name + (i.version ? ` (${i.version})` : '')) : 'Producto';
            type = 'Producto';
            unidad = prodRef?.unidad_medida || 'unidades';
          }
          if (!articuloMap[name]) {
            articuloMap[name] = { name, type, unidad, qty: 0, cost: 0, total: 0 };
          }
          articuloMap[name].qty += i.qty;
          articuloMap[name].total += i.qty * i.cost;
          articuloMap[name].cost = i.cost;
        });
      });

      const articuloRows = Object.values(articuloMap).sort((a, b) => b.total - a.total);
      articuloRows.forEach((row, rowIndex) => {
        const rowNumber = headerRow + 1 + rowIndex;
        const rowData = [row.name, row.type, row.unidad, row.qty, row.cost, row.total];
        rowData.forEach((value, colIndex) => {
          const cell = articuloSheet.getCell(rowNumber, colIndex + 1);
          cell.value = value;
          if (colIndex >= 4 && typeof value === 'number') {
            cell.numFmt = '"S/." #,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
          styleDataCell(cell, rowIndex);
        });
      });

      const articuloTotalRow = headerRow + 1 + articuloRows.length + 1;
      articuloSheet.getCell(`A${articuloTotalRow}`).value = 'TOTALES';
      articuloSheet.getCell(`D${articuloTotalRow}`).value = articuloRows.reduce((a, r) => a + r.qty, 0);
      articuloSheet.getCell(`F${articuloTotalRow}`).value = articuloRows.reduce((a, r) => a + r.total, 0);
      articuloSheet.getCell(`F${articuloTotalRow}`).numFmt = '"S/." #,##0.00';
      articuloSheet.getCell(`F${articuloTotalRow}`).alignment = { horizontal: 'right' };
      styleTotalsRow(articuloSheet, articuloTotalRow);

      [40, 12, 12, 14, 16, 14].forEach((w, i) => {
        articuloSheet.getColumn(i + 1).width = w;
      });
      articuloSheet.views = [{ state: 'frozen', ySplit: headerRow }];
      articuloSheet.autoFilter = {
        from: `A${headerRow}`,
        to: `F${headerRow + articuloRows.length}`,
      };

      // ── Hoja 4: Por proveedor ──
      const proveedorSheet = workbook.addWorksheet('4. Por proveedor');
      writeTitle(proveedorSheet, 'F', 'REPORTE DE COMPRAS — POR PROVEEDOR');
      writeFilterBlock(proveedorSheet);

      const proveedorHeaders = ['Proveedor', 'RUC', 'Teléfono', 'Compras', 'Total (S/.)', '% del total'];
      proveedorHeaders.forEach((header, colIndex) => {
        proveedorSheet.getCell(headerRow, colIndex + 1).value = header;
      });
      styleHeaderRow(proveedorSheet, headerRow, proveedorHeaders.length);

      const proveedorMap: Record<string, { name: string; ruc: string; phone: string; count: number; total: number }> = {};
      exportData.forEach(p => {
        if (!proveedorMap[p.prov]) {
          const provRef = providers.find(pr => pr.name === p.prov);
          proveedorMap[p.prov] = {
            name: p.prov,
            ruc: provRef?.ruc || '',
            phone: provRef?.phone || '',
            count: 0,
            total: 0,
          };
        }
        proveedorMap[p.prov].count += 1;
        proveedorMap[p.prov].total += moneyNum(p.total);
      });

      const proveedorRows = Object.values(proveedorMap).sort((a, b) => b.total - a.total);
      proveedorRows.forEach((row, rowIndex) => {
        const rowNumber = headerRow + 1 + rowIndex;
        const rowData = [
          row.name,
          row.ruc,
          row.phone,
          row.count,
          row.total,
          totalCompras > 0 ? ((row.total / totalCompras) * 100).toFixed(1) + '%' : '0%',
        ];
        rowData.forEach((value, colIndex) => {
          const cell = proveedorSheet.getCell(rowNumber, colIndex + 1);
          cell.value = value;
          if (colIndex === 4 && typeof value === 'number') {
            cell.numFmt = '"S/." #,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
          styleDataCell(cell, rowIndex);
        });
      });

      const proveedorTotalRow = headerRow + 1 + proveedorRows.length + 1;
      proveedorSheet.getCell(`A${proveedorTotalRow}`).value = 'TOTALES';
      proveedorSheet.getCell(`D${proveedorTotalRow}`).value = proveedorRows.reduce((a, r) => a + r.count, 0);
      proveedorSheet.getCell(`E${proveedorTotalRow}`).value = totalCompras;
      proveedorSheet.getCell(`E${proveedorTotalRow}`).numFmt = '"S/." #,##0.00';
      proveedorSheet.getCell(`F${proveedorTotalRow}`).value = '100%';
      styleTotalsRow(proveedorSheet, proveedorTotalRow);

      [32, 14, 14, 10, 14, 12].forEach((w, i) => {
        proveedorSheet.getColumn(i + 1).width = w;
      });
      proveedorSheet.views = [{ state: 'frozen', ySplit: headerRow }];
      proveedorSheet.autoFilter = {
        from: `A${headerRow}`,
        to: `F${headerRow + proveedorRows.length}`,
      };

      // Descargar
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const datePart = new Date().toISOString().split('T')[0];
      const periodSlug = period === 'custom'
        ? `rango_${customFrom || 'ini'}_${customTo || 'fin'}`
        : period;
      a.download = `SnackRoque_Compras_${periodSlug}_${datePart}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      alert(
        `Excel de compras descargado (${exportData.length} registros · filtros aplicados)`
      );
    } catch (err: any) {
      console.error(err);
      alert('Error al exportar Excel: ' + err.message);
    }
  };

  return (
    <div className="screen active">
      {/* TOOLBAR */}
      <div className="tb-bar">
        <div style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: '600' }}>
          Registra el ingreso de mercadería e insumos de tus proveedores estratégicos.
          <span style={{ marginLeft: 10, color: 'var(--text-3)', fontWeight: 600 }}>
            Mostrando {filteredPurchases.length} de {purchases.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-new"
            onClick={exportToExcel}
            title="Exporta solo las compras con los filtros actuales"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            📊 Exportar Excel
          </button>
          <button className="btn-new" onClick={handleOpenNew}>+ Registrar compra</button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="rep-filters" style={{ marginBottom: 16 }}>
        <div className="rep-filters-head">
          <div className="rep-filters-title">
            🎛️ Filtros de compras
            <span className="rep-filters-hint">
              {activeFiltersCount > 0
                ? `${activeFiltersCount} personalizado${activeFiltersCount > 1 ? 's' : ''} · la exportación usa estos filtros`
                : 'Sin filtros · se exporta el historial completo'}
            </span>
          </div>
          {activeFiltersCount > 0 && (
            <button type="button" className="rep-btn-ghost" onClick={clearFilters}>
              ✕ Restablecer
            </button>
          )}
        </div>

        <div className="rep-period-pills">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              className={`rep-period-btn${period === opt.key ? ' active' : ''}`}
              onClick={() => setPeriod(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="rep-filter-row">
          {period === 'custom' && (
            <>
              <div className="rep-field">
                <label>Desde</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div className="rep-field">
                <label>Hasta</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </>
          )}

          <div className="rep-field">
            <label>Proveedor</label>
            <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)}>
              <option value="todos">Todos los proveedores</option>
              {providerOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="rep-field" style={{ flex: 1, minWidth: 200 }}>
            <label>Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Código, proveedor o artículo…"
            />
          </div>
        </div>
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
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
                  Aún no se han registrado compras.
                </td>
              </tr>
            ) : filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontWeight: '600' }}>
                  No hay compras con los filtros actuales.
                  {activeFiltersCount > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <button type="button" className="rep-btn-ghost" onClick={clearFilters}>
                        ✕ Quitar filtros
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredPurchases.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: '700', color: 'var(--accent)' }}>#{p.id}</td>
                  <td>{p.d}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text)' }}>{p.prov}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: '12.5px' }}>
                    {getItemsLabel(p)}
                  </td>
                  <td>{p.subTotal}</td>
                  <td>{p.igv}</td>
                  <td style={{ fontWeight: '800', color: 'var(--green)' }}>{p.total}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="act-btn" onClick={() => handleOpenDetails(p)} title="Ver Detalle">👁️</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DETAILS MODAL */}
      {showDetailsModal && selectedPurchase && (
        <div className="modal-overlay open" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-card" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="mc-title" style={{ margin: 0, textAlign: 'left' }}>
                <span style={{ fontSize: '20px', marginRight: '8px' }}>🧾</span>
                Detalle de Compra #{selectedPurchase.id}
              </div>
              <button 
                className="act-btn" 
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
                onClick={() => setShowDetailsModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13.5px', color: 'var(--text)' }}>
              <div><strong>Fecha:</strong> {selectedPurchase.d}</div>
              <div><strong>Proveedor:</strong> {selectedPurchase.prov}</div>
              <div><strong>Subtotal:</strong> S/. {parseFloat(selectedPurchase.subTotal.toString().replace(/[^0-9.-]+/g,"")).toFixed(2)}</div>
              <div><strong>IGV (18%):</strong> S/. {parseFloat(selectedPurchase.igv.toString().replace(/[^0-9.-]+/g,"")).toFixed(2)}</div>
              <div style={{ color: 'var(--green)', fontSize: '15px' }}><strong>Total:</strong> S/. {parseFloat(selectedPurchase.total.toString().replace(/[^0-9.-]+/g,"")).toFixed(2)}</div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-2)' }}>Artículos Adquiridos:</strong>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Artículo</th>
                    <th style={{ textAlign: 'right' }}>Cant.</th>
                    <th style={{ textAlign: 'right' }}>Costo Unit.</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.items && selectedPurchase.items.length > 0 ? (
                    selectedPurchase.items.map((i: any, idx: number) => {
                      let displayName = 'Artículo';
                      if (i.type === 'insumo') {
                        const insRef = insumos.find(ins => ins.id === i.insumoId);
                        displayName = insRef?.nombre || 'Insumo';
                      } else {
                        const prodRef = products.find(prod => prod.id === i.productId);
                        displayName = prodRef ? (prodRef.name + (i.version ? ` (${i.version})` : '')) : 'Producto';
                      }
                      return (
                        <tr key={idx}>
                          <td>{displayName}</td>
                          <td style={{ textAlign: 'right' }}>{i.qty}</td>
                          <td style={{ textAlign: 'right' }}>S/. {parseFloat(i.cost).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>S/. {(parseFloat(i.qty) * parseFloat(i.cost)).toFixed(2)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>Sin artículos detallados</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.5px' }}>
                    Añadir Artículo al Pedido
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="radio" checked={itemType === 'insumo'} onChange={() => setItemType('insumo')} /> Insumo (Materia Prima)
                    </label>
                    <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="radio" checked={itemType === 'producto'} onChange={() => setItemType('producto')} /> Producto (Reventa)
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  {itemType === 'insumo' ? (
                    <div className="inp-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '9px', margin: 0 }}>Insumo</label>
                        <span 
                          onClick={() => setShowQuickInsumoModal(true)} 
                          style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 'bold', fontSize: '9px', textDecoration: 'underline' }}
                        >
                          ➕ Nuevo Insumo
                        </span>
                      </div>
                      <select value={insId} onChange={(e) => setInsId(e.target.value)}>
                        <option value="">-- Elegir insumo --</option>
                        {insumos.filter(i => i.active).map(i => (
                          <option key={i.id} value={String(i.id)}>{i.nombre}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="inp-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '9px', margin: 0 }}>Producto Terminado</label>
                          <span 
                            onClick={() => setShowQuickProductModal(true)} 
                            style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 'bold', fontSize: '9px', textDecoration: 'underline' }}
                          >
                            ➕ Nuevo Producto
                          </span>
                        </div>
                        <select value={prodId} onChange={(e) => setProdId(e.target.value)}>
                          <option value="">-- Elegir producto --</option>
                          {products.map(p => (
                            <option key={p.id} value={String(p.id)}>{p.name}</option>
                          ))}
                        </select>
                      </div>

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
                    </>
                  )}

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
      {/* QUICK INSUMO MODAL */}
      {showQuickInsumoModal && (
        <div className="modal-overlay open" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ width: '420px' }}>
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '14px' }}>🌾 Registrar Insumo Rápido</div>
            <form onSubmit={handleQuickInsumoSubmit}>
              <div className="inp-group">
                <label>Nombre del Insumo</label>
                <input 
                  type="text" 
                  value={quickInsumoNombre} 
                  onChange={(e) => setQuickInsumoNombre(e.target.value)} 
                  placeholder="Ej: Harina saco 50kg" 
                  required 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="inp-group">
                  <label>Unidad de Medida</label>
                  <select value={quickInsumoUnidad} onChange={(e) => setQuickInsumoUnidad(e.target.value)}>
                    {['kg', 'sacos', 'jabas', 'cajas', 'litros', 'unidades', 'gr'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="inp-group">
                  <label>Stock Mínimo</label>
                  <input 
                    type="number" 
                    step="0.001" 
                    min="0" 
                    value={quickInsumoMinStock} 
                    onChange={(e) => setQuickInsumoMinStock(e.target.value)} 
                  />
                </div>
              </div>
              <div className="mc-btns" style={{ marginTop: '20px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowQuickInsumoModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">Registrar Insumo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PRODUCTO MODAL */}
      {showQuickProductModal && (
        <div className="modal-overlay open" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ width: '420px' }}>
            <div className="mc-title" style={{ textAlign: 'left', marginBottom: '14px' }}>📦 Registrar Producto Rápido</div>
            <form onSubmit={handleQuickProductSubmit}>
              <div className="inp-group">
                <label>Nombre del Producto</label>
                <input 
                  type="text" 
                  value={quickProductNombre} 
                  onChange={(e) => setQuickProductNombre(e.target.value)} 
                  placeholder="Ej: Pan de Yema" 
                  required 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="inp-group">
                  <label>Categoría</label>
                  <select value={quickProductCat} onChange={(e) => setQuickProductCat(e.target.value)}>
                    <option value="">-- Seleccionar --</option>
                    {categories.filter(c => c.active && c.name !== 'Insumos').map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="inp-group">
                  <label>Precio Venta Sugerido</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={quickProductPrice} 
                    onChange={(e) => setQuickProductPrice(e.target.value)} 
                    placeholder="0.00" 
                    required 
                  />
                </div>
              </div>
              <div className="mc-btns" style={{ marginTop: '20px' }}>
                <button type="button" className="mc-sec" onClick={() => setShowQuickProductModal(false)}>Cancelar</button>
                <button type="submit" className="mc-pri">Registrar Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
