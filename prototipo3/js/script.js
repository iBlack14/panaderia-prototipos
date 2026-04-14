// =================================================================
// PROTOTIPO 3 — Datos demo modernos
// =================================================================
let products = JSON.parse(localStorage.getItem('p3_products')) || [
  { id: 101, name: 'Croissant mantequilla', cat: 'Panes',   price: 4.50,  stock: 48, em: '🥐' },
  { id: 102, name: 'Pan de yema especial',  cat: 'Panes',   price: 1.80,  stock: 74, em: '🍞' },
  { id: 103, name: 'Torta de chocolate',    cat: 'Tortas',  price: 45.00, stock: 8,  em: '🎂' },
  { id: 104, name: 'Empanada de pollo',     cat: 'Panes',   price: 3.50,  stock: 32, em: '🫓' },
  { id: 105, name: 'Alfajor triple',        cat: 'Dulces',  price: 2.80,  stock: 40, em: '🍪' },
  { id: 106, name: 'Queque de zanahoria',   cat: 'Tortas',  price: 28.00, stock: 6,  em: '🍰' },
  { id: 107, name: 'Pan integral',          cat: 'Panes',   price: 5.50,  stock: 20, em: '🌾' },
  { id: 108, name: 'Café americano',        cat: 'Bebidas', price: 6.00,  stock: 99, em: '☕' },
  { id: 109, name: 'Bizcocho vainilla',     cat: 'Dulces',  price: 1.50,  stock: 3,  em: '🧁' },
  { id: 110, name: 'Tarta de fresa',        cat: 'Tortas',  price: 38.00, stock: 5,  em: '🍓' },
  { id: 111, name: 'Pan campesino',         cat: 'Panes',   price: 3.80,  stock: 0,  em: '🥙' },
  { id: 112, name: 'Chocolate caliente',    cat: 'Bebidas', price: 7.50,  stock: 99, em: '🍫' },
];

let users = JSON.parse(localStorage.getItem('p3_users')) || [
  { id: 1, u: 'admin',  p: '1234', n: 'Ana Rodríguez',  rs: ['Administrador'],           st: 'act' },
  { id: 2, u: 'carlos', p: '1234', n: 'Carlos Mendoza', rs: ['Cajero'],                  st: 'act' },
  { id: 3, u: 'maria',  p: '1234', n: 'María Sánchez',  rs: ['Cajero'],                  st: 'act' },
  { id: 4, u: 'pedro',  p: '1234', n: 'Pedro Castillo', rs: ['Administrador','Cajero'],  st: 'ina' },
];

let sales = JSON.parse(localStorage.getItem('p3_sales')) || [];
let cart  = [];
let user  = null;
let role  = null;

const save = () => {
    localStorage.setItem('p3_products', JSON.stringify(products));
    localStorage.setItem('p3_users', JSON.stringify(users));
    localStorage.setItem('p3_sales', JSON.stringify(sales));
};

// --- LOGIN ---
window.step1 = () => {
    const uIn = document.getElementById('u1').value;
    const pIn = document.getElementById('p1').value;
    const found = users.find(x => x.u === uIn && x.p === pIn && x.st === 'act');

    if(!found) { toast('❌ Credenciales inválidas'); return; }

    user = found;

    // ── Si solo tiene 1 rol → entrar directo, sin pedir selección ──
    if(user.rs.length === 1) {
        role = user.rs[0];
        enter();
        return;
    }

    // ── Varios roles → mostrar selector ──
    document.getElementById('greet').textContent = user.n;
    
    const stack = document.getElementById('rolesStack');
    stack.innerHTML = '';
    const icons = { Administrador: '👑', Cajero: '🛒' };
    user.rs.forEach((r, idx) => {
        const d = document.createElement('div');
        d.className = 'role-tile' + (idx === 0 ? ' sel' : '');
        if(idx === 0) role = r;
        d.innerHTML = `
            <div class="rt-icon">${icons[r]||'👤'}</div>
            <div class="rt-texts">
                <div class="rt-name">${r}</div>
                <div class="rt-desc">Ingresar como ${r}</div>
            </div>
            <div class="rt-radio">${idx===0?'✓':''}</div>
        `;
        d.onclick = () => {
            document.querySelectorAll('.role-tile').forEach(t => t.classList.remove('sel'));
            document.querySelectorAll('.rt-radio').forEach(r => r.textContent = '');
            d.classList.add('sel');
            d.querySelector('.rt-radio').textContent = '✓';
            role = r;
        };
        stack.appendChild(d);
    });

    document.getElementById('ls1').style.display = 'none';
    document.getElementById('ls2').style.display = 'block';
    document.getElementById('loginContainer').classList.add('wide-mode');
};


