const { app, BrowserWindow, Menu, dialog, Notification, ipcMain } = require("electron");
const path = require("path");
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3000;

let mainWindow = null;
let server = null;

const nextApp = next({ dev, dir: path.join(__dirname, "..") });
const handle = nextApp.getRequestHandler();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: "Vigil",
    backgroundColor: "#0f1117",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { role: "quit", label: "退出 Vigil" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", label: "刷新" },
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { role: "resetZoom", label: "重置缩放" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "关于 Vigil",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "关于 Vigil",
              message: "Vigil v0.1.0",
              detail: "网页请求监控与自动化工具\n基于 Puppeteer + Next.js + Electron",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.on("show-notification", (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

app.whenReady().then(async () => {
  createMenu();

  await nextApp.prepare();

  server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(PORT, () => {
    console.log(`Vigil server running on http://localhost:${PORT}`);
    createWindow();
  });
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
  }
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (server) {
    server.close();
  }
});
