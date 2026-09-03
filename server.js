const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'valotakim_gizli_anahtar_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const db = new Database('valotakim.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    valorant_id TEXT,
    rank TEXT,
    role TEXT,
    is_admin INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    ban_reason TEXT,
    points INTEGER DEFAULT 100,
    tickets INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mode TEXT,
    age TEXT,
    description TEXT,
    agents TEXT,
    microphone INTEGER DEFAULT 0,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS room_participants (
    room_id INTEGER,
    user_id INTEGER,
    PRIMARY KEY(room_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS room_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    user_id INTEGER,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS giveaway_participants (
    user_id INTEGER PRIMARY KEY,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS matchmaking_queue (
    user_id INTEGER PRIMARY KEY,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    points_reward INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    url TEXT,
    image_url TEXT,
    is_active INTEGER DEFAULT 1,
    clicks INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Varsayılan site ayarları
const defaultSettings = [
  { key: 'site_title', value: 'VALOTAKIM' },
  { key: 'site_logo', value: 'VALO<span style="color:#a855f7">TAKIM</span>' },
  { key: 'hero_badge', value: '🎮 TROLLERDEN KURTUL • KARA LİSTEYE EKLE' },
  { key: 'hero_title', value: 'TAKIMINI BUL!' },
  { key: 'hero_subtitle', value: 'OYUNA GİR!<br>KEYİFLE KAZAN!' },
  { key: 'giveaway_date', value: '30 EYLÜL 2026' },
  { key: 'giveaway_prize', value: '825 VK' },
  { key: 'youtube_channel', value: 'SMOKGG' },
  { key: 'youtube_url', value: 'https://www.youtube.com/@SmokGG01' },
  { key: 'ad_url', value: 'https://www.youtube.com/@SmokGG01' },
  { key: 'ad_title', value: 'SMOKGG YouTube Kanalına Abone Ol!' }
];
defaultSettings.forEach(s => {
  db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)").run(s.key, s.value);
});

db.prepare("INSERT OR IGNORE INTO promo_codes (code, max_uses, points_reward) VALUES ('SMOKGG100', 50, 100)").run();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token yok' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Geçersiz token' });
    req.user = user;
    next();
  });
}

function adminOnly(req, res, next) {
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.is_admin) return res.status(403).json({ success: false, message: 'Admin yetkisi gerekli' });
  next();
}

// --- PUBLIC ROUTES ---
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT key, value FROM site_settings').all();
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json({ success: true, settings: obj });
});

app.get('/api/ads', (req, res) => {
  const ads = db.prepare('SELECT * FROM ads WHERE is_active = 1').all();
  res.json({ success: true, ads });
});

app.post('/api/ads/:id/click', (req, res) => {
  db.prepare('UPDATE ads SET clicks = clicks + 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/register', (req, res) => {
  const { username, valName, valTag, rank, role, password, passwordConfirm } = req.body;
  if (!username || !valName || !valTag || !password) return res.json({ success: false, message: 'Tüm alanları doldurun!' });
  if (password !== passwordConfirm) return res.json({ success: false, message: 'Şifreler uyuşmuyor!' });
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.json({ success: false, message: 'Bu kullanıcı adı zaten alınmış!' });
  const hashedPassword = bcrypt.hashSync(password, 10);
  const valorant_id = `${valName}#${valTag}`;
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const isAdmin = userCount === 0 ? 1 : 0;
  const stmt = db.prepare('INSERT INTO users (username, password, valorant_id, rank, role, is_admin, points, tickets) VALUES (?, ?, ?, ?, ?, ?, 100, 1)');
  stmt.run(username, hashedPassword, valorant_id, rank, role, isAdmin);
  res.json({ success: true, username, message: 'Kayıt başarılı' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.json({ success: false, message: 'Kullanıcı adı veya şifre hatalı!' });
  if (user.is_banned) return res.json({ success: false, message: `Hesabınız banlanmış. Sebep: ${user.ban_reason || 'Belirtilmemiş'}` });
  const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, username: user.username, is_admin: user.is_admin, points: user.points, tickets: user.tickets } });
});

app.get('/api/profile', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, valorant_id, rank, role, is_admin, points, tickets FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.json({ success: false, message: 'Kullanıcı bulunamadı' });
  res.json({ success: true, user });
});

app.put('/api/profile', authenticateToken, (req, res) => {
  const { valorant_id, rank, role } = req.body;
  db.prepare('UPDATE users SET valorant_id = ?, rank = ?, role = ? WHERE id = ?').run(valorant_id, rank, role, req.user.id);
  res.json({ success: true });
});

