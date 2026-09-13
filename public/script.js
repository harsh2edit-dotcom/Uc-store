const CONFIG = {
  API_BASE: '',
  INTRO_DURATION: 12,
  UPI_ID: 'harshsinghs@fam',
  UPI_NAME: 'XYVEN UC Store',
  MIN_DEPOSIT: 200,
  TIMER_SECONDS: 150,
  TG_CHANNEL: 'https://t.me/XyvenUCstore',
};

const COUPONS = {
  'XYVEN500':  { value: 500,  maxUses: 10 },
  'XYVEN1000': { value: 1000, maxUses: 10 },
  'VIP200':    { value: 200,  maxUses: 10 },
  'TEAM100':   { value: 100,  maxUses: 10 },
};

const PLANS = [
  { uc: 349,  price: 99   },
  { uc: 749,  price: 209  },
  { uc: 1499, price: 399  },
  { uc: 2999, price: 749  },
  { uc: 5000, price: 1199 },
];

const REAL_NAMES = [
  'Aarav Sharma','Aditya Verma','Arjun Singh','Rohan Gupta','Karan Malhotra',
  'Rahul Mehta','Yash Agarwal','Ankit Mishra','Ayush Tiwari','Mohit Saxena',
  'Abhishek Pandey','Nikhil Srivastava','Harsh Vardhan','Manish Yadav','Saurabh Kumar',
  'Akash Chauhan','Varun Bansal','Vivek Joshi','Rajat Kapoor','Shivam Shukla',
  'Aman Thakur','Deepak Sharma','Rohit Saini','Pranav Jain','Kartik Reddy',
  'Siddharth Rao','Anirudh Nair','Vishal Menon','Abhinav Iyer','Arnav Deshmukh',
  'Sameer Kulkarni','Omkar Patil','Adarsh Naik','Rishabh Mishra','Devendra Singh',
  'Tushar Choudhary','Neeraj Yadav','Piyush Gupta','Tanmay Agarwal','Lakshya Verma',
  'Raj Sharma','Aakash Mehra','Naman Arora','Siddhant Bhatia','Parth Shah',
  'Dhruv Patel','Krish Shah','Dev Patel','Meet Desai','Harsh Patel',
  'Ananya Sharma','Aditi Verma','Priya Singh','Sneha Gupta','Riya Mehta',
  'Kavya Agarwal','Simran Kaur','Neha Sharma','Pooja Mishra','Nandini Rao',
  'Ishita Kapoor','Anushka Joshi','Meera Nair','Diya Iyer','Avni Deshmukh',
  'Radhika Kulkarni','Shreya Patil','Tanvi Shah','Mahi Patel','Ananya Desai',
  'Muskan Yadav','Sakshi Chauhan','Kritika Saini','Palak Jain','Khushi Bansal',
  'Divya Srivastava','Isha Malhotra','Poonam Thakur','Sonali Choudhary','Komal Saxena',
  'Zoya Khan','Ayesha Siddiqui','Sana Sheikh','Fatima Ansari','Armaan Khan',
  'Rehan Ahmed','Sameer Khan','Faizan Ali','Danish Qureshi','Imran Sheikh',
  'Gurpreet Singh','Harpreet Kaur','Manpreet Singh','Jasleen Kaur','Navneet Singh',
  'Karanjeet Singh','Anmol Gill','Simranpreet Kaur','Hardeep Singh','Mandeep Kaur',
];

const UC_AMOUNTS = [349, 500, 749, 1499, 2999, 5000];

const state = {
  user: null, selectedPlan: null, walletBalance: 0,
  depositAmount: 0, order: null,
  timerInterval: null, timerRemaining: CONFIG.TIMER_SECONDS,
  notifications: [], couponUsage: {}, proofData: null,
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveSession(u) { localStorage.setItem('xyven_session', u); }
function loadSession() { return localStorage.getItem('xyven_session'); }
function clearSession() { localStorage.removeItem('xyven_session'); }
function saveCouponUsage() { localStorage.setItem('xyven_coupon_usage', JSON.stringify(state.couponUsage)); }
function loadCouponUsage() { try { return JSON.parse(localStorage.getItem('xyven_coupon_usage')) || {}; } catch { return {}; } }

function addNotification(type, message) {
  state.notifications.unshift({ id: Date.now(), type, message, time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) });
  if (state.notifications.length > 50) state.notifications.pop();
  renderNotifications();
  updateNotifBadge();
}
function renderNotifications() {
  const list = $('#notifList');
  if (state.notifications.length === 0) { list.innerHTML = '<p class="notif-empty">No notifications yet</p>'; return; }
  list.innerHTML = state.notifications.map(n => `<div class="notif-item ${n.type}">${n.message}<span class="notif-time">${n.time}</span></div>`).join('');
}
function updateNotifBadge() {
  const badge = $('#notifBadge');
  const count = state.notifications.length;
  if (count === 0) badge.classList.add('hidden');
  else { badge.classList.remove('hidden'); badge.textContent = count > 9 ? '9+' : count; }
}
$('#notifBtn').addEventListener('click', () => $('#notifPanel').classList.remove('hidden'));
$('#notifClose').addEventListener('click', () => $('#notifPanel').classList.add('hidden'));

