import puppeteer, { Browser, Page } from "puppeteer";

let browserInstance: Browser | null = null;
const activePages = new Map<string, Page>();

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== "false",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ],
    });
  }
  return browserInstance;
}

export async function createPage(taskId: string): Promise<Page> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  const viewportWidth = parseInt(process.env.BROWSER_VIEWPORT_WIDTH || "1920", 10);
  const viewportHeight = parseInt(process.env.BROWSER_VIEWPORT_HEIGHT || "1080", 10);
  await page.setViewport({ width: viewportWidth, height: viewportHeight });

  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);

  activePages.set(taskId, page);
  return page;
}

export function getPage(taskId: string): Page | undefined {
  return activePages.get(taskId);
}

export async function closePage(taskId: string): Promise<void> {
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
  const taskIds = Array.from(activePages.keys());
  for (const taskId of taskIds) {
    await closePage(taskId);
  }
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch {
      // browser may already be closed
    }
    browserInstance = null;
  }
}

export function getActiveTaskIds(): string[] {
  return Array.from(activePages.keys());
}
