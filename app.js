const API_URL = window.location.origin + "/api";
let currentUser = null;
let selectedAgents = [];
let profSelectedAgents = [];
let matchmakingInterval = null;
let countdownIntervals = {};
let chatIntervals = {};
let allUsers = [];

const AGENTS = [
  { name: "Jett", img: "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png" },
  { name: "Reyna", img: "https://media.valorant-api.com/agents/a3b2d30d-40b0-4d04-b801-6c3c70c2769e/displayicon.png" },
  { name: "Phoenix", img: "https://media.valorant-api.com/agents/eb93336a-449b-8c1c-0577-4c8b8e1a8c3e/displayicon.png" },
  { name: "Raze", img: "https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5ab3e1c8e1c0/displayicon.png" },
  { name: "Yoru", img: "https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/displayicon.png" },
  { name: "Neon", img: "https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195b751/displayicon.png" },
  { name: "Iso", img: "https://media.valorant-api.com/agents/6f2a04ca-43e0-be8c-0e0c-8c8b8e1a8c3e/displayicon.png" },
  { name: "Omen", img: "https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b0c-9c8b8e1a8c3e/displayicon.png" },
  { name: "Viper", img: "https://media.valorant-api.com/agents/707eab51-4836-f488-047c-9c8b8e1a8c3e/displayicon.png" },
  { name: "Astra", img: "https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e9c8e1c/displayicon.png" },
  { name: "Harbor", img: "https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-da0c8b8e1a8c/displayicon.png" },
  { name: "Clove", img: "https://media.valorant-api.com/agents/1e58de9c-4950-5125-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Sova", img: "https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f9c8b8e1a8c/displayicon.png" },
  { name: "Breach", img: "https://media.valorant-api.com/agents/5f8d3a7f-467b-7f35-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Skye", img: "https://media.valorant-api.com/agents/6f2a04ca-43e0-be8c-0e0c-8c8b8e1a8c3e/displayicon.png" },
  { name: "KAY/O", img: "https://media.valorant-api.com/agents/601dbbe7-4b67-4c05-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Fade", img: "https://media.valorant-api.com/agents/dadfe7c7-4950-5125-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Gekko", img: "https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-8c8b8e1a8c3e/displayicon.png" },
  { name: "Killjoy", img: "https://media.valorant-api.com/agents/1e58de9c-4950-5125-8c8b-8c8b8e1a8c3e/displayicon.png" },
  { name: "Cypher", img: "https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada8e1a8c3/displayicon.png" },
  { name: "Sage", img: "https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png" },
  { name: "Chamber", img: "https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-8c8b8e1a8c3e/displayicon.png" },
  { name: "Deadlock", img: "https://media.valorant-api.com/agents/cc8b8e1a-4950-5125-8c8b-8c8b8e1a8c3e/displayicon.png" }
];

const RANKS = [
  "Demir 1", "Demir 2", "Demir 3", "Bronz 1", "Bronz 2", "Bronz 3",
  "Gümüş 1", "Gümüş 2", "Gümüş 3", "Altın 1", "Altın 2", "Altın 3",
  "Platin 1", "Platin 2", "Platin 3", "Elmas 1", "Elmas 2", "Elmas 3",
  "Yücelik 1", "Yücelik 2", "Yücelik 3", "Ölümsüzlük 1", "Ölümsüzlük 2", "Ölümsüzlük 3", "Radiant"
];

function getToken() { return localStorage.getItem('valotakim_token'); }
function setToken(t) { localStorage.setItem('valotakim_token', t); }
function clearToken() { localStorage.removeItem('valotakim_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() }; }

async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(API_URL + url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
    return await res.json();
  } catch (e) {
    console.error('API Error:', e);
    return { success: false, message: 'Sunucuya bağlanılamadı' };
  }
}

function startCountdown(roomId, expiresAt) {
  if (countdownIntervals[roomId]) clearInterval(countdownIntervals[roomId]);
  const el = document.getElementById('countdown-' + roomId);
  if (!el) return;
  const update = function() {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) {
      el.innerHTML = '<span style="color:#ef4444;">⌛ Süre doldu</span>';
      clearInterval(countdownIntervals[roomId]);
      setTimeout(loadRooms, 2000);
      return;
    }
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.innerHTML = '<span style="color:' + (m < 2 ? '#ef4444' : '#4ade80') + '; font-weight:700;">⏱ ' + m + ':' + s.toString().padStart(2, '0') + '</span>';
  };
  update();
  countdownIntervals[roomId] = setInterval(update, 1000);
}

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  var target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
  if (pageId === 'rooms') loadRooms();
  if (pageId === 'profile') loadProfile();
  if (pageId === 'giveaway') loadGiveawayParticipants();
  if (pageId === 'admin' && currentUser && currentUser.is_admin) loadAdminDashboard();
  if (pageId === 'home') loadHomeGiveawayParticipants();
}

function toggleMobileMenu() {
  var navLinks = document.getElementById('nav-links');
  if (navLinks) navLinks.classList.toggle('active');
}