function showModal({ icon='⚠️', title, text, confirmText='OK', cancelText=null, onConfirm }) {
  $('#modalIcon').textContent = icon;
  $('#modalTitle').textContent = title;
  $('#modalText').textContent = text;
  $('#modalConfirm').textContent = confirmText;
  const cancelBtn = $('#modalCancel');
  if (cancelText) { cancelBtn.classList.remove('hidden'); cancelBtn.textContent = cancelText; }
  else cancelBtn.classList.add('hidden');
  $('#modalOverlay').classList.remove('hidden');
  const nc = $('#modalConfirm').cloneNode(true);
  $('#modalConfirm').parentNode.replaceChild(nc, $('#modalConfirm'));
  nc.addEventListener('click', () => { $('#modalOverlay').classList.add('hidden'); if (onConfirm) onConfirm(); });
  const nx = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(nx, cancelBtn);
  nx.addEventListener('click', () => $('#modalOverlay').classList.add('hidden'));
}

function initAuth() {
  $$('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'signin') { $('#signinForm').classList.remove('hidden'); $('#signupForm').classList.add('hidden'); }
      else { $('#signinForm').classList.add('hidden'); $('#signupForm').classList.remove('hidden'); }
    });
  });

  $('#signinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#signinUser').value.trim();
    const pass = $('#signinPass').value;
    $('#signinUser').parentElement.classList.remove('error');
    $('#signinPass').parentElement.classList.remove('error');
    if (!username) { showFieldError('#signinUser', 'Username required'); return; }
    if (!pass) { showFieldError('#signinPass', 'Password required'); return; }
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password: pass }) });
      const data = await res.json();
      if (!data.success) { showFieldError('#signinPass', data.message || 'Invalid credentials'); return; }
      loginUser(data.username, data.balance || 0);
    } catch { showFieldError('#signinPass', 'Server error'); }
  });

  $('#signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#signupUser').value.trim();
    const pass = $('#signupPass').value;
    const confirm = $('#signupConfirm').value;
    ['#signupUser','#signupPass','#signupConfirm'].forEach(s => $(s).parentElement.classList.remove('error'));
    if (username.length < 3) { showFieldError('#signupUser', 'Min 3 characters'); return; }
    if (pass.length < 6) { showFieldError('#signupPass', 'Min 6 characters'); return; }
    if (pass !== confirm) { showFieldError('#signupConfirm', "Passwords don't match"); return; }
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/signup`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password: pass }) });
      const data = await res.json();
      if (!data.success) { showFieldError('#signupUser', data.message || 'Signup failed'); return; }
      loginUser(username, 0);
    } catch { showFieldError('#signupUser', 'Server error'); }
  });
}

function showFieldError(sel, msg) {
  const g = $(sel).parentElement;
  g.classList.add('error');
  g.querySelector('.error-msg').textContent = msg;
}

async function loginUser(username, balance) {
  state.user = username;
  state.walletBalance = balance;
  saveSession(username);
  addNotification('signup', `👋 Welcome ${username}!`);
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/user/${username}`);
    const d = await res.json();
    if (d.success) state.walletBalance = d.balance;
  } catch {}
  $('#authScreen').classList.add('fade-out');
  setTimeout(() => {
    $('#authScreen').style.display = 'none';
    $('#introScreen').classList.remove('hidden');
    runIntro();
  }, 600);
}

function updateUserBar() {
  if (!state.user) return;
  $('#userName').textContent = state.user;
  $('#userAvatar').textContent = state.user.charAt(0).toUpperCase();
}

$('#logoutBtn').addEventListener('click', () => { clearSession(); location.reload(); });

