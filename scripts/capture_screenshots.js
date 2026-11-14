import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';
import { CompanionServer } from '../packages/ui/src/server.js';

async function capture() {
  const screenshotsDir = path.join(process.cwd(), 'docs', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const server = new CompanionServer({
    workspaceRoot: process.cwd(),
    port: 3689
  });

  const port = await server.start();
  const url = `http://localhost:${port}`;
  console.log(`Server started at ${url}`);

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1024x768', width: 1024, height: 768 }
  ];

  for (const vp of viewports) {
    console.log(`Capturing ${vp.name}...`);
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height }
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    // Allow subtle avatar and UI render
    await page.waitForTimeout(1000);

    const outPath = path.join(screenshotsDir, `muse_workspace_${vp.name}.png`);
    await page.screenshot({ path: outPath });
    console.log(`Saved screenshot: ${outPath}`);
    await page.close();
  }

  // Also capture active work surface state
  console.log('Capturing Active Work Surface state at 1920x1080...');
  const activePage = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });
  await activePage.goto(url, { waitUntil: 'networkidle' });
  await activePage.waitForTimeout(500);

  // Trigger active work surface via chat input
  await activePage.fill('#user-input', 'Compare MacBook Pro M4 and Dell XPS 15 specs and prices');
  await activePage.click('#send-btn');
  await activePage.waitForTimeout(1200);

  const activeOutPath = path.join(screenshotsDir, `muse_active_work_1920x1080.png`);
  await activePage.screenshot({ path: activeOutPath });
  console.log(`Saved active work screenshot: ${activeOutPath}`);
  await activePage.close();

  await browser.close();
  await server.stop();
  console.log('All screenshots captured successfully.');
}

capture().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
