require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ============== DATA STORAGE ==============
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const DEPOSITS_FILE = path.join(DATA_DIR, 'deposits.json');
const COUPONS_FILE = path.join(DATA_DIR, 'coupons.json');

function readJSON(file, def = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ============== TELEGRAM ==============
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot = null;
if (botToken) bot = new TelegramBot(botToken, { polling: false });

async function sendTG(msg, photoBase64 = null) {
  if (!bot || !chatId) return;
  try {
    if (photoBase64 && photoBase64.startsWith('data:image')) {
      const buf = Buffer.from(photoBase64.split(',')[1], 'base64');
      await bot.sendPhoto(chatId, buf, { caption: msg });
    } else {
      await bot.sendMessage(chatId, msg);
    }
  } catch (e) { console.error('TG:', e.message); }
}

// ============== HEALTH ==============
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// ============== SIGNUP ==============
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Missing fields' });
    const users = readJSON(USERS_FILE, {});
    if (users[username]) return res.status(409).json({ success: false, message: 'Username taken' });
    users[username] = { password, balance: 0, createdAt: new Date().toISOString() };
    writeJSON(USERS_FILE, users);
    await sendTG('🆕 NEW SIGNUP\n\nUsername: ' + username + '\nTime: ' + new Date().toLocaleString());
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ============== LOGIN ==============
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE, {});
  const u = users[username];
  if (!u || u.password !== password) return res.status(401).json({ success: false, message: 'Invalid credentials' });
  res.json({ success: true, username, balance: u.balance });
});

// ============== USER DATA ==============
app.get('/api/user/:username', (req, res) => {
  const users = readJSON(USERS_FILE, {});
  const u = users[req.params.username];
  if (!u) return res.status(404).json({ success: false });
  res.json({ success: true, username: req.params.username, balance: u.balance });
});

app.get('/api/user/orders/:username', (req, res) => {
  const orders = readJSON(ORDERS_FILE, []);
  res.json({ success: true, orders: orders.filter(o => o.username === req.params.username).reverse() });
});

app.get('/api/user/deposits/:username', (req, res) => {
  const deps = readJSON(DEPOSITS_FILE, []);
  res.json({ success: true, deposits: deps.filter(d => d.username === req.params.username).reverse() });
});

