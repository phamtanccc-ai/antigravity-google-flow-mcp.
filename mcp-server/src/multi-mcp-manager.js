// SangamFlow Multi-MCP Server Manager
// Manages multiple MCP server connections with health monitoring and load balancing

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MultiMCPManager extends EventEmitter {
  constructor(configPath = null) {
    super();

    this.configPath = configPath || join(__dirname, '../config/mcp-servers.json');
    this.servers = new Map();
    this.activeServer = null;
    this.healthCheckInterval = null;
    this.config = null;

    this.loadConfig();
    this.startHealthCheck();
  }

  // Load MCP server configurations
  loadConfig() {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(data);
        console.log('[SangamFlow] Loaded MCP server configurations');
      } else {
        this.config = this.getDefaultConfig();
        this.saveConfig();
        console.log('[SangamFlow] Created default MCP server configuration');
      }
    } catch (err) {
      console.error('[SangamFlow] Error loading MCP config:', err.message);
      this.config = this.getDefaultConfig();
    }
  }

  // Get default configuration
  getDefaultConfig() {
    return {
      version: '1.0.0',
      defaultServer: 'sangamflow-local',
      servers: {
        'sangamflow-local': {
          id: 'sangamflow-local',
          name: 'SangamFlow Local',
          description: 'Local SangamFlow MCP Server',
          command: 'node',
          args: [join(__dirname, '../bin/sangamflow-mcp.mjs')],
          enabled: true,
          priority: 1,
          status: 'stopped',
          capabilities: {
            videoGeneration: true,
            imageGeneration: true,
            characterManagement: true,
            storyboardAnalysis: true,
            multiAccount: true
          }
        }
      },
      healthCheck: {
        interval: 30000,
        timeout: 5000,
        unhealthyThreshold: 3
      }
    };
  }

  // Save configuration
  saveConfig() {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SangamFlow] Error saving MCP config:', err.message);
    }
  }

  // Initialize all enabled servers
  async initialize() {
    console.log('[SangamFlow] Initializing MCP servers...');

    for (const [serverId, serverConfig] of Object.entries(this.config.servers)) {
      if (serverConfig.enabled) {
        await this.startServer(serverId);
      }
    }

    // Set active server
    if (this.config.defaultServer && this.servers.has(this.config.defaultServer)) {
      this.activeServer = this.config.defaultServer;
    } else if (this.servers.size > 0) {
      this.activeServer = this.servers.keys().next().value;
    }

    this.emit('initialized', {
      servers: Array.from(this.servers.keys()),
      activeServer: this.activeServer
    });
  }

  // Start a specific MCP server
  async startServer(serverId) {
    const serverConfig = this.config.servers[serverId];
    if (!serverConfig) {
      throw new Error(`Server ${serverId} not found in configuration`);
    }

    if (this.servers.has(serverId)) {
      console.log(`[SangamFlow] Server ${serverId} is already running`);
      return;
    }

    try {
      console.log(`[SangamFlow] Starting MCP server: ${serverId}`);

      const serverProcess = spawn(serverConfig.command, serverConfig.args, {
        env: { ...process.env, ...serverConfig.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const serverInstance = {
        id: serverId,
        process: serverProcess,
        config: serverConfig,
        status: 'starting',
        healthy: false,
        lastHealthCheck: null,
        failureCount: 0,
        startTime: Date.now()
      };

      // Handle process events
      serverProcess.stdout.on('data', (data) => {
        this.emit('server:stdout', { serverId, data: data.toString() });
      });

      serverProcess.stderr.on('data', (data) => {
        this.emit('server:stderr', { serverId, data: data.toString() });
      });

      serverProcess.on('error', (err) => {
        console.error(`[SangamFlow] Server ${serverId} error:`, err.message);
        serverInstance.status = 'error';
        serverInstance.healthy = false;
        this.emit('server:error', { serverId, error: err });
      });

      serverProcess.on('exit', (code, signal) => {
        console.log(`[SangamFlow] Server ${serverId} exited with code ${code}`);
        serverInstance.status = 'stopped';
        serverInstance.healthy = false;
        this.servers.delete(serverId);
        this.emit('server:stopped', { serverId, code, signal });
      });

      this.servers.set(serverId, serverInstance);

      // Wait for server to be ready
      await this.waitForServerReady(serverId);

      serverInstance.status = 'running';
      serverInstance.healthy = true;

      this.emit('server:started', { serverId, config: serverConfig });

    } catch (err) {
      console.error(`[SangamFlow] Failed to start server ${serverId}:`, err.message);
      throw err;
    }
  }

  // Wait for server to be ready
  async waitForServerReady(serverId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const server = this.servers.get(serverId);
      if (!server) {
        reject(new Error(`Server ${serverId} not found`));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Server ${serverId} did not start within ${timeout}ms`));
      }, timeout);

      // Simple readiness check - could be enhanced with actual health check
      setTimeout(() => {
        clearTimeout(timer);
        if (server.process && server.process.pid) {
          resolve();
        } else {
          reject(new Error(`Server ${serverId} process not running`));
        }
      }, 1000);
    });
  }

  // Stop a specific MCP server
  async stopServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      console.log(`[SangamFlow] Server ${serverId} is not running`);
      return;
    }

    console.log(`[SangamFlow] Stopping MCP server: ${serverId}`);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (server.process) {
          server.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      server.process.on('exit', () => {
        clearTimeout(timer);
        this.servers.delete(serverId);
        this.emit('server:stopped', { serverId });
        resolve();
      });

      if (server.process) {
        server.process.kill('SIGTERM');
      }
    });
  }

  // Stop all servers
  async stopAll() {
    console.log('[SangamFlow] Stopping all MCP servers...');

    const stopPromises = [];
    for (const serverId of this.servers.keys()) {
      stopPromises.push(this.stopServer(serverId));
    }

    await Promise.all(stopPromises);

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  // Switch active server
  switchServer(serverId) {
    if (!this.servers.has(serverId)) {
      throw new Error(`Server ${serverId} is not running`);
    }

    const previousServer = this.activeServer;
    this.activeServer = serverId;

    console.log(`[SangamFlow] Switched active server from ${previousServer} to ${serverId}`);

    this.emit('server:switched', {
      previousServer,
      activeServer: serverId
    });
  }

  // Get active server
  getActiveServer() {
    return this.servers.get(this.activeServer);
  }

  // Get all server statuses
  getServerStatuses() {
    const statuses = {};

    for (const [serverId, server] of this.servers) {
      statuses[serverId] = {
        id: serverId,
        name: server.config.name,
        status: server.status,
        healthy: server.healthy,
        uptime: Date.now() - server.startTime,
        lastHealthCheck: server.lastHealthCheck
      };
    }

    return statuses;
  }

  // Add new server configuration
  addServer(serverConfig) {
    if (!serverConfig.id) {
      throw new Error('Server configuration must have an id');
    }

    this.config.servers[serverConfig.id] = {
      ...serverConfig,
      status: 'stopped',
      enabled: serverConfig.enabled !== false
    };

    this.saveConfig();
    this.emit('server:added', { serverId: serverConfig.id });
  }

  // Remove server configuration
  removeServer(serverId) {
    if (this.servers.has(serverId)) {
      throw new Error(`Server ${serverId} is running. Stop it first.`);
    }

    delete this.config.servers[serverId];
    this.saveConfig();
    this.emit('server:removed', { serverId });
  }

  // Start health check monitoring
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheck.interval);
  }

  // Perform health check on all servers
  async performHealthCheck() {
    for (const [serverId, server] of this.servers) {
      try {
        // Simple health check - could be enhanced with actual ping
        const isHealthy = server.process && server.process.pid &&
                         server.status === 'running';

        server.lastHealthCheck = Date.now();

        if (isHealthy !== server.healthy) {
          server.healthy = isHealthy;
          this.emit('server:health-changed', {
            serverId,
            healthy: isHealthy
          });
        }

        if (!isHealthy) {
          server.failureCount++;

          if (server.failureCount >= this.config.healthCheck.unhealthyThreshold) {
            console.warn(`[SangamFlow] Server ${serverId} is unhealthy, attempting restart...`);
            await this.restartServer(serverId);
          }
        } else {
          server.failureCount = 0;
        }

      } catch (err) {
        console.error(`[SangamFlow] Health check failed for ${serverId}:`, err.message);
      }
    }
  }

  // Restart a server
  async restartServer(serverId) {
    console.log(`[SangamFlow] Restarting server ${serverId}...`);

    try {
      await this.stopServer(serverId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.startServer(serverId);

      this.emit('server:restarted', { serverId });
    } catch (err) {
      console.error(`[SangamFlow] Failed to restart server ${serverId}:`, err.message);
      this.emit('server:restart-failed', { serverId, error: err });
    }
  }
}
