// SangamFlow Popup - Professional UI Controller

console.log('[SangamFlow Popup] Initialized');

// ============================================================================
// STATE
// ============================================================================

const state = {
  wsConnected: false,
  flowConnected: false,
  activeMcpServer: 'sangamflow-local',
  activeAccount: null,
  accounts: [],
  jobs: []
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[SangamFlow Popup] Loading...');

  // Load current status
  await loadStatus();

  // Load accounts
  await loadAccounts();

  // Load MCP servers
  await loadMcpServers();

  // Load active jobs
  await loadJobs();

  // Setup event listeners
  setupEventListeners();

  // Start periodic updates
  startPeriodicUpdates();

  console.log('[SangamFlow Popup] Loaded');
});

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadStatus() {
  try {
    const response = await sendMessage({ type: 'GET_STATUS' });

    state.wsConnected = response.wsConnected;
    state.activeMcpServer = response.activeMcpServer;
    state.activeAccount = response.activeAccount;

    updateStatusUI();
  } catch (err) {
    console.error('[SangamFlow Popup] Failed to load status:', err);
    showError('Failed to load status');
  }
}

async function loadAccounts() {
  try {
    const response = await sendMessage({ type: 'GET_ACCOUNTS' });
    state.accounts = response.accounts || [];
    renderAccounts();
  } catch (err) {
    console.error('[SangamFlow Popup] Failed to load accounts:', err);
  }
}

async function loadMcpServers() {
  try {
    const response = await sendMessage({ type: 'GET_MCP_SERVERS' });
    renderMcpServers(response.servers || []);
  } catch (err) {
    console.error('[SangamFlow Popup] Failed to load MCP servers:', err);
  }
}

async function loadJobs() {
  try {
    const response = await sendMessage({ type: 'GET_JOBS' });
    state.jobs = response.jobs || [];
    renderJobs();
  } catch (err) {
    console.error('[SangamFlow Popup] Failed to load jobs:', err);
  }
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateStatusUI() {
  // WebSocket status
  const wsStatusText = document.getElementById('ws-status-text');
  const wsStatusDot = document.getElementById('ws-status-dot');

  if (state.wsConnected) {
    wsStatusText.textContent = 'Connected';
    wsStatusDot.classList.remove('disconnected');
    wsStatusDot.classList.add('connected');
  } else {
    wsStatusText.textContent = 'Disconnected';
    wsStatusDot.classList.remove('connected');
    wsStatusDot.classList.add('disconnected');
  }

  // Flow status
  const flowStatusText = document.getElementById('flow-status-text');
  const flowStatusDot = document.getElementById('flow-status-dot');

  if (state.flowConnected) {
    flowStatusText.textContent = 'Connected';
    flowStatusDot.classList.remove('disconnected');
    flowStatusDot.classList.add('connected');
  } else {
    flowStatusText.textContent = 'Not Connected';
    flowStatusDot.classList.remove('connected');
    flowStatusDot.classList.add('disconnected');
  }
}

function renderAccounts() {
  const accountsList = document.getElementById('accounts-list');
  accountsList.innerHTML = '';

  if (state.accounts.length === 0) {
    accountsList.innerHTML = `
      <div style="padding: var(--spacing-md); text-align: center; color: var(--text-secondary); font-size: 12px;">
        No accounts added yet
      </div>
    `;
    return;
  }

  state.accounts.forEach(account => {
    const accountCard = document.createElement('div');
    accountCard.className = `account-card ${account.id === state.activeAccount ? 'active' : ''}`;
    accountCard.dataset.accountId = account.id;

    const initials = account.accountName.substring(0, 2).toUpperCase();
    const isPro = account.plan === 'PRO';

    accountCard.innerHTML = `
      <div class="account-avatar">${initials}</div>
      <div class="account-info">
        <div class="account-name">${account.accountName}</div>
        <div class="account-email">${account.email}</div>
      </div>
      <span class="account-plan ${isPro ? 'pro' : ''}">${account.plan}</span>
    `;

    accountCard.addEventListener('click', () => switchAccount(account.id));
    accountsList.appendChild(accountCard);
  });
}

function renderMcpServers(servers) {
  const select = document.getElementById('mcp-server-select');
  select.innerHTML = '';

  servers.forEach(server => {
    const option = document.createElement('option');
    option.value = server.id;
    option.textContent = server.name;
    option.selected = server.id === state.activeMcpServer;
    select.appendChild(option);
  });
}

function renderJobs() {
  const jobsSection = document.getElementById('jobs-section');
  const jobsList = document.getElementById('jobs-list');

  const activeJobs = state.jobs.filter(job =>
    job.status === 'pending' || job.status === 'running'
  );

  if (activeJobs.length === 0) {
    jobsSection.style.display = 'none';
    return;
  }

  jobsSection.style.display = 'block';
  jobsList.innerHTML = '';

  activeJobs.forEach(job => {
    const jobItem = document.createElement('div');
    jobItem.className = 'job-item';

    const progress = job.progress || 0;

    jobItem.innerHTML = `
      <div class="job-header">
        <span class="job-type">${job.type === 'video' ? '🎬 Video' : '🖼️ Image'}</span>
        <span class="job-status">${job.status} - ${progress}%</span>
      </div>
      <div class="progress-bar job-progress">
        <div class="progress-bar-fill" style="width: ${progress}%"></div>
      </div>
    `;

    jobsList.appendChild(jobItem);
  });
}

// ============================================================================
// ACTIONS
// ============================================================================

async function switchAccount(accountId) {
  try {
    await sendMessage({ type: 'SWITCH_ACCOUNT', data: { accountId } });
    state.activeAccount = accountId;
    renderAccounts();
    showSuccess('Account switched');
  } catch (err) {
    showError('Failed to switch account');
  }
}

async function switchMcpServer(serverId) {
  try {
    await sendMessage({ type: 'SWITCH_MCP_SERVER', data: { serverId } });
    state.activeMcpServer = serverId;
    showSuccess('MCP server switched');
  } catch (err) {
    showError('Failed to switch MCP server');
  }
}

async function addAccount() {
  // In a real implementation, this would open a dialog or OAuth flow
  const email = prompt('Enter Google account email:');
  if (!email) return;

  try {
    await sendMessage({
      type: 'ADD_ACCOUNT',
      data: {
        email,
        accountName: email.split('@')[0],
        plan: 'Standard',
        isLoggedIn: false
      }
    });

    await loadAccounts();
    showSuccess('Account added');
  } catch (err) {
    showError('Failed to add account');
  }
}

function openSidePanel() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
      try {
        await chrome.sidePanel.open({ tabId: tabs[0].id });
      } catch (err) {
        showError('Failed to open side panel');
      }
    }
  });
}

