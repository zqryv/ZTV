/**
 * 模块资源包完整性校验（零依赖，跨端一致）。
 *
 * 用途：识别代理返回的 HTML 错误页 / 传输截断。采用 FNV-1a 64 位（BigInt）
 * 实现，脚本与运行时共用同一份算法，保证本地生成与客户端校验结果一致。
 * 注意：这是完整性校验，不是密码学签名；模块清单本身通过 HTTPS 分发。
 */
const MASK_64 = (1n << 64n) - 1n;
const PRIME_64 = 1099511628211n;
const OFFSET_64 = 14695981039346656037n;

/** FNV-1a 64-bit，返回 16 位小写十六进制 */
export const fnv1a64 = (input: string): string => {
  let hash = OFFSET_64;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i) & 0xff);
    hash = (hash * PRIME_64) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
};

/**
 * 纯 JS UTF-8 编码：不依赖 TextEncoder / Buffer，React Native、Web、Node 结果一致。
 * 模块包含大量中文，必须按字节而非 charCode 计算。
 */
const utf8Bytes = (text: string): number[] => {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      const cp = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
      i += 1;
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
};

/** 用 UTF-8 字节计算，避免中文内容在不同环境下不一致 */
export const checksumText = (text: string): string => {
  let hash = OFFSET_64;
  for (const byte of utf8Bytes(text)) {
    hash ^= BigInt(byte);
    hash = (hash * PRIME_64) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
};

/**
 * 统一换行后再校验：国内加速代理 / CDN 可能把 LF 改写为 CRLF，
 * 而清单中的 checksum 是按仓库里的 LF 文本生成的。
 */
export const normalizePackText = (text: string): string => text.replace(/\r\n?/g, "\n");

/** semver 比较：a > b 返回 1，a < b 返回 -1，相等返回 0 */
export const compareModuleVersions = (a: string, b: string): number => {
  const pa = a.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff > 0) return 1;
    if (diff < 0) return -1;
  }
  return 0;
};

/** app 版本是否满足模块的最低要求 */
export const supportsAppVersion = (appVersion: string, minAppVersion: string): boolean =>
  compareModuleVersions(appVersion, minAppVersion) >= 0;
