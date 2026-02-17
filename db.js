/* ═══════════════════════════════════════════
   TAVOLA REDONDA — db.js
   Banco de dados compartilhado.
   Importar ANTES dos outros scripts.
═══════════════════════════════════════════ */

const DB_KEYS = {
    USERS:   'tr_users',
    MSGS:    'tr_messages',
    SESSION: 'tr_session'
};

/* ── Criptografia XOR+Base64 ── */
const _CKEY = 'tavolaredonda2024';

function dbEnc(text) {
    let r = '';
    for (let i = 0; i < text.length; i++)
        r += String.fromCharCode(text.charCodeAt(i) ^ _CKEY.charCodeAt(i % _CKEY.length));
    return btoa(r);
}

function dbDec(b64) {
    try {
        const t = atob(b64);
        let r = '';
        for (let i = 0; i < t.length; i++)
            r += String.fromCharCode(t.charCodeAt(i) ^ _CKEY.charCodeAt(i % _CKEY.length));
        return r;
    } catch { return null; }
}

/* ── CRUD Usuários ── */
function dbGetUsers() {
    const r = localStorage.getItem(DB_KEYS.USERS);
    return r ? JSON.parse(r) : [];
}

function dbSaveUsers(users) {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
}

/* ── CRUD Mensagens ── */
function dbGetMsgs() {
    const r = localStorage.getItem(DB_KEYS.MSGS);
    return r ? JSON.parse(r) : [];
}

function dbSaveMsgs(msgs) {
    localStorage.setItem(DB_KEYS.MSGS, JSON.stringify(msgs));
}

/* ── Sessão ── */
function dbSessionSave(username) {
    localStorage.setItem(DB_KEYS.SESSION, username);
}

function dbSessionClear() {
    localStorage.removeItem(DB_KEYS.SESSION);
}

function dbSessionGet() {
    return localStorage.getItem(DB_KEYS.SESSION) || null;
}

/* ── Validação de sessão ──
   isAdmin SEMPRE derivado do banco — nunca de cookie/localStorage editável. */
function dbGetLoggedUser() {
    const username = dbSessionGet();
    if (!username) return null;
    const users = dbGetUsers();
    const found = users.find(u => u.username === username);
    if (!found) { dbSessionClear(); return null; }
    return {
        username: found.username,
        isAdmin: (found.username === 'admin')
    };
}

/* ── Inicialização do banco ──
   Migra dados do sistema antigo se existirem.
   Garante admin padrão e corrige flags isAdmin. */
function dbInit() {
    // Migra usuários do sistema antigo (familyChat_users -> tr_users)
    const oldUsers = localStorage.getItem('familyChat_users');
    if (oldUsers && !localStorage.getItem(DB_KEYS.USERS)) {
        try {
            const parsed = JSON.parse(oldUsers);
            // Converte formato antigo para novo
            const migrated = parsed.map(u => ({
                username: u.username,
                password: u.password  // já está no mesmo formato XOR+Base64
            }));
            dbSaveUsers(migrated);
        } catch(e) {
            // Se falhar a migração, começa do zero
        }
    }

    let users = dbGetUsers();

    // Cria admin padrão se não existir
    if (!users.find(u => u.username === 'admin')) {
        users.push({ username: 'admin', password: dbEnc('admin123') });
    }

    // FORÇA: apenas 'admin' tem isAdmin=true
    users = users.map(u => ({ ...u, isAdmin: (u.username === 'admin') }));
    dbSaveUsers(users);
}

/* ── Login ── */
function dbLogin(username, password) {
    const users = dbGetUsers();
    const found = users.find(u => u.username === username && dbDec(u.password) === password);
    if (!found) return null;
    dbSessionSave(found.username);
    return { username: found.username, isAdmin: (found.username === 'admin') };
}

/* ── Alterar senha (usuário altera a própria senha) ── */
function dbChangePassword(username, newPassword) {
    const users = dbGetUsers();
    const user = users.find(u => u.username === username);
    if (!user) return false;
    user.password = dbEnc(newPassword);
    dbSaveUsers(users);
    return true;
}

/* ── Criar usuário (só admin chama) ── */
function dbCreateUser(newUsername, newPassword) {
    const users = dbGetUsers();
    if (users.find(u => u.username === newUsername)) return 'exists';
    users.push({ username: newUsername, password: dbEnc(newPassword), isAdmin: false });
    dbSaveUsers(users);
    return 'ok';
}

/* ── Deletar usuário (só admin chama) ── */
function dbDeleteUser(username) {
    if (username === 'admin') return false;
    dbSaveUsers(dbGetUsers().filter(u => u.username !== username));
    return true;
}

/* ── Purgar mensagens > 24h ── */
function dbPurgeMsgs() {
    dbSaveMsgs(dbGetMsgs().filter(m => (Date.now() - m.ts) < 86400000));
}

/* ── Utilitários ── */
function esc(t) {
    const d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
}

function fmtTime(ts) {
    const d = new Date(ts), n = new Date();
    if (d.toDateString() === n.toDateString())
        return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' ' +
           d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
