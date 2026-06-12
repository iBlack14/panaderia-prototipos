# Arquitectura del Proyecto - Panadería Prototipos

Este documento detalla la arquitectura técnica de la aplicación, mapeando las tecnologías modernas utilizadas (Next.js, TypeScript y Supabase) a los patrones de diseño clásicos exigidos por la rúbrica (**MVC**, **DAO** y **SOLID**). Puedes utilizar estos diagramas y explicaciones para tu informe y tus diapositivas de sustentación oral.

---

## 1. Arquitectura MVC (Modelo-Vista-Controlador)
En una aplicación web moderna orientada a componentes y API REST/Serverless, el patrón MVC se adapta de la siguiente manera:

* **Modelo (M)**: La base de datos relacional (PostgreSQL) alojada en Supabase y las definiciones de tipos TypeScript (`types.ts`) que modelan los datos de la panadería.
* **Vista (V)**: Páginas del Dashboard de administración (`src/app/dashboard/...`) escritas en React/TailwindCSS, que renderizan la interfaz para el usuario de manera interactiva.
* **Controlador (C)**: Rutas API (`src/app/api/...`) que manejan las peticiones del frontend, aplican validaciones de seguridad (como autenticación y DNI) y procesan la lógica del negocio.

```mermaid
graph TD
    subgraph VISTA (React Components)
        V[Dashboard Pages / POS / Caja]
    end

    subgraph CONTROLADOR (Next.js APIs & Hooks)
        C[API Routes /api/send-otp]
        H[Custom React Hooks: useOrderOperations]
    end

    subgraph MODELO (Data Layer)
        M_TS[Tipos de Datos TypeScript: types.ts]
        M_DB[(Supabase PostgreSQL Database)]
    end

    V -->|1. Interacción del Usuario / Eventos| H
    H -->|2. Envía Petición HTTP / Fetch| C
    C -->|3. Consulta / Escribe datos| M_DB
    M_DB -->|4. Retorna filas / JSON| C
    C -->|5. Retorna respuesta JSON| H
    H -->|6. Actualiza Estado React / Tipos| M_TS
    M_TS -->|7. Re-renderiza con nuevos datos| V
```

---

## 2. Implementación del Patrón DAO (Data Access Object)
El patrón DAO aísla la lógica de acceso a datos del comportamiento del negocio y la interfaz de usuario.
* En lugar de clases DAO clásicas de Java con JDBC/JPA, el proyecto encapsula el acceso a la persistencia (Supabase / LocalStorage) en **Hooks Personalizados de React**.
* Los componentes visuales (como `PedidosPage`) nunca hacen peticiones directamente a la base de datos; consumen las funciones expuestas por la capa de acceso a datos de los Hooks.

```mermaid
classDiagram
    class ClienteReact {
        <<Componente Vista>>
        +PedidosPage()
        +VentasPage()
    }
    
    class AppContext {
        <<Capa de Contexto Global>>
        +user: User
        +pedidos: Pedido[]
        +sales: Sale[]
        +toastMsg: string
    }

    class useOrderOperations {
        <<Capa DAO / Lógica de Acceso>>
        +savePedido(pedidoObj)
        +updatePedidoStatus(pedidoId, nuevoEstado)
        +registerPurchase(pObj)
        +processReturn(saleId, items)
    }

    class SupabaseClient {
        <<Persistencia en Nube>>
        +from(table)
        +insert()
        +update()
    }

    class LocalStorage {
        <<Persistencia Local>>
        +getItem(key)
        +setItem(key, val)
    }

    ClienteReact ..> AppContext : Consume Estado/Acciones
    AppContext --> useOrderOperations : Integra Lógica DAO
    useOrderOperations --> SupabaseClient : Sincroniza en Nube (Online)
    useOrderOperations --> LocalStorage : Respalda Localmente (Offline)
```

---

## 3. Principios SOLID Aplicados
En una arquitectura moderna basada en Hooks y TypeScript, los principios SOLID se evidencian en el diseño modular:

