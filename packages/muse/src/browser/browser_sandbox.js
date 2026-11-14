import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

export class BrowserSandbox {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    // Isolated agent browser profile to prevent cross-contamination with personal logins
    this.userDataDir = options.userDataDir || path.join(this.workspaceRoot, '.mose', 'isolated_agent_profile');
    this.headless = options.headless ?? true;
    this.browserContext = null;
    this.page = null;
  }

  async init() {
    if (this.browserContext && this.page && !this.page.isClosed()) {
      return this.page;
    }

    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    const channels = ['msedge', 'chrome', undefined];
    let lastError = null;

    for (const channel of channels) {
      try {
        const launchOptions = {
          headless: this.headless,
          viewport: { width: 1280, height: 800 },
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
        };
        if (channel) launchOptions.channel = channel;

        this.browserContext = await chromium.launchPersistentContext(this.userDataDir, launchOptions);
        const pages = this.browserContext.pages();
        this.page = pages.length > 0 ? pages[0] : await this.browserContext.newPage();
        
        await this.page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        return this.page;
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(`Failed to initialize Browser Sandbox: ${lastError?.message}`);
  }

  async navigate(url) {
    await this.init();
    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    await this.page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return { success: true, url: this.page.url(), title: await this.page.title() };
  }

  async click(selectorOrText) {
    await this.init();
    try {
      await this.page.click(selectorOrText, { timeout: 4000 });
      return { success: true, message: `Clicked: ${selectorOrText}` };
    } catch {
      await this.page.click(`text="${selectorOrText}"`, { timeout: 5000 });
      return { success: true, message: `Clicked text: ${selectorOrText}` };
    }
  }

  async fill(selector, text) {
    await this.init();
    await this.page.fill(selector, text, { timeout: 8000 });
    return { success: true, message: `Filled '${selector}'` };
  }

  async search(query) {
    await this.init();
    const encoded = encodeURIComponent(query);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;
    await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    const results = await this.page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.result__body').forEach((el, idx) => {
        if (idx >= 6) return;
        const titleEl = el.querySelector('.result__title');
        const snippetEl = el.querySelector('.result__snippet');
        const urlEl = el.querySelector('.result__url');
        if (titleEl) {
          items.push({
            title: titleEl.innerText.trim(),
            snippet: snippetEl?.innerText.trim() || '',
            url: urlEl?.innerText.trim() || ''
          });
        }
      });
      return items;
    });

    return { query, count: results.length, results };
  }

  async extractContent(maxLength = 6000) {
    await this.init();
    const data = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'))
        .slice(0, 15)
        .map(b => b.innerText?.trim())
        .filter(Boolean);

      const rawText = (document.body.innerText || document.body.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();

      return { title: document.title, buttons, text: rawText };
    });

    return {
      title: data.title,
      url: this.page.url(),
      interactive: { buttons: data.buttons },
      text: data.text.slice(0, maxLength)
    };
  }

  async screenshot(filePath = null) {
    await this.init();
    const dest = filePath || path.join(this.userDataDir, `screenshot_${Date.now()}.png`);
    await this.page.screenshot({ path: dest, fullPage: false });
    return { success: true, path: dest };
  }

  async close() {
    if (this.browserContext) {
      await this.browserContext.close();
      this.browserContext = null;
      this.page = null;
    }
  }
}
