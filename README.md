# Panadería Prototipos - Sistema de Gestión y POS

Este proyecto es un prototipo interactivo de **Sistema de Gestión y Punto de Venta (POS)** diseñado especialmente para panaderías y pastelerías locales. Permite controlar el flujo completo de ventas, reservas de pedidos, arqueos de caja, inventario y relaciones con proveedores/clientes de forma automatizada y dinámica.

---

## 🛠️ Stack Tecnológico
El proyecto está desarrollado utilizando una arquitectura full-stack moderna y ágil:

* **Frontend**: [Next.js (App Router)](https://nextjs.org/) con [React 19](https://react.dev/) y [Tailwind CSS v4](https://tailwindcss.com/) para una UI/UX moderna y responsiva.
* **Backend & Autenticación**: [Supabase](https://supabase.com/) (PostgreSQL en la nube) para el almacenamiento de datos, control de usuarios y políticas de seguridad.
* **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) para asegurar la robustez, tipado estricto de datos y orden en el código.
* **Servicios de Terceros**:
  * [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) para el envío automatizado de notificaciones de pedidos por WhatsApp.
  * Resend / Nodemailer para notificaciones automáticas por correo electrónico.
  * Consulta integrada de DNI y control de líneas de crédito de clientes.

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

## 🧪 Comandos y Herramientas Añadidas (Rúbrica Final 3)

### 1. Pruebas Unitarias (TDD)
Se ha integrado **Vitest** para la ejecución de pruebas unitarias sobre las funciones lógicas de la aplicación (como transacciones, inventario y estados de pedidos):
* **Ejecutar pruebas en una única ejecución**:
  ```bash
  npm run test
  ```
* **Ejecutar pruebas en modo interactivo/vigía (watch)**:
  ```bash
  npm run test:watch
  ```

### 2. Generación de Documentación Técnica
Se configuró **TypeDoc** para generar de manera automatizada documentación HTML técnica y estructurada a partir de los comentarios de TypeScript:
* **Generar documentación**:
  ```bash
  npm run docs
  ```
  Esto generará una carpeta llamada `/docs` en la raíz. Abre `docs/index.html` en cualquier navegador web para revisar el glosario técnico.

### 3. Diagramas de Arquitectura
Para revisar cómo se mapea este proyecto a los patrones exigidos por la universidad (**MVC**, **DAO** y **SOLID**), consulta el archivo especializado:
👉 **[ARCHITECTURE.md](file:///c:/Users/huanc/Downloads/panaderia-prototipos/ARCHITECTURE.md)**

---

## 📁 Estructura del Código

* `/src/app`: Rutas del frontend (Views) y endpoints API (Controllers).
  * `/dashboard`: Paneles de administración (POS, Caja, Productos, Clientes, Reportes).
  * `/api`: Rutas de servidor encargadas del envío de OTP, DNI y WhatsApp.
* `/src/context`: Capa de estado global (`AppContext.tsx`) y definición estricta de interfaces (`types.ts`).
* `/src/hooks`: Funciones de lógica de negocio y llamadas a la base de datos (equivalente a la **Capa DAO**).
* `/src/lib`: Clientes de conexión e integraciones externas (Supabase, Baileys).
