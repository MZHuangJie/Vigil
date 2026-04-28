import type { Page } from "puppeteer";
import type { TaskConfig } from "./types";
import { addEvent } from "./db";
import { emitSSE } from "./scheduler";

export async function performLogin(page: Page, config: TaskConfig): Promise<boolean> {
  if (!config.login.enabled || !config.login.loginUrl) {
    return true;
  }

  try {
    addEvent(config.id, "log", { message: `开始登录: ${config.login.loginUrl}` });
    emitSSE({ type: "log", taskId: config.id, data: { message: `开始登录: ${config.login.loginUrl}` } });

    await page.goto(config.login.loginUrl, { waitUntil: "networkidle2" });

    // 检查登录表单是否存在（可能因上次 Cookie 已登录而跳过了登录页）
    const formExists = await page.$(config.login.usernameSelector).catch(() => null);
    if (formExists) {
      await page.type(config.login.usernameSelector, config.login.username);

      await page.waitForSelector(config.login.passwordSelector, { timeout: 5000 });
      await page.type(config.login.passwordSelector, config.login.password);

      await page.waitForSelector(config.login.submitSelector, { timeout: 5000 });
      await Promise.all([
        page.click(config.login.submitSelector),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
      ]);
    } else {
      addEvent(config.id, "log", { message: "已登录（Cookie 有效），跳过表单填写" });
      emitSSE({ type: "log", taskId: config.id, data: { message: "已登录（Cookie 有效），跳过表单填写" } });
    }

    if (config.login.successIndicator) {
      try {
        await page.waitForFunction(
          (indicator: string) => {
            const el = document.querySelector(indicator);
            if (el) return true;
            return document.body?.innerText?.includes(indicator) ?? false;
          },
          { timeout: 15000 },
          config.login.successIndicator
        );
      } catch {
        addEvent(config.id, "log", { message: "登录成功验证未找到指示器，继续执行" });
      }
    }

    addEvent(config.id, "log", { message: "登录成功" });
    emitSSE({ type: "log", taskId: config.id, data: { message: "登录成功" } });
    return true;
  } catch (error) {
    const msg = `登录失败: ${error instanceof Error ? error.message : String(error)}`;
    addEvent(config.id, "log", { message: msg });
    emitSSE({ type: "log", taskId: config.id, data: { message: msg } });
    return false;
  }
}
