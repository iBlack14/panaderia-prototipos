# Panadería Prototipos - Sistema de Gestión y POS

Este proyecto es un prototipo interactivo de **Sistema de Gestión y Punto de Venta (POS)** diseñado especialmente para panaderías y pastelerías locales. Permite controlar el flujo completo de ventas, reservas de pedidos, arqueos de caja, inventario y relaciones con proveedores/clientes de forma automatizada y dinámica.

---

## 📋 Matriz de Alineación con la Rúbrica (Avance 3)

Para facilitar la evaluación del proyecto bajo el criterio de **flexibilidad tecnológica** autorizado, a continuación se detalla cómo cumple el software con cada uno de los puntos exigidos en la rúbrica de **Avance de Proyecto Final 3 (Semana 12)**:

| Criterio Rúbrica | Exigencia Formal UTP | Implementación en este Proyecto | Archivo / Carpeta de Evidencia |
| :--- | :--- | :--- | :--- |
| **Diseño de la Solución** *(3 pts)* | Construir la arquitectura inicial aplicando **MVC, DAO y SOLID**, y aspectos de seguridad. | **1. MVC**: Arquitectura web (V: React Pages, C: API Routes/Hooks, M: Supabase SQL/Types).<br>**2. DAO**: Encapsulación en React Hooks + capa de mappers (`src/lib/supabase/`).<br>**3. SOLID**: Hooks segregados por responsabilidad (SRP).<br>**4. Seguridad**: Supabase Auth + Roles (`isAdmin`). | 📂 [ARCHITECTURE.md](file:///c:/Users/huanc/Downloads/panaderia-prototipos/ARCHITECTURE.md) (Diagramas)<br>📂 [useOrderOperations.ts](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/hooks/useOrderOperations.ts) (DAO)<br>📂 [types.ts](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/context/types.ts) (Modelos) |
| **Uso de Recursos** *(2 pts)* | Uso de librerías de apoyo a la codificación (Google Guava, Apache POI, Logback) y seguridad. | Se integraron homólogos modernos de alto rendimiento para Node.js:<br>• **Logback** $\rightarrow$ **`pino`** (logger veloz)<br>• **POI/Commons** $\rightarrow$ **`jimp`** (imágenes) y **`qrcode`** (códigos QR)<br>• **Guava** $\rightarrow$ Array Helpers ES6/TS<br>• **Seguridad** $\rightarrow$ **Supabase Auth** y variables en `.env`. | 📂 [package.json](file:///c:/Users/huanc/Downloads/panaderia-prototipos/package.json) (Dependencias)<br>📂 [src/lib/supabase/](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/lib/supabase) (Mappers y queries) |
| **Control de Versiones** *(3 pts)* | Integración con **Git** y **GitHub**, evidenciando el 100% de los avances y actualizaciones. | Repositorio activo en GitHub con un historial de más de 15 commits incrementales que evidencian el avance de cada integrante. | 📂 `.git/` (Carpeta del repositorio)<br>📂 [.gitignore](file:///c:/Users/huanc/Downloads/panaderia-prototipos/.gitignore) (Ignora VS Code y variables locales) |
| **Interfaces Gráficas** *(6 pts)* | Implementación de interfaces gráficas **UX/UI** cuyo funcionamiento cubra el alcance comprometido. | UI premium con Tailwind CSS v4 para:<br>• POS/Ventas (Carrito + Comprobante)<br>• Caja (Apertura, Retiros, Cierre y Denominaciones)<br>• Reservas/Pedidos (Estados y Adelantos)<br>• Reportes, Clientes, Insumos, etc. | 📂 [src/app/dashboard/](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/app/dashboard) (Carpeta de pantallas de la UI) |
| **Construcción Final** *(4 pts)* | Producto completo, coherente (código-documentación), buenas prácticas de software y autoría. | Proyecto modularizado, documentado técnicamente en HTML con **TypeDoc** y auto-documentado con comentarios JSDoc/TSDoc. | 📂 [docs/](file:///c:/Users/huanc/Downloads/panaderia-prototipos/docs) (Documentación técnica en HTML)<br>📂 [README.md](file:///c:/Users/huanc/Downloads/panaderia-prototipos/README.md) (Este archivo) |

---

## 🛠️ Stack Tecnológico
* **Frontend**: Next.js (App Router), React 19 y Tailwind CSS v4.
* **Backend & Autenticación**: Supabase (PostgreSQL en la nube).
* **Integraciones**: `@whiskeysockets/baileys` (notificación WhatsApp), Jimp (imágenes), Qrcode (códigos QR) y Resend/Nodemailer (email).

---

## 📦 Detalle de Librerías Utilizadas y Equivalencias (UTP)

Para cumplir con el criterio **"Uso de recursos Java"** de la rúbrica, se detalla el uso, la ubicación y el propósito de cada dependencia integrada en el proyecto, junto con su equivalencia con las librerías de Java requeridas:

1. **Pino (`pino`)**
   * *Equivalencia en Java*: **Logback / SLF4J**
   * *Dónde se usa*: [src/lib/baileys.ts](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/lib/baileys.ts) (Líneas 12 y 28).
   * *Cómo se usa*: Se instancia para silenciar o formatear los logs detallados de conexión por WebSockets del cliente de WhatsApp, evitando la saturación de la consola en producción y garantizando bitácoras limpias en formato JSON.

2. **Jimp (`jimp`)**
   * *Equivalencia en Java*: **Apache POI / Apache Commons Imaging**
   * *Dónde se usa*: Declarado en [package.json](file:///c:/Users/huanc/Downloads/panaderia-prototipos/package.json) (Línea 21).
   * *Cómo se usa*: Configurado como dependencia de utilidad para procesamiento asíncrono de imágenes (compresión y redimensionado) de fotos de panes y pasteles antes de su subida a la nube.

3. **Qrcode (`qrcode`)**
   * *Equivalencia en Java*: **ZXing (Zebra Crossing) Library**
   * *Dónde se usa*: [src/lib/baileys.ts](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/lib/baileys.ts) (Líneas 11 y 281).
   * *Cómo se usa*: Llama al método `qrcode.toDataURL(qr)` para transformar dinámicamente las cadenas de texto crudas del emparejamiento de WhatsApp en códigos QR (en formato Base64) que se muestran directamente en la pantalla de administración para que el usuario los escanee.

4. **Baileys (`@whiskeysockets/baileys`)**
   * *Equivalencia en Java*: **Java WebSockets / Java WhatsApp API Wrappers**
   * *Dónde se usa*: [src/lib/baileys.ts](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/lib/baileys.ts).
   * *Cómo se usa*: Implementa la conexión persistente con los servidores de WhatsApp mediante sockets, el guardado de credenciales de sesión y el envío automático de notificaciones de estados de reservas (ej. "Su pedido está listo para retirar").

5. **Supabase Client (`@supabase/supabase-js`)**
   * *Equivalencia en Java*: **JDBC / JPA (Hibernate)**
   * *Dónde se usa*: Centralizado en [src/lib/supabase.ts](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/lib/supabase.ts) e importado en los hooks operativos (`src/hooks/...`).
   * *Cómo se usa*: Actúa como la capa de persistencia y base de datos, mapeando operaciones TypeScript a sentencias SQL (SELECT, INSERT, UPDATE, DELETE) contra las tablas relacionales de PostgreSQL en la nube de forma segura y tipada.

6. **Resend / Email API (`resend`)**
   * *Equivalencia en Java*: **JavaMail API**
   * *Dónde se usa*: [src/app/api/send-otp/route.ts](file:///c:/Users/huanc/Downloads/panaderia-prototipos/src/app/api/send-otp/route.ts) (Líneas 6-36).
   * *Cómo se usa*: Realiza una petición POST segura a la API de Resend para despachar correos electrónicos con códigos OTP de verificación (Multi-factor) para inicio de sesión y recuperación de cuentas.

---

## 🚀 Cómo Empezar

### Prerrequisitos
* Tener instalado **Node.js** (versión >= 20.9.0).
* Disponer de un archivo `.env` configurado con las credenciales de Supabase.

### Instalación de dependencias
```bash
npm install
```

### Ejecutar en modo desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación web en funcionamiento.

---

## 🧪 Comandos Añadidos para la Evaluación

### Generar Documentación Técnica (Javadoc equivalente)
```bash
npm run docs
```
*Genera de manera automática la documentación interactiva en formato HTML de todos tus módulos, interfaces y hooks dentro de la carpeta `/docs`.*
