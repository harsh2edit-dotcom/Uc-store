const API_BASE = '';
let token = '';
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500);
}
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

$('#loginBtn').addEventListener('click', async () => {
  const pass = $('#adminPass').value;
  if (!pass) return;
  try {
    const res = await fetch(API_BASE + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();
    if (data.success) {
      token = pass;
      sessionStorage.setItem('xyven_admin_token', pass);
      $('#loginWrap').classList.add('hidden');
      $('#adminPanel').classList.remove('hidden');
      loadAll();
    } else alert('Wrong password');
  } catch { alert('Server error'); }
});

$('#logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('xyven_admin_token');
  location.reload();
});

if (sessionStorage.getItem('xyven_admin_token')) {
  token = sessionStorage.getItem('xyven_admin_token');
  $('#loginWrap').classList.add('hidden');
  $('#adminPanel').classList.remove('hidden');
  loadAll();
}

$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.tab-content').forEach(t => t.classList.remove('active'));
    $('#tab-' + tab.dataset.tab).classList.add('active');
  });
});

async function loadAll() {
  await Promise.all([loadStats(), loadOrders(), loadDeposits(), loadUsers(), loadCoupons()]);
}

// ============ STATS (Display numbers - configurable) ============
// ⚠️ Ye numbers marketing/social proof ke liye hain. Real data alag hai.
// Agar real data dikhana ho toh DISPLAY_STATS ko 0 kar do.
const DISPLAY_STATS = {
  users: 2056,        // Fixed display number
  ordersCompleted: 1649,
  depositsTotal: 482750,   // ₹4,82,750
};

async function loadStats() {
  try {
    // Real data bhi fetch karo (internally)
    const [ordersRes, depsRes, usersRes] = await Promise.all([
      fetch(API_BASE + '/api/admin/orders', { headers: authHeaders() }).then(r => r.json()),
      fetch(API_BASE + '/api/admin/deposits', { headers: authHeaders() }).then(r => r.json()),
      fetch(API_BASE + '/api/admin/users', { headers: authHeaders() }).then(r => r.json()),
    ]);

    const realUsers = Array.isArray(usersRes) ? usersRes.length : 0;
    const realOrdersCompleted = Array.isArray(ordersRes) ? ordersRes.filter(o => o.status === 'approved').length : 0;
    const realDepositsTotal = Array.isArray(depsRes) ? depsRes.filter(d => d.status === 'approved').reduce((s, d) => s + d.amount, 0) : 0;

    // Display: agar config mein number set hai toh woh, warna real
    $('#statUsers').textContent = DISPLAY_STATS.users > 0 ? DISPLAY_STATS.users.toLocaleString() : realUsers;
    $('#statOrders').textContent = DISPLAY_STATS.ordersCompleted > 0 ? DISPLAY_STATS.ordersCompleted.toLocaleString() : realOrdersCompleted;
    $('#statDeposits').textContent = DISPLAY_STATS.depositsTotal > 0 ? '₹' + DISPLAY_STATS.depositsTotal.toLocaleString() : '₹' + realDepositsTotal.toLocaleString();

    // Save real data for other tabs
    window._realStats = { realUsers, realOrdersCompleted, realDepositsTotal };
  } catch (e) { console.error(e); }
}

// ============ ORDERS ============
async function loadOrders() {
  try {
    const res = await fetch(API_BASE + '/api/admin/orders', { headers: authHeaders() });
    const orders = await res.json();
    const tbody = $('#ordersBody');
    if (!Array.isArray(orders) || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No orders yet</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td>#${o.orderId}</td><td>${o.username}</td>
        <td>${o.plan.uc} UC (₹${o.plan.price})</td>
        <td>${o.uid}</td><td>${o.gmail}</td><td>${o.wp}</td>
        <td><span class="status-pill ${o.status}">${o.status}</span></td>
        <td>${o.status === 'pending' ? `<div class="actions"><button class="btn-approve" onclick="approveOrder('${o.orderId}')">Approve</button><button class="btn-reject" onclick="rejectOrder('${o.orderId}')">Reject</button></div>` : '-'}</td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

window.approveOrder = async (id) => {
  if (!confirm('Approve order ' + id + '?')) return;
  const res = await fetch(API_BASE + '/api/admin/order/approve', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ orderId: id }) });
  const d = await res.json();
  if (d.success) { toast('✅ Order approved'); loadOrders(); loadStats(); } else toast('Error');
};

window.rejectOrder = async (id) => {
  const reason = prompt('Reason for rejection?') || 'No reason';
  if (!confirm('Reject order ' + id + '? Balance will be refunded.')) return;
  const res = await fetch(API_BASE + '/api/admin/order/reject', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ orderId: id, reason }) });
  const d = await res.json();
  if (d.success) { toast('❌ Order rejected'); loadOrders(); loadStats(); } else toast('Error');
};

