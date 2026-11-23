const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#0B0E13",
    title: "ZTV",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false, // 允许加载第三方 M3U / 视频流
    },
  });

  // 加载 Expo Web 导出的静态站点
  const startUrl =
    process.env.ZTV_WEB_URL ||
    `file://${path.join(__dirname, "web-build", "index.html")}`;
  mainWindow.loadURL(startUrl);

  // 精简菜单，更接近 TV/大屏体验
  Menu.setApplicationMenu(null);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