app.get('/api/rooms', (req, res) => {
  const rooms = db.prepare(`SELECT r.*, u.username, u.valorant_id as owner_valorant_id, u.rank, u.role as owner_role FROM rooms r JOIN users u ON r.user_id = u.id WHERE r.expires_at > datetime('now') ORDER BY r.created_at DESC`).all();
  const formattedRooms = rooms.map(room => {
    const participants = db.prepare(`SELECT u.username FROM room_participants rp JOIN users u ON rp.user_id = u.id WHERE rp.room_id = ?`).all(room.id).map(p => p.username);
    const messages = db.prepare(`SELECT u.username as sender, m.message as text, m.created_at as time FROM room_messages m JOIN users u ON m.user_id = u.id WHERE m.room_id = ? ORDER BY m.created_at ASC`).all(room.id);
    return { ...room, participants, messages, agents: room.agents ? JSON.parse(room.agents) : [] };
  });
  res.json({ success: true, rooms: formattedRooms });
});

app.post('/api/rooms', authenticateToken, (req, res) => {
  const { mode, age, description, agents, microphone } = req.body;
  const expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const stmt = db.prepare('INSERT INTO rooms (user_id, mode, age, description, agents, microphone, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(req.user.id, mode, age, description, JSON.stringify(agents || []), microphone ? 1 : 0, expires_at);
  res.json({ success: true, roomId: result.lastInsertRowid });
});

app.post('/api/rooms/:id/join', authenticateToken, (req, res) => {
  const roomId = req.params.id;
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.json({ success: false, message: 'İlan bulunamadı' });
  const count = db.prepare('SELECT COUNT(*) as count FROM room_participants WHERE room_id = ?').get(roomId).count;
  if (count >= 4) return res.json({ success: false, message: 'İlan dolu!' });
  try {
    db.prepare('INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)').run(roomId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: 'Zaten katılmışsınız!' });
  }
});

app.delete('/api/rooms/:id', authenticateToken, (req, res) => {
  const room = db.prepare('SELECT user_id FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.json({ success: false, message: 'İlan bulunamadı' });
  if (room.user_id !== req.user.id && !req.user.is_admin) return res.json({ success: false, message: 'Yetkiniz yok!' });
  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/rooms/:id/message', authenticateToken, (req, res) => {
  const { message } = req.body;
  db.prepare('INSERT INTO room_messages (room_id, user_id, message) VALUES (?, ?, ?)').run(req.params.id, req.user.id, message);
  res.json({ success: true });
});

app.post('/api/matchmaking/join', authenticateToken, (req, res) => {
  try { db.prepare('INSERT INTO matchmaking_queue (user_id) VALUES (?)').run(req.user.id); } catch (e) {}
  const queue = db.prepare(`SELECT mq.user_id, u.username, u.rank, u.role FROM matchmaking_queue mq JOIN users u ON mq.user_id = u.id ORDER BY mq.joined_at ASC`).all();
  if (queue.length >= 5) {
    const team = queue.slice(0, 5);
    const expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const roomStmt = db.prepare("INSERT INTO rooms (user_id, mode, age, description, agents, microphone, expires_at) VALUES (?, 'Dereceli', 'Farketmez', 'Otomatik eşleşme ile oluşturulan 5\'li takım', '[]', 1, ?)");
    const result = roomStmt.run(team[0].user_id, expires_at);
    const roomId = result.lastInsertRowid;
    const partStmt = db.prepare('INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)');
    for (let i = 1; i < 5; i++) partStmt.run(roomId, team[i].user_id);
    const userIds = team.map(t => t.user_id);
    db.prepare(`DELETE FROM matchmaking_queue WHERE user_id IN (${userIds.join(',')})`).run();
    res.json({ matched: true, team, roomId });
  } else {
    res.json({ matched: false, waiting: queue.length });
  }
});

app.get('/api/giveaway', (req, res) => {
  const participants = db.prepare(`SELECT u.username, g.joined_at FROM giveaway_participants g JOIN users u ON g.user_id = u.id ORDER BY g.joined_at ASC`).all();
  res.json({ success: true, participants });
});

app.post('/api/giveaway/join', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT points, tickets FROM users WHERE id = ?').get(req.user.id);
  if (user.points < 100) return res.json({ success: false, message: 'Yetersiz puan! Çekilişe katılmak için 100 SmokGG Puanı gerekli.' });
  try {
    db.prepare('UPDATE users SET points = points - 100, tickets = tickets + 1 WHERE id = ?').run(req.user.id);
    db.prepare('INSERT INTO giveaway_participants (user_id) VALUES (?)').run(req.user.id);
    res.json({ success: true, message: '✅ 100 Puan harcanarak 1 Bilet kazandınız ve çekilişe katıldınız!' });
  } catch (e) {
    res.json({ success: false, message: 'Zaten çekilişe katılmışsınız!' });
  }
});

app.post('/api/giveaway/watch-ad', authenticateToken, (req, res) => {
  db.prepare('UPDATE users SET points = points + 50 WHERE id = ?').run(req.user.id);
  res.json({ success: true, message: '✅ Reklam izlendiği için +50 SmokGG Puanı kazandınız!' });
});

app.post('/api/giveaway/redeem-code', authenticateToken, (req, res) => {
  const { code } = req.body;
  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code);
  if (!promo) return res.json({ success: false, message: '❌ Geçersiz kod!' });
  if (promo.current_uses >= promo.max_uses) return res.json({ success: false, message: '❌ Bu kodun kullanım kotası doldu.' });
  db.prepare('UPDATE promo_codes SET current_uses = current_uses + 1 WHERE code = ?').run(code);
  db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(promo.points_reward, req.user.id);
  res.json({ success: true, message: `✅ Kod başarıyla kullanıldı! +${promo.points_reward} SmokGG Puanı kazandınız. (Kalan hak: ${promo.max_uses - promo.current_uses - 1})` });
});