async function checkAuthState() {
  var token = getToken();
  if (!token) { showLoggedOut(); return; }
  try {
    var res = await fetch(API_URL + '/profile', { headers: { 'Authorization': 'Bearer ' + token } });
    var result = await res.json();
    if (result.success) {
      currentUser = result.user;
      showLoggedIn();
    } else {
      clearToken();
      showLoggedOut();
    }
  } catch (e) { showLoggedOut(); }
}

function showLoggedIn() {
  var loginBtn = document.getElementById('nav-login-btn');
  var registerBtn = document.getElementById('nav-register-btn');
  var profileBtn = document.getElementById('nav-profile-btn');
  var logoutBtn = document.getElementById('nav-logout-btn');
  var adminBtn = document.getElementById('nav-admin-btn');
  if (loginBtn) loginBtn.style.display = 'none';
  if (registerBtn) registerBtn.style.display = 'none';
  if (profileBtn) profileBtn.style.display = 'inline-block';
  if (logoutBtn) logoutBtn.style.display = 'inline-block';
  if (adminBtn) adminBtn.style.display = (currentUser && currentUser.is_admin) ? 'inline-block' : 'none';
}

function showLoggedOut() {
  var loginBtn = document.getElementById('nav-login-btn');
  var registerBtn = document.getElementById('nav-register-btn');
  var profileBtn = document.getElementById('nav-profile-btn');
  var logoutBtn = document.getElementById('nav-logout-btn');
  var adminBtn = document.getElementById('nav-admin-btn');
  if (loginBtn) loginBtn.style.display = 'inline-block';
  if (registerBtn) registerBtn.style.display = 'inline-block';
  if (profileBtn) profileBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (adminBtn) adminBtn.style.display = 'none';
}

function logout() {
  clearToken();
  currentUser = null;
  showLoggedOut();
  switchPage('home');
}

async function register() {
  var username = document.getElementById('reg-user').value.trim();
  var valName = document.getElementById('reg-valname').value.trim();
  var valTag = document.getElementById('reg-valtag').value.trim();
  var rank = document.getElementById('reg-rank').value;
  var role = document.getElementById('reg-role').value;
  var password = document.getElementById('reg-pass').value;
  var passwordConfirm = document.getElementById('reg-pass2').value;
  if (!username || !valName || !valTag || !password) { alert('Tüm alanları doldurun!'); return; }
  var data = await fetch(API_URL + '/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, valName: valName, valTag: valTag, rank: rank, role: role, password: password, passwordConfirm: passwordConfirm })
  }).then(function(r) { return r.json(); });
  if (data.success) {
    alert('✅ Kayıt başarılı!\nKullanıcı adınız: ' + data.username);
    switchPage('login');
  } else {
    alert('❌ ' + (data.message || 'Kayıt hatası'));
  }
}

