-- ============================================================
-- SCRIPT RBAC - Ejecutar en Supabase SQL Editor
-- Panadería Snack Roque
-- ============================================================
-- Instrucciones: Copia y pega TODO este script en el SQL Editor 
-- de tu proyecto Supabase y presiona "Run".
-- ============================================================


-- ============================================================
-- PASO 1: Eliminar políticas anteriores
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

DROP POLICY IF EXISTS "roles_all" ON public.roles;
DROP POLICY IF EXISTS "roles_select" ON public.roles;
DROP POLICY IF EXISTS "roles_all_admin" ON public.roles;

DROP POLICY IF EXISTS "categorias_all" ON public.categorias;
DROP POLICY IF EXISTS "categorias_select" ON public.categorias;
DROP POLICY IF EXISTS "categorias_mod" ON public.categorias;

DROP POLICY IF EXISTS "metodos_pago_all" ON public.metodos_pago;
DROP POLICY IF EXISTS "metodos_pago_select" ON public.metodos_pago;
DROP POLICY IF EXISTS "metodos_pago_mod" ON public.metodos_pago;

DROP POLICY IF EXISTS "clientes_all" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_mod" ON public.clientes;

DROP POLICY IF EXISTS "proveedores_all" ON public.proveedores;
DROP POLICY IF EXISTS "proveedores_select" ON public.proveedores;
DROP POLICY IF EXISTS "proveedores_mod" ON public.proveedores;

DROP POLICY IF EXISTS "productos_all" ON public.productos;
DROP POLICY IF EXISTS "productos_select" ON public.productos;
DROP POLICY IF EXISTS "productos_mod" ON public.productos;

DROP POLICY IF EXISTS "producto_versiones_all" ON public.producto_versiones;
DROP POLICY IF EXISTS "producto_versiones_select" ON public.producto_versiones;
DROP POLICY IF EXISTS "producto_versiones_mod" ON public.producto_versiones;

DROP POLICY IF EXISTS "cierres_caja_all" ON public.cierres_caja;
DROP POLICY IF EXISTS "cierres_caja_select" ON public.cierres_caja;
DROP POLICY IF EXISTS "cierres_caja_mod" ON public.cierres_caja;

DROP POLICY IF EXISTS "ventas_all" ON public.ventas;
DROP POLICY IF EXISTS "ventas_select" ON public.ventas;
DROP POLICY IF EXISTS "ventas_insert" ON public.ventas;

DROP POLICY IF EXISTS "detalle_venta_all" ON public.detalle_venta;
DROP POLICY IF EXISTS "detalle_venta_select" ON public.detalle_venta;
DROP POLICY IF EXISTS "detalle_venta_insert" ON public.detalle_venta;

DROP POLICY IF EXISTS "compras_all" ON public.compras;
DROP POLICY IF EXISTS "compras_select" ON public.compras;
DROP POLICY IF EXISTS "compras_mod" ON public.compras;

DROP POLICY IF EXISTS "detalle_compra_all" ON public.detalle_compra;
DROP POLICY IF EXISTS "detalle_compra_select" ON public.detalle_compra;
DROP POLICY IF EXISTS "detalle_compra_mod" ON public.detalle_compra;

DROP POLICY IF EXISTS "produccion_descarte_all" ON public.produccion_descarte;
DROP POLICY IF EXISTS "produccion_descarte_select" ON public.produccion_descarte;
DROP POLICY IF EXISTS "produccion_descarte_mod" ON public.produccion_descarte;


-- ============================================================
-- PASO 2: Activar RLS en todas las tablas
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_descarte ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PASO 3: Crear nuevas políticas estrictas por rol
-- 
-- Referencia de roles (id_rol):
--   1 = Administrador (acceso total)
--   2 = Cajero
--   3 = Panadero
--   4 = Contador (solo lectura de reportes/caja)
--   5 = Supervisor
-- ============================================================

-- PERFILES
-- Cualquiera puede leer (necesario para login con username)
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);

