# ZTV v2.5.0 模块化架构与独立升级说明

## 一、要解决的问题

v2.4.0 及以前，搜索 / 音乐在线 / 收音机的界面、逻辑、音源常量散落在 `app/`、`components/`、`constants/`、`services/` 四处。改一个模块往往要动多个目录，任何小改动都必须重新构建并下载安装整个 App（几十 MB ~ 165 MB）。

v2.5.0 的目标：**模块可独立升级，后续更新单个模块无需重新下载安装整个 App，也无需大范围修改代码。**

## 二、目录结构

```
ZTV/
├── app/                          # Expo Router 路由薄壳（每个文件只有 3 行）
│   ├── search.tsx  → modules/search/SearchScreen
│   ├── music.tsx   → modules/music/MusicScreen
│   └── radio.tsx   → modules/radio/RadioScreen
├── modules/                      # 模块层：每个目录自包含
│   ├── contracts.ts              # 模块契约（ModuleId / Manifest / Pack / State）
│   ├── checksum.ts               # FNV-1a 64 完整性校验 + 版本比较
│   ├── defaultPacks.ts           # 随 App 发布的内置默认配置（发布源）
│   ├── ModuleRegistry.ts         # id → 元数据 / 入口 / 版本
│   ├── ModuleManager.ts          # 独立检查、下载、校验、缓存、回滚
│   ├── search/
│   │   └── SearchScreen.tsx      # 搜索 UI + 中文键盘接入 + 模块配置读取
│   ├── music/
│   │   ├── MusicScreen.tsx       # 音乐在线 UI
│   │   ├── musicCore.ts          # 检索主链路（缓存 / 雷达 / 熔断 / 降级入口）
│   │   ├── musicCache.ts         # 有效结果缓存 + 关键词记忆
│   │   └── musicDiscovery.ts     # 榜单雷达去重注入 + 请求熔断
│   └── radio/
│       ├── RadioScreen.tsx       # 收音机 UI + 离线筛选 / 预缓存 / 断网回退
│       └── offlineCatalog.ts     # 离线节目单与类型映射
├── components/                   # 跨模块共享 UI 基础设施
│   ├── SearchInput.tsx           # 统一可聚焦输入框
│   └── SearchKeyboard.tsx        # 中文拼音候选键盘
├── utils/pinyinIme.ts            # 中文拼音输入引擎（纯计算、零依赖）
├── services/
│   ├── updateChannels.ts         # 国内 / 海外双通道选址
│   ├── updateService.ts          # 整包更新 + 模块更新统一入口
│   └── offlineCache.ts(.web.ts)  # 离线音频缓存（原生 / Web 双实现）
├── module-packs/                 # 可远程下发的模块资源包（JSON，每个几 KB）
│   ├── search.json / music.json / radio.json
├── module-registry.json          # 远程模块清单（版本 / 校验和 / 体积 / 变更记录）
└── scripts/buildModulePacks.js   # 生成资源包与清单，支持 --only 单模块重建
```

## 三、模块契约

| 字段 | 含义 |
| --- | --- |
| `id` | `search` / `music` / `radio`，更新时的唯一键 |
| `version` | 模块自身版本号，与 App 版本解耦 |
| `minAppVersion` | 最低 App 版本，低版本客户端不加载新模块包 |
| `entry` | UI 入口（模块目录内），供注册表定位 |
| `pack` | 资源包路径 `module-packs/<id>.json` |
| `checksum` / `size` | FNV-1a 64 校验和与字符数，拦截代理错误页 / 截断 |
| `changelog` | 该模块本次变更，设置页展示 |

资源包内容全部是**配置与数据**：键盘布局与候选上限、曲库缓存 TTL / 雷达参数 / 熔断阈值、离线节目单与缓存配额。业务功能改配置即可生效，不必改 App 二进制。

## 四、独立升级流程

1. 修改 `modules/defaultPacks.ts` 中**目标模块**的 `config` 与 `BUNDLED_MODULE_META` 版本号；
2. 只重建该模块的资源包：`node scripts/buildModulePacks.js --only music`；
   - 其它两个包的 checksum 与内容保持不变，客户端不会误下载；
3. 把 `module-packs/music.json` 与 `module-registry.json` 推送到 `main`；
4. 客户端在「设置 → 模块独立更新」点「检查模块更新」，会看到仅音乐在线有新版本；
5. 点「更新」：并发竞速下载几 KB 的 JSON → 校验 checksum / 体积 → 写入本地缓存 → 该模块下次进入生效；
6. 出问题点「回滚」：删除缓存包，立即回到随 App 发布的内置版本。

**下载体积对比**：整包更新 67 MB（Android APK）~ 165 MB（macOS dmg）；单模块更新 0.5 ~ 6 KB。

设置页还提供「更新通道」切换：自动 / 国内优先 / 海外优先。

## 五、运行时读取配置

```ts
const config = await moduleManager.getConfig<MusicModuleConfig>("music");
```

三级降级：内存 → AsyncStorage 缓存包 → 内置默认包。缓存损坏、版本不兼容、网络全断都不会导致模块白屏。

## 六、边界与限制（如实说明）

- **原生 UI 代码仍随 App 发布**。Expo / React Native 不执行远程 JS，因此「新增一个全新界面」或「修改 UI 结构」仍需发版；本项目没有引入 CodePush / EAS Update 之类的代码级 OTA。
- 本架构覆盖绝大多数日常升级场景：**音源清单、离线节目单、缓存策略、键盘布局与词库、检索参数、雷达与熔断阈值**等，均通过模块包热更，且改动被限制在单个模块目录内。
- 若后续接入 `expo-updates` / EAS Update，可在现有 `ModuleManager` 基础上扩展「代码包」类型，无需改动路由与页面。
- 校验和为 FNV-1a 64，用于完整性检测，不是密码学签名；清单本身通过 HTTPS 与可信 CDN 分发。

## 七、验证结果

| 项目 | 结果 |
| --- | --- |
| `node scripts/verifyModules.js` | **53/53**（清单 / 校验和 / 单模块重建 / 契约 / 焦点 / 双通道） |
| `node scripts/verifyRefactor.js` | **54/54** |
| `node scripts/verifyLargeScreenMatrix.js` | **248/248** |
| `npx tsc --noEmit` | 0 错误 |
| `npx jest --ci --runInBand --silent` | 10 suites / 106 tests / 1 snapshot 全通过 |

## 八、第三方参考与许可

- 在线音乐核心逻辑参考 [akudamatata/Solara](https://github.com/akudamatata/Solara) 2.0 的公开设计说明（智能缓存、榜单雷达、无感记忆、请求熔断）。Solara 采用 **CC BY-NC-SA**（禁止商用、衍生需同协议开源）；本项目**未复制其任何代码**，仅借鉴思路并用 TypeScript / React Native 独立实现，在此保留出处与致谢。
- 离线广播缓存参考 RadioResurrector（滚动缓冲 + 断网切换）、Radiola / hiqradio（录音保存离线收听）的公开设计；实现为独立编写。
- 离线节目音频使用 SoundHelix 公开演示音频（公版器乐，允许离线缓存），节目单内逐条标注 `license` 与 `source`。