async function login() {
  var username = document.getElementById('login-user').value.trim();
  var password = document.getElementById('login-pass').value;
  if (!username || !password) { alert('Kullanıcı adı ve şifre gerekli!'); return; }
  var data = await fetch(API_URL + '/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  }).then(function(r) { return r.json(); });
  if (data.success) {
    setToken(data.token);
    currentUser = data.user;
    showLoggedIn();
    alert('✅ Giriş başarılı! Hoş geldin, ' + data.user.username);
    switchPage('home');
  } else {
    alert('❌ ' + (data.message || 'Giriş hatası'));
  }
}

async function loadProfile() {
  if (!getToken()) { switchPage('login'); return; }
  var data = await apiFetch('/profile');
  if (data.success) {
    currentUser = data.user;
    document.getElementById('prof-username').value = data.user.username;
    document.getElementById('prof-valorant').value = data.user.valorant_id || '';
    document.getElementById('prof-rank').value = data.user.rank || '';
    document.getElementById('prof-role').value = data.user.role || 'Duelist';
    profSelectedAgents = data.user.favorite_agents ? JSON.parse(data.user.favorite_agents) : [];
    renderProfAgentPicker();
  }
}

function renderProfAgentPicker() {
  var container = document.getElementById('prof-agent-picker');
  if (!container) return;
  container.innerHTML = AGENTS.map(function(a) {
    var selected = profSelectedAgents.indexOf(a.name) > -1;
    var idx = profSelectedAgents.indexOf(a.name);
    return '<div class="agent-pick-box ' + (selected ? 'selected' : '') + '" onclick="toggleProfAgent(\'' + a.name + '\')"> <img src="' + a.img + '" onerror="this.style.display=\'none\'"> <span class="agent-name-label">' + a.name + '</span> ' + (selected ? '<span class="pick-badge">' + (idx + 1) + '</span>' : '') + ' </div>';
  }).join('');
}

function toggleProfAgent(name) {
  var idx = profSelectedAgents.indexOf(name);
  if (idx > -1) {
    profSelectedAgents.splice(idx, 1);
  } else {
    if (profSelectedAgents.length >= 3) { alert('En fazla 3 ajan seçebilirsiniz!'); return; }
    profSelectedAgents.push(name);
  }
  renderProfAgentPicker();
}

async function updateProfile() {
  var valorant_id = document.getElementById('prof-valorant').value.trim();
  var rank = document.getElementById('prof-rank').value;
  var role = document.getElementById('prof-role').value;
  var data = await apiFetch('/profile', { method: 'PUT', body: JSON.stringify({ valorant_id: valorant_id, rank: rank, role: role, favorite_agents: profSelectedAgents }) });
  if (data.success) { alert('✅ Profil güncellendi!'); loadProfile(); }
}

async function loadRooms() {
  var data = await apiFetch('/rooms');
  var container = document.getElementById('rooms-list');
  if (!container) return;
  if (!data.success || !data.rooms) { container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:40px;">Yüklenemedi</p>'; return; }
  var filter = document.getElementById('room-filter') ? document.getElementById('room-filter').value : 'all';
  var rooms = data.rooms;
  if (filter !== 'all') {
    rooms = rooms.filter(function(r) { return r.team_size === parseInt(filter); });
  }
  if (rooms.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">Henüz ilan yok. İlk ilan sen oluştur!</p>';
    return;
  }
  container.innerHTML = rooms.map(renderRoomCard).join('');
  rooms.forEach(function(r) { startChatPolling(r.id); });
}

function renderRoomCard(room) {
  var isOwner = currentUser && room.user_id === currentUser.id;
  var isAdmin = currentUser && currentUser.is_admin;
  var isJoined = currentUser && room.participants.some(function(p) { return p.username === currentUser.username; });
  var myParticipant = room.participants.find(function(p) { return currentUser && p.username === currentUser.username; });
  var amReady = myParticipant && myParticipant.is_ready;
  var allReady = room.participants.length > 0 && room.participants.every(function(p) { return p.is_ready; });
  var showIds = allReady || isOwner;

  var agentsHtml = room.agents.map(function(a) {
    var ag = AGENTS.find(function(x) { return x.name === a; });
    return ag ? '<img src="' + ag.img + '" class="agent-img" title="' + a + '" onerror="this.style.display=\'none\'">' : '';
  }).join('');

  var chatHtml = room.messages.map(function(m) {
    return '<div class="chat-msg"><b>' + m.sender + '</b> (' + new Date(m.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'}) + '): ' + m.message + '</div>';
  }).join('');

  var ownerAgents = room.owner_favorite_agents || [];
  var ownerAvatarHtml = '<div class="profile-display"><div class="main-avatar">' + room.username[0].toUpperCase() + '</div>';
  ownerAgents.slice(0, 2).forEach(function(a) {
    var ag = AGENTS.find(function(x) { return x.name === a; });
    if (ag) ownerAvatarHtml += '<img src="' + ag.img + '" class="sub-avatar" title="' + a + '" onerror="this.style.display=\'none\'">';
  });
  ownerAvatarHtml += '</div>';

  var participantsHtml = room.participants.map(function(p) {
    var pAgents = p.favorite_agents ? JSON.parse(p.favorite_agents) : [];
    var avatarHtml = '<div class="profile-display"><div class="main-avatar ' + (p.is_ready ? 'ready' : '') + '">' + p.username[0].toUpperCase() + '</div>';
    pAgents.slice(0, 2).forEach(function(a) {
      var ag = AGENTS.find(function(x) { return x.name === a; });
      if (ag) avatarHtml += '<img src="' + ag.img + '" class="sub-avatar" title="' + a + '" onerror="this.style.display=\'none\'">';
    });
    avatarHtml += '</div>';
    return '<div class="participant-row">' + avatarHtml + '<div style="flex:1;"><span><b>' + p.username + '</b> ' + (p.is_ready ? '<span class="badge badge-green">✓ HAZIR</span>' : '') + '</span><div style="font-size:12px; color:#94a3b8;">' + (showIds ? p.valorant_id : '••••••••') + ' • ' + p.rank + '</div></div></div>';
  }).join('');

  var missingCount = room.team_size - 1 - room.participants.length;
  var sizeLabel = room.team_size + ' Kişi Lazım';

  setTimeout(function() { startCountdown(room.id, room.expires_at); }, 50);

  return '<div class="room-card">' +
    '<div class="room-header">' +
      ownerAvatarHtml +
      '<div class="room-user-info">' +
        '<div class="room-username">' + room.username + ' <span class="badge" style="background:#a855f7;">' + sizeLabel + '</span></div>' +
        '<div class="room-rank">' + room.rank + ' • ' + (showIds ? room.owner_valorant_id : '••••••••') + '</div>' +
      '</div>' +
    '</div>' +
    '<div id="countdown-' + room.id + '" class="room-countdown"> --:--</div>' +
    '<div class="room-agents">' + (agentsHtml || '<span style="color:#64748b; font-size:12px;">Ajan seçilmedi</span>') + '</div>' +
    '<div class="room-badges">' +
      '<span class="badge">' + room.mode + '</span>' +
      '<span class="badge">' + room.age + '</span>' +
      '<span class="badge ' + (room.microphone ? 'badge-green' : 'badge-red') + '">' + (room.microphone ? '🎤 Mikrofon: EVET' : '🔇 Mikrofon: HAYIR') + '</span>' +
    '</div>' +
    (room.description ? '<div class="room-desc">' + room.description + '</div>' : '') +
    '<div class="room-participants">' +
      '<h4>👥 Katılımcılar (' + (room.participants.length + 1) + '/' + room.team_size + ')</h4>' +
      '<div class="participant-row">' + ownerAvatarHtml + '<div style="flex:1;"><span><b>' + room.username + '</b> (Kurucu)</span><div style="font-size:12px; color:#94a3b8;">' + (showIds ? room.owner_valorant_id : '••••••••') + ' • ' + room.rank + '</div></div></div>' +
      participantsHtml +
    '</div>' +
    '<div class="room-actions">' +
      (!isOwner && !isJoined ? '<button class="btn-hero btn-hero-success" onclick="joinRoom(' + room.id + ')">+ Katıl</button>' : '') +
      (isJoined ? '<button class="btn-hero btn-hero-outline" onclick="leaveRoom(' + room.id + ')">🚪 Çık</button>' : '') +
      (isJoined && !amReady ? '<button class="btn-hero btn-hero-primary" onclick="setReady(' + room.id + ', true)">✓ Bu Takımdan Adam Olurum</button>' : '') +
      (isJoined && amReady ? '<button class="btn-hero btn-hero-danger" onclick="setReady(' + room.id + ', false)">✗ Hazır Değilim</button>' : '') +
      ((isOwner || isAdmin) ? '<button class="btn-hero btn-hero-danger" onclick="deleteRoom(' + room.id + ')">🗑️ Sil</button>' : '') +
    '</div>' +
    (isJoined ? '<div class="room-chat">' +
      '<h4>💬 Sohbet (Anlık)</h4>' +
      '<div class="chat-messages" id="chat-' + room.id + '">' + (chatHtml || '<p style="color:#64748b; font-size:12px;">Henüz mesaj yok</p>') + '</div>' +
      '<div class="chat-input-row">' +
        '<input type="text" id="msg-' + room.id + '" placeholder="Mesaj yaz..." onkeypress="if(event.key===\'Enter\') sendMessage(' + room.id + ')">' +
        '<button class="btn-hero btn-hero-success" onclick="sendMessage(' + room.id + ')">Gönder</button>' +
      '</div>' +
    '</div>' : '') +
  '</div>';
}

function startChatPolling(roomId) {
  if (chatIntervals[roomId]) clearInterval(chatIntervals[roomId]);
  chatIntervals[roomId] = setInterval(function() { refreshChat(roomId); }, 2000);
}

async function refreshChat(roomId) {
  var data = await apiFetch('/rooms/' + roomId + '/messages');
  var chatEl = document.getElementById('chat-' + roomId);
  if (!chatEl || !data.success) return;
  var newHtml = data.messages.map(function(m) {
    return '<div class="chat-msg"><b>' + m.sender + '</b> (' + new Date(m.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'}) + '): ' + m.message + '</div>';
  }).join('');
  if (chatEl.innerHTML !== newHtml) {
    chatEl.innerHTML = newHtml || '<p style="color:#64748b; font-size:12px;">Henüz mesaj yok</p>';
    chatEl.scrollTop = chatEl.scrollHeight;
  }
}

function openCreateRoom() {
  if (!getToken()) { alert('Önce giriş yapın!'); switchPage('login'); return; }
  selectedAgents = [];
  renderAgentPicker();
  document.getElementById('create-room-modal').classList.add('active');
}

function closeCreateRoom() {
  document.getElementById('create-room-modal').classList.remove('active');
}

function renderAgentPicker() {
  var container = document.getElementById('agent-picker');
  if (!container) return;
  container.innerHTML = AGENTS.map(function(a) {
    var selected = selectedAgents.indexOf(a.name) > -1;
    var idx = selectedAgents.indexOf(a.name);
    return '<div class="agent-pick-box ' + (selected ? 'selected' : '') + '" onclick="toggleAgent(\'' + a.name + '\')"> <img src="' + a.img + '" onerror="this.style.display=\'none\'"> <span class="agent-name-label">' + a.name + '</span> ' + (selected ? '<span class="pick-badge">' + (idx + 1) + '</span>' : '') + ' </div>';
  }).join('');
}

function toggleAgent(name) {
  var idx = selectedAgents.indexOf(name);
  if (idx > -1) {
    selectedAgents.splice(idx, 1);
  } else {
    if (selectedAgents.length >= 3) { alert('En fazla 3 ajan seçebilirsiniz!'); return; }
    selectedAgents.push(name);
  }
  renderAgentPicker();
}

async function createRoom() {
  var mode = document.getElementById('room-mode').value;
  var age = document.getElementById('room-age').value;
  var description = document.getElementById('room-desc').value;
  var microphone = document.getElementById('room-mic').checked;
  var team_size = parseInt(document.getElementById('room-team-size').value);
  var data = await apiFetch('/rooms', {
    method: 'POST', body: JSON.stringify({ mode: mode, age: age, description: description, agents: selectedAgents, microphone: microphone, team_size: team_size })
  });
  if (data.success) {
    alert('✅ İlan oluşturuldu! (' + team_size + ' kişi lazım)');
    closeCreateRoom();
    document.getElementById('room-desc').value = '';
    loadRooms();
  }
}

async function joinRoom(id) {
  var data = await apiFetch('/rooms/' + id + '/join', { method: 'POST' });
  if (data.success) { alert('✅ İlana katıldın!'); loadRooms(); }
  else alert('❌ ' + data.message);
}

async function leaveRoom(id) {
  if (!confirm('Odadan çıkmak istediğinize emin misiniz?')) return;
  var data = await apiFetch('/rooms/' + id + '/leave', { method: 'POST' });
  if (data.success) { alert('✅ Odadan çıktın'); loadRooms(); }
}

async function setReady(roomId, isReady) {
  var data = await apiFetch('/rooms/' + roomId + '/ready', { method: 'POST', body: JSON.stringify({ is_ready: isReady }) });
  if (data.success) {
    if (isReady) {
      alert('✅ Hazır oldun! Tüm takım hazır olunca Valorant ID\'ler görünür.');
    }
    loadRooms();
  }
}

async function deleteRoom(id) {
  if (!confirm('İlanı silmek istediğinize emin misiniz?')) return;
  var data = await apiFetch('/rooms/' + id, { method: 'DELETE' });
  if (data.success) loadRooms();
}

async function sendMessage(roomId) {
  var input = document.getElementById('msg-' + roomId);
  var message = input.value.trim();
  if (!message) return;
  var data = await apiFetch('/rooms/' + roomId + '/message', { method: 'POST', body: JSON.stringify({ message: message }) });
  if (data.success) { input.value = ''; refreshChat(roomId); }
}

async function startMatchmaking() {
  if (!getToken()) { alert('Önce giriş yapın!'); switchPage('login'); return; }
  var btn = document.getElementById('match-btn');
  var status = document.getElementById('match-status');
  var result = document.getElementById('match-result');
  btn.disabled = true;
  btn.textContent = 'Aranıyor...';
  result.innerHTML = '';
  status.innerHTML = '<p style="margin-top:15px; color:#a855f7;">Rankına uygun takım arkadaşları aranıyor... Ajan çakışması otomatik kontrol edilir.</p>';
  var tryMatch = async function() {
    var data = await apiFetch('/matchmaking/join', { method: 'POST' });
    if (data.matched) {
      clearInterval(matchmakingInterval);
      btn.disabled = false;
      btn.textContent = 'Eşleşme Ara';
      status.innerHTML = '<p style="color:#10b981; font-weight:800; font-size:18px;">✅ TAKIM BULUNDU!</p>';
      result.innerHTML = '<div class="match-team-card">' +
        '<h3> 5\'li Takımın Hazır!</h3>' +
        data.team.map(function(t) {
          var agents = t.favorite_agents ? JSON.parse(t.favorite_agents) : [];
          return '<div class="match-team-member">' +
            '<div><b>' + t.username + '</b> <span style="color:#a855f7;">' + t.rank + ' • ' + t.role + '</span></div>' +
            '<div style="font-size:13px; color:#94a3b8;">' + t.valorant_id + '</div>' +
          '</div>';
        }).join('') +
        '<button class="btn-hero btn-hero-primary btn-full" style="margin-top:15px;" onclick="switchPage(\'rooms\')">📋 Takım Odasını Gör (Sohbet Açık)</button>' +
      '</div>';
      setTimeout(function() { switchPage('rooms'); }, 3000);
    } else {
      status.innerHTML = '<p style="margin-top:15px; color:#a855f7;">Kuyrukta ' + data.waiting + '/5 kişi bekliyor...' + (data.message ? ' ' + data.message : '') + '</p>';
    }
  };
  await tryMatch();
  matchmakingInterval = setInterval(tryMatch, 3000);
}

async function loadGiveawayParticipants() {
  var container = document.getElementById('giveaway-participants-list');
  if (!container) return;
  var data = await fetch(API_URL + '/giveaway').then(function(r) { return r.json(); });
  if (!data.success || data.participants.length === 0) {
    container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px;">Henüz kimse katılmadı. İlk katılan sen ol!</p>';
    return;
  }
  container.innerHTML = data.participants.map(function(p, i) {
    return '<div class="participant-item"> <span class="name">#' + (i + 1) + ' - ' + p.username + '</span> <span class="status">Katıldı ✓</span> </div>';
  }).join('');
}

async function loadHomeGiveawayParticipants() {
  var container = document.getElementById('home-giveaway-participants');
  if (!container) return;
  var data = await fetch(API_URL + '/giveaway').then(function(r) { return r.json(); });
  if (!data.success || data.participants.length === 0) {
    container.innerHTML = '<p style="color:#64748b; font-size:12px; text-align:center; padding:10px;">Henüz katılan yok.</p>';
    return;
  }
  container.innerHTML = data.participants.slice(0, 10).map(function(p, i) {
    return '<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;"> <span>#' + (i + 1) + ' - ' + p.username + '</span> <span style="color:#10b981; font-size:11px;">✓</span> </div>';
  }).join('');
}

async function joinGiveawayWithPoints() {
  if (!getToken()) { alert('Çekilişe katılabilmek için önce giriş yapmalısınız!'); switchPage('login'); return; }
  var data = await apiFetch('/giveaway/join', { method: 'POST' });
  if (data.success) { alert(data.message || '✅ Katıldınız!'); loadGiveawayParticipants(); }
  else alert(data.message || '❌ Hata');
}

async function watchAd() {
  if (!getToken()) { alert('Puan kazanmak için önce giriş yapmalısınız!'); switchPage('login'); return; }
  if (!confirm('Reklam izleme simülasyonu başlatılıyor. 3 saniye bekleyin...')) return;
  setTimeout(async function() {
    var data = await apiFetch('/giveaway/watch-ad', { method: 'POST' });
    if (data.success) alert(data.message);
    else alert(data.message);
  }, 3000);
}

async function redeemPromoCode() {
  if (!getToken()) { alert('Kod kullanmak için önce giriş yapmalısınız!'); switchPage('login'); return; }
  var codeInput = document.getElementById('promo-code-input');
  var code = codeInput.value.trim().toUpperCase();
  if (!code) { alert('Lütfen bir kod girin!'); return; }
  var data = await apiFetch('/giveaway/redeem-code', { method: 'POST', body: JSON.stringify({ code: code }) });
  if (data.success) { alert(data.message); codeInput.value = ''; }
  else alert(data.message);
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
  event.target.classList.add('active');
  document.getElementById('admin-tab-' + tabName).classList.add('active');
  if (tabName === 'dashboard') loadAdminDashboard();
  if (tabName === 'users') loadAdminUsers();
  if (tabName === 'codes') loadAdminCodes();
  if (tabName === 'ads') loadAdminAds();
  if (tabName === 'settings') loadAdminSettings();
}

async function loadAdminDashboard() {
  if (!currentUser || !currentUser.is_admin) return;
  var data = await apiFetch('/admin/dashboard');
  if (!data.success) return;
  document.getElementById('stat-users').textContent = data.stats.totalUsers;
  document.getElementById('stat-rooms').textContent = data.stats.totalRooms;
  document.getElementById('stat-participants').textContent = data.stats.totalParticipants;
  document.getElementById('stat-banned').textContent = data.stats.bannedUsers;
  var recentUsersEl = document.getElementById('recent-users-list');
  if (data.recentUsers && data.recentUsers.length > 0) {
    recentUsersEl.innerHTML = data.recentUsers.map(function(u) {
      return '<div class="recent-item"><div><div class="name">' + u.username + '</div><div class="meta">' + (u.valorant_id || '-') + ' • ' + u.rank + '</div></div><div class="meta">' + new Date(u.created_at).toLocaleDateString('tr-TR') + '</div></div>';
    }).join('');
  } else {
    recentUsersEl.innerHTML = '<p style="color:#94a3b8;">Henüz kullanıcı yok.</p>';
  }
  var recentRoomsEl = document.getElementById('recent-rooms-list');
  if (data.recentRooms && data.recentRooms.length > 0) {
    recentRoomsEl.innerHTML = data.recentRooms.map(function(r) {
      return '<div class="recent-item"><div><div class="name">#' + r.id + ' - ' + r.username + '</div><div class="meta">' + r.mode + '</div></div><div class="meta">' + new Date(r.created_at).toLocaleDateString('tr-TR') + '</div></div>';
    }).join('');
  } else {
    recentRoomsEl.innerHTML = '<p style="color:#94a3b8;">Henüz ilan yok.</p>';
  }
}

async function loadAdminUsers() {
  if (!currentUser || !currentUser.is_admin) return;
  var data = await apiFetch('/admin/users');
  if (!data.success) return;
  allUsers = data.users;
  renderUsersList(allUsers);
}

function renderUsersList(users) {
  var container = document.getElementById('admin-users-list');
  if (!container) return;
  if (users.length === 0) { container.innerHTML = '<p style="color:#94a3b8;">Kullanıcı bulunamadı.</p>'; return; }
  container.innerHTML = users.map(function(u) {
    return '<div class="admin-user-item ' + (u.is_banned ? 'banned' : '') + '">' +
      '<div class="admin-user-info">' +
        '<b>' + u.username + '</b>' +
        (u.is_admin ? '<span class="admin-tag admin-tag-admin">ADMIN</span>' : '') +
        (u.is_banned ? '<span class="admin-tag admin-tag-banned">BANLI</span>' : '') +
        '<div class="meta">' + (u.valorant_id || '-') + ' • ' + u.rank + ' • ' + u.role + '</div>' +
        (u.ban_reason ? '<div style="font-size:11px; color:#ef4444; margin-top:4px;">Sebep: ' + u.ban_reason + '</div>' : '') +
      '</div>' +
      '<div class="admin-actions">' +
        (u.is_banned ? '<button class="btn-hero btn-hero-success" onclick="unbanUser(' + u.id + ')">✓ Ban Kaldır</button>' : '<button class="btn-hero btn-hero-danger" onclick="banUser(' + u.id + ')">🚫 Banla</button>') +
        (!u.is_admin ? '<button class="badge" style="background:#1e3a8a; color:#60a5fa; cursor:pointer;" onclick="toggleAdmin(' + u.id + ')">⭐ Admin Yap</button>' : '<button class="badge" style="background:#64748b; color:#fff; cursor:pointer;" onclick="toggleAdmin(' + u.id + ')">Admin Al</button>') +
        '<button class="btn-hero btn-hero-danger" onclick="deleteUser(' + u.id + ')">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function filterUsers() {
  var search = document.getElementById('user-search').value.toLowerCase();
  var filtered = allUsers.filter(function(u) { return u.username.toLowerCase().indexOf(search) > -1 || (u.valorant_id || '').toLowerCase().indexOf(search) > -1; });
  renderUsersList(filtered);
}

async function banUser(id) {
  var reason = prompt('Ban sebebi (boş bırakılabilir):');
  if (reason === null) return;
  var data = await apiFetch('/admin/users/' + id + '/ban', { method: 'POST', body: JSON.stringify({ reason: reason }) });
  if (data.success) { alert('✅ Kullanıcı banlandı'); loadAdminUsers(); }
  else alert('❌ ' + data.message);
}

async function unbanUser(id) {
  if (!confirm('Banı kaldırmak istediğinize emin misiniz?')) return;
  var data = await apiFetch('/admin/users/' + id + '/unban', { method: 'POST' });
  if (data.success) { alert('✅ Ban kaldırıldı'); loadAdminUsers(); }
  else alert('❌ ' + data.message);
}

async function toggleAdmin(id) {
  if (!confirm('Admin yetkisini değiştirmek istediğinize emin misiniz?')) return;
  var data = await apiFetch('/admin/users/' + id + '/toggle-admin', { method: 'POST' });
  if (data.success) { alert('✅ Güncellendi'); loadAdminUsers(); }
  else alert('❌ ' + data.message);
}

async function deleteUser(id) {
  if (!confirm('Bu kullanıcıyı kalıcı olarak silmek istediğinize emin misiniz?')) return;
  var data = await apiFetch('/admin/users/' + id, { method: 'DELETE' });
  if (data.success) { alert('✅ Kullanıcı silindi'); loadAdminUsers(); }
  else alert(' ' + data.message);
}

async function loadAdminCodes() {
  if (!currentUser || !currentUser.is_admin) return;
  var data = await apiFetch('/admin/promo-codes');
  if (!data.success) return;
  var container = document.getElementById('admin-codes-list');
  if (!data.codes || data.codes.length === 0) { container.innerHTML = '<p style="color:#94a3b8;">Henüz kod yok.</p>'; return; }
  container.innerHTML = data.codes.map(function(c) {
    var percent = (c.current_uses / c.max_uses) * 100;
    var isFull = c.current_uses >= c.max_uses;
    return '<div class="admin-user-item">' +
      '<div style="flex:1;">' +
        '<div style="font-size:18px; font-weight:800; color:#a855f7; font-family:monospace;">' + c.code + '</div>' +
        '<div style="font-size:13px; color:#94a3b8; margin-top:4px;">Kullanım: ' + c.current_uses + ' / ' + c.max_uses + ' • Ödül: ' + c.points_reward + ' Puan</div>' +
        '<div style="width:100%; height:6px; background:#1e1e2e; border-radius:3px; margin-top:8px; overflow:hidden;"><div style="height:100%; width:' + percent + '%; background:linear-gradient(90deg, #a855f7, #10b981);"></div></div>' +
      '</div>' +
      '<div class="admin-actions">' +
        (isFull ? '<span class="badge badge-red">DOLDU</span>' : '<span class="badge badge-green">AKTİF</span>') +
        '<button class="btn-hero btn-hero-danger" onclick="deleteCode(\'' + c.code + '\')">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function createPromoCode() {
  var code = document.getElementById('new-code').value.trim().toUpperCase();
  var maxUses = parseInt(document.getElementById('new-code-max').value);
  var pointsReward = parseInt(document.getElementById('new-code-points').value) || 100;
  if (!code || !maxUses) { alert('Kod ve maksimum kullanım gerekli!'); return; }
  var data = await apiFetch('/admin/promo-codes', { method: 'POST', body: JSON.stringify({ code: code, max_uses: maxUses, points_reward: pointsReward }) });
  if (data.success) {
    alert('✅ Kod oluşturuldu!');
    document.getElementById('new-code').value = '';
    document.getElementById('new-code-max').value = '';
    document.getElementById('new-code-points').value = '';
    loadAdminCodes();
  } else {
    alert('❌ ' + data.message);
  }
}

async function deleteCode(code) {
  if (!confirm('Bu kodu silmek istediğinize emin misiniz?')) return;
  var data = await apiFetch('/admin/promo-codes/' + code, { method: 'DELETE' });
  if (data.success) { alert('✅ Kod silindi'); loadAdminCodes(); }
  else alert('❌ ' + data.message);
}

async function loadAdminAds() {
  if (!currentUser || !currentUser.is_admin) return;
  var data = await apiFetch('/admin/ads');
  if (!data.success) return;
  var container = document.getElementById('admin-ads-list');
  if (!data.ads || data.ads.length === 0) { container.innerHTML = '<p style="color:#94a3b8;">Henüz reklam yok.</p>'; return; }
  container.innerHTML = data.ads.map(function(ad) {
    return '<div class="admin-user-item">' +
      '<div style="flex:1;">' +
        '<div style="font-weight:700; color:#fff;">' + ad.title + '</div>' +
        '<div style="font-size:12px; color:#94a3b8; margin-top:4px; word-break:break-all;">' + ad.url + '</div>' +
        '<div style="font-size:12px; color:#10b981; margin-top:4px;">👆 ' + ad.clicks + ' tıklama</div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<span class="badge ' + (ad.is_active ? 'badge-green' : 'badge-red') + '">' + (ad.is_active ? 'AKTİF' : 'PASİF') + '</span>' +
        '<button class="btn-hero btn-hero-' + (ad.is_active ? 'danger' : 'success') + '" onclick="toggleAd(' + ad.id + ', ' + (!ad.is_active) + ')">' + (ad.is_active ? 'Devre Dışı' : 'Aktif Et') + '</button>' +
        '<button class="btn-hero btn-hero-danger" onclick="deleteAd(' + ad.id + ')">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function createAd() {
  var title = document.getElementById('ad-title').value.trim();
  var url = document.getElementById('ad-url').value.trim();
  var imageUrl = document.getElementById('ad-image').value.trim();
  if (!title || !url) { alert('Başlık ve URL gerekli!'); return; }
  var data = await apiFetch('/admin/ads', { method: 'POST', body: JSON.stringify({ title: title, url: url, image_url: imageUrl }) });
  if (data.success) {
    alert('✅ Reklam eklendi!');
    document.getElementById('ad-title').value = '';
    document.getElementById('ad-url').value = '';
    document.getElementById('ad-image').value = '';
    loadAdminAds();
  } else {
    alert('❌ ' + data.message);
  }
}

async function toggleAd(id, isActive) {
  var data = await apiFetch('/admin/ads/' + id, { method: 'PUT', body: JSON.stringify({ is_active: isActive }) });
  if (data.success) loadAdminAds();
}

async function deleteAd(id) {
  if (!confirm('Bu reklamı silmek istediğinize emin misiniz?')) return;
  var data = await apiFetch('/admin/ads/' + id, { method: 'DELETE' });
  if (data.success) { alert('✅ Reklam silindi'); loadAdminAds(); }
  else alert('❌ ' + data.message);
}

async function loadAdminSettings() {
  if (!currentUser || !currentUser.is_admin) return;
  var data = await apiFetch('/admin/settings');
  if (!data.success) return;
  var s = data.settings;
  if (document.getElementById('set-site-title')) document.getElementById('set-site-title').value = s.site_title || '';
  if (document.getElementById('set-hero-badge')) document.getElementById('set-hero-badge').value = s.hero_badge || '';
  if (document.getElementById('set-hero-title')) document.getElementById('set-hero-title').value = s.hero_title || '';
  if (document.getElementById('set-hero-subtitle')) document.getElementById('set-hero-subtitle').value = s.hero_subtitle || '';
}

async function saveSettings() {
  var settings = {};
  if (document.getElementById('set-site-title')) settings.site_title = document.getElementById('set-site-title').value;
  if (document.getElementById('set-hero-badge')) settings.hero_badge = document.getElementById('set-hero-badge').value;
  if (document.getElementById('set-hero-title')) settings.hero_title = document.getElementById('set-hero-title').value;
  if (document.getElementById('set-hero-subtitle')) settings.hero_subtitle = document.getElementById('set-hero-subtitle').value;
  var data = await apiFetch('/admin/settings/bulk', { method: 'POST', body: JSON.stringify(settings) });
  if (data.success) alert('✅ Tüm ayarlar kaydedildi!');
  else alert('❌ ' + data.message);
}

function fillRankSelects() {
  ['reg-rank', 'prof-rank'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = RANKS.map(function(r) { return '<option value="' + r + '">' + r + '</option>'; }).join('');
  });
}

document.addEventListener('DOMContentLoaded', function() {
  fillRankSelects();
  checkAuthState();
  loadHomeGiveawayParticipants();
});