function runIntro() {
  let progress = 0;
  const step = 100 / (CONFIG.INTRO_DURATION * 10);
  const messages = ['Initializing...', 'Loading plans...', 'Connecting store...', 'Almost ready...'];
  const interval = setInterval(() => {
    progress += step;
    if (progress >= 100) { progress = 100; clearInterval(interval); $('#enterBtn').disabled = false; $('#progressText').textContent = 'Ready!'; }
    else { const i = Math.floor((progress / 100) * messages.length) % messages.length; $('#progressText').textContent = `${messages[i]} ${Math.floor(progress)}%`; }
    $('#progressBar').style.width = progress + '%';
  }, 100);
  initParticles();
}

function initParticles() {
  const canvas = $('#particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const particles = Array.from({ length: 60 }, () => ({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: Math.random()*2+0.5, vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.4, a: Math.random()*0.5+0.2 }));
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x<0||p.x>canvas.width) p.vx*=-1;
      if (p.y<0||p.y>canvas.height) p.vy*=-1;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(167,139,250,${p.a})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

$('#enterBtn').addEventListener('click', () => {
  $('#introScreen').classList.add('fade-out');
  setTimeout(() => {
    $('#introScreen').style.display = 'none';
    $('#mainApp').classList.remove('hidden');
    updateUserBar(); renderPlans(); updateWallet(); startTicker();
  }, 600);
});

function renderPlans() {
  const grid = $('#planGrid'); grid.innerHTML = '';
  PLANS.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'plan-card'; card.dataset.index = i;
    card.innerHTML = `<div class="plan-uc">${p.uc.toLocaleString()} <span>UC</span></div><div class="plan-price">₹${p.price}</div>`;
    card.addEventListener('click', () => selectPlan(i));
    grid.appendChild(card);
  });
}

function selectPlan(index) {
  $$('.plan-card').forEach(c => c.classList.remove('selected'));
  $(`.plan-card[data-index="${index}"]`).classList.add('selected');
  state.selectedPlan = PLANS[index];
  $('#selectPlanBtn').disabled = false;
}

$('#selectPlanBtn').addEventListener('click', () => {
  if (!state.selectedPlan) return;
  if (state.walletBalance < state.selectedPlan.price) {
    const short = state.selectedPlan.price - state.walletBalance;
    showModal({ icon:'💸', title:'Insufficient Balance', text:`You need ₹${short} more to buy ${state.selectedPlan.uc} UC. Please deposit more.`, confirmText:'Deposit Now', cancelText:'Cancel', onConfirm: () => openDeposit() });
    return;
  }
  showScreen('detailsScreen');
});

function updateWallet() { $('#walletAmount').textContent = '₹' + state.walletBalance.toLocaleString(); }
$('#walletAddBtn').addEventListener('click', openDeposit);

function openDeposit() {
  showScreen('depositScreen');
  $('#depositStep1').classList.remove('hidden');
  $('#depositStep2').classList.add('hidden');
  $('#depositStep3').classList.add('hidden');
  $('#depositAmount').value = '';
  clearInterval(state.timerInterval);
  state.proofData = null;
}

$('#depositNextBtn').addEventListener('click', () => {
  const amount = parseInt($('#depositAmount').value.trim(), 10);
  const g = $('#depositAmount').parentElement;
  if (!amount || amount < CONFIG.MIN_DEPOSIT) { g.classList.add('error'); return; }
  g.classList.remove('error'); g.classList.add('success');
  state.depositAmount = amount;
  $('#qrAmount').textContent = '₹' + amount;
  $('#depositStep1').classList.add('hidden');
  $('#depositStep2').classList.remove('hidden');
  renderQR(amount); startDepositTimer();
});

$('#depositAmount').addEventListener('input', function() {
  this.value = this.value.replace(/\D/g, '');
  this.parentElement.classList.remove('error');
});

