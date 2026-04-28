import type { StatAction, TaskConfig } from "./types";
import { addEvent } from "./db";
import { emitSSE } from "./scheduler";

export async function sendNotification(
  action: StatAction,
  message: string,
  config: TaskConfig
): Promise<void> {
  const logMsg = `[${action.type}] ${message}`;
  addEvent(config.id, "alert", { action: action.type, message });
  emitSSE({ type: "alert", taskId: config.id, data: { action: action.type, message } });

  switch (action.type) {
    case "log":
      addEvent(config.id, "log", { message: logMsg });
      emitSSE({ type: "log", taskId: config.id, data: { message: logMsg } });
      break;

    case "toast":
      emitSSE({ type: "alert", taskId: config.id, data: { message, level: "toast" } });
      break;

    case "webhook":
      if (action.config.webhookUrl) {
        await sendWebhook(action.config.webhookUrl, message);
      }
      break;

    case "dingtalk":
      if (action.config.webhookUrl) {
        await sendDingtalk(action.config.webhookUrl, message, config.name);
      }
      break;

    case "wework":
      if (action.config.webhookUrl) {
        await sendWework(action.config.webhookUrl, message);
      }
      break;

    case "wework_user":
      if (action.config.corpId && action.config.corpSecret && action.config.agentId && action.config.toUser) {
        await sendWeworkUser(action.config as WeworkUserConfig, message);
      }
      break;
  }
}

async function sendWebhook(url: string, message: string): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, timestamp: new Date().toISOString() }),
    });
  } catch (error) {
    console.error("Webhook send failed:", error);
  }
}

async function sendDingtalk(url: string, message: string, title: string): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content: `[${title}] ${message}` },
      }),
    });
  } catch (error) {
    console.error("Dingtalk send failed:", error);
  }
}

async function sendWework(url: string, message: string): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content: message },
      }),
    });
  } catch (error) {
    console.error("Wework send failed:", error);
  }
}

interface WeworkUserConfig {
  corpId: string;
  agentId: string;
  corpSecret: string;
  toUser: string;
}

async function sendWeworkUser(config: WeworkUserConfig, message: string): Promise<void> {
  try {
    const tokenRes = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${config.corpId}&corpsecret=${config.corpSecret}`
    );
    const tokenData = await tokenRes.json() as { access_token?: string; errcode?: number };
    if (!tokenData.access_token) {
      console.error("Wework gettoken failed:", tokenData);
      return;
    }

    await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touser: config.toUser,
          msgtype: "text",
          agentid: parseInt(config.agentId, 10),
          text: { content: message },
        }),
      }
    );
  } catch (error) {
    console.error("Wework user send failed:", error);
  }
}
