/* ═══════════════════════════════════════════
   TAVOLA REDONDA — user.js
   Lógica EXCLUSIVA do usuário comum.
   Não tem acesso a nenhuma função de admin.
   Não exibe senhas.
═══════════════════════════════════════════ */

var chatMode = { type: 'group', target: null };

/* ── Guard: verifica sessão válida e não-admin ── */
function guardUser() {
    dbInit();
    var user = dbGetLoggedUser();

    if (!user) {
        window.location.replace('index.html');
        return null;
    }
    if (user.isAdmin) {
        window.location.replace('admin.html');
        return null;
    }
    return user;
}

/* ── Inicialização ── */
(function init() {
    var user = guardUser();
    if (!user) return;

    document.getElementById('userName').textContent   = user.username;
    document.getElementById('userAvatar').textContent = user.username[0].toUpperCase();

    renderMemberList();
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
    var b = document.getElementById('successBanner');
    b.textContent = msg; b.classList.add('show');
    setTimeout(function() { b.classList.remove('show'); }, 4000);
}
function showErr(msg) {
    var b = document.getElementById('errBanner');
    b.textContent = msg; b.classList.add('show');
    setTimeout(function() { b.classList.remove('show'); }, 4000);
}

/* ── Alterar minha própria senha ── */
function changeMyPwd(inputId) {
    var user = guardUser();
    if (!user) return;

    var newPwd = document.getElementById(inputId).value.trim();
    if (!newPwd || newPwd.length < 3) { showErr('Senha deve ter pelo menos 3 caracteres'); return; }

    if (dbChangePassword(user.username, newPwd)) {
        showOk('Senha alterada com sucesso!');
        document.getElementById(inputId).value = '';
    } else {
        showErr('Erro ao alterar senha');
    }
}

/* ── Lista de membros — SEM senhas, SEM informações sensíveis ── */
function renderMemberList() {
    var user = guardUser();
    if (!user) return;

    var allUsers = dbGetUsers();
    var others   = allUsers.filter(function(u) { return u.username !== user.username; });

    ['memberList_d', 'memberList_m', 'modalMemberList'].forEach(function(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        var isModal = (containerId === 'modalMemberList');

        others.forEach(function(u) {
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
                // Apenas nome — SEM senha, SEM nada sensível
                div.className = 'member-row';
                div.onclick = function() { setMode('private', u.username); };
                div.innerHTML =
                    '<div class="avatar">' + esc(u.username[0].toUpperCase()) + '</div>' +
                    '<div>' +
                        '<div class="member-row-name">' + esc(u.username) + '</div>' +
                        '<div class="member-row-status">🟢 Online</div>' +
                    '</div>';
            }

            container.appendChild(div);
        });
    });
}

/* ── Modal de chat mode ── */
function openModeModal() {
    renderMemberList();
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
    var user = guardUser();
    if (!user) return;

    var input = document.getElementById('msgInput');
    var text  = input.value.trim();
    if (!text) return;

    var msgs = dbGetMsgs();
    msgs.push({ id: Date.now(), user: user.username, text: text, ts: Date.now(), type: chatMode.type, target: chatMode.target });
    dbSaveMsgs(msgs);
    input.value = '';
    input.style.height = 'auto';
    loadMessages();
}

function loadMessages() {
    var user = guardUser();
    if (!user) return;

    var msgs = dbGetMsgs();
    var list = document.getElementById('msgList');
    list.innerHTML = '';

    var filtered = msgs.filter(function(m) {
        if (chatMode.type === 'group') return !m.type || m.type === 'group';
        return m.type === 'private' && (
            (m.user === user.username && m.target === chatMode.target) ||
            (m.user === chatMode.target && m.target === user.username)
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
