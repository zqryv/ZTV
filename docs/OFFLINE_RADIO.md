# ZTV v2.5.0 收音机离线广播与缓存播放

## 一、原问题

v2.4.0 的 35 个内置电台**全部是实时网络流**。「内置电台无需联网即可收听」只是指电台列表写在代码常量里、不用先请求在线目录；真正播放依然必须联网。断网后点任何电台都会失败。

## 二、方案：离线节目单 + 预缓存 + 断网回退

参考 GitHub 上两个公开设计：

| 项目 | 可借鉴点 | 本项目落地方式 |
| --- | --- | --- |
| [RadioResurrector](https://github.com/lucasfrmr/RadioResurrector) | 直播流滚动录制 2 小时缓冲，断网自动切本地缓冲，恢复后回到直播 | 预缓存离线节目；直播加载失败时自动切到任意已缓存节目 |
| [Radiola](https://github.com/SokoloffA/radiola) / hiqradio | 录制网络电台保存供离线收听、电台缓存与录音 | 完整音频文件下载到应用私有目录，之后从 `file://` 播放 |

**为什么不对直播流做实时录制**：`expo-av` 只暴露 `Audio.Sound` 的播放控制，不提供原始音频字节流，在 RN / Expo 层无法可靠地把直播流切片落盘。因此采用「可下载的完整节目 + 缓存播放」这一在跨端环境下可验证、可落地的等价形式。

### 数据流

```
module-packs/radio.json（离线节目单，可独立升级）
        │
        ├─ 联网：cacheProgram(id, url) → expo-file-system / Cache API
        │        → 写入 ztv-offline/<id>.mp3 + AsyncStorage 索引
        │
        └─ 断网：getPlayableUri(id) → file:// 或 blob:
                 → audioPlayer.play(localUri)  ← v2.5.0 已放开 URI 校验
```

- 原生：`services/offlineCache.ts` 使用 `expo-file-system` 的 `createDownloadResumable`，带进度回调、最小体积校验、LRU 配额清理。
- Web / PWA：`services/offlineCache.web.ts` 使用 Cache API 保存音频响应，播放时转成 `blob:` object URL。两者导出同一套接口，页面无需平台判断。
- `services/audioPlayer.ts` 现在接受 `https://`、`file://`、`blob:` 及本地绝对路径，旧的网络流与备用地址逻辑完全保留。

## 三、离线节目单

节目单放在模块资源包里（`modules/defaultPacks.ts` → `module-packs/radio.json`），共 12 条，覆盖中国大陆、中国台湾、美国、日本、欧洲、韩国与音乐 / 古典 / 爵士 / 轻音乐 / 电子 / 文化分类。每条包含：

```json
{
  "id": "offline-cn-1",
  "name": "晨间轻音乐",
  "category": "轻音乐",
  "country": "中国大陆",
  "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "license": "SoundHelix 公开演示音频（公版器乐，允许离线缓存）",
  "source": "SoundHelix 公版器乐",
  "durationSec": 360,
  "estimatedMB": 7,
  "kind": "offline"
}
```

**许可说明**：音频使用 SoundHelix 公开演示音源（纯器乐、公版、可自由使用），节目单逐条标注许可与来源；项目不托管、不转播任何受版权保护的广播内容。新增离线节目时只需更新 `radio.json` 模块包，无需改 App 代码。

## 四、用户操作

- 电台列表末尾直接出现离线节目，卡片显示「待缓存 / 缓存中 N% / 离线可听」；
- 点离线节目：已缓存则立即本地播放；未缓存则联网下载后自动播放，并提示「已缓存，断网也能收听」；
- 筛选面板新增「仅看离线」与「预缓存节目」按钮，并显示 `离线 N/12 · 已用 x.x MB`；
- 预缓存按模块配置的并发数（默认 2）与数量（默认 3）下载，单条失败不影响其它节目；
- 缓存总量超过配额（默认 256 MB）时按 LRU 清理最旧文件；
- 直播电台加载失败时，若存在任意已缓存节目，自动切换播放并提示「网络不可用，已切换到离线节目」。

## 五、配置（可独立热更）

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `cacheQuotaMB` | 256 | 离线缓存总配额 |
| `preloadCount` | 3 | 一键预缓存的节目数 |
| `maxConcurrentDownloads` | 2 | 并发下载数 |
| `autoFallbackToCached` | true | 直播失败自动回退离线节目 |
| `offlinePrograms` | 12 条 | 离线节目单 |

修改这些值或新增节目只需 `node scripts/buildModulePacks.js --only radio` 并推送两个 JSON 文件，客户端在设置页单独更新「收音机」模块即可。

## 六、验证

- `scripts/verifyModules.js`：节目单非空、全部 https、ID 唯一且带 `offline-` 前缀、许可与来源齐全、原生 / Web 双实现、播放器接受 `file://` 与 `blob:`、断网回退与预缓存存在、失焦停止未被破坏 —— 全部 PASS。
- `scripts/verifyAudioSources.js`：18/18（含内置电台实网探测）。
- `npx jest --ci --runInBand --silent`：10 suites / 106 tests 通过，含离线节目单数据校验与播放生命周期回归。

## 七、已知限制

- 离线节目是**点播音频**而非实时广播；断网时听到的是已缓存节目，不是此刻的直播内容。这是 expo-av 能力边界下的取舍。
- 首次缓存必须联网；已缓存内容保存在应用私有目录，卸载 App 会一并清除。
- 部分浏览器在无痕模式下禁用 Cache API，此时 Web 端离线缓存会提示不支持，但在线播放不受影响。
