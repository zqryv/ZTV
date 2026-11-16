// 预加载脚本：桌面端可在此暴露最小化的安全 API。
// 当前 ZTV Web 版无需额外桥接，保留文件以便后续扩展（如本地文件选择）。
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("ztvDesktop", {
  platform: process.platform,
});
