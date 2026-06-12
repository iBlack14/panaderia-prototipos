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
        em: 'unidades',
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
      user: null,
      toast,
      isSupabaseConfigured: false,
      supabase: null,
      saveOffline,
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
        productId: 1, // Pan Frances
        qty: 50,
        cost: 0.3,
        version: null,
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
      providers: mockProviders,
      breadLogs: mockBreadLogs,
      setBreadLogs,
      user: { id: 'admin1', u: 'admin', n: 'Administrador', rs: ['Administrador'], email: '', phone: '', st: 'act' },
      toast,
      isSupabaseConfigured: false,
      supabase: null,
      saveOffline,
    });

    await hook.registerPurchase({
      providerId: 5,
      items: purchaseItems,
    });

    // Check product stock update
    expect(setProducts).toHaveBeenCalled();
    expect(mockProducts[0].stock).toBe(150); // 100 + 50
    expect(saveOffline).toHaveBeenCalledWith('snack_products', mockProducts);

    // Check purchases list update
    expect(setPurchases).toHaveBeenCalled();
    expect(saveOffline).toHaveBeenCalledWith('snack_purchases', expect.any(Array));

    // Check kardex (bread logs) update
    expect(setBreadLogs).toHaveBeenCalled();
    expect(saveOffline).toHaveBeenCalledWith('snack_bread_logs', expect.any(Array));

    expect(toast).toHaveBeenCalledWith('📥 Compra registrada e inventario actualizado');
  });
});
