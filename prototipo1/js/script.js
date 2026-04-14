// --- STATE MANAGEMENT ---
let products = JSON.parse(localStorage.getItem('p1_products')) || [
  { id: 1, name: 'Pan Francés', category: 'Panes', price: 0.20, stock: 250, icon: '🥖' },
  { id: 2, name: 'Croissant', category: 'Panes', price: 2.50, stock: 5, icon: '🥐' },
  { id: 3, name: 'Torta Chocolate', category: 'Tortas', price: 45.00, stock: 8, icon: '🎂' },
  { id: 4, name: 'Pan de Molde', category: 'Panes', price: 8.00, stock: 0, icon: '🍞' },
  { id: 5, name: 'Empanada', category: 'Otros', price: 1.50, stock: 60, icon: '🥟' },
  { id: 6, name: 'Cachito', category: 'Panes', price: 1.00, stock: 45, icon: '🥖' },
  { id: 7, name: 'Pan Integral', category: 'Panes', price: 3.50, stock: 20, icon: '🍞' },
  { id: 8, name: 'Rosca', category: 'Otros', price: 4.00, stock: 15, icon: '🍩' }
];

let users = JSON.parse(localStorage.getItem('p1_users')) || [
  { id: 1, user: 'admin', pass: '1234', name: 'María Rodríguez', roles: ['Administrador', 'Cajero'], status: 'active' },
  { id: 2, user: 'cajero', pass: '1234', name: 'Juan López', roles: ['Cajero'], status: 'active' },
  { id: 3, user: 'ana', pass: '1234', name: 'Ana Paredes', roles: ['Cajero'], status: 'active' }
];

let sales = JSON.parse(localStorage.getItem('p1_sales')) || [
  { id: 37, items: [{name:'Pan francés', qty:10, price:0.2}], total: 2.00, time: '11:42 am', date: new Date().toLocaleDateString() },
  { id: 36, items: [{name:'Torta chocolate', qty:1, price:45}], total: 45.00, time: '11:28 am', date: new Date().toLocaleDateString() }
];

let currentUser = null;
let selectedRole = null;
let cart = [];
let nextSaleId = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;

// --- PERSISTENCE ---
const saveData = () => {
    localStorage.setItem('p1_products', JSON.stringify(products));
    localStorage.setItem('p1_users', JSON.stringify(users));
    localStorage.setItem('p1_sales', JSON.stringify(sales));
};

// --- AUTH ---
window.doLogin = () => {
  const uInput = document.getElementById('userInput').value.trim();
  const pInput = document.getElementById('passInput').value.trim();
  const user = users.find(u => u.user === uInput && u.pass === pInput && u.status === 'active');
  
  if (!user) {
    showNotif('❌ Usuario o contraseña incorrectos');
    return;
  }
  
  currentUser = user;
  if (user.roles.length === 1) {
    selectedRole = user.roles[0];
    enterApp();
  } else {
    showRoleSelector(user);
  }
};

const showRoleSelector = (user) => {
  document.getElementById('welcomeName').textContent = user.name.split(' ')[0];
  const grid = document.getElementById('roleGrid');
  grid.innerHTML = '';
  
  const icons = { 'Administrador':'👑', 'Cajero':'🛒' };
  user.roles.forEach(r => {
    const d = document.createElement('div');
    d.className = 'role-card';
    d.innerHTML = `<div class="role-icon">${icons[r]||'👤'}</div><div class="role-name">${r}</div>`;
    d.onclick = () => {
      document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
      d.classList.add('active');
      selectedRole = r;
    };
    grid.appendChild(d);
  });
  grid.children[0].click();
  
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('roleSelector').style.display = 'block';
  document.querySelector('.login-card').classList.add('wide-mode');
};

window.enterWithRole = () => {
  if (!selectedRole) return;
  enterApp();
};

const enterApp = () => {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  
  document.getElementById('sideUserName').textContent = currentUser.name.split(' ')[0];
  document.getElementById('sideRole').textContent = selectedRole;
  document.getElementById('sideAvatar').textContent = currentUser.name[0];
  
  if (selectedRole !== 'Administrador') {
    document.querySelectorAll('.admin-only').forEach(e => e.style.display = 'none');
  } else {
    document.querySelectorAll('.admin-only').forEach(e => e.style.display = 'flex');
  }

  updateDashboard();
  renderCatalog();
  renderProductsTable();
  renderUsersGrid();
  updateClock();
  showNotif(`✅ ¡Bienvenido, ${currentUser.name.split(' ')[0]}!`);
};

