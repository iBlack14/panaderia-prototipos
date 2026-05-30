-- ============================================================
-- SUPABASE SCHEMA - PANADERÍA SNACK ROQUE (PROTOTIPO 3)
-- ============================================================
-- Ejecutar este script en el SQL Editor de tu proyecto Supabase.
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- LIMPIEZA DE TABLAS Y FUNCIONES (RESET COMPLETO)
-- ============================================================
DROP TABLE IF EXISTS public.produccion_descarte CASCADE;
DROP TABLE IF EXISTS public.detalle_compra CASCADE;
DROP TABLE IF EXISTS public.compras CASCADE;
DROP TABLE IF EXISTS public.detalle_venta CASCADE;
DROP TABLE IF EXISTS public.ventas CASCADE;
DROP TABLE IF EXISTS public.cierres_caja CASCADE;
DROP TABLE IF EXISTS public.producto_versiones CASCADE;
DROP TABLE IF EXISTS public.productos CASCADE;
DROP TABLE IF EXISTS public.proveedores CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.metodos_pago CASCADE;
DROP TABLE IF EXISTS public.categorias CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS fn_descontar_stock_venta() CASCADE;
DROP FUNCTION IF EXISTS fn_aumentar_stock_compra() CASCADE;
DROP FUNCTION IF EXISTS fn_actualizar_stock_panes() CASCADE;

-- 1. Roles de usuario
CREATE TABLE IF NOT EXISTS public.roles (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    permisos JSONB DEFAULT '[]'::jsonb,
    estado INT DEFAULT 1 -- 1: Activo, 0: Inactivo
);

-- 2. Tabla Perfiles de Usuario (Enlazada con auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    correo VARCHAR(150) NOT NULL,
    num_telefono VARCHAR(20),
    id_rol INT REFERENCES public.roles(id_rol) DEFAULT 2, -- Cajero por defecto
    fec_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado VARCHAR(20) DEFAULT 'act' -- 'act': Activo, 'ina': Inactivo
);

-- Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si ya existen para evitar errores al re-ejecutar el script
DROP POLICY IF EXISTS "Permitir lectura de perfiles a todos los autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Permitir actualización de perfil propio" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserción de perfiles" ON public.profiles;

-- Políticas de RLS para profiles
CREATE POLICY "Permitir lectura de perfiles a todos los autenticados" 
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir actualización de perfil propio" 
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Permitir inserción de perfiles" 
    ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Categorías de productos
CREATE TABLE IF NOT EXISTS public.categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    estado INT DEFAULT 1 -- 1: Activo, 0: Inactivo
);

-- 4. Métodos de Pago
CREATE TABLE IF NOT EXISTS public.metodos_pago (
    id_metodo_pago SERIAL PRIMARY KEY,
    tipo_pago VARCHAR(50) NOT NULL UNIQUE,
    estado INT DEFAULT 1 -- 1: Activo, 0: Inactivo
);

-- 5. Clientes (con soporte para línea de crédito y fiados)
CREATE TABLE IF NOT EXISTS public.clientes (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    dni VARCHAR(20),
    telefono VARCHAR(50),
    email VARCHAR(150),
    limite_credito DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT chk_limite_credito CHECK (limite_credito <= 100.00),
    saldo_credito DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    historial_pagos JSONB DEFAULT '[]'::jsonb,
    fec_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado INT DEFAULT 1 -- 1: Activo, 0: Inactivo
);

-- 6. Proveedores (con validación de RUC)
CREATE TABLE IF NOT EXISTS public.proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    ruc VARCHAR(11) NOT NULL UNIQUE CONSTRAINT chk_ruc_length CHECK (length(ruc) = 11),
    nombre_empresa VARCHAR(200) NOT NULL,
    num_telefono VARCHAR(20),
    direccion TEXT,
    fec_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado INT DEFAULT 1 -- 1: Activo, 0: Inactivo
);

-- 7. Productos
CREATE TABLE IF NOT EXISTS public.productos (
    id_producto SERIAL PRIMARY KEY,
    id_categoria INT REFERENCES public.categorias(id_categoria),
    nombre VARCHAR(150) NOT NULL UNIQUE,
    em VARCHAR(10) DEFAULT '📦', -- Emoji representativo
    num_stock INT DEFAULT 0 CONSTRAINT chk_product_stock CHECK (num_stock >= 0),
    precio_unitario DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT chk_product_price CHECK (precio_unitario >= 0),
    estado INT DEFAULT 1 -- 1: Activo, 0: Inactivo
);