window.goBack = () => {
    document.getElementById('ls1').style.display = 'block';
    document.getElementById('ls2').style.display = 'none';
    document.getElementById('loginContainer').classList.remove('wide-mode');
};

window.step2 = () => { if(role) enter(); };

const enter = () => {
    document.getElementById('loginScene').style.display = 'none';
    document.getElementById('appWrap').style.display = 'block';
    document.getElementById('sbName').textContent = user.n;
    document.getElementById('sbRole').textContent = role;
    document.getElementById('sbAv').textContent = user.n[0].toUpperCase();

    if(role !== 'Administrador') {
        document.querySelectorAll('.admin-only').forEach(e => e.style.display = 'none');
    }

    // Fecha en dashboard
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const dateEl = document.getElementById('todayDate');
    if(dateEl) dateEl.textContent = dateStr;

    // Clock tick
    const tick = () => {
        const now = new Date();
        const t = now.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        const d = now.toLocaleDateString('es-PE', { weekday:'short', day:'2-digit', month:'short' });
        const chip = document.getElementById('dtChip');
        if(chip) chip.textContent = d + ' · ' + t;
    };
    tick();
    setInterval(tick, 1000);

    renderPos();
    renderInventory();
    renderHome();
    renderUserList();
    toast('✨ Bienvenido, ' + user.n.split(' ')[0] + '!');
};

window.salir = () => {
    user = null; role = null;
    document.getElementById('loginScene').style.display = 'flex';
    document.getElementById('appWrap').style.display = 'none';
    goBack();
};

// --- NAVIGATION ---
window.gp = (scr, el) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('pg-' + scr).classList.add('active');
    document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const titles = { dashboard:'Dashboard', ventas:'Punto de Venta', productos:'Inventario', reportes:'Estadísticas', usuarios:'Personal' };
    const subs   = { dashboard:'Resumen de operaciones · Hoy', ventas:'Registrar nueva venta', productos:'Control de stock', reportes:'Análisis y métricas', usuarios:'Gestión del equipo' };
    document.getElementById('pageH2').textContent = titles[scr] || scr;
    const pEl = document.getElementById('pageP');
    if(pEl) pEl.textContent = subs[scr] || '';

    if(scr === 'dashboard') renderHome();
    if(scr === 'reportes') renderReports();
};

const DEMO_SALES = { total: 5284, trans: 214, units: 863, avg: 24.69 };

const renderReports = () => {
    const tv = sales.reduce((a,b) => a + b.total, 0);
    const tr = sales.length;
    const un = sales.reduce((a,b) => a + b.items.reduce((x,y)=>x+y.qty,0), 0);
    const av = tr > 0 ? (tv / tr) : 0;

    // Mostrar datos reales si existen, demo en caso contrario
    const show = (id, real, demo, prefix='', suffix='') => {
        const el = document.getElementById(id);
        if(el) el.textContent = prefix + (tr > 0 ? real : demo) + suffix;
    };

    show('r-total', tv.toFixed(2), DEMO_SALES.total.toLocaleString(), 'S/. ');
    show('r-trans', tr, DEMO_SALES.trans);
    show('r-units', un, DEMO_SALES.units);
    show('r-avg',   av.toFixed(2), DEMO_SALES.avg.toFixed(2), 'S/. ');
};

