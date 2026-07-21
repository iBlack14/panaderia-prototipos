# Documentación Técnica - Sistema de Gestión y POS Panadería

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Base de Datos](#base-de-datos)
6. [API Routes](#api-routes)
7. [Context y State Management](#context-y-state-management)
8. [Módulos Principales](#módulos-principales)
9. [Integraciones Externas](#integraciones-externas)
10. [Sistema de Hooks Personalizados](#sistema-de-hooks-personalizados)
11. [Sistema de Sincronización Offline](#sistema-de-sincronización-offline)
12. [Sistema de Roles y Permisos](#sistema-de-roles-y-permisos)
13. [Sistema de Recetas](#sistema-de-recetas)
14. [Sistema de Logs y Auditoría](#sistema-de-logs-y-auditoría)
15. [Configuración de Next.js](#configuración-de-nextjs)
16. [Testing y QA](#testing-y-qa)
17. [Optimizaciones de Rendimiento](#optimizaciones-de-rendimiento)
18. [Seguridad Avanzada](#seguridad-avanzada)
19. [Sistema de Categorías](#sistema-de-categorías)
20. [Sistema de Métodos de Pago](#sistema-de-métodos-de-pago)
21. [Sistema de Créditos de Clientes](#sistema-de-créditos-de-clientes)
22. [Sistema de Producción y Descarte de Panes](#sistema-de-producción-y-descarte-de-panes)
23. [Configuración de Tailwind CSS](#configuración-de-tailwind-css)
24. [Sistema de Notificaciones](#sistema-de-notificaciones)
25. [Sistema de Búsqueda y Filtrado](#sistema-de-búsqueda-y-filtrado)
26. [Sistema de Impresión](#sistema-de-impresión)
27. [Guía de Desarrollo](#guía-de-desarrollo)
28. [Deploy y Configuración](#deploy-y-configuración)
29. [Troubleshooting](#troubleshooting)
30. [Apéndices](#apéndices)

---

## Introducción

### Descripción General

El **Sistema de Gestión y POS Panadería** es una aplicación web completa diseñada para panaderías y pastelerías locales. Permite gestionar:

- **Punto de Venta (POS)**: Ventas en tiempo real con carrito de compras
- **Gestión de Caja**: Apertura, cierre, retiros y arqueo de caja
- **Inventario**: Control de productos, insumos y stock
- **Reservas/Pedidos**: Sistema de pedidos con adelantos y estados
- **Reportes**: Exportación de reportes en Excel y PDF
- **Clientes**: Gestión de clientes y créditos
- **Proveedores**: Registro de compras y proveedores
- **Notificaciones**: Integración con WhatsApp para notificaciones

### Objetivos del Proyecto

- Automatizar procesos operativos de panaderías
- Centralizar la gestión de ventas, inventario y finanzas
- Proporcionar reportes detallados para toma de decisiones
- Facilitar la comunicación con clientes vía WhatsApp
- Mantener un registro completo de transacciones

---

## Arquitectura del Sistema

### Patrón MVC

El proyecto sigue una arquitectura **Model-View-Controller (MVC)** adaptada para Next.js:

```
┌─────────────────────────────────────────────────────────────┐
│                      VIEW (Frontend)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Components (Pages)                              │  │
│  │  - src/app/dashboard/*/page.tsx                       │  │
│  │  - src/components/                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   CONTROLLER (Logic)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  API Routes (Next.js)                                 │  │
│  │  - src/app/api/*/route.ts                            │  │
│  │  React Hooks (Business Logic)                          │  │
│  │  - src/hooks/*                                       │  │
│  │  Context Providers                                     │  │
│  │  - src/context/AppContext.tsx                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      MODEL (Data)                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Supabase (PostgreSQL)                                 │  │
│  │  - Tables: users, sales, products, insumos, etc.       │  │
│  │  - TypeScript Types                                    │  │
│  │  - src/context/types.ts                               │  │
│  │  - Data Access Layer                                   │  │
│  │  - src/lib/supabase/                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Principios SOLID Aplicados

1. **Single Responsibility Principle (SRP)**
   - Cada hook tiene una responsabilidad única
   - `useOrderOperations`: Gestión de pedidos
   - `useCashOperations`: Gestión de caja
   - `useInventoryOperations`: Gestión de inventario

2. **Open/Closed Principle (OCP)**
   - Los componentes son extensibles mediante props
   - Los hooks pueden ser compuestos

3. **Liskov Substitution Principle (LSP)**
   - Interfaces TypeScript bien definidas
   - Tipos compartidos en `types.ts`

4. **Interface Segregation Principle (ISP)**
   - Context dividido por funcionalidad
   - Hooks específicos por dominio

5. **Dependency Inversion Principle (DIP)**
   - Dependencia de abstracciones (interfaces)
   - Inyección de dependencias vía Context API

---

## Stack Tecnológico

### Frontend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Next.js** | 16.2.6 | Framework React con App Router |
| **React** | 19.2.4 | Biblioteca UI |
| **TypeScript** | 6.0.3 | Tipado estático |
| **Tailwind CSS** | 4.0 | Estilos CSS utility-first |

### Backend & Base de Datos

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Supabase** | 2.106.1 | Backend-as-a-Service (PostgreSQL + Auth) |
| **PostgreSQL** | - | Base de datos relacional |

### Integraciones

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **@whiskeysockets/baileys** | 7.0.0-rc13 | API WhatsApp |
| **qrcode** | 1.5.4 | Generación de QR |
| **jimp** | 1.6.1 | Procesamiento de imágenes |
| **nodemailer** | 8.0.10 | Envío de emails |
| **resend** | 6.12.4 | API Email |
| **pino** | 10.3.1 | Logging |

### Herramientas de Desarrollo

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **ESLint** | 9.0.0 | Linting |
| **TypeDoc** | 0.28.19 | Documentación |
| **npm** | - | Gestión de paquetes |

---

## Estructura del Proyecto

```
panaderia-prototipos/
├── .env                          # Variables de entorno
├── .gitignore                    # Archivos ignorados por Git
├── ARCHITECTURE.md               # Documentación de arquitectura
├── DOCUMENTACION_TECNICA.md      # Este archivo
├── README.md                     # Documentación general
├── next.config.mjs               # Configuración de Next.js
├── package.json                  # Dependencias y scripts
├── tsconfig.json                 # Configuración TypeScript
├── tailwind.config.mjs           # Configuración Tailwind
├── supabase_schema.sql           # Schema de base de datos
│
├── public/                       # Archivos estáticos
│   ├── favicon.ico
│   └── ...
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/             # Autenticación
│   │   │   │   └── login/route.ts
│   │   │   ├── send-otp/         # Envío de OTP
│   │   │   │   └── route.ts
│   │   │   ├── sync/             # Sincronización
│   │   │   │   └── route.ts
│   │   │   └── whatsapp/        # Webhooks WhatsApp
│   │   │       └── route.ts
│   │   │
│   │   ├── dashboard/            # Panel principal
│   │   │   ├── caja/             # Gestión de caja
│   │   │   ├── categorias/      # Gestión de categorías
│   │   │   ├── clientes/         # Gestión de clientes
│   │   │   ├── compras/          # Gestión de compras
│   │   │   ├── insumos/          # Gestión de insumos
│   │   │   ├── layout.tsx        # Layout del dashboard
│   │   │   ├── metodos/          # Métodos de pago
│   │   │   ├── page.tsx          # Home del dashboard
│   │   │   ├── pedidos/          # Gestión de pedidos
│   │   │   ├── productos/        # Gestión de productos
│   │   │   ├── proveedores/      # Gestión de proveedores
│   │   │   ├── recetas/          # Gestión de recetas
│   │   │   ├── reportes/         # Reportes y exportación
│   │   │   ├── usuarios/         # Gestión de usuarios
│   │   │   ├── ventas/           # Punto de venta
│   │   │   └── whatsapp/         # Configuración WhatsApp
│   │   │
│   │   ├── recovery/             # Recuperación de contraseña
│   │   │
│   │   ├── globals.css           # Estilos globales
│   │   ├── layout.tsx            # Layout raíz
│   │   └── page.tsx              # Página de login
│   │
│   ├── components/               # Componentes reutilizables
│   │
│   ├── context/                  # Context API
│   │   ├── AppContext.tsx        # Context principal
│   │   └── types.ts              # Tipos TypeScript
│   │
│   ├── hooks/                    # Custom Hooks
│   │   ├── useAuth.ts            # Autenticación
│   │   ├── useCashOperations.ts  # Operaciones de caja
│   │   ├── useInventoryOperations.ts # Operaciones de inventario
│   │   ├── useOrderOperations.ts # Operaciones de pedidos
│   │   └── ...
│   │
│   └── lib/                      # Utilidades
│       ├── baileys.ts            # Cliente WhatsApp
│       ├── cdn.ts                # Carga de scripts externos
│       ├── supabase.ts           # Cliente Supabase
│       └── supabase/             # Mappers y queries
│           ├── sales.ts
│           ├── products.ts
│           └── ...
│
├── docs/                         # Documentación generada (TypeDoc)
└── node_modules/                 # Dependencias
```

---

## Base de Datos

### Esquema General

La base de datos está implementada en **PostgreSQL** a través de Supabase. El esquema completo se encuentra en `supabase_schema.sql`.

### Tablas Principales

#### 1. **users**
```sql
- id: uuid (PK)
- username: text (unique)
- password_hash: text
- full_name: text
- email: text
- phone: text
- roles: text[]
- is_active: boolean
- created_at: timestamp
```

#### 2. **sales**
```sql
- id: integer (PK)
- n: integer (número de boleta)
- items: jsonb (items del carrito)
- total: numeric
- method: text (método de pago)
- method_id: integer
- date: timestamp
- time: text
- cajero: text
- cliente_id: uuid (FK)
- cliente_nombre: text
- estado: integer (0=anulado, 1=pagado)
```

#### 3. **products**
```sql
- id: integer (PK)
- name: text
- category_id: integer (FK)
- price: numeric
- stock: integer
- versions: jsonb (versiones del producto)
- unidad_medida: text
- active: boolean
```

#### 4. **insumos**
```sql
- id: integer (PK)
- nombre: text
- stock: numeric
- costo_unitario: numeric
- unidad_medida: text
- stock_minimo: numeric
- active: boolean
- lotes: jsonb (lotes de compra)
```

#### 5. **pedidos** (reservas)
```sql
- id: uuid (PK)
- cliente_id: uuid (FK)
- cliente_nombre: text
- producto_texto: text
- fec_entrega: date
- adelanto: numeric
- notas: text
- estado: text ('Pendiente', 'Listo', 'Entregado', 'Cancelado')
- id_usuario: uuid (FK)
- created_at: timestamp
- updated_at: timestamp
```

#### 6. **purchases** (compras)
```sql
- id: text (PK)
- date: date
- provider: text
- sub_total: text
- igv: string
- total: string
- items: jsonb
```

#### 7. **cash_sessions**
```sql
- id: uuid (PK)
- fec_apertura: timestamp
- tot_saldo_inicial: numeric
- tot_ventas_efectivo: numeric
- tot_ventas_otros: numeric
- tot_retiros: numeric
- estado: text ('abierto', 'cerrado')
- cajero: text
- turno: text
```

#### 8. **clients**
```sql
- id: uuid (PK)
- nombre: text
- dni: text
- telefono: text
- email: text
- saldo_credito: numeric
- active: boolean
```

### Relaciones

```
users ──┬──> sales (cajero)
       ├──> pedidos (id_usuario)
       └──> cash_sessions (cajero)

clients ──┬──> sales (cliente_id)
         └──> pedidos (cliente_id)

products ──> sales (items)

insumos ──> purchases (items)
         └──> recetas (ingredientes)

categories ──> products
```

---

## API Routes

### Autenticación

#### POST `/api/auth/login`
Autenticación de usuarios con credenciales.

**Request:**
```json
{
  "username": "usuario",
  "password": "contraseña"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "usuario",
    "full_name": "Nombre Completo",
    "roles": ["admin", "cajero"]
  }
}
```

#### POST `/api/send-otp`
Envío de código OTP por email para verificación.

**Request:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP enviado correctamente"
}
```

### Sincronización

#### POST `/api/sync`
Sincronización de datos locales con Supabase.

**Request:**
```json
{
  "sales": [...],
  "products": [...],
  "purchases": [...]
}
```

**Response:**
```json
{
  "success": true,
  "synced": {
    "sales": 10,
    "products": 5
  }
}
```

### WhatsApp

#### POST `/api/whatsapp`
Webhook para recibir mensajes de WhatsApp.

**Request:**
```json
{
  "from": "51999999999",
  "message": "Hola, quiero consultar mi pedido"
}
```

---

## Context y State Management

### AppContext

El estado global de la aplicación se gestiona mediante **React Context API** en `src/context/AppContext.tsx`.

#### Estado Global

```typescript
interface AppContextType {
  // Usuario
  user: User | null;
  role: string | null;
  
  // Datos del negocio
  products: Product[];
  categories: Category[];
  usersList: User[];
  providers: Provider[];
  paymentMethods: PaymentMethod[];
  
  // Transacciones
  sales: Sale[];
  purchases: Purchase[];
  cart: CartItem[];
  
  // Caja
  cashSession: CashSession | null;
  cashHistory: CashHistoryRecord[];
  cashDrops: CashDrop[];
  
  // Otros
  clients: Client[];
  pedidos: Pedido[];
  insumos: Insumo[];
  recetas: Receta[];
  
  // Funciones
  login: (username, password) => Promise<void>;
  logout: () => void;
  addToCart: (product, price, id, version?) => void;
  checkoutCart: (paymentMethodId, clienteId?) => Promise<Sale>;
  registerPurchase: (purchase) => Promise<void>;
  // ... más funciones
}
```

#### Persistencia

- **LocalStorage**: Para datos offline y caché
- **Supabase**: Para persistencia en la nube
- **Sync automático**: Sincronización bidireccional

---

## Módulos Principales

### 1. Punto de Venta (POS)

**Ubicación**: `src/app/dashboard/ventas/page.tsx`

**Funcionalidades:**
- Carrito de compras en tiempo real
- Selección de productos por categoría
- Soporte para versiones de productos
- Cálculo automático de totales
- Selección de método de pago
- Selección de cliente (opcional)
- Generación de comprobante

**Flujo:**
1. Usuario selecciona productos
2. Productos se agregan al carrito
3. Usuario selecciona método de pago
4. Usuario confirma venta
5. Se genera registro en `sales`
6. Se actualiza stock de productos
7. Se imprime comprobante

### 2. Gestión de Caja

**Ubicación**: `src/app/dashboard/caja/page.tsx`

**Funcionalidades:**
- Apertura de caja con monto inicial
- Registro de retiros de efectivo
- Cierre de caja con arqueo
- Historial de sesiones de caja
- Denominaciones para arqueo

**Flujo:**
1. Cajero abre caja con monto inicial
2. Durante el día, se registran ventas
3. Cajero puede hacer retiros
4. Al cierre, se realiza arqueo
5. Se calcula diferencia
6. Se cierra sesión

### 3. Inventario

**Ubicación**: `src/app/dashboard/productos/page.tsx`

**Funcionalidades:**
- CRUD de productos
- Gestión de categorías
- Control de stock
- Versiones de productos (tamaños, sabores)
- Alertas de stock bajo

**Tipos de Productos:**
- **Productos finales**: Panes, pasteles, etc.
- **Insumos**: Harina, azúcar, etc.
- **Recetas**: Relación producto-insumos

### 4. Pedidos/Reservas

**Ubicación**: `src/app/dashboard/pedidos/page.tsx`

**Funcionalidades:**
- Registro de pedidos/reservas
- Estados: Pendiente → Listo → Entregado/Cancelado
- Sistema de adelantos
- Notificaciones por WhatsApp
- Historial de pedidos

**Estados del Pedido:**
- **Pendiente**: Pedido recibido, no iniciado
- **Listo**: Pedido preparado, listo para entrega
- **Entregado**: Pedido entregado al cliente
- **Cancelado**: Pedido cancelado

### 5. Reportes

**Ubicación**: `src/app/dashboard/reportes/page.tsx`

**Funcionalidades:**
- Reportes de ventas
- Reportes de productos
- Reportes de insumos
- Reportes de pedidos
- Exportación a Excel (ExcelJS)
- Exportación a PDF (jsPDF)
- Filtros por fecha, método, cajero

**Tipos de Reportes:**
- **Ventas**: Resumen de ventas por período
- **Productos**: Inventario y rotación
- **Insumos**: Compras y stock
- **Pedidos**: Reservas y entregas

### 6. Clientes

**Ubicación**: `src/app/dashboard/clientes/page.tsx`

**Funcionalidades:**
- Registro de clientes
- Sistema de crédito
- Historial de pagos
- Estado de cuenta

**Sistema de Crédito:**
- Límite de crédito por cliente
- Registro de cargos/abonos
- Alertas de saldo vencido

### 7. Compras

**Ubicación**: `src/app/dashboard/compras/page.tsx`

**Funcionalidades:**
- Registro de compras a proveedores
- Gestión de proveedores
- Control de insumos comprados
- Exportación a Excel

**Flujo de Compra:**
1. Seleccionar proveedor
2. Agregar items (insumos/productos)
3. Seleccionar costo unitario
4. Confirmar compra
5. Actualizar stock de insumos
6. Registrar en `purchases`

---

## Integraciones Externas

### WhatsApp (Baileys)

**Ubicación**: `src/lib/baileys.ts`

**Funcionalidades:**
- Conexión persistente con WhatsApp
- Generación de QR para emparejamiento
- Envío de mensajes automáticos
- Recepción de mensajes (webhook)

**Casos de Uso:**
- Notificación de pedido listo
- Confirmación de reserva
- Recordatorios de pago

**Configuración:**
```typescript
// Variables de entorno requeridas
WHATSAPP_PHONE_NUMBER
WHATSAPP_AUTH_STATE_PATH
```

### Email (Resend/Nodemailer)

**Ubicación**: `src/app/api/send-otp/route.ts`

**Funcionalidades:**
- Envío de OTP para verificación
- Recuperación de contraseña
- Notificaciones por email

**Configuración:**
```typescript
// Variables de entorno
RESEND_API_KEY
RESEND_FROM_EMAIL
```

### Exportación Excel (ExcelJS)

**Ubicación**: `src/lib/cdn.ts`

**Funcionalidades:**
- Exportación de reportes a Excel
- Estilos profesionales
- Múltiples hojas por reporte
- Formato de moneda

**Características:**
- Colores de marca
- Bordes y estilos
- Congelar paneles
- AutoFilter

### Exportación PDF (jsPDF)

**Ubicación**: `src/lib/cdn.ts`

**Funcionalidades:**
- Exportación de reportes a PDF
- Tablas formateadas
- Encabezados y pies de página

**Configuración de jsPDF:**
```typescript
const { jsPDF } = await loadJsPDFAutoTable();
const doc = new jsPDF();

// Configuración de tabla
autoTable(doc, {
  head: [['Columna 1', 'Columna 2']],
  body: data,
  styles: {
    fontSize: 10,
    cellPadding: 3,
  },
  headStyles: {
    fillColor: [176, 125, 46], // Color de marca
    textColor: 255,
  },
});
```

---

## Sistema de Hooks Personalizados

### useAuth (`src/hooks/useAuth.ts`)

**Funcionalidades:**
- Autenticación de usuarios
- Gestión de sesión
- Recuperación de contraseña

**Métodos principales:**
```typescript
interface UseAuthReturn {
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  sendRecoveryEmail: (email: string) => Promise<RecoveryResponse>;
  resetPasswordOffline: (userId: string, newPassword: string) => Promise<void>;
  lookupProfileByDni: (dni: string) => Promise<Profile | null>;
}
```

**Flujo de autenticación:**
1. Usuario ingresa credenciales
2. Se valida contra Supabase Auth
3. Se obtiene roles y permisos
4. Se establece sesión en localStorage
5. Se actualiza AppContext
6. Se redirige al dashboard

### useCashOperations (`src/hooks/useCashOperations.ts`)

**Funcionalidades:**
- Apertura de caja
- Cierre de caja con arqueo
- Registro de retiros
- Historial de sesiones

**Denominaciones de arqueo:**
```typescript
interface DenominacionArqueo {
  b100: number;   // Billetes de 100
  b50: number;    // Billetes de 50
  b20: number;    // Billetes de 20
  b10: number;    // Billetes de 10
  m5: number;     // Monedas de 5
  m2: number;     // Monedas de 2
  m1: number;     // Monedas de 1
  m050: number;   // Monedas de 0.50
  m020: number;   // Monedas de 0.20
  m010: number;   // Monedas de 0.10
}
```

**Cálculo de arqueo:**
```typescript
const calcularArqueo = (denominaciones: DenominacionArqueo) => {
  return (
    denominaciones.b100 * 100 +
    denominaciones.b50 * 50 +
    denominaciones.b20 * 20 +
    denominaciones.b10 * 10 +
    denominaciones.m5 * 5 +
    denominaciones.m2 * 2 +
    denominaciones.m1 * 1 +
    denominaciones.m050 * 0.50 +
    denominaciones.m020 * 0.20 +
    denominaciones.m010 * 0.10
  );
};
```

### useInventoryOperations (`src/hooks/useInventoryOperations.ts`)

**Funcionalidades:**
- Gestión de productos
- Gestión de insumos
- Registro de producción
- Registro de descartes

**Sistema de versiones de productos:**
```typescript
interface ProductVersion {
  id: number;
  name: string;              // "Pequeño", "Mediano", "Grande"
  price: number;
  stock: number;
  parent_version_id?: number;
  fraction_ratio?: number;   // Ratio para fraccionamiento
}
```

**Fraccionamiento de productos:**
```typescript
fractionateProduct(
  parentVersionId: number,
  childVersionId: number,
  qtyToDeduct: number,
  qtyToAdd: number
) {
  // 1. Validar stock disponible en versión padre
  // 2. Reducir stock de versión padre
  // 3. Aumentar stock de versión hija
  // 4. Registrar en breadLogs
  // 5. Actualizar en Supabase
}
```

### useOrderOperations (`src/hooks/useOrderOperations.ts`)

**Funcionalidades:**
- Gestión de pedidos
- Cambio de estados
- Cálculo de insumos necesarios
- Entrega de pedidos

**Cálculo de insumos para pedidos:**
```typescript
calcularInsumosParaPedido(items: PedidoItem[]) {
  const requerimientos: InsumoRequerido[] = [];
  
  items.forEach(item => {
    const receta = recetas.find(r => r.productoId === item.productId);
    if (receta) {
      receta.ingredientes.forEach(ing => {
        const cantidadNecesaria = ing.cantidadRequerida * item.qty;
        requerimientos.push({
          insumoId: ing.insumoId,
          insumoNombre: ing.insumoNombre,
          cantidadNecesaria,
          unidad: ing.unidadMedida,
          stockDisponible: insumos.find(i => i.id === ing.insumoId)?.stock || 0,
          suficiente: true,
          costoLinea: cantidadNecesaria * costoUnitario,
        });
      });
    }
  });
  
  return {
    requerimientos,
    costoMateriaPrima: sum(requerimientos.map(r => r.costoLinea)),
    todosDisponibles: requerimientos.every(r => r.suficiente),
  };
}
```

---

## Sistema de Sincronización Offline

### Estrategia de Sincronización

**Ubicación**: `src/hooks/useSync.ts`

**Estados de sincronización:**
```typescript
type SyncStatus = 'synced' | 'syncing' | 'polling' | 'offline' | 'error';
```

**Flujo de sincronización:**

1. **Estado Online:**
   - Operaciones se envían directamente a Supabase
   - Datos se cachean en localStorage
   - Se actualiza estado a 'synced'

2. **Estado Offline:**
   - Operaciones se guardan en cola local
   - Se marcan como 'pending'
   - Se actualiza estado a 'offline'

3. **Reconexión:**
   - Se detecta conexión restaurada
   - Se procesan operaciones pendientes
   - Se resuelven conflictos (LWW - Last Write Wins)
   - Se actualiza estado a 'synced'

**Estructura de operaciones pendientes:**
```typescript
interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
}
```

**Manejo de conflictos:**
```typescript
const resolveConflict = (local: any, remote: any) => {
  // Estrategia: Last Write Wins
  if (local.timestamp > remote.timestamp) {
    return local; // Versión local gana
  }
  return remote; // Versión remota gana
};
```

---

## Sistema de Roles y Permisos

### Roles Definidos

```typescript
type UserRole = 'admin' | 'cajero' | 'gerente' | 'inventario';
```

### Matriz de Permisos

| Rol | Ventas | Caja | Reportes | Productos | Insumos | Compras | Clientes | Pedidos | Usuarios |
|-----|--------|------|----------|-----------|---------|---------|----------|---------|----------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| cajero | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| gerente | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| inventario | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Validación de Permisos

```typescript
const hasPermission = (role: UserRole, permission: string): boolean => {
  const rolePermissions = {
    admin: ['all'],
    cajero: ['ventas', 'caja'],
    gerente: ['ventas', 'caja', 'reportes', 'clientes', 'pedidos'],
    inventario: ['productos', 'insumos', 'compras', 'recetas'],
  };
  
  if (role === 'admin') return true;
  return rolePermissions[role]?.includes(permission) || false;
};
```

---

## Sistema de Recetas

### Estructura de Receta

```typescript
interface Receta {
  id: number;
  productoId: number;
  productoNombre: string;
  rendimientoBase: number;      // Cantidad de producto final
  instrucciones: string;
  ingredientes: RecetaIngrediente[];
  margenDeseado: number;       // Margen de ganancia (%)
}

interface RecetaIngrediente {
  id?: number;
  insumoId: number;
  insumoNombre: string;
  cantidadRequerida: number;
  unidadMedida: string;
}
```

### Cálculo de Costo de Producción

```typescript
calcularCostoProduccion(productoId: number, cantidad: number) {
  const receta = recetas.find(r => r.productoId === productoId);
  if (!receta) return null;
  
  const factor = cantidad / receta.rendimientoBase;
  const detalles = receta.ingredientes.map(ing => {
    const cantidadNecesaria = ing.cantidadRequerida * factor;
    const insumo = insumos.find(i => i.id === ing.insumoId);
    const costoLinea = cantidadNecesaria * (insumo?.costoUnitario || 0);
    const stockDisponible = insumo?.stock || 0;
    const suficiente = stockDisponible >= cantidadNecesaria;
    
    return {
      insumoNombre: ing.insumoNombre,
      cantidadNecesaria,
      unidad: ing.unidadMedida,
      costoLinea,
      stockDisponible,
      suficiente,
    };
  });
  
  const costoTotal = detalles.reduce((sum, d) => sum + d.costoLinea, 0);
  const todosDisponibles = detalles.every(d => d.suficiente);
  
  return {
    costoTotal,
    detalles,
    todosDisponibles,
  };
}
```

---

## Sistema de Logs y Auditoría

### Tipos de Logs

```typescript
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  userId: string;
  action: string;
  details: any;
  ip?: string;
  userAgent?: string;
}
```

### Eventos Registrados

**Eventos de seguridad:**
- Inicio de sesión (login)
- Cierre de sesión (logout)
- Intentos fallidos de autenticación
- Cambios de contraseña

**Eventos operativos:**
- Apertura/cierre de caja
- Ventas realizadas
- Ventas anuladas
- Cambios en inventario
- Registro de compras

**Eventos del sistema:**
- Errores de sincronización
- Errores de conexión
- Errores de API

### Implementación con Pino

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Uso
logger.info({ userId: '123', action: 'login' }, 'Usuario inició sesión');
logger.error({ error: err }, 'Error en sincronización');
```

---

## Configuración de Next.js

### next.config.mjs

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Configuración de webpack
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
  
  // Configuración de entorno
  env: {
    NEXT_PUBLIC_APP_NAME: 'Snack Roque POS',
  },
  
  // Optimizaciones
  swcMinify: true,
  compress: true,
};

export default nextConfig;
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## Testing y QA

### Estrategia de Testing

**Unit Testing:**
- Pruebas de hooks personalizados
- Pruebas de utilidades
- Pruebas de validación

**Integration Testing:**
- Pruebas de API routes
- Pruebas de sincronización
- Pruebas de integración con Supabase

**E2E Testing:**
- Flujos completos de ventas
- Flujos de caja
- Flujos de pedidos

### Casos de Prueba

**Pruebas de POS:**
- Agregar producto al carrito
- Cambiar cantidad de producto
- Eliminar producto del carrito
- Completar venta con diferentes métodos de pago
- Anular venta

**Pruebas de Caja:**
- Apertura de caja con monto inicial
- Registro de retiros
- Cierre de caja con arqueo correcto
- Cierre de caja con diferencia

**Pruebas de Inventario:**
- Crear producto
- Actualizar stock
- Eliminar producto
- Alertas de stock bajo

---

## Optimizaciones de Rendimiento

### Lazy Loading de Componentes

```typescript
import dynamic from 'next/dynamic';

const ReportesPage = dynamic(
  () => import('@/app/dashboard/reportes/page'),
  { loading: () => <div>Cargando reportes...</div> }
);
```

### Memoización de Componentes

```typescript
import { memo } from 'react';

const ProductCard = memo(({ product, onAdd }) => {
  // Solo se re-renderiza si product cambia
  return <div>{product.name}</div>;
});
```

### Optimización de Consultas

```typescript
// Usar select para obtener solo campos necesarios
const { data } = await supabase
  .from('sales')
  .select('id, total, date, method')
  .eq('estado', 1)
  .order('date', { ascending: false });
```

### Caching de Datos

```typescript
// Caché en localStorage
const cacheKey = `products_${Date.now()}`;
const cached = localStorage.getItem(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

// Fetch y guardar en caché
const data = await fetchProducts();
localStorage.setItem(cacheKey, JSON.stringify(data));
```

---

## Seguridad Avanzada

### Validación de Inputs

```typescript
const validateSale = (sale: Sale) => {
  if (!sale.items || sale.items.length === 0) {
    throw new Error('La venta debe tener al menos un item');
  }
  
  if (sale.total <= 0) {
    throw new Error('El total debe ser mayor a 0');
  }
  
  if (!sale.method) {
    throw new Error('Debe seleccionar un método de pago');
  }
  
  return true;
};
```

### Sanitización de Datos

```typescript
const sanitizeSale = (sale: Sale) => {
  return {
    ...sale,
    items: sale.items.map(item => ({
      ...item,
      name: item.name.replace(/[<>]/g, ''), // Remover caracteres peligrosos
    })),
  };
};
```

### Row Level Security (RLS) en Supabase

```sql
-- Política para ventas: solo usuarios autenticados pueden ver
CREATE POLICY "users_can_view_sales"
ON sales FOR SELECT
TO authenticated
USING (true);

-- Política para ventas: solo cajeros pueden insertar
CREATE POLICY "cajeros_can_insert_sales"
ON sales FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND 'cajero' = ANY(users.roles)
  )
);
```

### Rate Limiting

```typescript
const rateLimit = new Map();

const checkRateLimit = (userId: string, maxRequests: number, windowMs: number) => {
  const now = Date.now();
  const userRequests = rateLimit.get(userId) || [];
  
  // Filtrar requests fuera de ventana
  const validRequests = userRequests.filter(t => now - t < windowMs);
  
  if (validRequests.length >= maxRequests) {
    throw new Error('Rate limit exceeded');
  }
  
  validRequests.push(now);
  rateLimit.set(userId, validRequests);
};
```

---

## Sistema de Categorías

### Estructura de Categoría

```typescript
interface Category {
  id: number;
  name: string;
  active: boolean;
}
```

### Funcionalidades

- **CRUD de categorías**: Crear, leer, actualizar, eliminar categorías
- **Asignación a productos**: Cada producto pertenece a una categoría
- **Filtrado**: Filtrado de productos por categoría en POS
- **Activación/Desactivación**: Control de visibilidad de categorías

### Relación con Productos

```typescript
// Un producto pertenece a una categoría
interface Product {
  id: number;
  name: string;
  cat: string;  // Nombre de la categoría
  // ...
}
```

---

## Sistema de Métodos de Pago

### Estructura de Método de Pago

```typescript
interface PaymentMethod {
  id: number;
  name: string;        // "Efectivo", "Yape", "Plin", "Tarjeta"
  desc: string;        // Descripción del método
  active: boolean;     // Método activo/inactivo
}
```

### Métodos Implementados

| Método | ID | Descripción | Uso |
|--------|-----|-------------|-----|
| Efectivo | 1 | Pago en efectivo físico | Caja, arqueo |
| Yape | 2 | Transferencia Yape | QR, confirmación |
| Plin | 3 | Transferencia Plin | QR, confirmación |
| Tarjeta | 4 | Tarjeta de crédito/débito | Datáfono |
| Crédito | 5 | Crédito de cliente | Sistema de créditos |

### Flujo de Pago

1. Cliente selecciona método de pago
2. Sistema valida método activo
3. Si es efectivo: se suma a caja
4. Si es digital: se espera confirmación
5. Si es crédito: se registra en cuenta del cliente
6. Se completa la venta

---

## Sistema de Créditos de Clientes

### Estructura de Crédito

```typescript
interface Client {
  id: uuid;
  nombre: string;
  saldo_credito: number;  // Saldo actual (positivo = debe)
  limite_credito: number; // Límite máximo de crédito
  active: boolean;
}

interface CreditPayment {
  id: uuid;
  cliente_id: uuid;
  monto: number;
  fecha: timestamp;
  metodo_pago: string;
}
```

### Funcionalidades

- **Registro de créditos**: Al vender a crédito, se suma al saldo del cliente
- **Pagos de créditos**: Registro de abonos a cuenta
- **Límite de crédito**: Validación de límite antes de vender a crédito
- **Estado de cuenta**: Historial de transacciones de crédito
- **Alertas**: Notificación cuando cliente excede límite

### Validación de Crédito

```typescript
const validarCredito = (cliente: Client, montoVenta: number) => {
  if (!cliente.active) {
    throw new Error('Cliente inactivo');
  }
  
  const nuevoSaldo = cliente.saldo_credito + montoVenta;
  if (nuevoSaldo > cliente.limite_credito) {
    throw new Error('Excede límite de crédito');
  }
  
  return true;
};
```

---

## Sistema de Producción y Descarte de Panes

### BreadLog (Registro de Pan)

```typescript
interface BreadLog {
  id: number;
  productId: number;
  productName: string;
  version?: string;
  qty: number;          // Cantidad producida/descartada
  type: 'production' | 'discard';
  reason?: string;      // Razón del descarte
  timestamp: timestamp;
  userId: uuid;
}
```

### Tipos de Movimientos

**Producción:**
- Registro de panes horneados
- Aumento de stock de producto
- Registro en historial de producción

**Descarte:**
- Registro de panes vencidos/dañados
- Disminución de stock de producto
- Registro de razón (vencido, quemado, etc.)

### Flujo de Producción

1. Panadero registra producción
2. Selecciona producto y versión
3. Ingresa cantidad producida
4. Se actualiza stock del producto
5. Se registra en breadLogs
6. Se actualiza en Supabase

### Flujo de Descarte

1. Panadero registra descarte
2. Selecciona producto y versión
3. Ingresa cantidad descartada
4. Selecciona razón (vencido, quemado, etc.)
5. Se valida stock disponible
6. Se actualiza stock del producto
7. Se registra en breadLogs
8. Se actualiza en Supabase

---

## Configuración de Tailwind CSS

### tailwind.config.mjs

```javascript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#B07D2E',  // Color dorado/marrón de marca
          secondary: '#FFF8E7', // Beige claro
          dark: '#2D2D2D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

### Clases Utilizadas

**Layout:**
- `flex`, `grid`, `flex-col`, `grid-cols-3`
- `p-4`, `m-2`, `gap-4`
- `w-full`, `h-screen`

**Colores:**
- `bg-brand-primary`, `text-brand-primary`
- `bg-white`, `bg-gray-100`
- `text-gray-900`, `text-gray-600`

**Componentes:**
- `rounded-lg`, `shadow-md`
- `border`, `border-gray-200`
- `hover:bg-gray-50`, `focus:ring-2`

---

## Sistema de Notificaciones

### Tipos de Notificaciones

**WhatsApp:**
- Pedido listo para entrega
- Confirmación de reserva
- Recordatorio de pago
- Promociones especiales

**Email:**
- OTP de verificación
- Recuperación de contraseña
- Estado de cuenta mensual
- Confirmación de pedido

### Flujo de Notificación WhatsApp

1. Evento activa notificación (pedido listo)
2. Sistema busca teléfono del cliente
3. Genera mensaje personalizado
4. Envía vía Baileys API
5. Registra envío en logs
6. Maneja errores de envío

### Plantillas de Mensajes

```typescript
const whatsappTemplates = {
  pedidoListo: (nombre: string, pedidoId: string) => 
    `Hola ${nombre}, tu pedido #${pedidoId} está listo para retirar. ¡Gracias por tu preferencia!`,
  
  confirmacionReserva: (nombre: string, fecha: string) =>
    `Hola ${nombre}, confirmamos tu reserva para el ${fecha}. Te notificaremos cuando esté listo.`,
  
  recordatorioPago: (nombre: string, monto: number) =>
    `Hola ${nombre}, recordatorio: tienes un saldo pendiente de S/. ${monto.toFixed(2)}. Por favor realiza tu pago.`,
};
```

---

## Sistema de Búsqueda y Filtrado

### Búsqueda de Productos

```typescript
const searchProducts = (query: string, products: Product[]) => {
  const lowerQuery = query.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.cat.toLowerCase().includes(lowerQuery)
  );
};
```

### Filtrado de Ventas

```typescript
interface SaleFilters {
  dateFrom?: Date;
  dateTo?: Date;
  method?: string;
  cajero?: string;
  estado?: number;
}

const filterSales = (sales: Sale[], filters: SaleFilters) => {
  return sales.filter(s => {
    if (filters.dateFrom && new Date(s.date) < filters.dateFrom) return false;
    if (filters.dateTo && new Date(s.date) > filters.dateTo) return false;
    if (filters.method && s.method !== filters.method) return false;
    if (filters.cajero && s.cajero !== filters.cajero) return false;
    if (filters.estado !== undefined && s.estado !== filters.estado) return false;
    return true;
  });
};
```

---

## Sistema de Impresión

### Comprobante de Venta

```typescript
interface ComprobanteVenta {
  numeroBoleta: number;
  fecha: Date;
  hora: string;
  cajero: string;
  cliente?: string;
  items: CartItem[];
  subtotal: number;
  igv: number;
  total: number;
  metodoPago: string;
}
```

### Formato de Impresión

```
╔════════════════════════════════════════╗
║         SNACK ROQUE - PANADERÍA         ║
╠════════════════════════════════════════╣
║ Boleta: #1234                           ║
║ Fecha: 20/07/2026  14:30               ║
║ Cajero: Juan Pérez                      ║
╠════════════════════════════════════════╣
║ CANT  PRODUCTO          PRECIO    TOTAL ║
║   2   Pan Chico        S/.2.00   S/.4.00 ║
║   1   Pan Grande       S/.5.00   S/.5.00 ║
╠════════════════════════════════════════╣
║ Subtotal:                      S/.9.00 ║
║ IGV (18%):                     S/.1.62 ║
║ TOTAL:                         S/.10.62 ║
╠════════════════════════════════════════╣
║ Método: Efectivo                        ║
╚════════════════════════════════════════╝
```

---

## Guía de Desarrollo

### Configuración del Entorno

1. **Clonar el repositorio**
```bash
git clone <repo-url>
cd panaderia-prototipos
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
Crear archivo `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
RESEND_API_KEY=tu_resend_api_key
RESEND_FROM_EMAIL=noreply@tudominio.com
WHATSAPP_PHONE_NUMBER=51999999999
```

4. **Ejecutar en desarrollo**
```bash
npm run dev
```

### Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run dev:turbo        # Iniciar con Turbopack (más rápido)
npm run dev:clean        # Limpiar caché y iniciar

# Producción
npm run build            # Compilar para producción
npm run start            # Iniciar servidor de producción

# Utilidades
npm run clean            # Limpiar caché .next
npm run lint             # Ejecutar ESLint
npm run docs             # Generar documentación TypeDoc
```

### Convenciones de Código

#### Nomenclatura

- **Componentes**: PascalCase (`ProductCard.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useAuth.ts`)
- **Funciones**: camelCase (`calculateTotal()`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_ITEMS`)
- **Tipos/Interfaces**: PascalCase (`User`, `Sale`)

#### Estructura de Componente

```typescript
"use client"; // Para componentes del lado del cliente

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';

export default function ComponentName() {
  // 1. Hooks
  const { data, function } = useApp();
  const [state, setState] = useState(initialValue);

  // 2. Efectos
  useEffect(() => {
    // Lógica de efecto
  }, [dependencies]);

  // 3. Handlers
  const handleClick = () => {
    // Lógica del handler
  };

  // 4. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

#### Tipado TypeScript

```typescript
// Interfaces para datos
interface Product {
  id: number;
  name: string;
  price: number;
}

// Tipos para props
interface ComponentProps {
  product: Product;
  onEdit: (id: number) => void;
}

// Tipos para funciones
type Handler = (id: number) => void;
```

### Agregar Nueva Funcionalidad

1. **Definir tipos** en `src/context/types.ts`
2. **Crear hook** en `src/hooks/useNewFeature.ts`
3. **Agregar funciones** en `src/context/AppContext.tsx`
4. **Crear página** en `src/app/dashboard/new-feature/page.tsx`
5. **Actualizar base de datos** si es necesario
6. **Probar funcionalidad**

### Debugging

#### Logs

```typescript
// Usar console.log para debugging
console.log('Debug info:', data);

// En producción, usar pino
import pino from 'pino';
const logger = pino();
logger.info({ data }, 'Debug info');
```

#### React DevTools

- Instalar React DevTools en el navegador
- Inspeccionar componentes y estado
- Verificar props y context

#### Network Tab

- Verificar llamadas a API
- Revisar payloads y responses
- Identificar errores de red

---

## Deploy y Configuración

### Deploy en Vercel

1. **Conectar repositorio a Vercel**
2. **Configurar variables de entorno** en Vercel
3. **Deploy automático** al hacer push a main

### Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Key anónima de Supabase | `eyJhbGc...` |
| `RESEND_API_KEY` | API Key de Resend | `re_xxx...` |
| `RESEND_FROM_EMAIL` | Email de origen | `noreply@panaderia.com` |
| `WHATSAPP_PHONE_NUMBER` | Número WhatsApp | `51999999999` |

### Configuración de Supabase

1. **Crear proyecto** en Supabase
2. **Ejecutar schema** desde `supabase_schema.sql`
3. **Configurar RLS** (Row Level Security)
4. **Obtener URL y keys**
5. **Configurar en `.env`**

### Configuración de WhatsApp

1. **Obtener número de WhatsApp Business**
2. **Escanear QR** desde la aplicación
3. **Guardar credenciales** en almacenamiento seguro
4. **Configurar webhooks** si es necesario

---

## Troubleshooting

### Errores Comunes

#### Error: "Module not found"

**Solución:**
```bash
npm install
# O instalar dependencia específica
npm install nombre-paquete
```

#### Error: "Supabase connection failed"

**Solución:**
- Verificar variables de entorno
- Verificar conexión a internet
- Revisar configuración de Supabase

#### Error: "WhatsApp connection failed"

**Solución:**
- Verificar número de teléfono
- Reescanear código QR
- Revisar logs de conexión

#### Error: "Excel export failed"

**Solución:**
- Verificar carga de ExcelJS
- Revisar datos a exportar
- Verificar navegador compatible

### Performance

#### Optimización de Imágenes

```typescript
// Usar next/image para optimización
import Image from 'next/image';

<Image
  src="/path/to/image.jpg"
  alt="Descripción"
  width={500}
  height={300}
  loading="lazy"
/>
```

#### Lazy Loading de Componentes

```typescript
// Cargar componentes bajo demanda
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(
  () => import('./HeavyComponent'),
  { loading: () => <p>Cargando...</p> }
);
```

### Seguridad

#### Validación de Datos

```typescript
// Validar inputs del usuario
const validateInput = (value: string) => {
  if (!value || value.length > 100) {
    throw new Error('Input inválido');
  }
  return value;
};
```

#### Sanitización

```typescript
// Sanitizar datos antes de guardar
const sanitizeData = (data: any) => {
  // Eliminar campos sensibles
  const { password, ...safeData } = data;
  return safeData;
};
```

---

## Apéndices

### A. Referencias

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### B. Glosario

- **POS**: Point of Sale (Punto de Venta)
- **KPI**: Key Performance Indicator (Indicador Clave de Desempeño)
- **SKU**: Stock Keeping Unit (Unidad de Mantenimiento de Inventario)
- **IGV**: Impuesto General a las Ventas (Perú)
- **OTP**: One-Time Password (Contraseña de un solo uso)
- **RLS**: Row Level Security (Seguridad a nivel de fila)

### C. Changelog

#### Versión 0.1.0
- Implementación de POS básico
- Gestión de inventario
- Sistema de caja
- Reportes en Excel y PDF
- Integración WhatsApp

### D. Soporte

Para reportar bugs o solicitar features:
- Crear issue en GitHub
- Contactar al equipo de desarrollo
- Revisar documentación existente

---

**Última actualización**: Julio 2026
**Versión**: 0.1.0
**Autores**: Equipo de Desarrollo Panadería Prototipos