window.logout = () => {
  currentUser = null;
  selectedRole = null;
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('roleSelector').style.display = 'none';
  document.querySelector('.login-card').classList.remove('wide-mode');
};

// --- NAVIGATION ---
window.showScreen = (name, btn) => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  const titles = { dashboard: 'Resumen General', ventas: 'Punto de Venta', productos: 'Inventario de Productos', reportes: 'Análisis de Ventas', usuarios: 'Control de Usuarios' };
  document.getElementById('pageTitle').textContent = titles[name] || name;

  if(name === 'dashboard') updateDashboard();
  if(name === 'reportes') renderReports();
};

// --- POS LOGIC ---
const renderCatalog = (filter = '') => {
  const grid = document.querySelector('.quick-products');
  if(!grid) return;
  const filtered = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
  
  grid.innerHTML = filtered.map(p => `
    <div class="quick-product" onclick="addToCart(${p.id})">
      <div class="p-icon">${p.icon}</div>
      <div class="p-name">${p.name}</div>
      <div class="p-price">S/. ${p.price.toFixed(2)}</div>
    </div>
  `).join('');
};

window.addToCart = (id) => {
  const p = products.find(prod => prod.id === id);
  if (!p) return;
  if (p.stock <= 0) {
    showNotif('❌ Sin stock disponible');
    return;
  }
  
  const inCart = cart.find(i => i.id === id);
  if (inCart) {
    if (inCart.qty >= p.stock) {
      showNotif('⚠️ No hay más stock');
      return;
    }
    inCart.qty++;
  } else {
    cart.push({ ...p, qty: 1 });
  }
  renderCart();
};

window.changeCartQty = (id, delta) => {
  const item = cart.find(i => i.id === id);
  if(!item) return;
  const prod = products.find(p => p.id === id);
  
  if (delta > 0 && item.qty >= prod.stock) {
    showNotif('⚠️ Stock máximo alcanzado');
    return;
  }
  
  item.qty += delta;
  if(item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  renderCart();
};

const renderCart = () => {
  const list = document.getElementById('cartItems');
  if (cart.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--text-light);font-size:13px;">Selecciona productos del catálogo</div>';
    document.getElementById('cartTotal').textContent = 'S/. 0.00';
    return;
  }
  
  let total = 0;
  list.innerHTML = cart.map(i => {
    total += i.price * i.qty;
    return `
      <div class="cart-item">
        <div class="ci-info">
          <div class="ci-name">${i.name}</div>
          <div class="ci-qty-wrap">
            <div class="ci-btns">
               <button class="ci-btn" onclick="changeCartQty(${i.id}, -1)">-</button>
               <span class="ci-qty">${i.qty}</span>
               <button class="ci-btn" onclick="changeCartQty(${i.id}, 1)">+</button>
            </div>
            <span style="font-size:11px; color:var(--text-light)">× S/. ${i.price.toFixed(2)}</span>
          </div>
        </div>
        <div class="ci-price">S/. ${(i.price * i.qty).toFixed(2)}</div>
      </div>
    `;
  }).join('');
  document.getElementById('cartTotal').textContent = 'S/. ' + total.toFixed(2);
};

window.clearCart = () => { cart = []; renderCart(); };

window.processSale = () => {
  if (cart.length === 0) {
    showNotif('⚠️ El carrito está vacío');
    return;
  }
  
  const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const now = new Date();
  const sale = {
    id: nextSaleId++,
    items: cart.map(i => ({ ...i })),
    total: total,
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString(),
    timestamp: now.getTime()
  };
  
  // Update Stock
  cart.forEach(item => {
    const p = products.find(prod => prod.id === item.id);
    if(p) p.stock -= item.qty;
  });
  
  sales.push(sale);
  saveData();
  
  // UI Update
  showReceipt(sale);
  renderCatalog();
  renderProductsTable();
  cart = [];
  renderCart();
  document.getElementById('saleNum').textContent = '#' + String(nextSaleId).padStart(4, '0');
};

const showReceipt = (sale) => {
  document.getElementById('receiptItems').innerHTML = sale.items.map(i => `
    <div class="receipt-row">
      <span>${i.name} (x${i.qty})</span>
      <span>S/. ${(i.price * i.qty).toFixed(2)}</span>
    </div>
  `).join('');
  document.getElementById('receiptTotal').textContent = 'S/. ' + sale.total.toFixed(2);
  document.getElementById('receiptNum').textContent = '#' + String(sale.id).padStart(4, '0');
  document.getElementById('receiptDate').textContent = sale.date + ' ' + sale.time;
  document.getElementById('receiptModal').classList.add('open');
};

