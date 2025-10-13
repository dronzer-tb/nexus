// Minimal frontend JS to call Nexus backend for admin login, token creation and agent connect

async function adminLogin(username, password) {
  const resp = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return resp.json();
}

async function createToken(name) {
  const resp = await fetch('/api/admin/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return resp.json();
}

async function agentConnect(token, hostname) {
  const resp = await fetch('/api/agent/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_token: token, hostname })
  });
  return resp.json();
}

// Wire buttons if present
window.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const u = document.getElementById('username').value;
      const p = document.getElementById('password').value;
      const r = await adminLogin(u, p);
      alert(JSON.stringify(r));
    });
  }

  const tokenForm = document.getElementById('token-form');
  if (tokenForm) {
    tokenForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const n = document.getElementById('token-name').value;
      const r = await createToken(n);
      alert(JSON.stringify(r));
    });
  }

  const connectForm = document.getElementById('connect-form');
  if (connectForm) {
    connectForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const t = document.getElementById('connect-token').value;
      const h = document.getElementById('connect-hostname').value || window.location.hostname;
      const r = await agentConnect(t, h);
      alert(JSON.stringify(r));
    });
  }
});