-- 8. Versiones / Variantes de Producto (Opcional)
CREATE TABLE IF NOT EXISTS public.producto_versiones (
    id_version SERIAL PRIMARY KEY,
    id_producto INT REFERENCES public.productos(id_producto) ON DELETE CASCADE,
    nombre_version VARCHAR(100) NOT NULL, -- e.g., 'Normal', 'Grande', 'Familiar'
    num_stock INT DEFAULT 0 CONSTRAINT chk_version_stock CHECK (num_stock >= 0),
    precio_unitario DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT chk_version_price CHECK (precio_unitario >= 0),
    estado INT DEFAULT 1, -- 1: Activo, 0: Inactivo
    UNIQUE(id_producto, nombre_version)
);

-- 9. Cierres / Sesiones de Caja
CREATE TABLE IF NOT EXISTS public.cierres_caja (
    id_cierre_caja SERIAL PRIMARY KEY,
    id_usuario UUID REFERENCES public.profiles(id),
    fec_apertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fec_cierre TIMESTAMP WITH TIME ZONE,
    tot_saldo_inicial DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tot_ventas_efectivo DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tot_ventas_otros DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tot_saldo_final DECIMAL(10, 2) DEFAULT 0.00,
    diferencia DECIMAL(10, 2) DEFAULT 0.00,
    estado VARCHAR(20) DEFAULT 'abierto' -- 'abierto', 'cerrado'
);

-- 10. Ventas
CREATE TABLE IF NOT EXISTS public.ventas (
    id_venta SERIAL PRIMARY KEY,
    id_cliente INT REFERENCES public.clientes(id_cliente) DEFAULT 1,
    id_usuario UUID REFERENCES public.profiles(id),
    id_cierre_caja INT REFERENCES public.cierres_caja(id_cierre_caja),
    id_metodo_pago INT REFERENCES public.metodos_pago(id_metodo_pago),
    fec_venta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sub_total DECIMAL(10, 2) NOT NULL,
    igv DECIMAL(10, 2) NOT NULL,
    tot_pago DECIMAL(10, 2) NOT NULL,
    estado INT DEFAULT 1 -- 1: Activo/Pagado, 0: Anulado
);

-- 11. Detalle de Venta
CREATE TABLE IF NOT EXISTS public.detalle_venta (
    id_detalle_venta SERIAL PRIMARY KEY,
    id_venta INT REFERENCES public.ventas(id_venta) ON DELETE CASCADE,
    id_producto INT REFERENCES public.productos(id_producto),
    id_version INT REFERENCES public.producto_versiones(id_version), -- NULL si no tiene variante
    num_cantidad INT NOT NULL CONSTRAINT chk_sale_qty CHECK (num_cantidad > 0),
    precio_unitario DECIMAL(10, 2) NOT NULL
);

-- 12. Compras (Logística)
CREATE TABLE IF NOT EXISTS public.compras (
    id_compra SERIAL PRIMARY KEY,
    id_usuario UUID REFERENCES public.profiles(id),
    id_proveedor INT REFERENCES public.proveedores(id_proveedor),
    fec_compra TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sub_total DECIMAL(10, 2) NOT NULL,
    igv DECIMAL(10, 2) NOT NULL,
    tot_pago DECIMAL(10, 2) NOT NULL,
    estado INT DEFAULT 1 -- 1: Completado, 0: Anulado
);

-- 13. Detalle de Compra
CREATE TABLE IF NOT EXISTS public.detalle_compra (
    id_detalle_compra SERIAL PRIMARY KEY,
    id_compra INT REFERENCES public.compras(id_compra) ON DELETE CASCADE,
    id_producto INT REFERENCES public.productos(id_producto),
    id_version INT REFERENCES public.producto_versiones(id_version), -- NULL si no tiene variante
    num_cantidad INT NOT NULL CONSTRAINT chk_purchase_qty CHECK (num_cantidad > 0),
    precio_compra DECIMAL(10, 2) NOT NULL
);