// --- POS ---
const renderPos = (f = '') => {
    const grid = document.getElementById('catGrid');
    if(!grid) return;
    const items = products.filter(p => p.name.toLowerCase().includes(f.toLowerCase()));
    grid.innerHTML = items.length === 0
        ? `<div style="grid-column:span 4;text-align:center;padding:40px;color:var(--text-3);font-weight:600;">Sin resultados</div>`
        : items.map(p => `
            <div class="cat-item ${p.stock===0?'style="opacity:.4;pointer-events:none"':''}" onclick="ai('${p.name}',${p.price},'${p.em}',${p.id})">
                <span class="ci-em">${p.em}</span>
                <div class="ci-nm">${p.name}</div>
                <div class="ci-pr">S/. ${p.price.toFixed(2)}</div>
                <div class="pc-stock">${p.stock > 0 ? p.stock + ' disponibles' : 'Agotado'}</div>
            </div>
        `).join('');
};

window.ai = (n, p, e, id) => {
    const prod = products.find(x => x.id === id);
    if(!prod || prod.stock <= 0) { toast('⚠️ Sin existencias'); return; }

    const cur = cart.find(x => x.id === id);
    if(cur) {
        if(cur.qty >= prod.stock) return;
        cur.qty++;
    } else {
        cart.push({ id, name: n, price: p, qty: 1 });
    }
    urt();
};

window.cq = (id, delta) => {
    const item = cart.find(x => x.id === id);
    if(!item) return;
    const prod = products.find(p => p.id === id);
    if(delta > 0 && item.qty >= prod.stock) return;
    
    item.qty += delta;
    if(item.qty <= 0) cart = cart.filter(x => x.id !== id);
    urt();
};

const urt = () => {
    const list = document.getElementById('orderList');
    const countEl = document.getElementById('orderCount');
    if(cart.length === 0) {
        list.innerHTML = '<div class="order-empty"><div>🛒</div>Añade productos al pedido</div>';
        document.getElementById('ot').textContent = 'S/. 0.00';
        const subEl = document.getElementById('subTotal');
        const igvEl = document.getElementById('igvTotal');
        if(subEl) subEl.textContent = 'S/. 0.00';
        if(igvEl) igvEl.textContent = 'S/. 0.00';
        if(countEl) countEl.textContent = '0 items';
        return;
    }
    let sub = 0;
    let totalQty = 0;
    list.innerHTML = cart.map(i => {
        sub += i.price * i.qty;
        totalQty += i.qty;
        return `
            <div class="order-line">
                <div class="ol-name">${i.name}</div>
                <div class="ol-ctrl">
                    <button class="q-btn" onclick="cq(${i.id},-1)">−</button>
                    <span class="q-num">${i.qty}</span>
                    <button class="q-btn" onclick="cq(${i.id},1)">+</button>
                </div>
                <div class="ol-price">S/. ${(i.price*i.qty).toFixed(2)}</div>
            </div>`;
    }).join('');
    const igv = sub * 0.18;
    const total = sub + igv;
    const subEl = document.getElementById('subTotal');
    const igvEl = document.getElementById('igvTotal');
    if(subEl) subEl.textContent = 'S/. ' + sub.toFixed(2);
    if(igvEl) igvEl.textContent = 'S/. ' + igv.toFixed(2);
    document.getElementById('ot').textContent = 'S/. ' + total.toFixed(2);
    if(countEl) countEl.textContent = totalQty + (totalQty === 1 ? ' item' : ' items');
};

window.limP = () => { cart = []; urt(); };

window.cobP = () => {
    if(cart.length === 0) return;
    const tot = cart.reduce((a,b) => a + (b.price*b.qty), 0);
    const s = {
        id: Date.now(),
        n: sales.length + 501,
        items: [...cart],
        total: tot,
        d: new Date().toLocaleDateString(),
        t: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    };

    cart.forEach(i => {
        const p = products.find(x => x.id === i.id);
        if(p) p.stock -= i.qty;
    });

    sales.push(s);
    save();
    
    // Receipt
    document.getElementById('mcrNum').textContent = '#' + s.n;
    document.getElementById('mcrDate').textContent = s.d + ' ' + s.t;
    document.getElementById('mcrList').innerHTML = s.items.map(i => `<div class="mcr-row"><span>${i.name} x${i.qty}</span><span>S/. ${(i.price*i.qty).toFixed(2)}</span></div>`).join('');
    document.getElementById('mcrTotal').textContent = 'S/. ' + s.total.toFixed(2);
    document.getElementById('receiptModal').classList.add('open');

    cart = []; urt();
    renderPos();
    renderInventory();
};

