// --- STATE ---
let products = JSON.parse(localStorage.getItem('p2_products')) || [
    { id: 1, name: 'Panciito de Yema', category: 'Panes', price: 0.50, stock: 120, icon: '🍞' },
    { id: 2, name: 'Croissant Mantequilla', category: 'Panes', price: 3.50, stock: 45, icon: '🥐' },
    { id: 3, name: 'Torta Selva Negra', category: 'Tortas', price: 65, stock: 12, icon: '🍰' },
    { id: 4, name: 'Empanada Carne', category: 'Salados', price: 4.50, stock: 30, icon: '🥟' },
    { id: 5, name: 'Café Americano', category: 'Bebidas', price: 6.00, stock: 100, icon: '☕' },
    { id: 6, name: 'Donut Chocolate', category: 'Dulces', price: 3.00, stock: 25, icon: '🍩' }
];

let users = JSON.parse(localStorage.getItem('p2_users')) || [
    { id: 1, user: 'admin', pass: '1234', name: 'Admin Principal', roles: ['Administrador'], status: 'active' },
    { id: 2, user: 'vera', pass: '1234', name: 'Vera S.', roles: ['Cajero'], status: 'active' },
    { id: 3, user: 'conta', pass: '1234', name: 'Ana Contable', roles: ['Contabilidad'], status: 'active' }
];

let sales = JSON.parse(localStorage.getItem('p2_sales')) || [];
let cart = [];
let currentUser = null;
let currentRole = null;

const saveData = () => {
    localStorage.setItem('p2_products', JSON.stringify(products));
    localStorage.setItem('p2_users', JSON.stringify(users));
    localStorage.setItem('p2_sales', JSON.stringify(sales));
};

// --- AUTH ---
window.loginStep = () => {
    const u = document.getElementById('uInput').value.trim();
    const p = document.getElementById('pInput').value.trim();
    const user = users.find(x => x.user === u && x.pass === p && x.status === 'active');

    if (!user) {
        showToast('❌ Usuario o contraseña incorrectos');
        return;
    }

    currentUser = user;
    if (user.roles.length === 1) {
        currentRole = user.roles[0];
        enterApp();
    } else {
        showRoles(user);
    }
};

const showRoles = (user) => {
    document.getElementById('greetName').textContent = user.name.split(' ')[0];
    const list = document.getElementById('rolesList');
    list.innerHTML = '';
    
    const icons = { 'Administrador':'👑', 'Cajero':'🛒', 'Contabilidad':'📈' };
    const descs = { 'Administrador':'Acceso total al sistema', 'Cajero':'Ventas y caja diaria', 'Contabilidad':'Ver reportes y estados' };

    user.roles.forEach((r, idx) => {
        const d = document.createElement('div');
        d.className = 'role-opt' + (idx === 0 ? ' selected' : '');
        if(idx === 0) currentRole = r;
        d.innerHTML = `
            <div class="r-icon">${icons[r]||'👤'}</div>
            <div class="r-info">
                <div class="r-name">${r}</div>
                <div class="r-desc">${descs[r]||'Ingreso al sistema'}</div>
            </div>
            <div class="r-check">${idx === 0 ? '✓' : ''}</div>
        `;
        d.onclick = () => {
            document.querySelectorAll('.role-opt').forEach(o => { 
                o.classList.remove('selected'); 
                o.querySelector('.r-check').textContent = ''; 
            });
            d.classList.add('selected');
            d.querySelector('.r-check').textContent = '✓';
            currentRole = r;
        };
        list.appendChild(d);
    });

    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    document.getElementById('loginWrap').classList.add('role-mode');
};

window.enterWithRole = () => { if(currentRole) enterApp(); };
window.backStep = () => {
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('loginWrap').classList.remove('role-mode');
};

