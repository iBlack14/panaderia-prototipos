-- ============================================================
-- SUPABASE SCHEMA - PANADERÍA SNACK ROQUE (FINAL DEPLOY)
-- ============================================================
-- Ejecutar este script en el SQL Editor de tu proyecto Supabase.
-- Este script realiza una instalación/reinstalación limpia desde 0.
-- ORDEN: DROP → CREATE TABLES → TRIGGERS → RLS → SEED DATA
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. LIMPIEZA COMPLETA (DROP en orden inverso de dependencias)
-- ============================================================
DROP TABLE IF EXISTS public.produccion_descarte  CASCADE;
DROP TABLE IF EXISTS public.whatsapp_baileys_auth CASCADE;
DROP TABLE IF EXISTS public.detalle_compra        CASCADE;
DROP TABLE IF EXISTS public.compras               CASCADE;
DROP TABLE IF EXISTS public.detalle_venta         CASCADE;
DROP TABLE IF EXISTS public.ventas                CASCADE;
DROP TABLE IF EXISTS public.cierres_caja          CASCADE;
DROP TABLE IF EXISTS public.producto_versiones    CASCADE;
DROP TABLE IF EXISTS public.productos             CASCADE;
DROP TABLE IF EXISTS public.proveedores           CASCADE;
DROP TABLE IF EXISTS public.clientes              CASCADE;
DROP TABLE IF EXISTS public.metodos_pago          CASCADE;
DROP TABLE IF EXISTS public.categorias            CASCADE;
DROP TABLE IF EXISTS public.profiles              CASCADE;
DROP TABLE IF EXISTS public.roles                 CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user()        CASCADE;
DROP FUNCTION IF EXISTS fn_descontar_stock_venta()      CASCADE;
DROP FUNCTION IF EXISTS fn_aumentar_stock_compra()      CASCADE;
DROP FUNCTION IF EXISTS fn_actualizar_stock_panes()     CASCADE;

-- ============================================================
-- 2. CREAR TABLAS
-- ============================================================

-- 2.1 Roles de usuario
CREATE TABLE public.roles (
    id_rol      SERIAL PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion TEXT,
    permisos    JSONB        DEFAULT '[]'::jsonb,
    estado      INT          DEFAULT 1  -- 1: Activo, 0: Inactivo
);

-- 2.2 Perfiles de Usuario (vinculados a auth.users)
CREATE TABLE public.profiles (
    id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username          VARCHAR(50) UNIQUE NOT NULL,
    nombre            VARCHAR(100) NOT NULL,
    apellido_paterno  VARCHAR(100) NOT NULL,
    apellido_materno  VARCHAR(100),
    correo            VARCHAR(150),
    num_telefono      VARCHAR(20),
    numero_documento  VARCHAR(20),          -- DNI u otro documento de identidad
    id_rol            INT REFERENCES public.roles(id_rol) DEFAULT 2,  -- 2: Cajero
    fec_registro      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado            VARCHAR(20) DEFAULT 'act'  -- 'act': Activo, 'ina': Inactivo
);

-- 2.3 Categorías de productos
CREATE TABLE public.categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL UNIQUE,
    estado       INT DEFAULT 1
);

-- 2.4 Métodos de Pago
CREATE TABLE public.metodos_pago (
    id_metodo_pago SERIAL PRIMARY KEY,
    tipo_pago      VARCHAR(50) NOT NULL UNIQUE,
    estado         INT DEFAULT 1
);

-- 2.5 Clientes (con línea de crédito / fiados)
CREATE TABLE public.clientes (
    id_cliente      SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    dni             VARCHAR(20),
    telefono        VARCHAR(50),
    email           VARCHAR(150),
    limite_credito  DECIMAL(10,2) NOT NULL DEFAULT 0.00
                        CONSTRAINT chk_limite_credito CHECK (limite_credito >= 0),
    saldo_credito   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    historial_pagos JSONB DEFAULT '[]'::jsonb,
    fec_registro    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado          INT DEFAULT 1
);