window.clm = (id) => document.getElementById(id).classList.remove('open');

// --- INVENTORY ---
window.renderInventory = (f = '') => {
    const body = document.getElementById('invBody');
    if(!body) return;
    const items = products.filter(p => p.name.toLowerCase().includes(f.toLowerCase()));
    const catColor = { 'Panes':'tg-blue','Tortas':'tg-blue','Dulces':'tg-warn','Bebidas':'tg-ok' };
    body.innerHTML = items.map(p => {
        const stTag = p.stock <= 0  ? '<span class="tag tg-err">Agotado</span>'
                    : p.stock < 10  ? '<span class="tag tg-warn">Stock bajo</span>'
                    : '<span class="tag tg-ok">Disponible</span>';
        return `
        <tr>
            <td>
                <div class="row-chip">
                    <div class="chip-icon">${p.em}</div>
                    <div>
                        <div style="font-weight:700;color:var(--text);font-size:13.5px">${p.name}</div>
                        <div style="font-size:11px;color:var(--text-3);margin-top:2px">ID #${p.id}</div>
                    </div>
                </div>
            </td>
            <td><span class="tag ${catColor[p.cat]||'tg-blue'}">${p.cat}</span></td>
            <td style="font-weight:800;color:var(--accent)">S/. ${p.price.toFixed(2)}</td>
            <td style="font-weight:700;color:var(--text)">${p.stock} <span style="font-size:11px;color:var(--text-3)">und.</span></td>
            <td>${stTag}</td>
            <td>
                <div class="act-row">
                    <button class="act-btn" onclick="edP(${p.id})" title="Editar">✏️</button>
                    <button class="act-btn del" onclick="deP(${p.id})" title="Eliminar">🗑</button>
                </div>
            </td>
        </tr>`;
    }).join('');
};


window.opnP = () => {
    document.getElementById('mpTitle').textContent = 'Nuevo Producto';
    document.getElementById('mpId').value = '';
    document.getElementById('mpForm').reset();
    document.getElementById('mpModal').classList.add('open');
};

window.edP = (id) => {
    const p = products.find(x => x.id === id);
    if(!p) return;
    document.getElementById('mpTitle').textContent = 'Editar Producto';
    document.getElementById('mpId').value = p.id;
    document.getElementById('mpName').value = p.name;
    document.getElementById('mpCat').value = p.cat;
    document.getElementById('mpPrice').value = p.price;
    document.getElementById('mpStock').value = p.stock;
    document.getElementById('mpEm').value = p.em;
    document.getElementById('mpModal').classList.add('open');
};

window.svP = () => {
    const id = document.getElementById('mpId').value;
    const n = document.getElementById('mpName').value;
    const c = document.getElementById('mpCat').value;
    const p = parseFloat(document.getElementById('mpPrice').value);
    const s = parseInt(document.getElementById('mpStock').value);
    const e = document.getElementById('mpEm').value;

    if(!n || isNaN(p)) return;

    if(id) {
        const idx = products.findIndex(x => x.id == id);
        products[idx] = { ...products[idx], name: n, cat: c, price: p, stock: s, em: e };
    } else {
        products.push({ id: Date.now(), name: n, cat: c, price: p, stock: s, em: e });
    }
    save();
    renderInventory();
    renderPos();
    clm('mpModal');
};

window.deP = (id) => {
    if(!confirm('¿Eliminar?')) return;
    products = products.filter(x => x.id !== id);
    save();
    renderInventory();
    renderPos();
};

