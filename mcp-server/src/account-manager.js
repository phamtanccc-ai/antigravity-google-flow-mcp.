// SangamFlow Multi-Account Manager
// Manages multiple Google Flow accounts with session isolation

import { EventEmitter } from 'events';

export class AccountManager extends EventEmitter {
  constructor() {
    super();

    this.accounts = new Map();
    this.activeAccount = null;
    this.sessionTokens = new Map();
    this.projectAssociations = new Map();
  }

  // Add or update account
  addAccount(accountInfo) {
    const {
      email,
      accountName,
      plan = 'Standard',
      isLoggedIn = true,
      token = null
    } = accountInfo;

    if (!email) {
      throw new Error('Account email is required');
    }

    const accountId = this.generateAccountId(email);
    const existingAccount = this.accounts.get(accountId);

    const account = {
      id: accountId,
      email,
      accountName: accountName || email.split('@')[0],
      plan,
      isLoggedIn,
      token,
      addedAt: existingAccount?.addedAt || Date.now(),
      lastUsed: Date.now(),
      projects: existingAccount?.projects || [],
      settings: existingAccount?.settings || this.getDefaultSettings()
    };

    this.accounts.set(accountId, account);

    if (token) {
      this.sessionTokens.set(accountId, {
        token,
        capturedAt: Date.now(),
        expiresAt: null // Will be updated when we know expiry
      });
    }

    // Set as active if first account
    if (!this.activeAccount) {
      this.activeAccount = accountId;
    }

    this.emit('account:added', { accountId, account });
    console.log(`[SangamFlow] Account added: ${email}`);

    return accountId;
  }

  // Remove account
  removeAccount(accountId) {
    if (!this.accounts.has(accountId)) {
      return false;
    }

    const account = this.accounts.get(accountId);

    // Clear session token
    this.sessionTokens.delete(accountId);

    // Clear project associations
    for (const [projectId, assocAccountId] of this.projectAssociations) {
      if (assocAccountId === accountId) {
        this.projectAssociations.delete(projectId);
      }
    }

    this.accounts.delete(accountId);

    // Switch active account if needed
    if (this.activeAccount === accountId) {
      this.activeAccount = this.accounts.keys().next().value || null;
    }

    this.emit('account:removed', { accountId, email: account.email });
    console.log(`[SangamFlow] Account removed: ${account.email}`);

    return true;
  }

  // Switch active account
  switchAccount(accountId) {
    if (!this.accounts.has(accountId)) {
      throw new Error(`Account ${accountId} not found`);
    }

    const previousAccount = this.activeAccount;
    this.activeAccount = accountId;

    // Update last used
    const account = this.accounts.get(accountId);
    account.lastUsed = Date.now();

    console.log(`[SangamFlow] Switched active account from ${previousAccount} to ${accountId}`);

    this.emit('account:switched', {
      previousAccount,
      activeAccount: accountId
    });
  }

  // Get active account
  getActiveAccount() {
    return this.accounts.get(this.activeAccount);
  }

  // Get account by ID
  getAccount(accountId) {
    return this.accounts.get(accountId);
  }

  // Get all accounts
  getAllAccounts() {
    return Array.from(this.accounts.values());
  }

  // Update account token
  updateToken(accountId, token, expiresIn = null) {
    if (!this.accounts.has(accountId)) {
      return false;
    }

    this.sessionTokens.set(accountId, {
      token,
      capturedAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null
    });

    const account = this.accounts.get(accountId);
    account.token = token;
    account.isLoggedIn = true;

    this.emit('account:token-updated', { accountId });
    return true;
  }

  // Get account token
  getToken(accountId) {
    const session = this.sessionTokens.get(accountId || this.activeAccount);
    return session?.token || null;
  }

  // Check if token is valid
  isTokenValid(accountId) {
    const session = this.sessionTokens.get(accountId || this.activeAccount);
    if (!session || !session.token) {
      return false;
    }

    if (session.expiresAt && Date.now() > session.expiresAt) {
      return false;
    }

    return true;
  }

  // Associate project with account
  associateProject(projectId, accountId) {
    if (!this.accounts.has(accountId)) {
      throw new Error(`Account ${accountId} not found`);
    }

    this.projectAssociations.set(projectId, accountId);

    // Add to account's project list
    const account = this.accounts.get(accountId);
    if (!account.projects.includes(projectId)) {
      account.projects.push(projectId);
    }

    this.emit('project:associated', { projectId, accountId });
  }

