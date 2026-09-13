require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ============== MONGODB ==============
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true },
  username: String,
  plan: { uc: Number, price: Number },
  uid: String, gmail: String, wp: String,
  status: { type: String, default: 'pending' },
  reason: String,
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

const DepositSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: String,
  amount: Number,
  upiId: String,
  utr: String,
  proof: String,
  status: { type: String, default: 'pending' },
  reason: String,
  createdAt: { type: Date, default: Date.now }
});
const Deposit = mongoose.model('Deposit', DepositSchema);

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

// ============== HEALTH CHECK ==============
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// ============== USER APIS ==============
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Missing fields' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ success: false, message: 'Username taken' });
    await User.create({ username, password, balance: 0 });
    await sendTG(`🆕 NEW SIGNUP\n\nUsername: ${username}\nTime: ${new Date().toLocaleString()}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const u = await User.findOne({ username, password });
    if (!u) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    res.json({ success: true, username: u.username, balance: u.balance });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/user/:username', async (req, res) => {
  const u = await User.findOne({ username: req.params.username });
  if (!u) return res.status(404).json({ success: false });
  res.json({ success: true, username: u.username, balance: u.balance });
});

app.get('/api/user/orders/:username', async (req, res) => {
  const orders = await Order.find({ username: req.params.username }).sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

app.get('/api/user/deposits/:username', async (req, res) => {
  const deps = await Deposit.find({ username: req.params.username }).sort({ createdAt: -1 });
  res.json({ success: true, deposits: deps });
});

// ============== ORDER ==============
app.post('/api/order', async (req, res) => {
  try {
    const o = req.body;
    if (!o.orderId || !o.username || !o.plan) return res.status(400).json({ success: false, message: 'Missing fields' });
    const u = await User.findOne({ username: o.username });
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });
    if (u.balance < o.plan.price) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    u.balance -= o.plan.price;
    await u.save();

    await Order.create({
      orderId: o.orderId, username: o.username, plan: o.plan,
      uid: o.uid, gmail: o.gmail, wp: o.wp, status: 'pending'
    });

    await sendTG(
      `🎮 REQUEST UC\n\nUser: ${o.username}\nPlan: ${o.plan.uc} UC (₹${o.plan.price})\nUID: ${o.uid}\nGmail: ${o.gmail}\nWP: ${o.wp}\nOrder ID: ${o.orderId}\nStatus: Pending`
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
    await Deposit.create({ id: depId, username, amount, upiId, utr, proof: proof || null, status: 'pending' });

    const msg = `💰 DEPOSIT REQUEST\n\nID: ${depId}\nUser: ${username}\nAmount: ₹${amount}\nUTR: ${utr}\nUPI: ${upiId}\nStatus: Pending`;
    await sendTG(msg, proof);
    res.json({ success: true, depositId: depId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ============== ADMIN ==============
function adminAuth(req, res, next) {
  const token = req.headers.authorization;
  if (token !== `Bearer ${process.env.ADMIN_PASSWORD}`) return res.status(401).json({ success: false });
  next();
}

app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ success: false });
  res.json({ success: true });
});

app.get('/api/admin/orders', adminAuth, async (req, res) => res.json(await Order.find().sort({ createdAt: -1 })));
app.get('/api/admin/deposits', adminAuth, async (req, res) => res.json(await Deposit.find().sort({ createdAt: -1 })));
app.get('/api/admin/users', adminAuth, async (req, res) => {
  const users = await User.find().select('username balance createdAt');
  res.json(users);
});

app.post('/api/admin/order/approve', adminAuth, async (req, res) => {
  const { orderId } = req.body;
  await Order.updateOne({ orderId }, { status: 'approved' });
  await sendTG(`✅ ORDER APPROVED\n\nID: ${orderId}`);
  res.json({ success: true });
});

app.post('/api/admin/order/reject', adminAuth, async (req, res) => {
  const { orderId, reason } = req.body;
  const order = await Order.findOne({ orderId });
  if (!order) return res.status(404).json({ success: false });
  if (order.status !== 'rejected') {
    await User.updateOne({ username: order.username }, { $inc: { balance: order.plan.price } });
  }
  order.status = 'rejected';
  order.reason = reason || 'No reason';
  await order.save();
  await sendTG(`❌ ORDER REJECTED\n\nID: ${orderId}\nReason: ${reason || 'N/A'}`);
  res.json({ success: true });
});

app.post('/api/admin/deposit/approve', adminAuth, async (req, res) => {
  const { depositId } = req.body;
  const dep = await Deposit.findOne({ id: depositId });
  if (!dep) return res.status(404).json({ success: false });
  if (dep.status !== 'approved') {
    await User.updateOne({ username: dep.username }, { $inc: { balance: dep.amount } });
    dep.status = 'approved';
    await dep.save();
    await sendTG(`✅ DEPOSIT APPROVED\n\nID: ${depositId}\nUser: ${dep.username}\nAmount: ₹${dep.amount}`);
  }
  res.json({ success: true });
});

app.post('/api/admin/deposit/reject', adminAuth, async (req, res) => {
  const { depositId, reason } = req.body;
  await Deposit.updateOne({ id: depositId }, { status: 'rejected', reason: reason || 'No reason' });
  await sendTG(`❌ DEPOSIT REJECTED\n\nID: ${depositId}\nReason: ${reason || 'N/A'}`);
  res.json({ success: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