window.closeModal = (id = 'receiptModal') => {
  document.getElementById(id).classList.remove('open');
};

// --- INVENTORY CRUD ---
window.renderProductsTable = (search = '') => {
  const tbody = document.querySelector('.products-table tbody');
  if(!tbody) return;
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>
        <div class="product-chip">
          <div class="product-thumb">${p.icon}</div>
          ${p.name}
        </div>
      </td>
      <td style="color:var(--text-light);font-size:13px">${p.category}</td>
      <td style="font-weight:700">S/. ${p.price.toFixed(2)}</td>
      <td>
        <span class="stock-badge ${p.stock <= 0 ? 'stock-out' : p.stock < 10 ? 'stock-low' : 'stock-ok'}">
          ${p.stock} und.
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit-btn" onclick="openEditProduct(${p.id})">✏️</button>
          <button class="action-btn del-btn" onclick="deleteProduct(${p.id})">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
};

window.openAddProduct = () => {
    document.getElementById('prodModalTitle').textContent = 'Agregar Producto';
    document.getElementById('prodId').value = '';
    document.getElementById('prodForm').reset();
    document.getElementById('productModal').classList.add('open');
};

window.openEditProduct = (id) => {
    const p = products.find(p => p.id === id);
    if(!p) return;
    document.getElementById('prodModalTitle').textContent = 'Editar Producto';
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodCategory').value = p.category;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodIcon').value = p.icon;
    document.getElementById('productModal').classList.add('open');
};

window.saveProduct = () => {
    const id = document.getElementById('prodId').value;
    const name = document.getElementById('prodName').value;
    const cat = document.getElementById('prodCategory').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const stock = parseInt(document.getElementById('prodStock').value);
    const icon = document.getElementById('prodIcon').value;

    if(!name || isNaN(price)) { showNotif('⚠️ Completa los campos'); return; }

    if(id) {
        // Edit
        const idx = products.findIndex(p => p.id == id);
        products[idx] = { ...products[idx], name, category: cat, price, stock, icon };
        showNotif('✅ Producto actualizado');
    } else {
        // Add
        const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
        products.push({ id: newId, name, category: cat, price, stock, icon });
        showNotif('✅ Producto creado');
    }

    saveData();
    renderProductsTable();
    renderCatalog();
    closeModal('productModal');
};

window.deleteProduct = (id) => {
    if(!confirm('¿Seguro que deseas eliminar este producto?')) return;
    products = products.filter(p => p.id !== id);
    saveData();
    renderProductsTable();
    renderCatalog();
    showNotif('🗑 Producto eliminado');
};

// --- USERS CRUD ---
const renderUsersGrid = () => {
    const grid = document.querySelector('.users-grid');
    if(!grid) return;
    grid.innerHTML = users.map(u => `
        <div class="user-card">
            <div class="avatar" style="background: linear-gradient(135deg, var(--warm-tan), var(--brown))">${u.name[0]}</div>
            <div class="u-name">${u.name}</div>
            <div class="u-role">${u.roles.join(' / ')}</div>
            <div class="u-status ${u.status==='active'?'status-active':'status-inactive'}">● ${u.status==='active'?'Activo':'Inactivo'}</div>
            <div class="user-actions">
                <button onclick="openEditUser(${u.id})">✏️ Editar</button>
                <button onclick="toggleUserStatus(${u.id})">${u.status==='active'?'Bloquear':'Activar'}</button>
            </div>
        </div>
    `).join('');
};

window.openAddUser = () => {
    document.getElementById('userModalTitle').textContent = 'Nuevo Usuario';
    document.getElementById('userId').value = '';
    document.getElementById('userForm').reset();
    document.getElementById('userModal').classList.add('open');
};

window.saveUser = () => {
    const id = document.getElementById('userId').value;
    const name = document.getElementById('userName').value;
    const userStr = document.getElementById('userUsername').value;
    const pass = document.getElementById('userPass').value;
    const role = document.getElementById('userRole').value;

    if(!name || !userStr || !pass) { showNotif('⚠️ Completa los campos'); return; }

    if(id) {
        const idx = users.findIndex(u => u.id == id);
        users[idx] = { ...users[idx], name, user: userStr, pass, roles: [role] };
        showNotif('✅ Usuario actualizado');
    } else {
        const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
        users.push({ id: newId, name, user: userStr, pass, roles: [role], status: 'active' });
        showNotif('✅ Usuario creado');
    }
    saveData();
    renderUsersGrid();
    closeModal('userModal');
};