  // Get account for project
  getAccountForProject(projectId) {
    const accountId = this.projectAssociations.get(projectId);
    return accountId ? this.accounts.get(accountId) : this.getActiveAccount();
  }

  // Update account plan
  updatePlan(accountId, plan) {
    const account = this.accounts.get(accountId);
    if (!account) return false;

    account.plan = plan;
    this.emit('account:plan-updated', { accountId, plan });
    return true;
  }

  // Get account statistics
  getAccountStats(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) return null;

    const session = this.sessionTokens.get(accountId);

    return {
      id: account.id,
      email: account.email,
      plan: account.plan,
      isLoggedIn: account.isLoggedIn,
      hasToken: !!session?.token,
      tokenValid: this.isTokenValid(accountId),
      projectCount: account.projects.length,
      lastUsed: account.lastUsed,
      addedAt: account.addedAt
    };
  }

  // Get all accounts summary
  getAllAccountsSummary() {
    return this.getAllAccounts().map(acc => this.getAccountStats(acc.id));
  }

  // Validate account credentials
  async validateAccount(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      return { valid: false, reason: 'Account not found' };
    }

    const session = this.sessionTokens.get(accountId);

    if (!session || !session.token) {
      return { valid: false, reason: 'No token available' };
    }

    if (session.expiresAt && Date.now() > session.expiresAt) {
      return { valid: false, reason: 'Token expired' };
    }

    // Could add actual API validation here
    return { valid: true };
  }

  // Generate account ID from email
  generateAccountId(email) {
    return email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  // Get default settings
  getDefaultSettings() {
    return {
      autoDownload: true,
      defaultModel: 'veo-quality',
      defaultAspectRatio: '16:9',
      defaultDuration: 8,
      notifications: true
    };
  }

  // Export accounts (without tokens)
  exportAccounts() {
    const accounts = this.getAllAccounts().map(acc => ({
      email: acc.email,
      accountName: acc.accountName,
      plan: acc.plan,
      settings: acc.settings
    }));

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      accounts
    };
  }

  // Import accounts
  importAccounts(data) {
    if (!data.accounts || !Array.isArray(data.accounts)) {
      throw new Error('Invalid import data');
    }

    let imported = 0;
    for (const acc of data.accounts) {
      try {
        this.addAccount(acc);
        imported++;
      } catch (err) {
        console.error('[SangamFlow] Failed to import account:', err.message);
      }
    }

    this.emit('accounts:imported', { count: imported });
    return imported;
  }

  // Clean up expired sessions
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [accountId, session] of this.sessionTokens) {
      if (session.expiresAt && now > session.expiresAt) {
        this.sessionTokens.delete(accountId);

        const account = this.accounts.get(accountId);
        if (account) {
          account.isLoggedIn = false;
          account.token = null;
        }

        cleaned++;
        this.emit('session:expired', { accountId });
      }
    }

    if (cleaned > 0) {
      console.log(`[SangamFlow] Cleaned up ${cleaned} expired sessions`);
    }

    return cleaned;
  }

  // Get best account for generation
  getBestAccount(preferences = {}) {
    const {
      preferPro = true,
      requireToken = true,
      preferEmail = null
    } = preferences;

    // If specific email requested
    if (preferEmail) {
      const accountId = this.generateAccountId(preferEmail);
      const account = this.accounts.get(accountId);
      if (account && (!requireToken || this.isTokenValid(accountId))) {
        return account;
      }
    }

    // Score each account
    let bestAccount = null;
    let bestScore = -Infinity;

    for (const [accountId, account] of this.accounts) {
      // Skip accounts without valid token if required
      if (requireToken && !this.isTokenValid(accountId)) {
        continue;
      }

      let score = 0;

      // Prefer active account
      if (accountId === this.activeAccount) score += 100;

      // Prefer PRO accounts
      if (preferPro && account.plan === 'PRO') score += 50;

      // Prefer recently used
      const hoursSinceLastUse = (Date.now() - account.lastUsed) / (1000 * 60 * 60);
      score += Math.max(0, 20 - hoursSinceLastUse);

      // Prefer logged in
      if (account.isLoggedIn) score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestAccount = account;
      }
    }

    return bestAccount;
  }
}
