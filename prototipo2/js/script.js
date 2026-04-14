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

const renderReports = () => {
    // Logic for report bars
    const bars = document.querySelectorAll('.bar-fill');
    bars.forEach(b => {
        const h = Math.floor(Math.random() * 80) + 20;
        b.style.height = h + '%';
    });
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