function renderQR(amount) {
  const uri = `upi://pay?pa=${encodeURIComponent(CONFIG.UPI_ID)}&pn=${encodeURIComponent(CONFIG.UPI_NAME)}&am=${amount}&cu=INR`;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(uri)}`;
  const c = $('#qrContainer'); c.innerHTML = '';
  const img = document.createElement('img'); img.src = url; img.alt = 'UPI QR';
  img.onerror = () => { c.textContent = 'QR unavailable'; };
  c.appendChild(img);
}

function startDepositTimer() {
  clearInterval(state.timerInterval);
  state.timerRemaining = CONFIG.TIMER_SECONDS;
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timerRemaining--; updateTimerDisplay();
    if (state.timerRemaining <= 0) { clearInterval(state.timerInterval); $('#timer').textContent = 'Expired'; }
  }, 1000);
}
function updateTimerDisplay() {
  const m = String(Math.floor(state.timerRemaining/60)).padStart(2,'0');
  const s = String(state.timerRemaining%60).padStart(2,'0');
  $('#timer').textContent = `${m}:${s}`;
}

$('#copyUpiBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(CONFIG.UPI_ID).then(() => {
    $('#copyUpiBtn').textContent = 'Copied!';
    setTimeout(() => $('#copyUpiBtn').textContent = 'Copy', 1500);
  });
});

$('#paidBtn').addEventListener('click', () => {
  $('#depositStep2').classList.add('hidden');
  $('#depositStep3').classList.remove('hidden');
  $('#utrInput').value = '';
  state.proofData = null;
  $('#proofPreview').classList.add('hidden');
  $('#proofDrop').classList.remove('hidden');
});

$('#proofDrop').addEventListener('click', () => $('#proofFile').click());

$('#proofFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.proofData = ev.target.result;
    $('#proofImg').src = ev.target.result;
    $('#proofDrop').classList.add('hidden');
    $('#proofPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

$('#proofRemove').addEventListener('click', () => {
  state.proofData = null; $('#proofFile').value = '';
  $('#proofDrop').classList.remove('hidden'); $('#proofPreview').classList.add('hidden');
});

$('#submitPaymentBtn').addEventListener('click', async () => {
  const utr = $('#utrInput').value.trim().toUpperCase();
  const g = $('#utrInput').parentElement;
  if (!utr || utr.length < 8) { g.classList.add('error'); g.querySelector('.error-msg').textContent = 'UTR required (min 8 chars)'; return; }
  g.classList.remove('error'); g.classList.add('success');
  $('#submitPaymentBtn').disabled = true;
  $('#pendingMsg').classList.remove('hidden');
  addNotification('deposit', `💰 ${state.user} submitted deposit of ₹${state.depositAmount}`);
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/deposit`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: state.user, amount: state.depositAmount, upiId: CONFIG.UPI_ID, utr, proof: state.proofData }) });
    const data = await res.json();
    if (data.success) {
      showModal({ icon:'✅', title:'Submitted!', text:'Your deposit request is submitted. Admin will verify and credit your wallet shortly.', confirmText:'OK', onConfirm: () => showScreen('storeScreen') });
    } else { alert('Error: ' + (data.message || 'Try again')); $('#submitPaymentBtn').disabled = false; }
  } catch { alert('Network error'); $('#submitPaymentBtn').disabled = false; }
});

$('#couponBtn').addEventListener('click', () => {
  showScreen('couponScreen');
  $('#couponInput').value = '';
  $('#couponInput').parentElement.classList.remove('error','success');
});

$('#applyCouponBtn').addEventListener('click', () => {
  const code = $('#couponInput').value.trim().toUpperCase();
  const g = $('#couponInput').parentElement;
  if (!code || !COUPONS[code]) { g.classList.add('error'); return; }
  state.couponUsage = loadCouponUsage();
  const used = state.couponUsage[code] || 0;
  if (used >= COUPONS[code].maxUses) { g.classList.add('error'); g.querySelector('.error-msg').textContent = 'Coupon usage limit reached'; return; }
  g.classList.remove('error'); g.classList.add('success');
  const value = COUPONS[code].value;
  state.walletBalance += value; updateWallet();
  state.couponUsage[code] = used + 1; saveCouponUsage();
  addNotification('signup', `🎟️ ${state.user} applied coupon — ₹${value} added`);
  showModal({ icon:'🎉', title:'Coupon Applied!', text:`₹${value} has been added to your wallet.`, confirmText:'Back to Store', onConfirm: () => showScreen('storeScreen') });
});