// ==================== ADMIN ROUTES ====================

app.get('/api/admin/dashboard', authenticateToken, adminOnly, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalRooms = db.prepare("SELECT COUNT(*) as count FROM rooms WHERE expires_at > datetime('now')").get().count;
  const totalParticipants = db.prepare('SELECT COUNT(*) as count FROM giveaway_participants').get().count;
  const bannedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 1').get().count;
  const totalPoints = db.prepare('SELECT SUM(points) as total FROM users').get().total || 0;
  const totalTickets = db.prepare('SELECT SUM(tickets) as total FROM users').get().total || 0;
  const recentUsers = db.prepare('SELECT id, username, valorant_id, rank, created_at FROM users ORDER BY created_at DESC LIMIT 5').all();
  const recentRooms = db.prepare('SELECT r.id, r.mode, u.username, r.created_at FROM rooms r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 5').all();
  res.json({
    success: true,
    stats: { totalUsers, totalRooms, totalParticipants, bannedUsers, totalPoints, totalTickets },
    recentUsers,
    recentRooms
  });
});

app.get('/api/admin/users', authenticateToken, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, username, valorant_id, rank, role, is_admin, is_banned, ban_reason, points, tickets, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ success: true, users });
});

app.post('/api/admin/users/:id/ban', authenticateToken, adminOnly, (req, res) => {
  const { reason } = req.body;
  db.prepare('UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?').run(reason, req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/users/:id/unban', authenticateToken, adminOnly, (req, res) => {
  db.prepare('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/users/:id/toggle-admin', authenticateToken, adminOnly, (req, res) => {
  db.prepare('UPDATE users SET is_admin = CASE WHEN is_admin = 1 THEN 0 ELSE 1 END WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', authenticateToken, adminOnly, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/rooms', authenticateToken, adminOnly, (req, res) => {
  const rooms = db.prepare(`SELECT r.*, u.username, (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as participant_count FROM rooms r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC`).all();
  res.json({ success: true, rooms });
});

app.delete('/api/admin/rooms/:id', authenticateToken, adminOnly, (req, res) => {
  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/promo-codes', authenticateToken, adminOnly, (req, res) => {
  const codes = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
  res.json({ success: true, codes });
});

app.post('/api/admin/promo-codes', authenticateToken, adminOnly, (req, res) => {
  const { code, max_uses, points_reward } = req.body;
  if (!code || !max_uses) return res.json({ success: false, message: 'Kod ve maksimum kullanım gerekli!' });
  try {
    db.prepare('INSERT INTO promo_codes (code, max_uses, points_reward) VALUES (?, ?, ?)').run(code.toUpperCase(), max_uses, points_reward || 100);
    res.json({ success: true, message: 'Kod oluşturuldu!' });
  } catch (e) {
    res.json({ success: false, message: 'Bu kod zaten mevcut!' });
  }
});

app.delete('/api/admin/promo-codes/:code', authenticateToken, adminOnly, (req, res) => {
  db.prepare('DELETE FROM promo_codes WHERE code = ?').run(req.params.code);
  res.json({ success: true });
});

app.get('/api/admin/ads', authenticateToken, adminOnly, (req, res) => {
  const ads = db.prepare('SELECT * FROM ads ORDER BY created_at DESC').all();
  res.json({ success: true, ads });
});

app.post('/api/admin/ads', authenticateToken, adminOnly, (req, res) => {
  const { title, url, image_url } = req.body;
  if (!title || !url) return res.json({ success: false, message: 'Başlık ve URL gerekli!' });
  const stmt = db.prepare('INSERT INTO ads (title, url, image_url) VALUES (?, ?, ?)');
  const result = stmt.run(title, url, image_url || '');
  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/admin/ads/:id', authenticateToken, adminOnly, (req, res) => {
  const { title, url, image_url, is_active } = req.body;
  db.prepare('UPDATE ads SET title = ?, url = ?, image_url = ?, is_active = ? WHERE id = ?').run(title, url, image_url || '', is_active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/ads/:id', authenticateToken, adminOnly, (req, res) => {
  db.prepare('DELETE FROM ads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/settings', authenticateToken, adminOnly, (req, res) => {
  const settings = db.prepare('SELECT key, value FROM site_settings').all();
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json({ success: true, settings: obj });
});

app.post('/api/admin/settings', authenticateToken, adminOnly, (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
});

app.post('/api/admin/settings/bulk', authenticateToken, adminOnly, (req, res) => {
  const settings = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  Object.entries(settings).forEach(([key, value]) => {
    stmt.run(key, value);
  });
  res.json({ success: true, message: 'Tüm ayarlar güncellendi!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ VALOTAKIM Sunucusu çalışıyor: http://localhost:${PORT}`);
});