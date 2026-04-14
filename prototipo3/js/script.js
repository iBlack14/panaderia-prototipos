// --- DATA ---
let products = JSON.parse(localStorage.getItem('p3_products')) || [
    { id: 101, name: 'Pan de Arroz', cat: 'Panes', price: 1.20, stock: 80, em: '🥖' },
    { id: 102, name: 'Torta de Vainilla', cat: 'Tortas', price: 42.00, stock: 15, em: '🍰' },
    { id: 103, name: 'Cuernito Dulce', cat: 'Panes', price: 1.50, stock: 60, em: '🥐' },
    { id: 104, name: 'Tarta de Fresa', cat: 'Tortas', price: 55.00, stock: 5, em: '🍰' },
    { id: 105, name: 'Muffin Arándano', cat: 'Dulces', price: 4.00, stock: 35, em: '🧁' },
    { id: 106, name: 'Pan Campesino', cat: 'Panes', price: 3.80, stock: 22, em: '🍞' }
];

let users = JSON.parse(localStorage.getItem('p3_users')) || [
    { id: 1, u: 'admin', p: '1234', n: 'Administrador', rs: ['Administrador'], st: 'act' },
    { id: 2, u: 'cajero', p: '1234', n: 'Cajero 01', rs: ['Cajero'], st: 'act' }
];

let sales = JSON.parse(localStorage.getItem('p3_sales')) || [];
let cart = [];
let user = null;
let role = null;

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
    document.getElementById('greet').textContent = user.n;
    
    // Build Roles
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
    document.getElementById('sbAv').textContent = user.n[0];

    if(role !== 'Administrador') {
        document.querySelectorAll('.admin-only').forEach(e => e.style.display = 'none');
    }

    renderPos();
    renderInventory();
    renderHome();
    renderUserList();
    toast(`🥐 ¡Bienvenido!`);
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
    
    document.getElementById('pageH2').textContent = el ? el.textContent.trim() : scr;
    
    if(scr === 'dashboard') renderHome();
    if(scr === 'reportes') renderReports();
};

const renderReports = () => {
    const sls = sales; // For all time or filter
    const tv = sls.reduce((a,b) => a + b.total, 0);
    const tr = sls.length;
    const un = sls.reduce((a,b) => a + b.items.reduce((x,y)=>x+y.qty,0), 0);
    const av = tr > 0 ? (tv / tr) : 0;

    document.getElementById('r-total').textContent = 'S/. ' + tv.toFixed(2);
    document.getElementById('r-trans').textContent = tr;
    document.getElementById('r-units').textContent = un;
    document.getElementById('r-avg').textContent = 'S/. ' + av.toFixed(2);
};

// --- POS ---
const renderPos = (f = '') => {
    const grid = document.getElementById('catGrid');
    if(!grid) return;
    const items = products.filter(p => p.name.toLowerCase().includes(f.toLowerCase()));
    grid.innerHTML = items.map(p => `
        <div class="cat-item" onclick="ai('${p.name}', ${p.price}, '${p.em}', ${p.id})">
            <div class="ci-em">${p.em}</div>
            <div class="ci-nm">${p.name}</div>
            <div class="ci-pr">S/. ${p.price.toFixed(2)}</div>
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
    if(cart.length === 0) {
        list.innerHTML = '<div class="order-empty"><div>🥖</div>Inicia un pedido</div>';
        document.getElementById('ot').textContent = 'S/. 0.00';
        return;
    }
    let t = 0;
    list.innerHTML = cart.map(i => {
        t += i.price * i.qty;
        return `
            <div class="order-line">
                <div class="ol-name">${i.name}</div>
                <div class="ol-ctrl">
                    <button class="q-btn" onclick="cq(${i.id},-1)">-</button>
                    <span class="q-num">${i.qty}</span>
                    <button class="q-btn" onclick="cq(${i.id},1)">+</button>
                </div>
                <div class="ol-price">S/. ${(i.price*i.qty).toFixed(2)}</div>
            </div>
        `;
    }).join('');
    document.getElementById('ot').textContent = 'S/. ' + t.toFixed(2);
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
    body.innerHTML = items.map(p => `
        <tr>
            <td><div class="row-chip"><div class="chip-icon">${p.em}</div><strong>${p.name}</strong></div></td>
            <td><span class="tag tg-blue">${p.cat}</span></td>
            <td style="font-weight:800">S/. ${p.price.toFixed(2)}</td>
            <td><span class="tag ${p.stock<=0?'tg-err':p.stock<10?'tg-warn':'tg-ok'}">${p.stock} und.</span></td>
            <td>
                <div class="act-row">
                    <button class="act-btn" onclick="edP(${p.id})">✏️</button>
                    <button class="act-btn del" onclick="deP(${p.id})">🗑</button>
                </div>
            </td>
        </tr>
    `).join('');
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
    grid.innerHTML = users.map(u => `
        <div class="uc">
            <div class="uc-av" style="background:var(--violet)">${u.n[0]}</div>
            <div class="uc-name">${u.n}</div>
            <div class="uc-roles">${u.rs.map(r => `<span class="role-tag ${r==='Administrador'?'rt-a':'rt-c'}">${r}</span>`).join('')}</div>
            <div class="uc-status ${u.st==='act'?'on':'off'}">${u.st==='act'?'● Conectado':'○ Offline'}</div>
            <div class="uc-btns">
                <button class="uc-btn" onclick="edU(${u.id})">Editar</button>
                <button class="uc-btn" onclick="tgU(${u.id})">Estado</button>
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

// --- REPORTS ---
const renderHome = () => {
    const tod = new Date().toLocaleDateString();
    const sls = sales.filter(s => s.d === tod);
    const tv = sls.reduce((a,b) => a + b.total, 0);
    const low = products.filter(p => p.stock < 10).length;

    const v = document.querySelectorAll('.st-val');
    if(v.length) {
        v[0].textContent = 'S/. ' + tv.toFixed(2);
        v[1].textContent = sls.length;
        v[2].textContent = sls.reduce((a,b) => a + b.items.reduce((x,y)=>x+y.qty,0), 0);
        v[3].textContent = low;
    }

    const b = document.getElementById('recentSales');
    if(b) {
        b.innerHTML = sls.slice(-5).reverse().map(s => `
            <tr>
                <td><span class="tag tg-ok">#${s.n}</span></td>
                <td>${s.items.map(i=>i.name).join(', ')}</td>
                <td>${s.t}</td>
                <td>S/. ${s.total.toFixed(2)}</td>
            </tr>
        `).join('');
    }
};

// --- UTILS ---
const toast = (msg) => {
    const s = document.getElementById('snack');
    s.textContent = msg; s.style.display = 'block';
    setTimeout(() => s.style.display = 'none', 3000);
};

const tick = () => {
    const el = document.getElementById('dtChip');
    if(el) el.textContent = new Date().toLocaleString('es-PE', {weekday:'long', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
};

document.addEventListener('DOMContentLoaded', () => {
    renderPos();
    renderInventory();
    renderHome();
    renderUserList();
    setInterval(tick, 1000); tick();
});