$('#confirmBtn').addEventListener('click', async () => {
  const uid = $('#uidInput').value.trim();
  const gmail = $('#gmailInput').value.trim();
  const wp = $('#wpInput').value.trim();
  let valid = true;
  const uidG = $('#uidInput').parentElement, gmailG = $('#gmailInput').parentElement, wpG = $('#wpInput').parentElement;
  if (!/^\d{8,12}$/.test(uid)) { uidG.classList.add('error'); valid = false; } else { uidG.classList.remove('error'); uidG.classList.add('success'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) { gmailG.classList.add('error'); valid = false; } else { gmailG.classList.remove('error'); gmailG.classList.add('success'); }
  if (!/^\d{10}$/.test(wp)) { wpG.classList.add('error'); valid = false; } else { wpG.classList.remove('error'); wpG.classList.add('success'); }
  if (!valid) return;

  const orderId = 'XYV-' + Math.random().toString(36).substring(2,7).toUpperCase();
  const order = { orderId, username: state.user, plan: state.selectedPlan, uid, gmail, wp, status: 'pending' };

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/order`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(order) });
    const data = await res.json();
    if (data.success) {
      state.walletBalance = data.newBalance; updateWallet(); state.order = order;
      addNotification('order', `📦 Order ${orderId} placed — ${state.selectedPlan.uc} UC`);
      $('#orderPlan').textContent = `${state.selectedPlan.uc} UC (₹${state.selectedPlan.price})`;
      $('#orderUid').textContent = uid; $('#orderGmail').textContent = gmail; $('#orderWp').textContent = wp; $('#orderId').textContent = orderId;
      showScreen('orderScreen');
    } else { showModal({ icon:'⚠️', title:'Order Failed', text: data.message || 'Try again' }); }
  } catch { alert('Network error'); }
});

$('#newOrderBtn').addEventListener('click', () => {
  state.selectedPlan = null; state.order = null;
  $$('.plan-card').forEach(c => c.classList.remove('selected'));
  $('#selectPlanBtn').disabled = true;
  $('#uidInput').value = ''; $('#gmailInput').value = ''; $('#wpInput').value = '';
  $$('.input-group').forEach(g => g.classList.remove('error','success'));
  showScreen('storeScreen');
});

$('#ordersBtn').addEventListener('click', async () => {
  showScreen('historyScreen');
  $('#ordersList').innerHTML = '<p class="history-empty">Loading...</p>';
  $('#depositsList').innerHTML = '<p class="history-empty">Loading...</p>';
  try {
    const [o, d] = await Promise.all([
      fetch(`${CONFIG.API_BASE}/api/user/orders/${state.user}`).then(r => r.json()),
      fetch(`${CONFIG.API_BASE}/api/user/deposits/${state.user}`).then(r => r.json()),
    ]);
    renderOrders(o.orders || []); renderDeposits(d.deposits || []);
  } catch {
    $('#ordersList').innerHTML = '<p class="history-empty">Failed to load</p>';
    $('#depositsList').innerHTML = '<p class="history-empty">Failed to load</p>';
  }
});

function renderOrders(orders) {
  const el = $('#ordersList');
  if (orders.length === 0) { el.innerHTML = '<p class="history-empty">No orders yet</p>'; return; }
  el.innerHTML = orders.map(o => `
    <div class="history-item">
      <div class="hi-top"><span class="hi-title">${o.plan.uc} UC — ₹${o.plan.price}</span><span class="hi-id">#${o.orderId}</span></div>
      <div class="hi-row"><span>UID:</span><strong>${o.uid}</strong></div>
      <div class="hi-row"><span>Status:</span><span class="hi-status ${o.status}">${o.status}</span></div>
    </div>
  `).join('');
}

function renderDeposits(deps) {
  const el = $('#depositsList');
  if (deps.length === 0) { el.innerHTML = '<p class="history-empty">No deposits yet</p>'; return; }
  el.innerHTML = deps.map(d => `
    <div class="history-item">
      <div class="hi-top"><span class="hi-title">₹${d.amount}</span><span class="hi-id">#${d.id}</span></div>
      <div class="hi-row"><span>UTR:</span><strong>${d.utr}</strong></div>
      <div class="hi-row"><span>Status:</span><span class="hi-status ${d.status}">${d.status}</span></div>
    </div>
  `).join('');
}

$$('[data-back]').forEach(btn => btn.addEventListener('click', () => showScreen('storeScreen')));

function startTicker() {
  const ticker = $('#ticker');
  function showNext() {
    const name = REAL_NAMES[Math.floor(Math.random() * REAL_NAMES.length)];
    const uc = UC_AMOUNTS[Math.floor(Math.random() * UC_AMOUNTS.length)];
    ticker.innerHTML = `<div class="ticker-item">🎮 ${name} just claimed ${uc} UC</div>`;
  }
  showNext(); setInterval(showNext, 3000);
}

async function init() {
  state.couponUsage = loadCouponUsage();
  const session = loadSession();
  if (session) {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/user/${session}`);
      const data = await res.json();
      if (data.success) { loginUser(session, data.balance); return; }
    } catch {}
    clearSession();
  }
  initAuth();
}

init();
