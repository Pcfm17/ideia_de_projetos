/* ═══════════════════════════════════════════
   TAVOLA REDONDA — auth.js
   Lógica da página de login (index.html)
═══════════════════════════════════════════ */

function showErr(msg) {
    const b = document.getElementById('errBanner');
    b.textContent = msg;
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 5000);
}

// Inicializa banco SEMPRE primeiro
dbInit();

// Verifica se já tem sessão ativa — só redireciona se a sessão for válida
(function checkSession() {
    const user = dbGetLoggedUser();
    if (!user) return; // sem sessão, fica no login
    if (user.isAdmin) {
        window.location.replace('admin.html');
    } else {
        window.location.replace('user.html');
    }
})();

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const username = document.getElementById('inpUser').value.trim();
    const password = document.getElementById('inpPwd').value;

    if (!username || !password) {
        showErr('Preencha todos os campos');
        return;
    }

    const user = dbLogin(username, password);

    if (!user) {
        showErr('Usuário ou senha incorretos');
        return;
    }

    if (user.isAdmin) {
        window.location.replace('admin.html');
    } else {
        window.location.replace('user.html');
    }
});
