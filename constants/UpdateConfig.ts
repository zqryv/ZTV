/**
 * ZTV 自动更新配置。
 * 部署到 GitHub 后，只需把 GITHUB_OWNER / GITHUB_REPO 改成你的仓库，
 * 应用即可从该仓库读取 package.json 的版本号并下载 Release 里对应平台的安装包。
 */
const GITHUB_OWNER = "zqryv";
const GITHUB_REPO = "ZTV";
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_RELEASE_BASE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download`;

export const UPDATE_CONFIG = {
  // 自动检查更新
  AUTO_CHECK: true,

  // 检查更新间隔（毫秒）
  CHECK_INTERVAL: 12 * 60 * 60 * 1000, // 12小时

  // GitHub相关URL：从你自己的仓库读取版本信息（带时间戳绕开缓存）
  GITHUB_RAW_URL: `${GITHUB_RAW_BASE}/refs/heads/main/package.json?t=${Date.now()}`,

  // 获取平台特定的下载URL
  // Release 资源命名规范：ZTV-v{version}-android-tv.apk 等
  getDownloadUrl(version: string): string {
    return `${GITHUB_RELEASE_BASE}/v${version}/ZTV-v${version}-android-tv.apk`;
  },

  // 是否显示更新日志
  SHOW_RELEASE_NOTES: true,

  // 是否允许跳过版本
  ALLOW_SKIP_VERSION: true,

  // 下载超时时间（毫秒）
  DOWNLOAD_TIMEOUT: 10 * 60 * 1000, // 10分钟

  // 是否在WIFI下自动下载
  AUTO_DOWNLOAD_ON_WIFI: false,

  // 更新通知设置
  NOTIFICATION: {
    ENABLED: true,
    TITLE: "ZTV 更新",
    DOWNLOADING_TEXT: "正在下载新版本...",
    DOWNLOAD_COMPLETE_TEXT: "下载完成，点击安装",
  },
};
