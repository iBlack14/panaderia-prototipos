import { ReactNode } from 'react';

export interface ProductVersion {
  id: number;
  name: string;
  price: number;
  stock: number;
  parent_version_id?: number | null;
  fraction_ratio?: number;
}

export interface Product {
  id: number;
  name: string;
  cat: string;
  price: number;
  stock: number;
  versions: ProductVersion[];
  unidad_medida?: string;
}

export interface User {
  id: number | string;
  u: string;
  p?: string;
  n: string;
  rs: string[];
  st: string;
  email: string;
  phone: string;
}

export interface Provider {
  id: number | string;
  ruc: string;
  name: string;
  phone: string;
  address: string;
  active: boolean;
}

export interface PaymentMethod {
  id: number;
  name: string;
  desc: string;
  active: boolean;
}

export interface CartItem {
  id: number;
  cartId?: string;
  name: string;
  price: number;
  qty: number;
  version: string | null;
}

export interface DenominacionArqueo {
  b100: number; b50: number; b20: number; b10: number;
  m5: number; m2: number; m1: number; m050: number; m020: number; m010: number;
}

export interface CashSession {
  id: number | string;
  fec_apertura: string | Date;
  date?: string;
  tot_saldo_inicial: number;
  tot_ventas_efectivo: number;
  tot_ventas_otros: number;
  tot_retiros: number;
  estado: 'abierto' | 'cerrado';
  cajero?: string;
  turno?: string;
}

export interface CashDrop {
  id: number;
  sessionId: number | string;
  monto: number;
  motivo: string;
  cajero: string;
  hora: string;
}

export interface CashHistoryRecord {
  id: number | string;
  fec_apertura: string;
  fec_cierre: string;
  monto_inicial: number;
  monto_final: number;
  ventas_efectivo: number;
  ventas_otros: number;
  tot_retiros?: number;
  diferencia?: number;
  estado: 'cerrado';
  cajero?: string;
  date?: string;
  turno?: string;
  observaciones?: string;
  denominaciones?: DenominacionArqueo;
}

export interface CustomRole {
  id: string;
  name: string;
  desc: string;
  permissions: string[];
}

export interface Client {
  id: number | string;
  nombre: string;
  dni?: string;
  telefono?: string;
  email?: string;
  saldoCred: number;
  historialPagos: CreditPayment[];
  active: boolean;
}

export interface CreditPayment {
  id: number;
  fecha: string;
  concepto: string;
  monto: number;
  tipo: 'cargo' | 'abono';
  metodoPago?: string;
}

export interface BreadLog {
  id: number;
  d: string;
  prodName: string;
  type: 'produccion' | 'descarte' | 'venta' | 'compra' | 'conversion';
  qty: number;
  reason: string;
  cajero?: string;
  ref_id?: string;
  destino?: string;
  costoEstimado?: number;
}

export interface Sale {
  id: number;
  n: number;
  items: CartItem[];
  total: number;
  method: string;
  methodId?: number;
  d: string;
  t: string;
  cajero: string;
  clienteId?: number | string;
  clienteNombre?: string;
  estado?: number;
}