-- 2.6 Proveedores (con validación de RUC de 11 dígitos)
CREATE TABLE public.proveedores (
    id_proveedor   SERIAL PRIMARY KEY,
    ruc            VARCHAR(11) NOT NULL UNIQUE
                       CONSTRAINT chk_ruc_length CHECK (length(ruc) = 11),
    nombre_empresa VARCHAR(200) NOT NULL,
    num_telefono   VARCHAR(20),
    direccion      TEXT,
    fec_registro   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado         INT DEFAULT 1
);

-- 2.7 Productos
CREATE TABLE public.productos (
    id_producto     SERIAL PRIMARY KEY,
    id_categoria    INT REFERENCES public.categorias(id_categoria),
    nombre          VARCHAR(150) NOT NULL UNIQUE,
    em              VARCHAR(10)  DEFAULT '📦',
    num_stock       DECIMAL(10,3) DEFAULT 0.000
                        CONSTRAINT chk_product_stock CHECK (num_stock >= 0),
    precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00
                        CONSTRAINT chk_product_price CHECK (precio_unitario >= 0),
    unidad_medida   VARCHAR(20)  DEFAULT 'unidades',
    estado          INT DEFAULT 1
);

-- 2.8 Versiones / Variantes de Producto
CREATE TABLE public.producto_versiones (
    id_version      SERIAL PRIMARY KEY,
    id_producto     INT REFERENCES public.productos(id_producto) ON DELETE CASCADE,
    nombre_version  VARCHAR(100) NOT NULL,
    num_stock       DECIMAL(10,3) DEFAULT 0.000
                        CONSTRAINT chk_version_stock CHECK (num_stock >= 0),
    precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00
                        CONSTRAINT chk_version_price CHECK (precio_unitario >= 0),
    estado          INT DEFAULT 1,
    UNIQUE(id_producto, nombre_version)
);

-- 2.9 Cierres / Sesiones de Caja
CREATE TABLE public.cierres_caja (
    id_cierre_caja      SERIAL PRIMARY KEY,
    id_usuario          UUID REFERENCES public.profiles(id),
    fec_apertura        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fec_cierre          TIMESTAMP WITH TIME ZONE,
    tot_saldo_inicial   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tot_ventas_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tot_ventas_otros    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tot_saldo_final     DECIMAL(10,2) DEFAULT 0.00,
    diferencia          DECIMAL(10,2) DEFAULT 0.00,
    estado              VARCHAR(20)   DEFAULT 'abierto'  -- 'abierto', 'cerrado'
);

-- 2.10 Ventas
CREATE TABLE public.ventas (
    id_venta       SERIAL PRIMARY KEY,
    id_cliente     INT  REFERENCES public.clientes(id_cliente),
    id_usuario     UUID REFERENCES public.profiles(id),
    id_cierre_caja INT  REFERENCES public.cierres_caja(id_cierre_caja),
    id_metodo_pago INT  REFERENCES public.metodos_pago(id_metodo_pago),
    fec_venta      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sub_total      DECIMAL(10,2) NOT NULL,
    igv            DECIMAL(10,2) NOT NULL,
    tot_pago       DECIMAL(10,2) NOT NULL,
    estado         INT DEFAULT 1  -- 1: Pagado, 0: Anulado
);

-- 2.11 Detalle de Venta
CREATE TABLE public.detalle_venta (
    id_detalle_venta SERIAL PRIMARY KEY,
    id_venta         INT REFERENCES public.ventas(id_venta)              ON DELETE CASCADE,
    id_producto      INT REFERENCES public.productos(id_producto),
    id_version       INT REFERENCES public.producto_versiones(id_version),  -- NULL si sin variante
    num_cantidad     DECIMAL(10,3) NOT NULL CONSTRAINT chk_sale_qty CHECK (num_cantidad > 0),
    precio_unitario  DECIMAL(10,2) NOT NULL
);

-- 2.12 Compras (Logística)
CREATE TABLE public.compras (
    id_compra    SERIAL PRIMARY KEY,
    id_usuario   UUID REFERENCES public.profiles(id),
    id_proveedor INT  REFERENCES public.proveedores(id_proveedor),
    fec_compra   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sub_total    DECIMAL(10,2) NOT NULL,
    igv          DECIMAL(10,2) NOT NULL,
    tot_pago     DECIMAL(10,2) NOT NULL,
    estado       INT DEFAULT 1
);