// ============== ORDER ==============
app.post('/api/order', async (req, res) => {
  try {
    const o = req.body;
    if (!o.orderId || !o.username || !o.plan) return res.status(400).json({ success: false, message: 'Missing fields' });

    const users = readJSON(USERS_FILE, {});
    const u = users[o.username];
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });
    if (u.balance < o.plan.price) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    u.balance -= o.plan.price;
    writeJSON(USERS_FILE, users);

    const orders = readJSON(ORDERS_FILE, []);
    orders.push({
      orderId: o.orderId,
      username: o.username,
      plan: o.plan,
      uid: o.uid,
      gmail: o.gmail,
      wp: o.wp,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    writeJSON(ORDERS_FILE, orders);

    await sendTG(
      '🎮 REQUEST UC\n\n' +
      'User: ' + o.username + '\n' +
      'Plan: ' + o.plan.uc + ' UC (₹' + o.plan.price + ')\n' +
      'UID: ' + o.uid + '\n' +
      'Gmail: ' + o.gmail + '\n' +
      'WP: ' + o.wp + '\n' +
      'Order ID: ' + o.orderId + '\n' +
      'Status: Pending'
    );

    res.json({ success: true, orderId: o.orderId, newBalance: u.balance });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ============== DEPOSIT ==============
app.post('/api/deposit', async (req, res) => {
  try {
    const { username, amount, upiId, utr, proof } = req.body;
    if (!username || !amount || amount < 200) return res.status(400).json({ success: false, message: 'Invalid deposit' });
    if (!utr || utr.length < 8) return res.status(400).json({ success: false, message: 'UTR required' });

    const depId = 'DEP-' + Date.now().toString(36).toUpperCase();
    const deps = readJSON(DEPOSITS_FILE, []);
    deps.push({
      id: depId,
      username,
      amount,
      upiId,
      utr,
      proof: proof || null,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    writeJSON(DEPOSITS_FILE, deps);

    const msg = '💰 DEPOSIT REQUEST\n\n' +
      'ID: ' + depId + '\n' +
      'User: ' + username + '\n' +
      'Amount: ₹' + amount + '\n' +
      'UTR: ' + utr + '\n' +
      'UPI: ' + upiId + '\n' +
      'Status: Pending';
    await sendTG(msg, proof);
    res.json({ success: true, depositId: depId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ============== COUPON VALIDATE (User) ==============
app.post('/api/coupon/validate', (req, res) => {
  const { code, username } = req.body;
  if (!code || !username) return res.status(400).json({ success: false, message: 'Missing fields' });

  const coupons = readJSON(COUPONS_FILE, []);
  const coupon = coupons.find(c => c.code === code.toUpperCase());
  if (!coupon) return res.status(404).json({ success: false, message: 'Invalid coupon' });
  if ((coupon.used || 0) >= coupon.maxUses) return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });

  const deposits = readJSON(DEPOSITS_FILE, []);
  const userDepositTotal = deposits
    .filter(d => d.username === username && d.status === 'approved')
    .reduce((s, d) => s + d.amount, 0);

  if (userDepositTotal < (coupon.minDeposit || 200)) {
    return res.status(400).json({
      success: false,
      message: 'Minimum deposit ₹' + (coupon.minDeposit || 200) + ' required. Please deposit first.'
    });
  }

  coupon.used = (coupon.used || 0) + 1;
  writeJSON(COUPONS_FILE, coupons);

  const users = readJSON(USERS_FILE, {});
  if (users[username]) {
    users[username].balance = (users[username].balance || 0) + coupon.value;
    writeJSON(USERS_FILE, users);
  }

  res.json({
    success: true,
    value: coupon.value,
    newBalance: users[username] ? users[username].balance : 0
  });
});

// ============== ADMIN AUTH ==============
function adminAuth(req, res, next) {
  const token = req.headers.authorization;
  if (token !== 'Bearer ' + process.env.ADMIN_PASSWORD) return res.status(401).json({ success: false });
  next();
}

app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ success: false });
  res.json({ success: true });
});

// ============== ADMIN — ORDERS ==============
app.get('/api/admin/orders', adminAuth, (req, res) => {
  res.json(readJSON(ORDERS_FILE, []).reverse());
});

app.post('/api/admin/order/approve', adminAuth, async (req, res) => {
  const { orderId } = req.body;
  const orders = readJSON(ORDERS_FILE, []);
  const idx = orders.findIndex(o => o.orderId === orderId);
  if (idx === -1) return res.status(404).json({ success: false });
  orders[idx].status = 'approved';
  writeJSON(ORDERS_FILE, orders);
  await sendTG('✅ ORDER APPROVED\n\nID: ' + orderId);
  res.json({ success: true });
});

app.post('/api/admin/order/reject', adminAuth, async (req, res) => {
  const { orderId, reason } = req.body;
  const orders = readJSON(ORDERS_FILE, []);
  const idx = orders.findIndex(o => o.orderId === orderId);
  if (idx === -1) return res.status(404).json({ success: false });

  if (orders[idx].status !== 'rejected') {
    const users = readJSON(USERS_FILE, {});
    if (users[orders[idx].username]) {
      users[orders[idx].username].balance += orders[idx].plan.price;
      writeJSON(USERS_FILE, users);
    }
  }
  orders[idx].status = 'rejected';
  orders[idx].reason = reason || 'No reason';
  writeJSON(ORDERS_FILE, orders);
  await sendTG('❌ ORDER REJECTED\n\nID: ' + orderId + '\nReason: ' + (reason || 'N/A'));
  res.json({ success: true });
});

// ============== ADMIN — DEPOSITS ==============
app.get('/api/admin/deposits', adminAuth, (req, res) => {
  res.json(readJSON(DEPOSITS_FILE, []).reverse());
});

app.post('/api/admin/deposit/approve', adminAuth, async (req, res) => {
  const { depositId } = req.body;
  const deps = readJSON(DEPOSITS_FILE, []);
  const idx = deps.findIndex(d => d.id === depositId);
  if (idx === -1) return res.status(404).json({ success: false });
  if (deps[idx].status === 'approved') return res.json({ success: true });

  const users = readJSON(USERS_FILE, {});
  if (users[deps[idx].username]) {
    users[deps[idx].username].balance += deps[idx].amount;
    writeJSON(USERS_FILE, users);
  }
  deps[idx].status = 'approved';
  writeJSON(DEPOSITS_FILE, deps);
  await sendTG('✅ DEPOSIT APPROVED\n\nID: ' + depositId + '\nUser: ' + deps[idx].username + '\nAmount: ₹' + deps[idx].amount);
  res.json({ success: true });
});

app.post('/api/admin/deposit/reject', adminAuth, async (req, res) => {
  const { depositId, reason } = req.body;
  const deps = readJSON(DEPOSITS_FILE, []);
  const idx = deps.findIndex(d => d.id === depositId);
  if (idx === -1) return res.status(404).json({ success: false });
  deps[idx].status = 'rejected';
  deps[idx].reason = reason || 'No reason';
  writeJSON(DEPOSITS_FILE, deps);
  await sendTG('❌ DEPOSIT REJECTED\n\nID: ' + depositId + '\nReason: ' + (reason || 'N/A'));
  res.json({ success: true });
});

// ============== ADMIN — USERS ==============
app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = readJSON(USERS_FILE, {});
  const list = Object.entries(users).map(([u, d]) => ({
    username: u,
    balance: d.balance,
    createdAt: d.createdAt
  }));
  res.json(list);
});

// ============== ADMIN — COUPONS ==============
app.get('/api/admin/coupons', adminAuth, (req, res) => {
  res.json(readJSON(COUPONS_FILE, []));
});

app.post('/api/admin/coupon/create', adminAuth, (req, res) => {
  const { code, value, maxUses, minDeposit } = req.body;
  if (!code || !value) return res.status(400).json({ success: false, message: 'Code and value required' });

  const coupons = readJSON(COUPONS_FILE, []);
  if (coupons.find(c => c.code === code.toUpperCase())) {
    return res.status(409).json({ success: false, message: 'Coupon already exists' });
  }

  coupons.push({
    code: code.toUpperCase(),
    value: parseInt(value, 10),
    maxUses: parseInt(maxUses, 10) || 10,
    minDeposit: parseInt(minDeposit, 10) || 200,
    used: 0,
    createdAt: new Date().toISOString()
  });
  writeJSON(COUPONS_FILE, coupons);
  await sendTG('🎟️ NEW COUPON CREATED\n\nCode: ' + code.toUpperCase() + '\nValue: ₹' + value + '\nMax Uses: ' + (maxUses || 10) + '\nMin Deposit: ₹' + (minDeposit || 200));
  res.json({ success: true });
});

app.post('/api/admin/coupon/delete', adminAuth, (req, res) => {
  const { code } = req.body;
  let coupons = readJSON(COUPONS_FILE, []);
  coupons = coupons.filter(c => c.code !== code.toUpperCase());
  writeJSON(COUPONS_FILE, coupons);
  res.json({ success: true });
});

// ============== SERVE FRONTEND ==============
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('✅ Server running on ' + PORT));
