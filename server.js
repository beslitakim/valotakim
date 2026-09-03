const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'valotakim_gizli_anahtar_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- VERİTABANI KURULUMU ---
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
`);

// --- MIDDLEWARE ---
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
  if (!user || !user.is_admin) {
    return res.status(403).json({ success: false, message: 'Admin yetkisi gerekli' });
  }
  next();
}

// --- ROUTES ---

// Kayıt Ol
app.post('/api/register', (req, res) => {
  const { username, valName, valTag, rank, role, password, passwordConfirm } = req.body;
  if (!username || !valName || !valTag || !password) {
    return res.json({ success: false, message: 'Tüm alanları doldurun!' });
  }
  if (password !== passwordConfirm) {
    return res.json({ success: false, message: 'Şifreler uyuşmuyor!' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.json({ success: false, message: 'Bu kullanıcı adı zaten alınmış!' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const valorant_id = `${valName}#${valTag}`;
  
  // İlk kaydedilen kullanıcıyı otomatik admin yap
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const isAdmin = userCount === 0 ? 1 : 0;

  const stmt = db.prepare('INSERT INTO users (username, password, valorant_id, rank, role, is_admin) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(username, hashedPassword, valorant_id, rank, role, isAdmin);

  res.json({ success: true, username, message: 'Kayıt başarılı' });
});

// Giriş Yap
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.json({ success: false, message: 'Kullanıcı adı veya şifre hatalı!' });
  }
  if (user.is_banned) {
    return res.json({ success: false, message: `Hesabınız banlanmış. Sebep: ${user.ban_reason || 'Belirtilmemiş'}` });
  }

  const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, username: user.username, is_admin: user.is_admin } });
});

// Profil
app.get('/api/profile', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, valorant_id, rank, role, is_admin FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.json({ success: false, message: 'Kullanıcı bulunamadı' });
  res.json({ success: true, user });
});

app.put('/api/profile', authenticateToken, (req, res) => {
  const { valorant_id, rank, role } = req.body;
  db.prepare('UPDATE users SET valorant_id = ?, rank = ?, role = ? WHERE id = ?').run(valorant_id, rank, role, req.user.id);
  res.json({ success: true });
});

// İlanlar (Rooms)
app.get('/api/rooms', (req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, u.username, u.valorant_id as owner_valorant_id, u.rank, u.role as owner_role
    FROM rooms r
    JOIN users u ON r.user_id = u.id
    WHERE r.expires_at > datetime('now')
    ORDER BY r.created_at DESC
  `).all();

  const formattedRooms = rooms.map(room => {
    const participants = db.prepare(`
      SELECT u.username FROM room_participants rp
      JOIN users u ON rp.user_id = u.id
      WHERE rp.room_id = ?
    `).all(room.id).map(p => p.username);

    const messages = db.prepare(`
      SELECT u.username as sender, m.message as text, m.created_at as time
      FROM room_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.created_at ASC
    `).all(room.id);

    return {
      ...room,
      participants,
      messages,
      agents: room.agents ? JSON.parse(room.agents) : []
    };
  });

  res.json({ success: true, rooms: formattedRooms });
});

app.post('/api/rooms', authenticateToken, (req, res) => {
  const { mode, age, description, agents, microphone } = req.body;
  const expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 saat geçerli

  const stmt = db.prepare(`
    INSERT INTO rooms (user_id, mode, age, description, agents, microphone, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(req.user.id, mode, age, description, JSON.stringify(agents || []), microphone ? 1 : 0, expires_at);
  
  res.json({ success: true, roomId: result.lastInsertRowid });
});

app.post('/api/rooms/:id/join', authenticateToken, (req, res) => {
  const roomId = req.params.id;
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.json({ success: false, message: 'İlan bulunamadı' });

  const participantsCount = db.prepare('SELECT COUNT(*) as count FROM room_participants WHERE room_id = ?').get(roomId).count;
  if (participantsCount >= 4) { // 1 kurucu + 4 katılımcı = 5
    return res.json({ success: false, message: 'İlan dolu!' });
  }

  try {
    db.prepare('INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)').run(roomId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: 'Zaten katılmışsınız!' });
  }
});