-- 2.13 Detalle de Compra
CREATE TABLE public.detalle_compra (
    id_detalle_compra SERIAL PRIMARY KEY,
    id_compra         INT REFERENCES public.compras(id_compra)              ON DELETE CASCADE,
    id_producto       INT REFERENCES public.productos(id_producto),
    id_version        INT REFERENCES public.producto_versiones(id_version),
    num_cantidad      DECIMAL(10,3) NOT NULL CONSTRAINT chk_purchase_qty CHECK (num_cantidad > 0),
    precio_compra     DECIMAL(10,2) NOT NULL
);

-- 2.14 Control de Panes (Producción y Descartes)
CREATE TABLE public.produccion_descarte (
    id_registro      SERIAL PRIMARY KEY,
    id_producto      INT REFERENCES public.productos(id_producto)          ON DELETE CASCADE,
    id_version       INT REFERENCES public.producto_versiones(id_version)  ON DELETE SET NULL,
    tipo_registro    VARCHAR(20) NOT NULL
                         CONSTRAINT chk_reg_type CHECK (tipo_registro IN ('produccion', 'descarte')),
    num_cantidad     DECIMAL(10,3) NOT NULL CONSTRAINT chk_pan_qty CHECK (num_cantidad > 0),
    motivo_descarte  VARCHAR(100),
    id_usuario       UUID REFERENCES public.profiles(id),
    fec_registro     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.15 Sesión real de WhatsApp Baileys
-- Guarda credenciales Signal/Baileys en BD para evitar archivos locales .json.
-- Acceso esperado: solo servidor con SUPABASE_SERVICE_ROLE_KEY.
CREATE TABLE public.whatsapp_baileys_auth (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 3. TRIGGERS DE STOCK AUTOMÁTICO
-- ============================================================

-- A. Descontar stock al vender
CREATE OR REPLACE FUNCTION fn_descontar_stock_venta()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_version IS NOT NULL THEN
        UPDATE public.producto_versiones
           SET num_stock = num_stock - NEW.num_cantidad
         WHERE id_version = NEW.id_version;
    ELSE
        UPDATE public.productos
           SET num_stock = num_stock - NEW.num_cantidad
         WHERE id_producto = NEW.id_producto;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_venta_descontar_stock ON public.detalle_venta;
CREATE TRIGGER tr_venta_descontar_stock
AFTER INSERT ON public.detalle_venta
FOR EACH ROW EXECUTE FUNCTION fn_descontar_stock_venta();

-- B. Aumentar stock al comprar
CREATE OR REPLACE FUNCTION fn_aumentar_stock_compra()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_version IS NOT NULL THEN
        UPDATE public.producto_versiones
           SET num_stock = num_stock + NEW.num_cantidad
         WHERE id_version = NEW.id_version;
    ELSE
        UPDATE public.productos
           SET num_stock = num_stock + NEW.num_cantidad
         WHERE id_producto = NEW.id_producto;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_compra_aumentar_stock ON public.detalle_compra;
CREATE TRIGGER tr_compra_aumentar_stock
AFTER INSERT ON public.detalle_compra
FOR EACH ROW EXECUTE FUNCTION fn_aumentar_stock_compra();

-- C. Actualizar stock en producción / descarte
CREATE OR REPLACE FUNCTION fn_actualizar_stock_panes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo_registro = 'produccion' THEN
        IF NEW.id_version IS NOT NULL THEN
            UPDATE public.producto_versiones
               SET num_stock = num_stock + NEW.num_cantidad
             WHERE id_version = NEW.id_version;
        ELSE
            UPDATE public.productos
               SET num_stock = num_stock + NEW.num_cantidad
             WHERE id_producto = NEW.id_producto;
        END IF;
    ELSIF NEW.tipo_registro = 'descarte' THEN
        IF NEW.id_version IS NOT NULL THEN
            UPDATE public.producto_versiones
               SET num_stock = num_stock - NEW.num_cantidad
             WHERE id_version = NEW.id_version;
        ELSE
            UPDATE public.productos
               SET num_stock = num_stock - NEW.num_cantidad
             WHERE id_producto = NEW.id_producto;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_panes_actualizar_stock ON public.produccion_descarte;
CREATE TRIGGER tr_panes_actualizar_stock
AFTER INSERT ON public.produccion_descarte
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_stock_panes();


-- ============================================================
-- 4. TRIGGER: SINCRONIZAR AUTH.USERS → PUBLIC.PROFILES
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
      id, username, nombre, apellido_paterno, apellido_materno,
      correo, num_telefono, id_rol, estado
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), new.id::text),
    COALESCE(new.raw_user_meta_data->>'nombre', 'Nuevo'),
    COALESCE(new.raw_user_meta_data->>'apellido_paterno', 'Colaborador'),
    new.raw_user_meta_data->>'apellido_materno',
    new.email,
    COALESCE(new.raw_user_meta_data->>'num_telefono', new.phone),
    COALESCE((new.raw_user_meta_data->>'id_rol')::int, 2),
    'act'
  )
  ON CONFLICT (id) DO UPDATE SET
    username         = COALESCE(EXCLUDED.username,         public.profiles.username),
    nombre           = COALESCE(EXCLUDED.nombre,           public.profiles.nombre),
    apellido_paterno = COALESCE(EXCLUDED.apellido_paterno, public.profiles.apellido_paterno),
    correo           = COALESCE(EXCLUDED.correo,           public.profiles.correo),
    id_rol           = COALESCE(EXCLUDED.id_rol,           public.profiles.id_rol);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- Todas las tablas ya existen aquí, sin errores de orden.
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol = 1));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol = 1));

-- roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select" ON public.roles;
DROP POLICY IF EXISTS "roles_all_admin" ON public.roles;
CREATE POLICY "roles_select" ON public.roles FOR SELECT USING (true);
CREATE POLICY "roles_all_admin" ON public.roles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol = 1));

-- categorias
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categorias_select" ON public.categorias;
DROP POLICY IF EXISTS "categorias_mod" ON public.categorias;
CREATE POLICY "categorias_select" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "categorias_mod" ON public.categorias FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));

-- metodos_pago
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metodos_pago_select" ON public.metodos_pago;
DROP POLICY IF EXISTS "metodos_pago_mod" ON public.metodos_pago;
CREATE POLICY "metodos_pago_select" ON public.metodos_pago FOR SELECT USING (true);
CREATE POLICY "metodos_pago_mod" ON public.metodos_pago FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));

-- clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_mod" ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));
CREATE POLICY "clientes_mod" ON public.clientes FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));

-- proveedores
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proveedores_select" ON public.proveedores;
DROP POLICY IF EXISTS "proveedores_mod" ON public.proveedores;
CREATE POLICY "proveedores_select" ON public.proveedores FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));
CREATE POLICY "proveedores_mod" ON public.proveedores FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));

-- productos
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "productos_select" ON public.productos;
DROP POLICY IF EXISTS "productos_mod" ON public.productos;
CREATE POLICY "productos_select" ON public.productos FOR SELECT USING (true);
CREATE POLICY "productos_mod" ON public.productos FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 3, 5)));

-- producto_versiones
ALTER TABLE public.producto_versiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "producto_versiones_select" ON public.producto_versiones;
DROP POLICY IF EXISTS "producto_versiones_mod" ON public.producto_versiones;
CREATE POLICY "producto_versiones_select" ON public.producto_versiones FOR SELECT USING (true);
CREATE POLICY "producto_versiones_mod" ON public.producto_versiones FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 3, 5)));

-- cierres_caja
ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cierres_caja_select" ON public.cierres_caja;
DROP POLICY IF EXISTS "cierres_caja_mod" ON public.cierres_caja;
CREATE POLICY "cierres_caja_select" ON public.cierres_caja FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 4, 5)));
CREATE POLICY "cierres_caja_mod" ON public.cierres_caja FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));

-- ventas
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ventas_select" ON public.ventas;
DROP POLICY IF EXISTS "ventas_insert" ON public.ventas;
CREATE POLICY "ventas_select" ON public.ventas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 4, 5)));
CREATE POLICY "ventas_insert" ON public.ventas FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));

