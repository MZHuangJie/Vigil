import puppeteer, { Browser, Page } from "puppeteer";

// 使用 globalThis 跨 webpack chunk 共享（App Router 每个路由是独立 entry）
const BROWSER_KEY = "__vigil_browser__";
const PAGES_KEY = "__vigil_active_pages__";

function g(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function getSharedState<T>(key: string, factory: () => T): T {
  const gt = g();
  if (!gt[key]) {
    gt[key] = factory();
  }
  return gt[key] as T;
}

export async function getBrowser(): Promise<Browser> {
  let browser = g()[BROWSER_KEY] as Browser | undefined;
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== "false",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ],
    });
    g()[BROWSER_KEY] = browser;
  }
  return browser;
}

export async function createPage(taskId: string): Promise<Page> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  const viewportWidth = parseInt(process.env.BROWSER_VIEWPORT_WIDTH || "1920", 10);
  const viewportHeight = parseInt(process.env.BROWSER_VIEWPORT_HEIGHT || "1080", 10);
  await page.setViewport({ width: viewportWidth, height: viewportHeight });

  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);

  const activePages = getSharedState<Map<string, Page>>(PAGES_KEY, () => new Map());
  activePages.set(taskId, page);
  return page;
}

export function getPage(taskId: string): Page | undefined {
  const activePages = g()[PAGES_KEY] as Map<string, Page> | undefined;
  return activePages?.get(taskId);
}

export async function closePage(taskId: string): Promise<void> {
  const activePages = g()[PAGES_KEY] as Map<string, Page> | undefined;
  if (!activePages) return;
  const page = activePages.get(taskId);
  if (page) {
    try {
      await page.close();
    } catch {
      // page may already be closed
    }
    activePages.delete(taskId);
  }
}

export async function closeBrowser(): Promise<void> {
  const activePages = g()[PAGES_KEY] as Map<string, Page> | undefined;
  if (activePages) {
    for (const taskId of Array.from(activePages.keys())) {
      await closePage(taskId);
    }
  }
  const browser = g()[BROWSER_KEY] as Browser | undefined;
  if (browser) {
    try {
      await browser.close();
    } catch {
      // browser may already be closed
    }
    g()[BROWSER_KEY] = null;
  }
}

export function getActiveTaskIds(): string[] {
  const activePages = g()[PAGES_KEY] as Map<string, Page> | undefined;
  return activePages ? Array.from(activePages.keys()) : [];
}
