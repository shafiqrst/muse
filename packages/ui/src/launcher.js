#!/usr/bin/env node

import dotenv from 'dotenv';
import { exec } from 'node:child_process';
import { CompanionServer } from './server.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3500', 10);

async function main() {
  const server = new CompanionServer({
    workspaceRoot: process.cwd(),
    port: PORT
  });

  const startedPort = await server.start();
  const url = `http://localhost:${startedPort}`;

  console.log(`\n======================================================`);
  console.log(`  🌟 Muse Desktop Companion Active at: ${url}`);
  console.log(`  Mode: Native Desktop Sidecar (Meta Muse UI/UX)`);
  console.log(`======================================================\n`);

  // Launch docked to the right edge of the screen (Sidecar popup mode)
  if (process.platform === 'win32') {
    const launchCmd = `powershell -NoProfile -Command "Start-Process msedge -ArgumentList '--app=${url} --window-size=440,940 --window-position=1460,30' -ErrorAction SilentlyContinue; if (!$?) { Start-Process chrome -ArgumentList '--app=${url} --window-size=440,940 --window-position=1460,30' -ErrorAction SilentlyContinue } if (!$?) { Start-Process '${url}' }"`;
    exec(launchCmd);
  } else if (process.platform === 'darwin') {
    exec(`open -na "Google Chrome" --args --app="${url}" --window-size=440,940 || open "${url}"`);
  } else {
    exec(`google-chrome --app="${url}" --window-size=440,940 || xdg-open "${url}"`);
  }

  process.on('SIGINT', async () => {
    console.log('\nShutting down Muse Companion...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Failed to launch Muse Companion:', err);
  process.exit(1);
});
