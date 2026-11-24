import React from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { ThemedText } from "../ThemedText";
import { StyledButton } from "../StyledButton";
import { useUpdateStore } from "@/stores/updateStore";
import { TARGET_LABELS } from "@/constants/UpdateConfig";

export function UpdateSection() {
  const {
    currentVersion,
    remoteVersion,
    updateAvailable,
    downloading,
    checking,
    downloadProgress,
    checkForUpdate,
    startDownload,
    openReleasePage,
    isLatestVersion,
    target,
    inAppInstall,
    assetName,
    releaseNotes,
    error,
  } = useUpdateStore();

  const handleCheckUpdate = async () => {
    await checkForUpdate(false);
  };

  return (
    <View style={styles.sectionContainer}>
      <ThemedText style={styles.sectionTitle}>应用更新</ThemedText>

      <View style={styles.row}>
        <ThemedText style={styles.label}>当前版本</ThemedText>
        <ThemedText style={styles.value}>v{currentVersion}</ThemedText>
      </View>

      <View style={styles.row}>
        <ThemedText style={styles.label}>当前设备</ThemedText>
        <ThemedText style={styles.value}>{TARGET_LABELS[target]}</ThemedText>
      </View>

      {updateAvailable && (
        <>
          <View style={styles.row}>
            <ThemedText style={styles.label}>最新版本</ThemedText>
            <ThemedText style={[styles.value, styles.newVersion]}>v{remoteVersion}</ThemedText>
          </View>
          {!!assetName && (
            <View style={styles.row}>
              <ThemedText style={styles.label}>安装包</ThemedText>
              <ThemedText style={styles.value} numberOfLines={1}>{assetName}</ThemedText>
            </View>
          )}
          {!!releaseNotes && (
            <View style={styles.notesBox}>
              <ThemedText style={styles.notesTitle}>更新说明</ThemedText>
              <ThemedText style={styles.notesText} numberOfLines={5}>{releaseNotes}</ThemedText>
            </View>
          )}
        </>
      )}

      {isLatestVersion && remoteVersion && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>状态</ThemedText>
          <ThemedText style={[styles.value, styles.latestVersion]}>已是最新版本</ThemedText>
        </View>
      )}

      {error && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>检查结果</ThemedText>
          <ThemedText style={[styles.value, styles.errorText]} numberOfLines={2}>{error}</ThemedText>
        </View>
      )}

      {downloading && (
        <View style={styles.row}>
          <ThemedText style={styles.label}>下载进度</ThemedText>
          <ThemedText style={styles.value}>{downloadProgress}%</ThemedText>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <StyledButton onPress={handleCheckUpdate} disabled={checking || downloading} style={styles.button}>
          {checking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={styles.buttonText}>检查更新</ThemedText>
          )}
        </StyledButton>

        {updateAvailable && (
          <StyledButton
            onPress={startDownload}
            disabled={downloading}
            variant="primary"
            style={styles.button}
          >
            <ThemedText style={styles.buttonText}>
              {downloading
                ? `下载中 ${downloadProgress}%`
                : inAppInstall
                  ? "立即更新"
                  : "前往下载页面"}
            </ThemedText>
          </StyledButton>
        )}

        {updateAvailable && inAppInstall && (
          <StyledButton onPress={openReleasePage} variant="ghost" style={styles.button}>
            <ThemedText style={styles.buttonText}>浏览器下载</ThemedText>
          </StyledButton>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: Platform.select({
      ios: "rgba(255, 255, 255, 0.05)",
      android: "rgba(255, 255, 255, 0.05)",
      default: "transparent",
    }),
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: Platform.isTV ? 24 : 20,
    fontWeight: "bold",
    marginBottom: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  label: {
    fontSize: Platform.isTV ? 18 : 16,
    color: "#999",
  },
  value: {
    fontSize: Platform.isTV ? 18 : 16,
    flexShrink: 1,
    textAlign: "right",
  },
  newVersion: {
    color: "#00E6A8",
    fontWeight: "bold",
  },
  latestVersion: {
    color: "#00E6A8",
    fontWeight: "500",
  },
  errorText: {
    color: "#ff6b6b",
    fontWeight: "500",
  },
  notesBox: {
    backgroundColor: "rgba(0,230,168,0.07)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  notesTitle: {
    color: "#00E6A8",
    fontSize: Platform.isTV ? 15 : 13,
    fontWeight: "600",
    marginBottom: 5,
  },
  notesText: {
    color: "#bbb",
    fontSize: Platform.isTV ? 14 : 12,
    lineHeight: Platform.isTV ? 21 : 18,
  },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    width: "90%",
    ...(Platform.isTV && {
      borderWidth: 2,
      borderColor: "transparent",
    }),
  },
  buttonText: {
    color: "#ffffff",
    fontSize: Platform.isTV ? 16 : 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