-- Solo Administradores pueden crear nuevos usuarios
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol = 1)
  );

-- Cada usuario puede editar su propio perfil; Admin puede editar cualquiera
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol = 1)
  );


-- ROLES
-- Todos pueden leer (para cargar el menú de permisos)
CREATE POLICY "roles_select" ON public.roles
  FOR SELECT USING (true);

-- Solo Administradores pueden crear/editar/eliminar roles
CREATE POLICY "roles_all_admin" ON public.roles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol = 1));


-- CATEGORÍAS
-- Todos pueden leer (para mostrar categorías al vender)
CREATE POLICY "categorias_select" ON public.categorias
  FOR SELECT USING (true);

-- Solo Admin y Supervisor pueden crear/editar/eliminar categorías
CREATE POLICY "categorias_mod" ON public.categorias
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));


-- MÉTODOS DE PAGO
-- Todos pueden leer (para mostrar opciones en la venta)
CREATE POLICY "metodos_pago_select" ON public.metodos_pago
  FOR SELECT USING (true);

-- Solo Admin y Supervisor pueden modificarlos
CREATE POLICY "metodos_pago_mod" ON public.metodos_pago
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));


-- CLIENTES
-- Cajero, Admin y Supervisor pueden ver y gestionar clientes
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));

CREATE POLICY "clientes_mod" ON public.clientes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));


-- PROVEEDORES
-- Solo Admin y Supervisor
CREATE POLICY "proveedores_select" ON public.proveedores
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));

CREATE POLICY "proveedores_mod" ON public.proveedores
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));


-- PRODUCTOS (INVENTARIO)
-- Todos pueden leer (para vender y revisar stock)
CREATE POLICY "productos_select" ON public.productos
  FOR SELECT USING (true);

-- Solo Admin, Panadero y Supervisor pueden editar stock/crear productos
CREATE POLICY "productos_mod" ON public.productos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 3, 5)));


-- VERSIONES DE PRODUCTOS
CREATE POLICY "producto_versiones_select" ON public.producto_versiones
  FOR SELECT USING (true);

CREATE POLICY "producto_versiones_mod" ON public.producto_versiones
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 3, 5)));


-- CIERRES DE CAJA
-- Cajero, Admin, Supervisor y Contador pueden ver
CREATE POLICY "cierres_caja_select" ON public.cierres_caja
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 4, 5)));

-- Solo Cajero, Admin y Supervisor pueden abrir/cerrar caja
CREATE POLICY "cierres_caja_mod" ON public.cierres_caja
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));


-- VENTAS
-- Admin, Contador y Supervisor pueden ver el historial completo
CREATE POLICY "ventas_select" ON public.ventas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 4, 5)));

-- Cajero, Admin y Supervisor pueden registrar ventas
CREATE POLICY "ventas_insert" ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));


-- DETALLE DE VENTAS
CREATE POLICY "detalle_venta_select" ON public.detalle_venta
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 4, 5)));

CREATE POLICY "detalle_venta_insert" ON public.detalle_venta
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 2, 5)));


-- COMPRAS
-- Solo Admin y Supervisor
CREATE POLICY "compras_select" ON public.compras
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));

CREATE POLICY "compras_mod" ON public.compras
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));


-- DETALLE DE COMPRAS
CREATE POLICY "detalle_compra_select" ON public.detalle_compra
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));

CREATE POLICY "detalle_compra_mod" ON public.detalle_compra
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 5)));


-- PRODUCCIÓN Y DESCARTE
-- Solo Admin, Panadero y Supervisor
CREATE POLICY "produccion_descarte_select" ON public.produccion_descarte
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 3, 5)));

CREATE POLICY "produccion_descarte_mod" ON public.produccion_descarte
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id_rol IN (1, 3, 5)));


-- ============================================================
-- ✅ FIN DEL SCRIPT
-- Verifica en Supabase > Authentication > Policies que 
-- todas las políticas aparecen correctamente.
-- ============================================================