app.delete('/api/rooms/:id', authenticateToken, (req, res) => {
  const roomId = req.params.id;
  const room = db.prepare('SELECT user_id FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.json({ success: false, message: 'İlan bulunamadı' });
  if (room.user_id !== req.user.id && !req.user.is_admin) {
    return res.json({ success: false, message: 'Yetkiniz yok!' });
  }
  db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
  res.json({ success: true });
});

app.post('/api/rooms/:id/message', authenticateToken, (req, res) => {
  const roomId = req.params.id;
  const { message } = req.body;
  db.prepare('INSERT INTO room_messages (room_id, user_id, message) VALUES (?, ?, ?)').run(roomId, req.user.id, message);
  res.json({ success: true });
});

// 5'li Eşleştirme (Matchmaking)
app.post('/api/matchmaking/join', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  // Kuyruğa ekle (zaten yoksa)
  try {
    db.prepare('INSERT INTO matchmaking_queue (user_id) VALUES (?)').run(userId);
  } catch (e) {
    // Zaten kuyrukta, hata verme
  }

  const queue = db.prepare(`
    SELECT mq.user_id, u.username, u.rank, u.role 
    FROM matchmaking_queue mq
    JOIN users u ON mq.user_id = u.id
    ORDER BY mq.joined_at ASC
  `).all();

  if (queue.length >= 5) {
    // 5 kişi bulundu, oda oluştur ve kuyruktan sil
    const team = queue.slice(0, 5);
    const expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    
    const roomStmt = db.prepare(`
      INSERT INTO rooms (user_id, mode, age, description, agents, microphone, expires_at)
      VALUES (?, 'Dereceli', 'Farketmez', 'Otomatik eşleşme ile oluşturulan 5\'li takım', '[]', 1, ?)
    `);
    const result = roomStmt.run(team[0].user_id, expires_at);
    const roomId = result.lastInsertRowid;

    // Diğer 4 kişiyi katılımcı olarak ekle
    const partStmt = db.prepare('INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)');
    for (let i = 1; i < 5; i++) {
      partStmt.run(roomId, team[i].user_id);
    }

    // Kuyruktan 5 kişiyi sil
    const userIds = team.map(t => t.user_id);
    db.prepare(`DELETE FROM matchmaking_queue WHERE user_id IN (${userIds.join(',')})`).run();

    res.json({ matched: true, team, roomId });
  } else {
    res.json({ matched: false, waiting: queue.length });
  }
});

// Çekiliş
app.get('/api/giveaway', (req, res) => {
  const participants = db.prepare(`
    SELECT u.username, g.joined_at 
    FROM giveaway_participants g
    JOIN users u ON g.user_id = u.id
    ORDER BY g.joined_at ASC
  `).all();
  res.json({ success: true, participants });
});

app.post('/api/giveaway/join', authenticateToken, (req, res) => {
  try {
    db.prepare('INSERT INTO giveaway_participants (user_id) VALUES (?)').run(req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: 'Zaten katıldınız!' });
  }
});

// Admin Paneli
app.get('/api/admin/rooms', authenticateToken, adminOnly, (req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, u.username, 
    (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as participant_count
    FROM rooms r
    JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
  `).all();
  res.json({ success: true, rooms });
});

app.delete('/api/admin/rooms/:id', authenticateToken, adminOnly, (req, res) => {
  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/users', authenticateToken, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, username, valorant_id, rank, role, is_admin, is_banned, ban_reason FROM users').all();
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

app.listen(PORT, () => {
  console.log(`✅ VALOTAKIM Sunucusu çalışıyor: http://localhost:${PORT}`);
});