### A. SRP (Single Responsibility Principle - Principio de Responsabilidad Única)
La lógica de negocio y estado global no se concentran en un único archivo gigante. Cada módulo operativo tiene su propio Hook con una responsabilidad única y aislada:
* `useAuthOperations.ts`: Gestión exclusiva de sesiones y control de acceso.
* `useInventoryOps.ts`: Gestión del catálogo de panes, stock y kardex.
* `useCartOperations.ts`: Lógica del carrito de compras y POS.
* `useCashOperations.ts`: Control de flujo de dinero, turnos y arqueos de caja.
* `useOrderOperations.ts`: Gestión de reservas, compras de insumos y devoluciones.

```mermaid
graph LR
    AppContext[AppContext.tsx] --> useAuthOperations[useAuthOperations: Seguridad]
    AppContext --> useInventoryOps[useInventoryOps: Inventario]
    AppContext --> useCartOperations[useCartOperations: POS y Carrito]
    AppContext --> useCashOperations[useCashOperations: Caja y Arqueo]
    AppContext --> useOrderOperations[useOrderOperations: Reservas y Compras]
```

### B. ISP (Interface Segregation Principle - Principio de Segregación de Interfaces)
Las interfaces de TypeScript en `src/context/types.ts` definen contratos de datos específicos y delgados para cada entidad en lugar de interfaces genéricas sobrecargadas. Cada componente o función importa únicamente el tipo que necesita utilizar.
* `Product` y `ProductVersion` están segregados para modelar productos estándar y variantes.
* `CashSession` e `HistoryRecord` separan la caja activa de la auditoría histórica.

---

## 📝 Anexo B: Documentación Técnica de Conexión de Ventas a Supabase

En la arquitectura del prototipo, la transacción de ventas conecta el frontend (React) con el backend serverless (Base de datos PostgreSQL en Supabase) a través de TypeScript utilizando una estructura de persistencia transaccional y relacional.

### Flujo Técnico del Proceso de Ventas

El guardado de una transacción de ventas se realiza dentro de la función `checkoutCart` del controlador del carrito (`src/hooks/useCartOperations.ts`), operando bajo el siguiente flujo:

1. **Recopilación y Cálculos del Frontend**:
   * Al confirmar la venta en el POS, se captura el estado del carrito (`cart`) y el método de pago seleccionado (`paymentMethodId`).
   * Se calculan los montos transaccionales:
     * **Subtotal**: Suma del precio por cantidad de cada producto.
     * **IGV (18%)**: Impuesto a las ventas sobre el subtotal.
     * **Total**: Suma de Subtotal + IGV.

2. **Inserción de Cabecera (`ventas`)**:
   * Se envía una petición HTTP `POST` asíncrona mediante el cliente de Supabase para insertar un registro en la tabla `ventas` representando la cabecera del comprobante:
     ```typescript
     const { data: vData } = await supabase.from('ventas').insert({
       id_cliente: clienteId || null,
       id_usuario: user?.id,
       id_cierre_caja: activeSession.id,
       id_metodo_pago: paymentMethodId,
       sub_total: sub,
       igv,
       tot_pago: tot
     }).select().single();
     ```
   * Supabase procesa la sentencia en la base de datos PostgreSQL, genera una llave primaria secuencial (`id_venta`) y retorna el objeto insertado (`vData`).

3. **Inserción de Detalles (`detalle_venta`)**:
   * Tras recuperar la cabecera (`id_venta`), se mapea el arreglo del carrito en memoria para preparar múltiples filas que representan los productos vendidos:
     ```typescript
     const detailRows = cart.map(item => ({
       id_venta: vData.id_venta,
       id_producto: item.id,
       id_version: item.versionId || null,
       num_cantidad: item.qty,
       precio_unitario: item.price
     }));
     ```
   * Se ejecuta una inserción en lote (bulk insert) a la tabla relacional `detalle_venta` vinculada por llave foránea a la cabecera:
     ```typescript
     await supabase.from('detalle_venta').insert(detailRows);
     ```

4. **Sincronización del Estado Local**:
   * Tras la persistencia exitosa en Supabase, el hook actualiza el estado global de React llamando a `setSales` y limpiando el carrito localmente (`setCart([])`).
   * Se registra el movimiento en el Kardex local/historial (`snack_bread_logs`) para la auditoría de stock.