-- detalle_venta
ALTER TABLE public.detalle_venta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detalle_venta_select" ON public.detalle_venta;
DROP POLICY IF EXISTS "detalle_venta_insert" ON public.detalle_venta;
CREATE POLICY "detalle_venta_select" ON public.detalle_venta FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 4, 5)));
CREATE POLICY "detalle_venta_insert" ON public.detalle_venta FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));

-- compras
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compras_select" ON public.compras;
DROP POLICY IF EXISTS "compras_mod" ON public.compras;
CREATE POLICY "compras_select" ON public.compras FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));
CREATE POLICY "compras_mod" ON public.compras FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));

-- detalle_compra
ALTER TABLE public.detalle_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detalle_compra_select" ON public.detalle_compra;
DROP POLICY IF EXISTS "detalle_compra_mod" ON public.detalle_compra;
CREATE POLICY "detalle_compra_select" ON public.detalle_compra FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));
CREATE POLICY "detalle_compra_mod" ON public.detalle_compra FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));

-- produccion_descarte
ALTER TABLE public.produccion_descarte ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "produccion_descarte_select" ON public.produccion_descarte;
DROP POLICY IF EXISTS "produccion_descarte_mod" ON public.produccion_descarte;
CREATE POLICY "produccion_descarte_select" ON public.produccion_descarte FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 3, 5)));
CREATE POLICY "produccion_descarte_mod" ON public.produccion_descarte FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 3, 5)));

-- whatsapp_baileys_auth
-- Sin políticas para usuarios cliente; la API de Next accede con service role.
ALTER TABLE public.whatsapp_baileys_auth ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. DATOS SEMILLA (SEED DATA)
-- ============================================================

-- Roles
INSERT INTO public.roles (id_rol, nombre, descripcion, permisos, estado) VALUES
(1, 'Administrador', 'Control total de la panadería con acceso sin restricciones a todos los módulos.',
    '["pos_ventas","caja_operaciones","caja_auditoria","inventario_ver","inventario_editar","estadisticas_ver","personal_gestionar"]'::jsonb, 1),
(2, 'Cajero',        'Operador de caja estándar encargado de cobros al detalle y arqueo de turnos básicos.',
    '["pos_ventas","caja_operaciones","inventario_ver"]'::jsonb, 1),
(3, 'Panadero',      'Personal de producción de panes y dulces con control sobre stock y descartes.',
    '["inventario_ver","inventario_editar"]'::jsonb, 1),
(4, 'Contador',      'Auditor contable enfocado en control fiscal, ingresos consolidados y reportes mensuales.',
    '["caja_auditoria","estadisticas_ver"]'::jsonb, 1),
(5, 'Supervisor',    'Encargado del local. Habilitado para auditar cajas, gestionar descartes de panes y stock.',
    '["pos_ventas","caja_operaciones","caja_auditoria","inventario_ver","inventario_editar","estadisticas_ver"]'::jsonb, 1)
ON CONFLICT (id_rol) DO UPDATE
    SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, permisos = EXCLUDED.permisos;

-- Categorías
INSERT INTO public.categorias (id_categoria, nombre, estado) VALUES
(1, 'Panes',   1),
(2, 'Tortas',  1),
(3, 'Dulces',  1),
(4, 'Bebidas', 1)
ON CONFLICT (id_categoria) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Métodos de Pago
INSERT INTO public.metodos_pago (id_metodo_pago, tipo_pago, estado) VALUES
(1, 'Efectivo', 1),
(2, 'Tarjeta',  1),
(3, 'Yape',     1),
(4, 'Plin',     1)
ON CONFLICT (id_metodo_pago) DO UPDATE SET tipo_pago = EXCLUDED.tipo_pago;