const enterApp = () => {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('appWrap').style.display = 'block';
    
    document.getElementById('navName').textContent = currentUser.name;
    document.getElementById('navRole').textContent = currentRole;
    document.getElementById('navAv').textContent = currentUser.name[0];
    
    if (currentRole !== 'Administrador') {
        document.querySelectorAll('.admin-only').forEach(e => e.style.display = 'none');
    }

    renderCatalog();
    renderInventory();
    renderDashboard();
    renderUsers();
    showToast(`✅ Bienvenido, ${currentUser.name.split(' ')[0]}`);
};

window.logout = () => {
    currentUser = null; currentRole = null;
    document.getElementById('loginWrap').style.display = 'grid';
    document.getElementById('appWrap').style.display = 'none';
    backStep();
};

// --- NAVIGATION ---
window.goScreen = (name, el) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('scr-' + name).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if(el) el.classList.add('active');
    
    if(name === 'dashboard') renderDashboard();
    if(name === 'reportes') renderReports();
};

// --- POS LOGIC ---
const renderCatalog = (filter = '') => {
    const grid = document.getElementById('catalogGrid');
    if(!grid) return;
    const filtered = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    grid.innerHTML = filtered.map(p => `
        <div class="prod-card" onclick="addToCart(${p.id})">
            <div class="pc-emoji">${p.icon}</div>
            <div class="pc-name">${p.name}</div>
            <div class="pc-price">S/. ${p.price.toFixed(2)}</div>
            <div class="pc-stock">${p.stock} disponibles</div>
        </div>
    `).join('');
};

window.catalogSearch = (val) => renderCatalog(val);

window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    if (!p || p.stock <= 0) { showToast('❌ Sin stock'); return; }
    
    const item = cart.find(i => i.id === id);
    if (item) {
        if (item.qty >= p.stock) { showToast('⚠️ Límite de stock'); return; }
        item.qty++;
    } else {
        cart.push({ ...p, qty: 1 });
    }
    renderTicket();
};

window.changeQty = (id, d) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const p = products.find(x => x.id === id);
    if (d > 0 && item.qty >= p.stock) return;
    
    item.qty += d;
    if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
    renderTicket();
};

