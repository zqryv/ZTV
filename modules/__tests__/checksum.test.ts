import {
  checksumText,
  compareModuleVersions,
  supportsAppVersion,
} from "@/modules/checksum";

describe("模块资源包完整性校验", () => {
  it("中文内容按 UTF-8 字节计算且稳定可复现", () => {
    expect(checksumText('{"id":"search","title":"搜索"}')).toMatch(/^[0-9a-f]{16}$/);
    expect(checksumText('{"id":"search","title":"搜索"}'))
      .toBe(checksumText('{"id":"search","title":"搜索"}'));
    expect(checksumText("搜索")).not.toBe(checksumText("收音机"));
  });

  it("版本号比较支持 v 前缀与不等长", () => {
    expect(compareModuleVersions("v2.5.1", "2.5.0")).toBe(1);
    expect(compareModuleVersions("2.4.9", "2.5.0")).toBe(-1);
    expect(compareModuleVersions("2.5", "2.5.0")).toBe(0);
  });

  it("低版本 App 不加载要求更高版本的模块包", () => {
    expect(supportsAppVersion("2.5.0", "2.5.0")).toBe(true);
    expect(supportsAppVersion("2.6.0", "2.5.0")).toBe(true);
    expect(supportsAppVersion("2.4.0", "2.5.0")).toBe(false);
  });
});