// --- USERS ---
const renderUserList = () => {
    const grid = document.getElementById('userGrid');
    if(!grid) return;
    const actives = users.filter(u => u.st === 'act').length;
    const totalEl = document.getElementById('totalUsers');
    const actEl   = document.getElementById('activeUsers');
    if(totalEl) totalEl.textContent = users.length;
    if(actEl)   actEl.textContent   = actives;
    grid.innerHTML = users.map(u => `
        <div class="uc">
            <div class="uc-av">${u.n[0].toUpperCase()}</div>
            <div class="uc-name">${u.n}</div>
            <div style="font-size:11px;color:var(--text-3)">@${u.u}</div>
            <div class="uc-roles">${u.rs.map(r => `<span class="role-tag ${r==='Administrador'?'rt-a':'rt-c'}">${r}</span>`).join('')}</div>
            <div class="uc-status ${u.st==='act'?'on':'off'}">${u.st==='act'?'● Activo':'○ Inactivo'}</div>
            <div class="uc-btns">
                <button class="uc-btn" onclick="edU(${u.id})">Editar</button>
                <button class="uc-btn" onclick="tgU(${u.id})">${u.st==='act'?'Desactivar':'Activar'}</button>
            </div>
        </div>
    `).join('');
};

window.opnU = () => {
    document.getElementById('muTitle').textContent = 'Nuevo Usuario';
    document.getElementById('muId').value = '';
    document.getElementById('muForm').reset();
    document.getElementById('muModal').classList.add('open');
};

window.svU = () => {
    const id = document.getElementById('muId').value;
    const n = document.getElementById('muName').value;
    const lu = document.getElementById('muUser').value;
    const p = document.getElementById('muPass').value;
    const r = document.getElementById('muRole').value;

    if(!n || !lu) return;

    if(id) {
        const idx = users.findIndex(x => x.id == id);
        users[idx] = { ...users[idx], n, u: lu, p, rs: [r] };
    } else {
        users.push({ id: Date.now(), n, u: lu, p, rs: [r], st: 'act' });
    }
    save();
    renderUserList();
    clm('muModal');
};

window.tgU = (id) => {
    const u = users.find(x => x.id === id);
    if(u) u.st = u.st === 'act' ? 'off' : 'act';
    save();
    renderUserList();
};

// -- renderHome --
const DEMO_HOME = { total: 842, trans: 34, units: 127 };

const renderHome = () => {
    const tod = new Date().toLocaleDateString();
    const sls = sales.filter(s => s.d === tod);
    const tv  = sls.reduce((a,b) => a + b.total, 0);
    const low = products.filter(p => p.stock < 10).length;
    const hasReal = sls.length > 0;

    const dT = document.getElementById('d-total');
    const dTr= document.getElementById('d-trans');
    const dU = document.getElementById('d-units');
    const dL = document.getElementById('d-low');
    if(dT)  dT.textContent  = 'S/. ' + (hasReal ? tv.toFixed(2) : DEMO_HOME.total);
    if(dTr) dTr.textContent = hasReal ? sls.length : DEMO_HOME.trans;
    if(dU)  dU.textContent  = hasReal ? sls.reduce((a,b) => a + b.items.reduce((x,y)=>x+y.qty,0), 0) : DEMO_HOME.units;
    if(dL)  dL.textContent  = low;

    // Only update recent sales table if there are real ones
    if(hasReal) {
        const b = document.getElementById('recentSales');
        if(b) {
            b.innerHTML = sls.slice(-5).reverse().map(s => `
                <tr>
                    <td><span style="font-weight:700;color:var(--accent)">#B-${String(s.n).padStart(4,'0')}</span></td>
                    <td style="color:var(--text-2)">${s.items.map(i=>i.name+' ×'+i.qty).join(', ')}</td>
                    <td><span class="tag tg-blue">${s.t}</span></td>
                    <td>${user ? user.n : '-'}</td>
                    <td style="font-weight:800;color:var(--green)">S/. ${s.total.toFixed(2)}</td>
                </tr>
            `).join('');
        }
    }
};

// --- UTILS ---
window.clm = (id) => document.getElementById(id).classList.remove('open');

const toast = (msg) => {
    const s = document.getElementById('snack');
    s.textContent = msg;
    s.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => s.style.display = 'none', 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    // Forzar recarga de datos demo si los guardados son los viejos
    const saved = JSON.parse(localStorage.getItem('p3_products') || '[]');
    if(saved.length > 0 && saved[0].id === 101 && saved[0].name === 'Pan de Arroz') {
        localStorage.removeItem('p3_products');
        localStorage.removeItem('p3_users');
        location.reload();
    }
});