export interface Pedido {
  id: number | string;
  clienteId?: number | string;
  clienteNombre?: string;
  productoTexto: string;
  fecEntrega: string;
  adelanto: number;
  notes?: string; // Note: the type definition in AppContext line 168 says notes?: string, but Pedido interface line 168 has notes?: string, in AppContextType savePedido uses Pedido. Let's make sure it matches.
  notas?: string;
  estado: 'Pendiente' | 'Listo' | 'Entregado' | 'Cancelado';
  idUsuario?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReturnedItem {
  productId: number;
  version: string | null;
  qty: number;
  price: number;
}

export interface ReturnRecord {
  id: number | string;
  saleId: number;
  clienteId?: number | string;
  clienteNombre?: string;
  motivo: string;
  totalReturned: number;
  cajero: string;
  date: string;
  items: ReturnedItem[];
}

export interface PurchaseItem {
  type: 'producto' | 'insumo';
  productId?: number;
  insumoId?: number;
  qty: number;
  cost: number;
  version?: string | null;
}

export interface Purchase {
  id: string;
  d: string;
  prov: string;
  subTotal: string;
  igv: string;
  total: string;
  items: PurchaseItem[];
}

export interface Insumo {
  id: number;
  nombre: string;
  stock: number;
  costoUnitario: number;
  unidadMedida: string;
  stockMinimo: number;
  active: boolean;
}

export interface RecetaIngrediente {
  id?: number;
  insumoId: number;
  insumoNombre?: string;
  cantidadRequerida: number;
  unidadMedida?: string;
}

export interface Receta {
  id: number;
  productoId: number;
  productoNombre?: string;
  rendimientoBase: number;
  instrucciones?: string;
  ingredientes: RecetaIngrediente[];
}

export interface AppContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  products: Product[];
  categories: { id: number; name: string }[];
  usersList: User[];
  providers: Provider[];
  paymentMethods: PaymentMethod[];
  sales: Sale[];
  purchases: Purchase[];
  cart: CartItem[];
  cashSession: CashSession | null;
  cashHistory: CashHistoryRecord[];
  cashDrops: CashDrop[];
  breadLogs: BreadLog[];
  clients: Client[];
  rolesList: CustomRole[];
  toastMsg: string;
  pedidos: Pedido[];
  devoluciones: ReturnRecord[];
  insumos: Insumo[];
  recetas: Receta[];
  toast: (msg: string) => void;
  login: (uIn: string, pIn: string) => Promise<{ success: boolean; user?: User; message?: string }>;
  logout: () => void;
  sendRecoveryEmail: (emailIn: string) => Promise<{ success: boolean; online?: boolean; userId?: number | string; username?: string; message?: string }>;
  resetPasswordOffline: (userId: number | string, newPass: string) => Promise<void>;
  addToCart: (productName: string, price: number, id: number, versionObj?: ProductVersion | null, customQty?: number) => void;
  updateCartQty: (id: number, delta: number, version?: string | null) => void;
  clearCart: () => void;
  checkoutCart: (paymentMethodId: number, clienteId?: number | string) => Promise<Sale | undefined>;
  saveUser: (uObj: any) => Promise<void>;
  toggleUserStatus: (userId: number | string) => Promise<void>;
  lookupProfileByDni: (dni: string) => Promise<{ firstName: string; lastName: string; email?: string; phone?: string } | null>;
  saveProvider: (pObj: any) => Promise<void>;
  toggleProvider: (id: number | string) => Promise<void>;
  savePaymentMethod: (mObj: any) => Promise<void>;
  togglePaymentMethod: (id: number) => Promise<void>;
  registerPurchase: (pObj: { providerId: number | string; items: PurchaseItem[] }) => Promise<void>;
  openCashSession: (initialAmount: string | number, shift: string) => Promise<void>;
  closeCashSession: (countedAmount: string | number, observaciones: string, denominaciones?: DenominacionArqueo) => Promise<void>;
  registerCashDrop: (monto: number, motivo: string) => Promise<void>;
  saveProduct: (pObj: any) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  logBreadProduction: (prodId: number, qty: number, version?: string | null) => Promise<void>;
  logBreadDiscard: (prodId: number, qty: number, reason: string, version?: string | null) => Promise<void>;
  saveClient: (cObj: any) => Promise<Client | undefined>;
  toggleClient: (id: number | string) => Promise<void>;
  payCreditBalance: (clientId: number | string, monto: number, concepto: string, metodoPago?: string) => Promise<void>;
  logBreadConversion: (prodId: number, qty: number, destino: string, costoEstimado?: number, version?: string | null) => void;
  saveRole: (roleObj: any) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
  savePedido: (pedidoObj: any) => Promise<void>;
  updatePedidoStatus: (pedidoId: number | string, nuevoEstado: 'Pendiente' | 'Listo' | 'Entregado' | 'Cancelado') => Promise<void>;
  deliverPedido: (pedidoId: number | string, paymentMethodId: number, paymentMethodName: string, totalVal: number, adelantoVal: number, items: any[]) => Promise<void>;
  processReturn: (saleId: number, items: ReturnedItem[], motivo: string) => Promise<void>;
  fractionateProduct: (parentVersionId: number, childVersionId: number, qtyToDeduct: number, qtyToAdd: number) => Promise<void>;
  // Insumos
  saveInsumo: (iObj: any) => Promise<void>;
  toggleInsumo: (id: number) => Promise<void>;
  // Recetas
  saveReceta: (rObj: any) => Promise<void>;
  deleteReceta: (id: number) => Promise<void>;
}