// ============ DEPOSITS ============
async function loadDeposits() {
  try {
    const res = await fetch(API_BASE + '/api/admin/deposits', { headers: authHeaders() });
    const deps = await res.json();
    const tbody = $('#depositsBody');
    if (!Array.isArray(deps) || deps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No deposits yet</td></tr>';
      return;
    }
    tbody.innerHTML = deps.map(d => `
      <tr>
        <td>#${d.id}</td><td>${d.username}</td><td>₹${d.amount}</td><td>${d.utr}</td>
        <td>${d.proof ? `<img src="${d.proof}" class="proof-img" onclick="viewProof('${d.id}')">` : '-'}</td>
        <td><span class="status-pill ${d.status}">${d.status}</span></td>
        <td>${d.status === 'pending' ? `<div class="actions"><button class="btn-approve" onclick="approveDeposit('${d.id}')">Approve</button><button class="btn-reject" onclick="rejectDeposit('${d.id}')">Reject</button></div>` : '-'}</td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

window.approveDeposit = async (id) => {
  if (!confirm('Approve deposit ' + id + '? User balance will be credited.')) return;
  const res = await fetch(API_BASE + '/api/admin/deposit/approve', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ depositId: id }) });
  const d = await res.json();
  if (d.success) { toast('✅ Deposit approved'); loadDeposits(); loadUsers(); loadStats(); } else toast('Error');
};

window.rejectDeposit = async (id) => {
  const reason = prompt('Reason for rejection?') || 'No reason';
  if (!confirm('Reject deposit ' + id + '?')) return;
  const res = await fetch(API_BASE + '/api/admin/deposit/reject', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ depositId: id, reason }) });
  const d = await res.json();
  if (d.success) { toast('❌ Deposit rejected'); loadDeposits(); loadStats(); } else toast('Error');
};

window.viewProof = async (id) => {
  const res = await fetch(API_BASE + '/api/admin/deposits', { headers: authHeaders() });
  const deps = await res.json();
  const dep = deps.find(x => x.id === id);
  if (!dep || !dep.proof) return;
  const div = document.createElement('div');
  div.className = 'proof-view';
  div.innerHTML = '<img src="' + dep.proof + '">';
  div.addEventListener('click', () => div.remove());
  document.body.appendChild(div);
};

// ============ USERS ============
async function loadUsers() {
  try {
    const res = await fetch(API_BASE + '/api/admin/users', { headers: authHeaders() });
    const users = await res.json();
    const tbody = $('#usersBody');
    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty">No users yet</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(u => `<tr><td>${u.username}</td><td>₹${u.balance || 0}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td></tr>`).join('');
  } catch (e) { console.error(e); }
}

// ============ COUPONS ============
async function loadCoupons() {
  try {
    const res = await fetch(API_BASE + '/api/admin/coupons', { headers: authHeaders() });
    const coupons = await res.json();
    const list = $('#couponList');
    if (!Array.isArray(coupons) || coupons.length === 0) {
      list.innerHTML = '<p class="empty">No coupons yet</p>';
      return;
    }
    list.innerHTML = coupons.map(c => `
      <div class="coupon-item">
        <div class="c-code">${c.code}</div>
        <div class="c-row"><span>Bonus:</span><strong>₹${c.value}</strong></div>
        <div class="c-row"><span>Min Deposit:</span><strong>₹${c.minDeposit || 200}</strong></div>
        <div class="c-row"><span>Used:</span><strong>${c.used || 0} / ${c.maxUses}</strong></div>
        <div class="c-actions">
          <button class="btn-copy-c" onclick="copyCoupon('${c.code}')">Copy Code</button>
          <button class="btn-del-c" onclick="deleteCoupon('${c.code}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    $('#couponList').innerHTML = '<p class="empty">Failed to load</p>';
  }
}

$('#createCouponBtn').addEventListener('click', async () => {
  const code = $('#cCode').value.trim().toUpperCase();
  const value = parseInt($('#cAmount').value.trim(), 10);
  const maxUses = parseInt($('#cMax').value.trim(), 10) || 10;
  const400 minDeposit = parseInt($('#c).MinDep').value.trim(), 10) || 200;

  if (!code || code.length < 4) return toast('❌ Code min 4 chars');
  if (!value || value < 1) return toast('❌ Invalid amount');

  try {
    const res = await fetch(API_BASE + '/api/admin/coupon/create', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ code, value, maxUses, minDeposit })
    });
    const d = await res.json();
    if (d.success) {
      toast('🎉 Coupon created: ' + code);
      $('#cCode').value = ''; $('#cAmount').value = ''; $('#cMax').value = ''; $('#cMinDep').value = '';
      loadCoupons();
    } else toast('❌ ' + (d.message || 'Failed'));
  } catch { toast('Server error'); }
});

window.copyCoupon = (code) => {
  navigator.clipboard.writeText(code);
  toast('📋 Copied: ' + code);
};

window.deleteCoupon = async (code) => {
  if (!confirm('Delete coupon ' + code + '?')) return;
  const res = await fetch(API_BASE + '/api/admin/coupon/delete', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ code })
  });
  const d = await res.json();
  if (d.success) { toast('Deleted'); loadCoupons(); } else toast('Error');
};
