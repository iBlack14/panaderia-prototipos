import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOrderOperations } from './useOrderOperations';
import { Pedido, Product, Provider, PurchaseItem } from '@/context/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('useOrderOperations Unit Tests (TDD)', () => {
  let mockPedidos: Pedido[];
  let setPedidos: any;
  let mockProducts: Product[];
  let setProducts: any;
  let mockPurchases: any[];
  let setPurchases: any;
  let mockSales: any[];
  let setSales: any;
  let mockDevoluciones: any[];
  let setDevoluciones: any;
  let mockClients: any[];
  let setClients: any;
  let mockBreadLogs: any[];
  let setBreadLogs: any;
  let mockInsumos: any[];
  let setInsumos: any;
  let toast: any;
  let saveOffline: any;

  beforeEach(() => {
    localStorageMock.clear();
    mockPedidos = [
      {
        id: 1,
        clienteId: 101,
        clienteNombre: 'Juan Perez',
        productoTexto: '3 Croissants',
        fecEntrega: '2026-06-15T08:00:00.000Z',
        adelanto: 10,
        notas: 'Sin azucar',
        estado: 'Pendiente',
        idUsuario: 'user1',
        createdAt: '2026-06-11T12:00:00.000Z',
        updatedAt: '2026-06-11T12:00:00.000Z',
      },
    ];
    setPedidos = vi.fn((cb) => {
      if (typeof cb === 'function') {
        mockPedidos = cb(mockPedidos);
      } else {
        mockPedidos = cb;
      }
    });

    mockProducts = [
      {
        id: 1,
        name: 'Pan Frances',
        cat: 'Panes',
        price: 0.5,
        stock: 100,
        unidad_medida: 'unidades',
        versions: [],
      },
    ];
    setProducts = vi.fn((cb) => {
      if (typeof cb === 'function') {
        mockProducts = cb(mockProducts);
      } else {
        mockProducts = cb;
      }
    });

    mockInsumos = [
      {
        id: 1,
        nombre: 'Harina',
        stock: 10,
        costoUnitario: 5,
        unidadMedida: 'kg',
        stockMinimo: 2,
        active: true,
        lotes: [{ qty: 10, cost: 5 }]
      }
    ];
    setInsumos = vi.fn((cb) => {
      if (typeof cb === 'function') {
        mockInsumos = cb(mockInsumos);
      } else {
        mockInsumos = cb;
      }
    });

    mockPurchases = [];
    setPurchases = vi.fn();
    mockSales = [];
    setSales = vi.fn();
    mockDevoluciones = [];
    setDevoluciones = vi.fn();
    mockClients = [];
    setClients = vi.fn();
    mockBreadLogs = [];
    setBreadLogs = vi.fn();
    toast = vi.fn();
    saveOffline = vi.fn();
  });

  it('should update order status correctly and save it in localStorage', async () => {
    const hook = useOrderOperations({
      pedidos: mockPedidos,
      setPedidos,
      devoluciones: mockDevoluciones,
      setDevoluciones,
      purchases: mockPurchases,
      setPurchases,
      sales: mockSales,
      setSales,
      products: mockProducts,
      setProducts,
      clients: mockClients,
      setClients,
      providers: [],
      breadLogs: mockBreadLogs,
      setBreadLogs,
      cashSession: null,
      setCashSession: vi.fn(),
      user: null,
      toast,
      isSupabaseConfigured: false,
      supabase: null,
      saveOffline,
      insumos: mockInsumos,
      setInsumos,
    });

    await hook.updatePedidoStatus(1, 'Listo');

    // State update checks
    expect(setPedidos).toHaveBeenCalled();
    expect(mockPedidos[0].estado).toBe('Listo');
    expect(mockPedidos[0].updatedAt).toBeDefined();

    // LocalStorage checks
    const stored = JSON.parse(localStorageMock.getItem('snack_pedidos') || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].estado).toBe('Listo');
    expect(toast).toHaveBeenCalledWith('📅 Estado del pedido actualizado');
  });

  it('should register a purchase, calculate subtotal, IGV and update product stock', async () => {
    const mockProviders: Provider[] = [
      {
        id: 5,
        ruc: '20123456789',
        name: 'Distribuidora Harinas SAC',
        phone: '987654321',
        address: 'Av. Peru 123',
        active: true,
      },
    ];
    const purchaseItems: PurchaseItem[] = [
      {
        type: 'producto',
        productId: 1, // Pan Frances
        qty: 50,
        cost: 0.3,
        version: null,
      },
      {
        type: 'insumo',
        insumoId: 1, // Harina
        qty: 20,
        cost: 6,
        version: null
      }
    ];

    const hook = useOrderOperations({
      pedidos: mockPedidos,
      setPedidos,
      devoluciones: mockDevoluciones,
      setDevoluciones,
      purchases: mockPurchases,
      setPurchases,
      sales: mockSales,
      setSales,
      products: mockProducts,
      setProducts,
      clients: mockClients,
      setClients,
      providers: mockProviders,
      breadLogs: mockBreadLogs,
      setBreadLogs,
      cashSession: null,
      setCashSession: vi.fn(),
      user: { id: 'admin1', u: 'admin', n: 'Administrador', rs: ['Administrador'], email: '', phone: '', st: 'act' },
      toast,
      isSupabaseConfigured: false,
      supabase: null,
      saveOffline,
      insumos: mockInsumos,
      setInsumos
    });

    await hook.registerPurchase({
      providerId: 5,
      items: purchaseItems,
    });

    // Check product stock update
    expect(setProducts).toHaveBeenCalled();
    expect(mockProducts[0].stock).toBe(150); // 100 + 50
    expect(saveOffline).toHaveBeenCalledWith('snack_products', mockProducts);

    // Check insumos FIFO update
    expect(setInsumos).toHaveBeenCalled();
    expect(mockInsumos[0].stock).toBe(30); // 10 + 20
    expect(mockInsumos[0].lotes.length).toBe(2); // Initial batch + new batch
    expect(mockInsumos[0].lotes[1].qty).toBe(20);
    expect(mockInsumos[0].lotes[1].cost).toBe(6);
    expect(mockInsumos[0].costoUnitario).toBe(5); // Oldest unit cost remains 5 until first batch is consumed

    // Check purchases list update
    expect(setPurchases).toHaveBeenCalled();
    expect(saveOffline).toHaveBeenCalledWith('snack_purchases', expect.any(Array));

    // Check kardex (bread logs) update
    expect(setBreadLogs).toHaveBeenCalled();
    expect(saveOffline).toHaveBeenCalledWith('snack_bread_logs', expect.any(Array));

    expect(toast).toHaveBeenCalledWith('📥 Compra registrada e inventario actualizado');
  });

  it('should process a return, update product stock, and refund the amount to the client prepaid balance', async () => {
    // Arrange
    const saleId = 1001;
    mockSales = [
      {
        id: saleId,
        n: 501,
        items: [
          {
            id: 1, // Pan Frances
            name: 'Pan Frances',
            price: 0.5,
            qty: 10,
            version: null,
          },
        ],
        total: 5.0,
        method: 'Saldo Cliente',
        d: '2026-06-18',
        t: '12:00',
        cajero: 'Cajero',
        clienteId: 201,
        clienteNombre: 'Maria Gomez',
        estado: 1,
      },
    ];
    setSales = vi.fn((cb) => {
      if (typeof cb === 'function') {
        mockSales = cb(mockSales);
      } else {
        mockSales = cb;
      }
    });

    mockClients = [
      {
        id: 201,
        nombre: 'Maria Gomez',
        dni: '98765432',
        telefono: '987654321',
        email: 'maria@gomez.com',
        saldoCred: 10.0,
        historialPagos: [],
        active: true,
      },
    ];
    setClients = vi.fn((cb) => {
      if (typeof cb === 'function') {
        mockClients = cb(mockClients);
      } else {
        mockClients = cb;
      }
    });

    setDevoluciones = vi.fn((cb) => {
      if (typeof cb === 'function') {
        mockDevoluciones = cb(mockDevoluciones);
      } else {
        mockDevoluciones = cb;
      }
    });

    setBreadLogs = vi.fn((cb) => {
      if (typeof cb === 'function') {
        mockBreadLogs = cb(mockBreadLogs);
      } else {
        mockBreadLogs = cb;
      }
    });

    const returnedItems = [
      {
        productId: 1,
        version: null,
        qty: 4, // Returning 4 items
        price: 0.5,
      },
    ];

    const hook = useOrderOperations({
      pedidos: mockPedidos,
      setPedidos,
      devoluciones: mockDevoluciones,
      setDevoluciones,
      purchases: mockPurchases,
      setPurchases,
      sales: mockSales,
      setSales,
      products: mockProducts,
      setProducts,
      clients: mockClients,
      setClients,
      providers: [],
      breadLogs: mockBreadLogs,
      setBreadLogs,
      cashSession: null,
      setCashSession: vi.fn(),
      user: { id: 'admin1', u: 'admin', n: 'Administrador', rs: ['Administrador'], email: '', phone: '', st: 'act' },
      toast,
      isSupabaseConfigured: false,
      supabase: null,
      saveOffline,
      insumos: mockInsumos,
      setInsumos
    });

    // Act
    await hook.processReturn(saleId, returnedItems, 'Pan quemado');

    // Assert
    // 1. Stock of product 1 should increase by 4 (initial stock was 100)
    expect(setProducts).toHaveBeenCalled();
    expect(mockProducts[0].stock).toBe(104);

    // 2. Client prepaid balance should increase by 2.0 (4 * 0.5)
    expect(setClients).toHaveBeenCalled();
    expect(mockClients[0].saldoCred).toBe(12.0); // 10.0 + 2.0
    expect(mockClients[0].historialPagos.length).toBe(1);
    expect(mockClients[0].historialPagos[0].tipo).toBe('abono');
    expect(mockClients[0].historialPagos[0].monto).toBe(2.0);
    expect(mockClients[0].historialPagos[0].concepto).toContain('Devolución venta #B-501');

    // 3. Devoluciones list should have 1 record
    expect(setDevoluciones).toHaveBeenCalled();
    expect(mockDevoluciones.length).toBe(1);
    expect(mockDevoluciones[0].totalReturned).toBe(2.0);
    expect(mockDevoluciones[0].motivo).toBe('Pan quemado');

    // 4. Kardex (bread logs) should be updated
    expect(setBreadLogs).toHaveBeenCalled();
    expect(mockBreadLogs.length).toBe(1);
    expect(mockBreadLogs[0].qty).toBe(4);
    expect(mockBreadLogs[0].reason).toContain('Devolución Venta #501');

    // 5. Toast notification
    expect(toast).toHaveBeenCalledWith('↩ Devolución registrada correctamente localmente');
  });
});
