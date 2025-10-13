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

// Live updates via WebSocket
let ws;
function startLive() {
  try {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/live');
    ws.onopen = () => console.log('live ws open');
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'agent.update') {
          updateAgentRow(data.agent, data.metrics);
        }
      } catch (e) {
        console.error(e);
      }
    };
    ws.onclose = () => setTimeout(startLive, 2000);
  } catch (e) {
    console.error('ws failed', e);
  }
}

function updateAgentRow(agent, metrics) {
  const container = document.getElementById('agents-container');
  if (!container) return;
  let row = document.getElementById('agent-' + agent);
  const cpu = metrics && metrics.cpu_percent ? metrics.cpu_percent : 0;
  const mem = metrics && metrics.memory ? Math.round(metrics.memory.percent) : 0;
  if (!row) {
    row = document.createElement('tr');
    row.id = 'agent-' + agent;
    row.innerHTML = `<td class="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">${agent}</td>
      <td class="px-6 py-4"><div class="flex items-center gap-2"><div class="w-24 h-2 rounded-full bg-primary/20"><div class="h-2 rounded-full bg-primary" style="width: ${cpu}%; box-shadow: 0 0 5px rgba(13, 139, 242, 0.7);"></div></div><span>${cpu}%</span></div></td>
      <td class="px-6 py-4"><div class="flex items-center gap-2"><div class="w-24 h-2 rounded-full bg-primary/20"><div class="h-2 rounded-full bg-primary" style="width: ${mem}%; box-shadow: 0 0 5px rgba(13, 139, 242, 0.7);"></div></div><span>${mem}%</span></div></td>
      <td class="px-6 py-4">—</td>
      <td class="px-6 py-4 text-center"><span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400"><span class="w-2 h-2 mr-2 bg-green-400 rounded-full animate-pulse"></span>Online</span></td>`;
    container.prepend(row);
  } else {
    // update existing
    const tds = row.querySelectorAll('td');
    if (tds[1]) tds[1].querySelector('span').textContent = cpu + '%';
    if (tds[2]) tds[2].querySelector('span').textContent = mem + '%';
  }
}

startLive();
