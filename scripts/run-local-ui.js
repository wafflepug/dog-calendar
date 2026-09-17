'use strict';

const { spawn: defaultSpawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;
const ROOT = path.resolve(__dirname, '..');

function pythonCommand() {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function probe() {
  return new Promise(resolve => {
    const request = http.get(`${BASE_URL}/index.html`, response => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 400);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function portIsFree() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', error => {
      if (error.code === 'EADDRINUSE') return resolve(false);
      reject(error);
    });
    server.listen(PORT, HOST, () => server.close(() => resolve(true)));
  });
}

function installSignals(handlers) {
  const entries = Object.entries(handlers);
  entries.forEach(([signal, handler]) => process.once(signal, handler));
  return () => entries.forEach(([signal, handler]) => process.removeListener(signal, handler));
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  try { child.kill('SIGTERM'); } catch (_) {}
  setTimeout(() => {
    if (child.exitCode === null) {
      try { child.kill('SIGKILL'); } catch (_) {}
    }
  }, 1_000).unref();
}

async function waitForServer(child, { probeImpl, sleepImpl, isAborted }) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (isAborted()) return false;
    if (child.error) throw child.error;
    if (child.exited) throw new Error(`Local HTTP server exited with code ${child.exitCode ?? 'unknown'}.`);
    const ready = await probeImpl();
    if (isAborted()) return false;
    if (child.error) throw child.error;
    if (child.exited) throw new Error(`Local HTTP server exited with code ${child.exitCode ?? 'unknown'}.`);
    if (ready) return true;
    await sleepImpl(100);
  }
  if (isAborted()) return false;
  throw new Error(`Local HTTP server did not become ready at ${BASE_URL}.`);
}

async function runLocalUi(options = {}) {
  const spawnImpl = options.spawnImpl || defaultSpawn;
  const probeImpl = options.probeImpl || probe;
  const portFreeImpl = options.portFreeImpl || portIsFree;
  const sleepImpl = options.sleepImpl || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const resolveCli = options.resolveCli || (() => require.resolve('@playwright/test/cli'));
  const register = options.registerSignals || installSignals;
  const cliArgs = options.args || process.argv.slice(2);
  const config = options.config || process.env.WAFFLE_PLAYWRIGHT_CONFIG || 'playwright.ui.config.js';
  const cli = resolveCli();

  if (!(await portFreeImpl())) {
    throw new Error(`Port ${PORT} is already in use; refusing to run against an unrelated server.`);
  }

  let server = null;
  let testProcess = null;
  let abortCode = null;
  let cleaned = false;
  let cleanup;
  cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (testProcess) stopChild(testProcess);
    stopChild(server);
  };
  const signalCleanup = register({
    SIGINT: () => { abortCode = 130; cleanup(); },
    SIGTERM: () => { abortCode = 143; cleanup(); }
  });

  try {
    server = spawnImpl(pythonCommand(), ['-m', 'http.server', String(PORT), '--bind', HOST], {
      cwd: ROOT,
      stdio: ['ignore', 'inherit', 'inherit']
    });
    server.on?.('error', error => { server.error = error; });
    server.on?.('exit', code => { server.exited = true; server.exitCode = code; });

    const ready = await waitForServer(server, {
      probeImpl,
      sleepImpl,
      isAborted: () => abortCode !== null
    });
    if (!ready || abortCode !== null) return abortCode || 1;

    testProcess = spawnImpl(process.execPath, [cli, 'test', `--config=${config}`, ...cliArgs], {
      cwd: ROOT,
      env: { ...process.env, WAFFLE_BASE_URL: BASE_URL },
      stdio: 'inherit'
    });
    const result = await new Promise((resolve, reject) => {
      testProcess.once('error', reject);
      testProcess.once('exit', (code, signal) => resolve({ code, signal }));
    });
    if (abortCode !== null) return abortCode;
    return result.signal ? 1 : (result.code ?? 1);
  } finally {
    cleanup();
    signalCleanup?.();
  }
}

if (require.main === module) {
  runLocalUi().then(code => { process.exitCode = code; }).catch(error => {
    console.error(`Local UI runner failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { BASE_URL, HOST, PORT, runLocalUi };