-- Productos de ejemplo
INSERT INTO public.productos (id_producto, id_categoria, nombre, em, num_stock, precio_unitario, estado) VALUES
(1, 1, 'Croissant mantequilla', '🥐', 48,  4.50, 1),
(2, 1, 'Pan de yema especial',  '🍞', 74,  1.80, 1),
(3, 2, 'Torta de chocolate',    '🎂',  8, 45.00, 1),
(4, 1, 'Empanada de pollo',     '🫓', 32,  3.50, 1),
(5, 3, 'Alfajor triple',        '🍪', 40,  2.80, 1),
(6, 2, 'Queque de zanahoria',   '🍰',  6, 28.00, 1),
(7, 1, 'Pan integral',          '🌾', 20,  5.50, 1),
(8, 4, 'Café americano',        '☕', 99,  6.00, 1)
ON CONFLICT (id_producto) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Backfill: vincular usuarios auth ya existentes con profiles
INSERT INTO public.profiles (id, username, nombre, apellido_paterno, correo, id_rol, estado)
SELECT
    id,
    COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1), id::text),
    COALESCE(raw_user_meta_data->>'nombre', 'Admin'),
    COALESCE(raw_user_meta_data->>'apellido_paterno', 'Sistema'),
    email,
    1,      -- Administrador por defecto para usuarios pre-existentes
    'act'
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 7. PEDIDOS Y DEVOLUCIONES (NUEVAS MEJORAS)
-- ============================================================

-- 7.1 Pedidos y Reservas
CREATE TABLE public.pedidos_reserva (
    id_pedido      SERIAL PRIMARY KEY,
    id_cliente     INT REFERENCES public.clientes(id_cliente),
    producto_texto TEXT NOT NULL,
    fec_entrega    TIMESTAMP WITH TIME ZONE NOT NULL,
    adelanto       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    notas          TEXT,
    estado         VARCHAR(50) DEFAULT 'Pendiente', -- 'Pendiente', 'Listo', 'Entregado', 'Cancelado'
    id_usuario     UUID REFERENCES public.profiles(id),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7.2 Devoluciones
CREATE TABLE public.devoluciones (
    id_devolucion  SERIAL PRIMARY KEY,
    id_venta       INT NOT NULL REFERENCES public.ventas(id_venta) ON DELETE CASCADE,
    id_cliente     INT REFERENCES public.clientes(id_cliente),
    motivo         TEXT,
    total_devuelto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    id_usuario     UUID REFERENCES public.profiles(id),
    fec_devolucion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7.3 Detalle de Devoluciones
CREATE TABLE public.detalle_devolucion (
    id_detalle_devolucion SERIAL PRIMARY KEY,
    id_devolucion         INT NOT NULL REFERENCES public.devoluciones(id_devolucion) ON DELETE CASCADE,
    id_producto           INT REFERENCES public.productos(id_producto),
    id_version            INT REFERENCES public.producto_versiones(id_version),
    num_cantidad          DECIMAL(10,3) NOT NULL CONSTRAINT chk_dev_qty CHECK (num_cantidad > 0),
    precio_unitario       DECIMAL(10,2) NOT NULL
);

-- RLS y políticas consistentes con ventas (cajero/supervisor/admin inserta, contador/supervisor/admin consulta)
ALTER TABLE public.pedidos_reserva ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedidos_reserva_select" ON public.pedidos_reserva;
DROP POLICY IF EXISTS "pedidos_reserva_insert" ON public.pedidos_reserva;
DROP POLICY IF EXISTS "pedidos_reserva_update" ON public.pedidos_reserva;
CREATE POLICY "pedidos_reserva_select" ON public.pedidos_reserva FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 4, 5)));
CREATE POLICY "pedidos_reserva_insert" ON public.pedidos_reserva FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));
CREATE POLICY "pedidos_reserva_update" ON public.pedidos_reserva FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));

ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "devoluciones_select" ON public.devoluciones;
DROP POLICY IF EXISTS "devoluciones_insert" ON public.devoluciones;
CREATE POLICY "devoluciones_select" ON public.devoluciones FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 4, 5)));
CREATE POLICY "devoluciones_insert" ON public.devoluciones FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));

ALTER TABLE public.detalle_devolucion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detalle_devolucion_select" ON public.detalle_devolucion;
DROP POLICY IF EXISTS "detalle_devolucion_insert" ON public.detalle_devolucion;
CREATE POLICY "detalle_devolucion_select" ON public.detalle_devolucion FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 4, 5)));
CREATE POLICY "detalle_devolucion_insert" ON public.detalle_devolucion FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));

-- Recargar caché del esquema PostgREST
NOTIFY pgrst, 'reload schema';