-- 14. Control de Panes (Producción y Descartes de Panes)
CREATE TABLE IF NOT EXISTS public.produccion_descarte (
    id_registro SERIAL PRIMARY KEY,
    id_producto INT REFERENCES public.productos(id_producto) ON DELETE CASCADE,
    id_version INT REFERENCES public.producto_versiones(id_version) ON DELETE SET NULL,
    tipo_registro VARCHAR(20) NOT NULL CONSTRAINT chk_reg_type CHECK (tipo_registro IN ('produccion', 'descarte')),
    num_cantidad INT NOT NULL CONSTRAINT chk_pan_qty CHECK (num_cantidad > 0),
    motivo_descarte VARCHAR(100), -- Duro, Quemado, Dañado, etc. (Solo si es descarte)
    id_usuario UUID REFERENCES public.profiles(id),
    fec_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- TRIGGERS DE BASE DE DATOS PARA GESTIÓN AUTOMÁTICA DE STOCK
-- ============================================================

-- A. Actualizar Stock al vender
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


-- B. Actualizar Stock al comprar
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


-- C. Actualizar Stock al registrar Producción o Descarte
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
-- TRIGGER AUTOMÁTICO PARA ENLAZAR AUTH.USERS CON PUBLIC.PROFILES
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nombre, apellido_paterno, apellido_materno, correo, id_rol, estado)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'nombre', 'Nuevo'),
    COALESCE(new.raw_user_meta_data->>'apellido_paterno', 'Colaborador'),
    new.raw_user_meta_data->>'apellido_materno',
    new.email,
    COALESCE((new.raw_user_meta_data->>'id_rol')::int, 2), -- 2: Cajero por defecto
    'act'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador después de que un usuario se registra en Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- DATOS SEMILLA (SEED DATA)
-- ============================================================

-- 1. Roles
INSERT INTO public.roles (id_rol, nombre, descripcion, permisos, estado) VALUES
(1, 'Administrador', 'Control total de la panadería con acceso sin restricciones a todos los módulos.', '["pos_ventas", "caja_operaciones", "caja_auditoria", "inventario_ver", "inventario_editar", "estadisticas_ver", "personal_gestionar"]'::jsonb, 1),
(2, 'Cajero', 'Operador de caja estándar encargado de cobros al detalle y arqueo de turnos básicos.', '["pos_ventas", "caja_operaciones", "inventario_ver"]'::jsonb, 1),
(3, 'Panadero', 'Personal de producción de panes y dulces con control sobre stock y descartes.', '["inventario_ver", "inventario_editar"]'::jsonb, 1),
(4, 'Contador', 'Auditor contable enfocado en control fiscal, ingresos consolidados y reportes mensuales.', '["caja_auditoria", "estadisticas_ver"]'::jsonb, 1),
(5, 'Supervisor', 'Encargado del local. Habilitado para auditar cajas, gestionar descartes de panes y stock.', '["pos_ventas", "caja_operaciones", "caja_auditoria", "inventario_ver", "inventario_editar", "estadisticas_ver"]'::jsonb, 1)
ON CONFLICT (id_rol) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, permisos = EXCLUDED.permisos;

-- 2. Categorías
INSERT INTO public.categorias (id_categoria, nombre, estado) VALUES
(1, 'Panes', 1),
(2, 'Tortas', 1),
(3, 'Dulces', 1),
(4, 'Bebidas', 1)
ON CONFLICT (id_categoria) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 3. Métodos de Pago
INSERT INTO public.metodos_pago (id_metodo_pago, tipo_pago, estado) VALUES
(1, 'Efectivo', 1),
(2, 'Tarjeta', 1),
(3, 'Yape', 1),
(4, 'Plin', 1)
ON CONFLICT (id_metodo_pago) DO UPDATE SET tipo_pago = EXCLUDED.tipo_pago;

-- 4. Clientes
INSERT INTO public.clientes (id_cliente, nombre, estado) VALUES
(1, 'Público General', 1)
ON CONFLICT (id_cliente) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 5. Productos
INSERT INTO public.productos (id_producto, id_categoria, nombre, em, num_stock, precio_unitario, estado) VALUES
(1, 1, 'Croissant mantequilla', '🥐', 48, 4.50, 1),
(2, 1, 'Pan de yema especial', '🍞', 74, 1.80, 1),
(3, 2, 'Torta de chocolate', '🎂', 8, 45.00, 1),
(4, 1, 'Empanada de pollo', '🫓', 32, 3.50, 1),
(5, 3, 'Alfajor triple', '🍪', 40, 2.80, 1),
(6, 2, 'Queque de zanahoria', '🍰', 6, 28.00, 1),
(7, 1, 'Pan integral', '🌾', 20, 5.50, 1),
(8, 4, 'Café americano', '☕', 99, 6.00, 1)
ON CONFLICT (id_producto) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Vincular usuarios de auth.users existentes con public.profiles (Backfill automático)
INSERT INTO public.profiles (id, username, nombre, apellido_paterno, correo, id_rol, estado)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)), 
  COALESCE(raw_user_meta_data->>'nombre', 'Alonso'), 
  COALESCE(raw_user_meta_data->>'apellido_paterno', 'Admin'), 
  email, 
  1, -- 1: Administrador por defecto para usuarios ya creados en auth
  'act'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Recargar caché del esquema de Supabase/PostgREST
NOTIFY pgrst, 'reload schema';


