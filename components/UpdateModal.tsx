import React from "react";
import { Modal, View, StyleSheet, ActivityIndicator, Platform, ScrollView } from "react-native";
import { useUpdateStore } from "../stores/updateStore";
import { Colors } from "../constants/Colors";
import { TARGET_LABELS } from "../constants/UpdateConfig";
import { StyledButton } from "./StyledButton";
import { ThemedText } from "./ThemedText";

export function UpdateModal() {
  const {
    showUpdateModal,
    currentVersion,
    remoteVersion,
    downloading,
    downloadProgress,
    error,
    setShowUpdateModal,
    startDownload,
    installUpdate,
    openReleasePage,
    skipThisVersion,
    inAppInstall,
    target,
    releaseNotes,
    downloadedPath,
  } = useUpdateStore();

  const updateButtonRef = React.useRef<View>(null);
  const laterButtonRef = React.useRef<View>(null);
  const skipButtonRef = React.useRef<View>(null);
  const browserButtonRef = React.useRef<View>(null);

  async function handleUpdate() {
    // 鸿蒙 NEXT / iOS / 桌面端无法直接安装 APK，统一打开下载页面
    if (!inAppInstall) {
      await openReleasePage();
      return;
    }
    if (!downloading && !downloadedPath) {
      await startDownload();
    } else if (downloadedPath) {
      await installUpdate();
    }
  }

  function handleLater() {
    setShowUpdateModal(false);
  }

  async function handleSkip() {
    await skipThisVersion();
  }

  React.useEffect(() => {
    if (showUpdateModal && Platform.isTV) {
      setTimeout(() => updateButtonRef.current?.focus(), 100);
    }
  }, [showUpdateModal]);

  const getButtonText = () => {
    if (!inAppInstall) return "前往下载页面";
    if (downloading) return `下载中 ${downloadProgress}%`;
    if (downloadedPath) return "立即安装";
    return "立即更新";
  };

  return (
    <Modal visible={showUpdateModal} transparent animationType="fade" onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ThemedText style={styles.title}>发现新版本</ThemedText>

          <View style={styles.versionInfo}>
            <ThemedText style={styles.versionText}>当前版本: v{currentVersion}</ThemedText>
            <ThemedText style={styles.arrow}>→</ThemedText>
            <ThemedText style={[styles.versionText, styles.newVersion]}>新版本: v{remoteVersion}</ThemedText>
          </View>

          <ThemedText style={styles.targetText}>
            当前设备：{TARGET_LABELS[target]}
            {!inAppInstall ? " · 请在浏览器中下载对应安装包" : ""}
          </ThemedText>

          {!!releaseNotes && (
            <ScrollView style={styles.notesBox} nestedScrollEnabled>
              <ThemedText style={styles.notesText} numberOfLines={6}>{releaseNotes}</ThemedText>
            </ScrollView>
          )}

          {downloading && inAppInstall && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
              </View>
              <ThemedText style={styles.progressText}>{downloadProgress}%</ThemedText>
            </View>
          )}

          {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

          <View style={styles.buttonContainer}>
            <StyledButton
              ref={updateButtonRef}
              onPress={handleUpdate}
              disabled={downloading && !downloadedPath}
              variant="primary"
              style={styles.button}
            >
              {downloading && inAppInstall && !downloadedPath ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>{getButtonText()}</ThemedText>
              )}
            </StyledButton>

            {inAppInstall && (
              <StyledButton ref={browserButtonRef} onPress={openReleasePage} variant="ghost" style={styles.button}>
                <ThemedText style={styles.buttonText}>浏览器下载</ThemedText>
              </StyledButton>
            )}

            {!downloading && !downloadedPath && (
              <>
                <StyledButton ref={laterButtonRef} onPress={handleLater} variant="ghost" style={styles.button}>
                  <ThemedText style={styles.buttonText}>稍后再说</ThemedText>
                </StyledButton>
                <StyledButton ref={skipButtonRef} onPress={handleSkip} variant="ghost" style={styles.button}>
                  <ThemedText style={styles.buttonText}>跳过此版本</ThemedText>
                </StyledButton>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 24,
    width: Platform.isTV ? 500 : "90%",
    maxWidth: 500,
    alignItems: "center",
  },
  title: {
    fontSize: Platform.isTV ? 28 : 24,
    fontWeight: "bold",
    color: Colors.dark.text,
    marginBottom: 20,
    paddingTop: 12,
  },
  versionInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  versionText: {
    fontSize: Platform.isTV ? 18 : 16,
    color: Colors.dark.text,
  },
  newVersion: {
    color: Colors.dark.primary || "#00E6A8",
    fontWeight: "bold",
  },
  arrow: {
    fontSize: Platform.isTV ? 20 : 18,
    color: Colors.dark.text,
    marginHorizontal: 12,
  },
  targetText: {
    fontSize: Platform.isTV ? 14 : 12,
    color: Colors.text.tertiary,
    textAlign: "center",
    marginBottom: 12,
  },
  notesBox: {
    maxHeight: 120,
    width: "100%",
    backgroundColor: "rgba(0,230,168,0.07)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  notesText: {
    fontSize: Platform.isTV ? 14 : 12,
    color: Colors.text.secondary,
    lineHeight: Platform.isTV ? 21 : 18,
  },
  progressContainer: {
    width: "100%",
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.dark.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.dark.primary || "#00E6A8",
  },
  progressText: {
    fontSize: Platform.isTV ? 16 : 14,
    color: Colors.dark.text,
    textAlign: "center",
  },
  errorText: {
    fontSize: Platform.isTV ? 16 : 14,
    color: "#ff4444",
    marginBottom: 16,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    width: "80%",
  },
  buttonText: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
});
