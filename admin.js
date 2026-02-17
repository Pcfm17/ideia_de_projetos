/* ═══════════════════════════════════════════
   TAVOLA REDONDA — admin.js
   Lógica EXCLUSIVA do painel administrativo.
   Senhas NUNCA são exibidas.
═══════════════════════════════════════════ */

let chatMode = { type: 'group', target: null };

/* ── Guard: verifica no banco se é admin de verdade ── */
function guardAdmin() {
    dbInit();
    const user = dbGetLoggedUser();
    if (!user || !user.isAdmin) {
        dbSessionClear();
        window.location.replace('index.html');
        return null;
    }
    return user;
}

/* ── Inicialização ── */
(function init() {
    const admin = guardAdmin();
    if (!admin) return;

    document.getElementById('adminName').textContent   = admin.username;
    document.getElementById('adminAvatar').textContent = admin.username[0].toUpperCase();

    renderUserList();
    loadMessages();

    setInterval(function() { dbPurgeMsgs(); loadMessages(); }, 10000);
})();

/* ── Logout ── */
function doLogout() {
    if (!confirm('Tem certeza que deseja sair?')) return;
    dbSessionClear();
    window.location.replace('index.html');
}

/* ── Feedback visual ── */
function showOk(msg) {
    const b = document.getElementById('successBanner');
    b.textContent = msg; b.classList.add('show');
    setTimeout(function() { b.classList.remove('show'); }, 4000);
}
function showErr(msg) {
    const b = document.getElementById('errBanner');
    b.textContent = msg; b.classList.add('show');
    setTimeout(function() { b.classList.remove('show'); }, 4000);
}

/* ── Alterar minha senha (campo único reutilizado por desktop e mobile) ── */
function changeMyPwd(inputId) {
    const admin = guardAdmin();
    if (!admin) return;

    const newPwd = document.getElementById(inputId).value.trim();
    if (!newPwd || newPwd.length < 3) { showErr('Senha deve ter pelo menos 3 caracteres'); return; }

    if (dbChangePassword(admin.username, newPwd)) {
        showOk('Senha alterada com sucesso!');
        document.getElementById(inputId).value = '';
    } else {
        showErr('Erro ao alterar senha');
    }
}

/* ── Criar usuário ── */
function createUser(userInputId, pwdInputId) {
    const admin = guardAdmin();
    if (!admin) return;

    const newUsername = document.getElementById(userInputId).value.trim();
    const newPassword = document.getElementById(pwdInputId).value.trim();

    if (!newUsername || !newPassword) { showErr('Preencha todos os campos'); return; }
    if (newPassword.length < 3)       { showErr('Senha deve ter pelo menos 3 caracteres'); return; }

    const result = dbCreateUser(newUsername, newPassword);
    if (result === 'exists') { showErr('Usuário já existe'); return; }

    showOk('Usuário "' + newUsername + '" criado com sucesso!');
    document.getElementById(userInputId).value = '';
    document.getElementById(pwdInputId).value  = '';
    renderUserList();
}

/* ── Deletar usuário ── */
function deleteUser(username) {
    const admin = guardAdmin();
    if (!admin) return;

    if (!confirm('Deletar o usuário "' + username + '"?')) return;

    if (dbDeleteUser(username)) {
        showOk('Usuário "' + username + '" deletado.');
        renderUserList();
    } else {
        showErr('Não é possível deletar este usuário');
    }
}

/* ── Lista de usuários — SEM SENHAS ── */
function renderUserList() {
    var admin = guardAdmin();
    if (!admin) return;

    var users = dbGetUsers();

    ['userList_d', 'userList_m', 'modalUserList'].forEach(function(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        var isModal = (containerId === 'modalUserList');

        users.forEach(function(u) {
            var div = document.createElement('div');

            if (isModal) {
                div.className = 'user-row';
                div.style.cursor = 'pointer';
                div.onclick = function() { setMode('private', u.username); };
                div.innerHTML =
                    '<div class="user-row-info">' +
                        '<div class="avatar">' + esc(u.username[0].toUpperCase()) + '</div>' +
                        '<div>' +
                            '<div class="user-name-text">' + esc(u.username) + '</div>' +
                            '<div style="font-size:12px;color:var(--text2);">Chat privado</div>' +
                        '</div>' +
                    '</div>';
            } else {
                div.className = 'user-row';
                // ← Apenas nome + badge admin + botão deletar. SEM SENHA.
                div.innerHTML =
                    '<div class="user-row-info">' +
                        '<div class="avatar">' + esc(u.username[0].toUpperCase()) + '</div>' +
                        '<div class="user-name-text">' +
                            esc(u.username) +
                            (u.username === 'admin' ? ' <span class="badge-admin">Admin</span>' : '') +
                        '</div>' +
                    '</div>' +
                    (u.username !== 'admin'
                        ? '<button class="btn-sm btn-danger-sm" onclick="deleteUser(\'' + esc(u.username) + '\')">Deletar</button>'
                        : '');
            }

            container.appendChild(div);
        });
    });
}

/* ── Modal de chat mode ── */
function openModeModal() {
    renderUserList();
    document.getElementById('modeModal').classList.add('show');
}
function closeModeModal(e) {
    if (!e || e.target.id === 'modeModal')
        document.getElementById('modeModal').classList.remove('show');
}
function setMode(type, target) {
    target = target || null;
    chatMode = { type: type, target: target };
    document.getElementById('modeLabel').textContent =
        type === 'group' ? 'Grupo • Todos' : 'Privado • ' + target;
    document.getElementById('modeModal').classList.remove('show');
    loadMessages();
}

/* ── Mensagens ── */
function sendMsg() {
    var admin = guardAdmin();
    if (!admin) return;

    var input = document.getElementById('msgInput');
    var text  = input.value.trim();
    if (!text) return;

    var msgs = dbGetMsgs();
    msgs.push({ id: Date.now(), user: admin.username, text: text, ts: Date.now(), type: chatMode.type, target: chatMode.target });
    dbSaveMsgs(msgs);
    input.value = '';
    input.style.height = 'auto';
    loadMessages();
}

function loadMessages() {
    var admin = guardAdmin();
    if (!admin) return;

    var msgs = dbGetMsgs();
    var list = document.getElementById('msgList');
    list.innerHTML = '';

    var filtered = msgs.filter(function(m) {
        if (chatMode.type === 'group') return !m.type || m.type === 'group';
        return m.type === 'private' && (
            (m.user === admin.username && m.target === chatMode.target) ||
            (m.user === chatMode.target && m.target === admin.username)
        );
    });

    filtered.forEach(function(m) {
        var div = document.createElement('div');
        div.className = 'msg';
        var left = 86400000 - (Date.now() - m.ts);
        var h    = Math.floor(left / 3600000);
        var min  = Math.floor((left % 3600000) / 60000);
        div.innerHTML =
            '<div class="msg-bubble">' +
                '<div class="msg-head">' +
                    '<span class="msg-author">' + esc(m.user) + (m.type === 'private' ? ' 🔒' : '') + '</span>' +
                    '<span class="msg-time">' + fmtTime(m.ts) + '</span>' +
                '</div>' +
                '<div class="msg-text">' + esc(m.text) + '</div>' +
                '<div class="msg-expire">⏳ Expira em ' + h + 'h ' + min + 'm</div>' +
            '</div>';
        list.appendChild(div);
    });

    var wrap = document.getElementById('msgWrap');
    wrap.scrollTop = wrap.scrollHeight;
}

function onMsgKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}