function openSettings() {
  // Open settings in a new tab or side panel
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
}

function generateVideo() {
  // Open generation panel
  openSidePanel();
  // Send message to side panel to open video generation
  setTimeout(() => {
    sendMessage({ type: 'OPEN_GENERATION', data: { type: 'video' } });
  }, 500);
}

function generateImage() {
  openSidePanel();
  setTimeout(() => {
    sendMessage({ type: 'OPEN_GENERATION', data: { type: 'image' } });
  }, 500);
}

function uploadCharacter() {
  openSidePanel();
  setTimeout(() => {
    sendMessage({ type: 'OPEN_UPLOAD_CHARACTER' });
  }, 500);
}

function viewJobs() {
  openSidePanel();
  setTimeout(() => {
    sendMessage({ type: 'OPEN_JOBS' });
  }, 500);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // MCP Server selector
  document.getElementById('mcp-server-select').addEventListener('change', (e) => {
    switchMcpServer(e.target.value);
  });

  // Refresh servers button
  document.getElementById('refresh-servers').addEventListener('click', async () => {
    await loadMcpServers();
    showSuccess('Servers refreshed');
  });

  // Add account button
  document.getElementById('add-account').addEventListener('click', addAccount);

  // Quick action buttons
  document.getElementById('action-generate-video').addEventListener('click', generateVideo);
  document.getElementById('action-generate-image').addEventListener('click', generateImage);
  document.getElementById('action-upload-character').addEventListener('click', uploadCharacter);
  document.getElementById('action-view-jobs').addEventListener('click', viewJobs);

  // Footer buttons
  document.getElementById('open-sidepanel').addEventListener('click', openSidePanel);
  document.getElementById('open-settings').addEventListener('click', openSettings);
}

// ============================================================================
// PERIODIC UPDATES
// ============================================================================

function startPeriodicUpdates() {
  // Update status every 2 seconds
  setInterval(async () => {
    await loadStatus();
    await loadJobs();
  }, 2000);
}

// ============================================================================
// MESSAGING
// ============================================================================

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response || {});
      }
    });
  });
}

// Listen for updates from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message;

  switch (type) {
    case 'ws-connected':
      state.wsConnected = true;
      updateStatusUI();
      break;

    case 'ws-disconnected':
      state.wsConnected = false;
      updateStatusUI();
      break;

    case 'account-changed':
      state.activeAccount = data.accountId;
      loadAccounts();
      break;

    case 'job-updated':
    case 'generation-progress':
    case 'generation-complete':
      loadJobs();
      break;

    default:
      break;
  }
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  notification.style.cssText = `
    position: fixed;
    top: var(--spacing-md);
    right: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'});
    color: white;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
    z-index: 9999;
    animation: fadeIn var(--transition-normal) ease;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'fadeOut var(--transition-normal) ease';
    setTimeout(() => notification.remove(), 250);
  }, 2000);
}

// Add fadeOut animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);
