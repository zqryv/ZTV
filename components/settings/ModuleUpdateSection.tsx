/**
 * 模块级独立更新设置区（v2.5.0）。
 *
 * 搜索 / 音乐在线 / 收音机各自显示版本与来源，可单独检查、更新、回滚；
 * 更新只下载几 KB 的模块资源包，不需要重新下载安装整个 App。
 * 同时提供国内 / 海外更新通道切换，供网络环境特殊时手动指定。
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import updateService from "@/services/updateService";
import { MODULE_TITLES } from "@/modules/ModuleRegistry";
import { MODULE_IDS, ModuleId, ModuleState, ModuleUpdateInfo } from "@/modules/contracts";
import { UpdateRegion } from "@/services/updateChannels";

const REGIONS: Array<{ id: UpdateRegion; label: string }> = [
  { id: "auto", label: "自动" },
  { id: "domestic", label: "国内优先" },
  { id: "overseas", label: "海外优先" },
];

export function ModuleUpdateSection() {
  const [states, setStates] = useState<ModuleState[]>([]);
  const [updates, setUpdates] = useState<ModuleUpdateInfo[]>([]);
  const [region, setRegionState] = useState<UpdateRegion>("auto");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("模块可单独升级，无需重装 App");

  const refresh = useCallback(async () => {
    setStates(await updateService.getModuleStates());
  }, []);

  useEffect(() => {
    void refresh();
    void updateService.getUpdateRegion().then(setRegionState);
  }, [refresh]);

  const check = useCallback(async () => {
    setBusy(true);
    try {
      const found = await updateService.checkModuleUpdates();
      setUpdates(found);
      setMessage(found.length ? `发现 ${found.length} 个模块更新` : "所有模块已是最新版本");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "检查失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const apply = useCallback(async (id: ModuleId) => {
    setBusy(true);
    try {
      const result = await updateService.updateModule(id);
      setMessage(result.ok
        ? `${MODULE_TITLES[id]} 已更新到 v${result.version}，重新进入该模块生效`
        : `${MODULE_TITLES[id]} 更新失败：${result.error ?? "未知错误"}`);
      setUpdates((prev) => prev.filter((item) => item.id !== id));
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const rollback = useCallback(async (id: ModuleId) => {
    setBusy(true);
    try {
      await updateService.rollbackModule(id);
      setMessage(`${MODULE_TITLES[id]} 已回滚到内置版本`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const changeRegion = useCallback(async (next: UpdateRegion) => {
    setRegionState(next);
    await updateService.setUpdateRegion(next);
    setMessage(`更新通道：${REGIONS.find((r) => r.id === next)?.label ?? next}`);
  }, []);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>模块独立更新</ThemedText>
      <ThemedText style={styles.subtitle}>{message}</ThemedText>

      {MODULE_IDS.map((id) => {
        const state = states.find((item) => item.id === id);
        const update = updates.find((item) => item.id === id);
        return (
          <View key={id} style={styles.row}>
            <View style={styles.rowInfo}>
              <ThemedText style={styles.name}>{MODULE_TITLES[id]}</ThemedText>
              <ThemedText style={styles.meta}>
                {`v${state?.activeVersion ?? "2.5.0"} · ${state?.source === "cached" ? "已独立更新" : "内置版本"}`}
                {update ? ` · 可升级到 v${update.remoteVersion}` : ""}
              </ThemedText>
            </View>
            <View style={styles.actions}>
              {!!update && (
                <TouchableOpacity
                  onPress={() => void apply(id)}
                  disabled={busy}
                  style={[styles.button, styles.buttonPrimary]}
                  accessibilityLabel={`更新${MODULE_TITLES[id]}`}
                >
                  <ThemedText style={styles.buttonPrimaryText}>更新</ThemedText>
                </TouchableOpacity>
              )}
              {state?.source === "cached" && (
                <TouchableOpacity
                  onPress={() => void rollback(id)}
                  disabled={busy}
                  style={styles.button}
                  accessibilityLabel={`回滚${MODULE_TITLES[id]}`}
                >
                  <ThemedText style={styles.buttonText}>回滚</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <TouchableOpacity onPress={() => void check()} disabled={busy} style={styles.checkButton}>
        <ThemedText style={styles.checkText}>{busy ? "处理中…" : "检查模块更新"}</ThemedText>
      </TouchableOpacity>

      <View style={styles.regionRow}>
        <ThemedText style={styles.regionLabel}>更新通道</ThemedText>
        {REGIONS.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => void changeRegion(item.id)}
            style={[styles.regionChip, region === item.id && styles.regionChipActive]}
          >
            <ThemedText style={region === item.id ? styles.regionTextActive : styles.regionText}>
              {item.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface.raised,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "700", color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.tertiary, marginTop: 4, marginBottom: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surface.border,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "600", color: Colors.text.primary },
  meta: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
  actions: { flexDirection: "row", gap: 6 },
  button: {
    minHeight: 36,
    minWidth: 52,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surface.border,
  },
  buttonPrimary: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },
  buttonText: { fontSize: 12, color: Colors.text.secondary },
  buttonPrimaryText: { fontSize: 12, color: Colors.brand.onAccent, fontWeight: "700" },
  checkButton: {
    minHeight: 40,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,230,168,0.45)",
    backgroundColor: "rgba(0,230,168,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { fontSize: 13, color: Colors.brand.accent, fontWeight: "700" },
  regionRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 12 },
  regionLabel: { fontSize: 12, color: Colors.text.tertiary, marginRight: 4 },
  regionChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surface.border,
  },
  regionChipActive: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },
  regionText: { fontSize: 11, color: Colors.text.secondary },
  regionTextActive: { fontSize: 11, color: Colors.brand.onAccent, fontWeight: "700" },
});