const renderTicket = () => {
    const list = document.getElementById('ticketList');
    if (cart.length === 0) {
        list.innerHTML = '<div class="ticket-empty"><div>🛒</div>Tu pedido está vacío</div>';
        document.getElementById('tsSub').textContent = 'S/. 0.00';
        document.getElementById('tsTotal').textContent = 'S/. 0.00';
        return;
    }
    
    let sub = 0;
    list.innerHTML = cart.map(i => {
        sub += i.price * i.qty;
        return `
            <div class="t-line">
                <div class="tl-info">
                    <div class="tl-n">${i.name}</div>
                    <div class="tl-q-wrap">
                        <button class="q-btn" onclick="changeQty(${i.id}, -1)">-</button>
                        <span style="font-weight:700">${i.qty}</span>
                        <button class="q-btn" onclick="changeQty(${i.id}, 1)">+</button>
                    </div>
                </div>
                <div class="tl-p">S/. ${(i.price * i.qty).toFixed(2)}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('tsSub').textContent = 'S/. ' + sub.toFixed(2);
    document.getElementById('tsTotal').textContent = 'S/. ' + sub.toFixed(2);
};

window.clearCart = () => { cart = []; renderTicket(); };

window.payTicket = () => {
    if (cart.length === 0) return;
    
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const sale = {
        id: Date.now(),
        num: sales.length + 1001,
        items: [...cart],
        total: total,
        date: new Date().toLocaleDateString('es-PE'),
        time: new Date().toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'})
    };

    // Sub Stock
    cart.forEach(item => {
        const prod = products.find(p => p.id === item.id);
        if(prod) prod.stock -= item.qty;
    });

    sales.push(sale);
    saveData();
    
    showReceipt(sale);
    clearCart();
    renderCatalog();
    renderInventory();
};

const showReceipt = (sale) => {
    document.getElementById('rbNum').textContent = '#' + sale.num;
    document.getElementById('rbDate').textContent = sale.date + ' ' + sale.time;
    document.getElementById('rbList').innerHTML = sale.items.map(i => `
        <div class="receipt-line">
            <span>${i.name} x${i.qty}</span>
            <span>S/. ${(i.price * i.qty).toFixed(2)}</span>
        </div>
    `).join('');
    document.getElementById('rbTotal').textContent = 'S/. ' + sale.total.toFixed(2);
    document.getElementById('receiptModal').classList.add('open');
};

window.closeModal = (id) => document.getElementById(id).classList.remove('open');

// --- INVENTORY ---
window.renderInventory = (search = '') => {
    const body = document.getElementById('inventoryBody');
    if(!body) return;
    const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    
    body.innerHTML = filtered.map(p => `
        <tr>
            <td>
                <div class="tbl-icon">
                    <div class="tbl-thumb">${p.icon}</div>
                    <strong>${p.name}</strong>
                </div>
            </td>
            <td><span class="pill pill-blue">${p.category}</span></td>
            <td style="font-weight:700">S/. ${p.price.toFixed(2)}</td>
            <td><span class="pill ${p.stock <= 0 ? 'pill-red' : p.stock < 15 ? 'pill-orange' : 'pill-green'}">${p.stock} und.</span></td>
            <td>
                <div class="action-btns">
                    <button class="ab-btn" onclick="editProd(${p.id})">✏️</button>
                    <button class="ab-btn del" onclick="delProd(${p.id})">🗑</button>
                </div>
            </td>
        </tr>
    `).join('');
};

window.addProd = () => {
    document.getElementById('prodTitle').textContent = 'Nuevo Producto';
    document.getElementById('prodId').value = '';
    document.getElementById('prodForm').reset();
    document.getElementById('prodModal').classList.add('open');
};

window.editProd = (id) => {
    const p = products.find(x => x.id === id);
    if(!p) return;
    document.getElementById('prodTitle').textContent = 'Editar Producto';
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodCat').value = p.category;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodIcon').value = p.icon;
    document.getElementById('prodModal').classList.add('open');
};

window.saveProd = () => {
    const id = document.getElementById('prodId').value;
    const n = document.getElementById('prodName').value;
    const c = document.getElementById('prodCat').value;
    const p = parseFloat(document.getElementById('prodPrice').value);
    const s = parseInt(document.getElementById('prodStock').value);
    const i = document.getElementById('prodIcon').value;

    if(!n || isNaN(p)) return;

    if(id) {
        const idx = products.findIndex(x => x.id == id);
        products[idx] = { ...products[idx], name: n, category: c, price: p, stock: s, icon: i };
    } else {
        const newId = products.length > 0 ? Math.max(...products.map(x => x.id)) + 1 : 1;
        products.push({ id: newId, name: n, category: c, price: p, stock: s, icon: i });
    }

    saveData();
    renderInventory();
    renderCatalog();
    closeModal('prodModal');
    showToast('✅ Inventario actualizado');
};

window.delProd = (id) => {
    if(!confirm('¿Eliminar producto?')) return;
    products = products.filter(x => x.id !== id);
    saveData();
    renderInventory();
    renderCatalog();
    showToast('🗑 Producto eliminado');
};

// --- USERS ---
const renderUsers = () => {
    const stack = document.getElementById('usersStack');
    if(!stack) return;
    stack.innerHTML = users.map(u => `
        <div class="user-row">
            <div class="ur-av">${u.name[0]}</div>
            <div class="ur-i">
                <div class="ur-n">${u.name}</div>
                <div class="ur-r">${u.roles.join(' / ')}</div>
            </div>
            <div class="ur-s">
                <span class="pill ${u.status === 'active' ? 'pill-green' : 'pill-red'}">${u.status}</span>
            </div>
            <div class="action-btns">
                <button class="ab-btn" onclick="editUser(${u.id})">✏️</button>
                <button class="ab-btn" onclick="toggleUser(${u.id})">🚫</button>
            </div>
        </div>
    `).join('');
};

window.addUser = () => {
    document.getElementById('userTitle').textContent = 'Nuevo Usuario';
    document.getElementById('userId').value = '';
    document.getElementById('userForm').reset();
    document.getElementById('userModal').classList.add('open');
};

window.saveUser = () => {
    const id = document.getElementById('userId').value;
    const n = document.getElementById('userName').value;
    const u = document.getElementById('userLogin').value;
    const p = document.getElementById('userPass').value;
    const r = document.getElementById('userRole').value;

    if(!n || !u) return;

    if(id) {
        const idx = users.findIndex(x => x.id == id);
        users[idx] = { ...users[idx], name: n, user: u, pass: p, roles: [r] };
    } else {
        const newId = users.length > 0 ? Math.max(...users.map(x => x.id)) + 1 : 1;
        users.push({ id: newId, name: n, user: u, pass: p, roles: [r], status: 'active' });
    }
    saveData();
    renderUsers();
    closeModal('userModal');
};

window.toggleUser = (id) => {
    const u = users.find(x => x.id === id);
    if(u) u.status = u.status === 'active' ? 'inactive' : 'active';
    saveData();
    renderUsers();
};

// --- REPORTS ---
const renderDashboard = () => {
    const today = new Date().toLocaleDateString('es-PE');
    const todaySales = sales.filter(s => s.date === today);
    const total = todaySales.reduce((s, x) => s + x.total, 0);
    const productsSold = todaySales.reduce((s, x) => s + x.items.reduce((a, b) => a + b.qty, 0), 0);
    const lowStock = products.filter(p => p.stock < 15).length;

    const v = document.querySelectorAll('.kpi-value');
    if(v.length) {
        v[0].textContent = 'S/. ' + total.toFixed(2);
        v[1].textContent = todaySales.length;
        v[2].textContent = productsSold;
        v[3].textContent = lowStock;
    }

    const t = document.getElementById('recentSalesBody');
    if(t) {
        t.innerHTML = todaySales.slice(-6).reverse().map(s => `
            <tr>
                <td><strong>#${s.num}</strong></td>
                <td style="color:var(--text-2)">${s.items.length} productos</td>
                <td>${s.time}</td>
                <td style="font-weight:800; text-align:right">S/. ${s.total.toFixed(2)}</td>
            </tr>
        `).join('');
    }
};

// ── Demo data for reports (realistic bakery day) ──
const DEMO_SALES = [
    { num: 1001, time: '07:12', items: [{name:'Panciito de Yema',qty:12,price:0.5},{name:'Café Americano',qty:2,price:6}], total: 18.00 },
    { num: 1002, time: '07:35', items: [{name:'Croissant Mantequilla',qty:2,price:3.5},{name:'Café Americano',qty:2,price:6}], total: 19.00 },
    { num: 1003, time: '08:05', items: [{name:'Empanada Carne',qty:4,price:4.5}], total: 18.00 },
    { num: 1004, time: '08:22', items: [{name:'Panciito de Yema',qty:20,price:0.5},{name:'Donut Chocolate',qty:3,price:3}], total: 19.00 },
    { num: 1005, time: '08:50', items: [{name:'Torta Selva Negra',qty:1,price:65}], total: 65.00 },
    { num: 1006, time: '09:10', items: [{name:'Croissant Mantequilla',qty:3,price:3.5},{name:'Café Americano',qty:3,price:6}], total: 28.50 },
    { num: 1007, time: '09:40', items: [{name:'Empanada Carne',qty:6,price:4.5}], total: 27.00 },
    { num: 1008, time: '10:15', items: [{name:'Donut Chocolate',qty:5,price:3},{name:'Café Americano',qty:2,price:6}], total: 27.00 },
    { num: 1009, time: '10:30', items: [{name:'Panciito de Yema',qty:30,price:0.5}], total: 15.00 },
    { num: 1010, time: '11:00', items: [{name:'Torta Selva Negra',qty:1,price:65},{name:'Croissant Mantequilla',qty:2,price:3.5}], total: 72.00 },
    { num: 1011, time: '11:20', items: [{name:'Empanada Carne',qty:4,price:4.5},{name:'Café Americano',qty:2,price:6}], total: 30.00 },
    { num: 1012, time: '11:45', items: [{name:'Panciito de Yema',qty:15,price:0.5},{name:'Donut Chocolate',qty:4,price:3}], total: 19.50 },
    { num: 1013, time: '12:10', items: [{name:'Torta Selva Negra',qty:2,price:65}], total: 130.00 },
    { num: 1014, time: '12:30', items: [{name:'Croissant Mantequilla',qty:4,price:3.5},{name:'Café Americano',qty:4,price:6}], total: 38.00 },
    { num: 1015, time: '12:55', items: [{name:'Empanada Carne',qty:8,price:4.5}], total: 36.00 },
    { num: 1016, time: '13:15', items: [{name:'Donut Chocolate',qty:6,price:3},{name:'Panciito de Yema',qty:10,price:0.5}], total: 23.00 },
    { num: 1017, time: '13:40', items: [{name:'Torta Selva Negra',qty:1,price:65},{name:'Café Americano',qty:3,price:6}], total: 83.00 },
    { num: 1018, time: '14:05', items: [{name:'Croissant Mantequilla',qty:5,price:3.5}], total: 17.50 },
    { num: 1019, time: '14:30', items: [{name:'Empanada Carne',qty:3,price:4.5},{name:'Donut Chocolate',qty:2,price:3}], total: 19.50 },
    { num: 1020, time: '15:00', items: [{name:'Panciito de Yema',qty:25,price:0.5},{name:'Café Americano',qty:2,price:6}], total: 24.50 },
    { num: 1021, time: '15:20', items: [{name:'Torta Selva Negra',qty:1,price:65},{name:'Croissant Mantequilla',qty:3,price:3.5}], total: 75.50 },
    { num: 1022, time: '16:00', items: [{name:'Empanada Carne',qty:5,price:4.5},{name:'Café Americano',qty:3,price:6}], total: 40.50 },
    { num: 1023, time: '16:30', items: [{name:'Donut Chocolate',qty:8,price:3}], total: 24.00 },
    { num: 1024, time: '17:10', items: [{name:'Panciito de Yema',qty:40,price:0.5},{name:'Croissant Mantequilla',qty:2,price:3.5}], total: 27.00 },
    { num: 1025, time: '17:45', items: [{name:'Torta Selva Negra',qty:1,price:65},{name:'Café Americano',qty:4,price:6}], total: 89.00 },
    { num: 1026, time: '18:05', items: [{name:'Empanada Carne',qty:6,price:4.5},{name:'Donut Chocolate',qty:3,price:3}], total: 36.00 },
    { num: 1027, time: '18:30', items: [{name:'Panciito de Yema',qty:20,price:0.5},{name:'Croissant Mantequilla',qty:4,price:3.5}], total: 24.00 },
    { num: 1028, time: '19:00', items: [{name:'Café Americano',qty:5,price:6},{name:'Donut Chocolate',qty:4,price:3}], total: 42.00 },
    { num: 1029, time: '19:30', items: [{name:'Torta Selva Negra',qty:1,price:65}], total: 65.00 },
    { num: 1030, time: '19:55', items: [{name:'Empanada Carne',qty:4,price:4.5},{name:'Panciito de Yema',qty:15,price:0.5}], total: 25.50 },
];

const HOURLY_DATA = { 7:2, 8:3, 9:2, 10:3, 11:3, 12:3, 13:3, 14:2, 15:3, 16:2, 17:2, 18:2, 19:3 };
const HOURLY_AMT  = { 7:37, 8:102, 9:55.5, 10:57, 11:121.5, 12:203, 13:141, 14:37, 15:125, 16:64.5, 17:116, 18:85, 19:132.5 };

const CAT_COLORS = {
    'Panes':   '#F59E0B',
    'Tortas':  '#C8783A',
    'Salados': '#22C55E',
    'Bebidas': '#3B82F6',
    'Dulces':  '#A855F7',
};

let currentRepPeriod = 'hoy';

window.setRepPeriod = (period, btn) => {
    currentRepPeriod = period;
    document.querySelectorAll('.rf-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderReports();
};

const renderReports = () => {
    // Pick real sales or demo depending on data availability
    const today = new Date().toLocaleDateString('es-PE');
    const realSalesToday = sales.filter(s => s.date === today);
    const allSales = realSalesToday.length > 0 ? realSalesToday : DEMO_SALES;

    // ── Date label ──
    const dateEl = document.getElementById('repDate');
    if(dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' }) +
            ' | ' + now.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
    }

    // ── KPIs ──
    const total = allSales.reduce((s, x) => s + x.total, 0);
    const txns  = allSales.length;
    const avg   = txns > 0 ? total / txns : 0;
    const units = allSales.reduce((s, x) => s + x.items.reduce((a, b) => a + b.qty, 0), 0);

    const multipliers = { hoy: 1, semana: 6.8, mes: 26.3 };
    const m = multipliers[currentRepPeriod] || 1;

    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    set('repTotal', 'S/. ' + (total * m).toLocaleString('es-PE', { minimumFractionDigits: 2 }));
    set('repTxn',   Math.round(txns * m));
    set('repAvg',   'S/. ' + avg.toFixed(2));
    set('repUnits', Math.round(units * m));

    const setDelta = (id, txt, cls) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.textContent = txt; el.className = 'rk-delta ' + cls;
    };
    const deltas = { hoy: ['↑ 12.4% vs ayer', '↑ 5 más que ayer', '↑ S/. 4.20', '↑ 8.1%'],
                     semana: ['↑ 7.2% vs semana ant.', '↑ 18 más', '↑ S/. 1.80', '↓ 2.3%'],
                     mes: ['↑ 21.3% vs mes ant.', '↑ 84 transacciones', '↑ S/. 6.40', '↑ 14.7%'] };
    const d = deltas[currentRepPeriod];
    setDelta('repTotalDelta', d[0], 'up');
    setDelta('repTxnDelta',   d[1], 'up');
    setDelta('repAvgDelta',   d[2], 'up');
    setDelta('repUnitsDelta', d[3], d[3].startsWith('↓') ? 'down' : 'up');

    // ── Hourly Chart ──
    const chart  = document.getElementById('hourlyChart');
    const labels = document.getElementById('chartLabels');
    if(chart && labels) {
        const hours = [7,8,9,10,11,12,13,14,15,16,17,18,19];
        const vals  = hours.map(h => HOURLY_AMT[h] || 0);
        const maxV  = Math.max(...vals);
        const peakH = hours[vals.indexOf(maxV)];

        chart.innerHTML = hours.map(h => {
            const pct = maxV > 0 ? Math.round((HOURLY_AMT[h] / maxV) * 100) : 5;
            const isPeak = h === peakH;
            const amtStr = 'S/. ' + (HOURLY_AMT[h] || 0).toFixed(0);
            return `<div class="h-bar-col">
                <div class="h-bar ${isPeak ? 'peak' : ''}" style="height:${Math.max(pct,5)}%">
                    <div class="h-bar-tooltip">${amtStr}</div>
                </div>
            </div>`;
        }).join('');

        labels.innerHTML = hours.map(h => `<span>${h}h</span>`).join('');
    }

    // ── Top Products ──
    const prodTotals = {};
    allSales.forEach(s => s.items.forEach(i => {
        prodTotals[i.name] = (prodTotals[i.name] || 0) + (i.price * i.qty * m);
    }));
    const sorted = Object.entries(prodTotals).sort((a,b) => b[1]-a[1]).slice(0,5);
    const maxAmt = sorted[0]?.[1] || 1;

    const rankCls = ['r1','r2','r3','rn','rn'];
    const topEl = document.getElementById('topProducts');
    if(topEl) {
        topEl.innerHTML = sorted.map(([name, amt], i) => {
            const emoji = (products.find(p => p.name === name) || {}).icon || '🍞';
            const pct = Math.round((amt / maxAmt) * 100);
            return `<div class="tp-item">
                <div class="tp-row">
                    <div class="tp-rank ${rankCls[i]}">${i+1}</div>
                    <span class="tp-emoji">${emoji}</span>
                    <span class="tp-name">${name}</span>
                    <span class="tp-amount">S/. ${amt.toFixed(0)}</span>
                </div>
                <div class="tp-bar-track">
                    <div class="tp-bar-fill" style="width:${pct}%"></div>
                </div>
            </div>`;
        }).join('');
    }

    // ── Category Breakdown ──
    const catTotals = {};
    allSales.forEach(s => s.items.forEach(i => {
        const prod = products.find(p => p.name === i.name);
        const cat = prod ? prod.category : 'Otros';
        catTotals[cat] = (catTotals[cat] || 0) + (i.price * i.qty * m);
    }));
    const catArr = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
    const catMax = catArr[0]?.[1] || 1;
    const catTotal = catArr.reduce((s,[,v]) => s+v, 0);
    const colors = ['#C8783A','#22C55E','#3B82F6','#A855F7','#F59E0B','#EF4444'];

    const catEl = document.getElementById('catList');
    if(catEl) {
        catEl.innerHTML = catArr.map(([cat, amt], i) => {
            const pct = Math.round((amt / catTotal) * 100);
            const barW = Math.round((amt / catMax) * 100);
            const color = CAT_COLORS[cat] || colors[i % colors.length];
            return `<div class="cat-item">
                <div class="cat-row">
                    <div class="cat-dot" style="background:${color}"></div>
                    <span class="cat-name">${cat}</span>
                    <span class="cat-pct">${pct}%</span>
                </div>
                <div class="cat-track">
                    <div class="cat-fill" style="width:${barW}%; background:${color}"></div>
                </div>
            </div>`;
        }).join('');
    }

    // ── Transactions Table ──
    const txnCountEl = document.getElementById('txnCount');
    if(txnCountEl) txnCountEl.textContent = allSales.length + ' ventas';

    const txnBody = document.getElementById('txnBody');
    if(txnBody) {
        const shown = [...allSales].reverse().slice(0, 18);
        txnBody.innerHTML = shown.map((s, idx) => {
            const isPaid = idx % 9 !== 0;  // simulate mostly paid
            const itemsSummary = s.items.map(i => `${i.name} ×${i.qty}`).join(', ');
            const brief = itemsSummary.length > 38 ? itemsSummary.slice(0,38) + '…' : itemsSummary;
            return `<tr>
                <td><strong style="color:var(--text)">#${s.num}</strong></td>
                <td style="color:var(--text-3); font-size:12px">${s.time}</td>
                <td style="font-size:12.5px; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${brief}</td>
                <td style="text-align:right; font-weight:800; color:var(--text)">S/. ${s.total.toFixed(2)}</td>
                <td><span class="txn-badge ${isPaid ? 'txn-paid' : 'txn-pending'}">${isPaid ? 'Pagado' : 'Pendiente'}</span></td>
            </tr>`;
        }).join('');
    }
};


// --- UTILS ---
window.showToast = (msg) => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    renderCatalog();
    renderInventory();
    renderDashboard();
    renderUsers();
});
