-- SQL Demo Data for Snack Roque

-- 1. Roles
INSERT INTO rol (id_rol, nombre, estado) VALUES 
(1, 'Administrador', 1),
(2, 'Cajero', 1),
(3, 'Panadero', 1);

-- 2. Usuarios
INSERT INTO usuario (id_usuario, id_rol, nombre, apellido_paterno, apellido_materno, user_login, password, correo, fec_registro, estado) VALUES 
(1, 1, 'Admin', 'Sistema', 'Principal', 'admin', '1234', 'admin@snackroque.com', NOW(), 1),
(2, 2, 'Carlos', 'Rodriguez', 'Lopez', 'carlos', '1234', 'carlos@snackroque.com', NOW(), 1),
(3, 2, 'Maria', 'Sanches', 'Gomez', 'maria', '1234', 'maria@snackroque.com', NOW(), 1);

-- 3. Turnos
INSERT INTO turno (id_turno, nombre, hora_inicio, hora_fin, estado) VALUES 
(1, 'Mañana', '06:00:00', '14:00:00', 1),
(2, 'Tarde', '14:00:00', '22:00:00', 1);

-- 4. Categorías
INSERT INTO categoria (id_categoria, nombre, estado) VALUES 
(1, 'Panes', 1),
(2, 'Tortas', 1),
(3, 'Dulces', 1),
(4, 'Bebidas', 1);

-- 5. Métodos de Pago
INSERT INTO metodo_pago (id_metodo_pago, tipo_pago, estado) VALUES 
(1, 'Efectivo', 1),
(2, 'Tarjeta', 1),
(3, 'Yape', 1),
(4, 'Plin', 1);

-- 6. Clientes
INSERT INTO cliente (id_cliente, nombre, estado) VALUES 
(1, 'Publico General', 1),
(2, 'Juan Perez', 1),
(3, 'Maria Lopez', 1);

-- 7. Proveedores
INSERT INTO proveedor (id_proveedor, ruc, nombre_empresa, num_telefono, direccion, estado) VALUES 
(1, '20123456789', 'Harinas S.A.', '987654321', 'Av. Trigo 123', 1),
(2, '20987654321', 'Distribuidora Dulce', '912345678', 'Calle Azucar 456', 1);

-- 8. Productos
INSERT INTO producto (id_producto, id_categoria, nombre, num_stock, precio_unitario, estado) VALUES 
(1, 1, 'Pan Frances', 500, 0.20, 1),
(2, 1, 'Croissant', 100, 2.50, 1),
(3, 2, 'Torta de Chocolate', 15, 45.00, 1),
(4, 4, 'Café Americano', 50, 5.00, 1);

-- 9. Proveedor_Producto
INSERT INTO proveedor_producto (id_proveedor_producto, id_proveedor, id_producto, precio_compra, estado) VALUES 
(1, 1, 1, 0.10, 1),
(2, 2, 3, 30.00, 1);

-- 10. Cierre de Caja
INSERT INTO cierre_caja (id_cierre_caja, id_usuario, id_turno, fec_apertura, fec_cierre, tot_saldo_initial, tot_ventas, estado) VALUES 
(1, 2, 1, '2026-05-15 06:00:00', '2026-05-15 14:00:00', 100.00, 842.00, 1);

-- 11. Ventas
INSERT INTO venta (id_venta, id_cliente, id_usuario, id_cierre_caja, id_metodo_pago, fec_venta, sub_total, igv, tot_pago, estado) VALUES 
(1, 1, 2, 1, 1, '2026-05-15 09:14:00', 20.76, 3.74, 24.50, 1),
(2, 2, 3, 1, 3, '2026-05-15 10:02:00', 38.14, 6.86, 45.00, 1);

-- 12. Detalle de Venta
INSERT INTO detalle_venta (id_detalle_venta, id_venta, id_producto, num_cantidad, precio_unitario) VALUES 
(1, 1, 1, 10, 0.20),
(2, 1, 2, 9, 2.50),
(3, 2, 3, 1, 45.00);

-- 13. Compras
INSERT INTO compra (id_compra, id_usuario, fec_compra, sub_total, igv, tot_pago, estado) VALUES 
(1, 1, '2026-05-14 15:00:00', 100.00, 18.00, 118.00, 1);

-- 14. Detalle de Compra
INSERT INTO detalle_compra (id_detalle_compra, id_compra, id_producto, id_proveedor, num_cantidad, precio_compra) VALUES 
(1, 1, 1, 1, 1000, 0.10);