window.toggleUserStatus = (id) => {
    const u = users.find(u => u.id === id);
    if(u) u.status = u.status === 'active' ? 'inactive' : 'active';
    saveData();
    renderUsersGrid();
};

// --- REPORTS & DASHBOARD ---
const updateDashboard = () => {
    const todaySales = sales.filter(s => s.date === new Date().toLocaleDateString());
    const totalToday = todaySales.reduce((sum, s) => sum + s.total, 0);
    const unitsToday = todaySales.reduce((sum, s) => sum + s.items.reduce((a,b)=>a+b.qty,0), 0);
    const lowStock = products.filter(p => p.stock < 10 && p.stock > 0).length;
    
    // Update Stats
    const stats = document.querySelectorAll('.stat-value');
    if(stats.length) {
        stats[0].textContent = 'S/. ' + totalToday.toLocaleString();
        stats[1].textContent = unitsToday;
        stats[2].textContent = todaySales.length;
        stats[3].textContent = lowStock;
    }

    // Recent Sales Table
    const recentTbody = document.querySelector('.card table tbody');
    if(recentTbody && todaySales.length > 0) {
        recentTbody.innerHTML = todaySales.slice(-5).reverse().map(s => `
            <tr>
                <td>#${String(s.id).padStart(4,'0')}</td>
                <td>${s.items.map(i=>i.name+' x'+i.qty).join(', ')}</td>
                <td>${s.time}</td>
                <td style="font-weight:700;color:var(--brown)">S/. ${s.total.toFixed(2)}</td>
            </tr>
        `).join('');
    }

    // Critical Stock
    const critGrid = document.querySelectorAll('.card table tbody')[1];
    if(critGrid) {
        const critical = products.filter(p => p.stock < 10).sort((a,b)=>a.stock-b.stock).slice(0,5);
        critGrid.innerHTML = critical.map(p => `
            <tr>
                <td><div class="product-chip"><div class="product-thumb">${p.icon}</div>${p.name}</div></td>
                <td><span class="stock-badge ${p.stock<=0?'stock-out':'stock-low'}">${p.stock} und.</span></td>
            </tr>
        `).join('');
    }
};

const renderReports = () => {
    const todaySales = sales.filter(s => s.date === new Date().toLocaleDateString());
    const totalVal = todaySales.reduce((sum, s) => sum + s.total, 0);
    
    // Update Report Stats
    const repStats = document.querySelectorAll('#screen-reportes .stat-value');
    if(repStats.length) {
        repStats[0].textContent = 'S/. ' + totalVal.toFixed(2);
        repStats[1].textContent = todaySales.reduce((sum, s) => sum + s.items.reduce((a,b)=>a+b.qty,0),0);
        repStats[2].textContent = todaySales.length;
        repStats[3].textContent = 'S/. ' + (todaySales.length > 0 ? (totalVal/todaySales.length).toFixed(2) : '0.00');
    }

    // Top Products
    const prodCount = {};
    todaySales.forEach(s => s.items.forEach(i => {
        prodCount[i.name] = (prodCount[i.name] || 0) + i.qty;
    }));
    const sorted = Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const topProdTbody = document.querySelector('#screen-reportes table tbody');
    if(topProdTbody) {
        topProdTbody.innerHTML = sorted.map(([name, qty], idx) => `
            <tr>
                <td style="color:var(--warm-tan);font-weight:700">${idx+1}</td>
                <td>${name}</td>
                <td>${qty} und.</td>
                <td style="font-weight:700;color:var(--brown)">S/. ${(qty * (products.find(p=>p.name===name)?.price||0)).toFixed(2)}</td>
            </tr>
        `).join('');
    }
};

// --- UTILS ---
const updateClock = () => {
    const el = document.getElementById('topDate');
    if(!el) return;
    const n = new Date();
    el.textContent = n.toLocaleDateString('es-PE', {weekday:'long', year:'numeric', month:'long', day:'numeric'}) + ' | ' + n.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
};
setInterval(updateClock, 30000);

window.showNotif = (msg) => {
    const n = document.getElementById('notification');
    n.textContent = msg;
    n.style.display = 'block';
    setTimeout(() => n.style.display = 'none', 3000);
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    renderCatalog();
    renderProductsTable();
    renderUsersGrid();
    updateDashboard();
    document.getElementById('saleNum').textContent = '#' + String(nextSaleId).padStart(4, '0');
});
