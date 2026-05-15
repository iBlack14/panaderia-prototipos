require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del prototipo
app.use(express.static(path.join(__dirname, 'prototipo3')));

// Configuración de la base de datos
let pool;
try {
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('✅ Pool de conexiones configurado (esperando DB real)');
} catch (error) {
    console.error('❌ Error al configurar el pool de DB:', error.message);
}

// --- ENDPOINTS API ---

// 1. Productos / Inventario
app.get('/api/productos', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM producto WHERE estado = 1');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos', details: error.message });
    }
});

// 2. Ventas
app.post('/api/ventas', async (req, res) => {
    const { id_cliente, id_usuario, id_metodo_pago, items, total } = req.body;
    // Lógica para insertar venta y detalles...
    res.json({ success: true, message: 'Venta registrada en DB' });
});

// 3. Usuarios / Login
app.post('/api/login', async (req, res) => {
    const { user, pass } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM usuario WHERE user_login = ? AND password = ? AND estado = 1', [user, pass]);
        if (rows.length > 0) {
            res.json({ success: true, user: rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Ruta por defecto
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'prototipo3', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
🚀 Servidor Profesional Iniciado
-------------------------------
📍 Local: http://localhost:${PORT}
🔧 Entorno: ${process.env.NODE_ENV}
📂 Dashboard: http://localhost:${PORT}/index.html
-------------------------------
    `);
});
