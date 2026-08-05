import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Snackbar } from "react-native-paper";

import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../../types/navigation";
import { useDialogue } from "../../context/DialogueProvider";
import { LoadingModal } from "./LoadingModal";
import { CompletionModal } from "./CompletionModal";
import { WeakFitModal } from "./WeakFitModal";
import { AnswerModal } from "./AnswerModal";
import { VoiceRecordingModal } from "./VoiceRecordingModal";
import { StampModal } from "./StampModal";
import { InfoModal } from "./InfoModal";
import { QuestionInputModal } from "./QuestionInputModal";
import ImageEditor from "../ImageEditor";
import ZoomableImageView from "../ZoomableImageView";

type PriorityModal = "crisis" | "sensitive" | "weakFit" | "stampUnlock" | "stampUpgrade" | null;

function resolveActiveModal(d: ReturnType<typeof useDialogue>): PriorityModal {
  if (d.showCrisisSupport) return "crisis";
  if (d.uiState === "weak-fit" && d.contentWarning) return "weakFit";
  if (d.showSensitiveIntro) return "sensitive";
  if (d.uiState === "weak-fit") return "weakFit";
  if (d.newStampUnlock) return "stampUnlock";
  if (d.activeStampUpgrade) return "stampUpgrade";
  return null;
}

export function DialogueModals() {
  const d = useDialogue();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [zoomViewerVisible, setZoomViewerVisible] = useState(false);
  const [proofSnackbarVisible, setProofSnackbarVisible] = useState(false);
  const activeModal = resolveActiveModal(d);

  React.useEffect(() => {
    if (!d.pendingProofNotification) {
      setProofSnackbarVisible(false);
      return;
    }
    if (d.showQuestionInputModal) return;
    const timer = setTimeout(() => setProofSnackbarVisible(true), 800);
    return () => clearTimeout(timer);
  }, [d.pendingProofNotification, d.showQuestionInputModal]);

  console.log({
    uiState: d.uiState,
    showQuestionInputModal: d.showQuestionInputModal,
    pendingQuestion: d.pendingQuestion,
    currentPrompt: d.currentPrompt,
  });
  return (
    <>
      <Snackbar
        visible={!!d.error}
        onDismiss={() => d.setError("")}
        duration={3000}
        style={styles.snackbar}
      >
        {d.error}
      </Snackbar>

      <LoadingModal visible={d.uiState === "loading"} message={d.loadingMessage} />

      <CompletionModal visible={d.uiState === "complete"} onDismiss={() => d.setUiState("idle")} />

      <WeakFitModal
        visible={activeModal === "weakFit"}
        justification={d.weakFitJustification}
        isContentWarning={d.contentWarning}
        onTryAgain={d.handleWeakFitTryAgain}
        onNewQuestion={d.handleWeakFitNewQuestion}
      />

      <AnswerModal
        visible={d.uiState === "answering"}
        currentPrompt={d.currentPrompt}
        userAnswer={d.userAnswer}
        selectedImage={d.selectedImage}
        isAnswerFromVoice={d.isAnswerFromVoice}
        isAnalyzingImage={d.isAnalyzingImage}
        onDismiss={d.dismissAnswerModal}
        onZoomImage={() => setZoomViewerVisible(true)}
        onChangeImage={d.showImageSourceDialog}
        onSubmitImage={d.handleSubmitImage}
        onAnswerChange={d.setUserAnswer}
        onRecordAgain={() => {
          d.setUiState("voice-recording");
          d.setUserAnswer("");
          d.setIsAnswerFromVoice(false);
        }}
        onSubmit={() => {}}
      />

      <VoiceRecordingModal
        visible={d.uiState === "voice-recording"}
        currentPrompt={d.currentPrompt}
        isRecording={d.isRecording}
        recordingDuration={d.recordingDuration}
        recordingUri={d.recordingUri}
        isProcessingAudio={d.isProcessingAudio}
        onStartRecording={d.startRecording}
        onStopRecording={d.stopRecording}
        onRecordAgain={d.handleVoiceRecordAgain}
        onSubmit={d.handleVoiceSubmit}
        onCancel={d.handleVoiceCancel}
      />

      {activeModal === "stampUnlock" && d.newStampUnlock && (
        <StampModal
          visible
          variant="unlock"
          stampName={d.newStampUnlock.stamp}
          tier={d.newStampUnlock.tier}
          region={d.newStampUnlock.category}
          sensitive={d.newStampUnlock.sensitive}
          showConfetti={d.showConfetti}
          onContinue={d.handleContinueAfterStampUnlock}
          onViewStamp={() => {
            const unlock = d.newStampUnlock;
            d.clearStampUnlock();
            if (unlock) {
              navigation.navigate("StampDetails", {
                stamp: unlock.stamp,
                region: unlock.category,
                categoryId: unlock.categoryId,
              });
            }
          }}
        />
      )}

      {activeModal === "stampUpgrade" && d.activeStampUpgrade && (
        <StampModal
          visible
          variant="upgrade"
          stampName={d.activeStampUpgrade.stamp}
          previousTier={d.activeStampUpgrade.previousTier}
          newTier={d.activeStampUpgrade.newTier}
          region={d.activeStampUpgrade.category}
          showConfetti={d.showConfetti}
          onContinue={d.handleContinueAfterStampUpgrade}
          onViewStamp={() => {
            const upgrade = d.activeStampUpgrade;
            d.clearActiveStampUpgrade();
            if (upgrade) {
              navigation.navigate("StampDetails", {
                stamp: upgrade.stamp,
                region: upgrade.category,
                categoryId: upgrade.categoryId,
              });
            }
          }}
        />
      )}

      <InfoModal
        visible={activeModal === "crisis"}
        title="Need Support?"
        body={[
          "We noticed that your message may relate to self-harm, suicide, or a personal crisis.",
          "If you're in immediate danger or considering harming yourself, please contact emergency services or call/text 988 for immediate support.",
          "If this was not your intent, you can continue using the app normally.",
        ]}
        onContinue={d.dismissCrisisSupport}
      />
      <InfoModal
        visible={activeModal === "sensitive"}
        body={[
          "We recognize that this experience may have been difficult.",
          "Thank you for sharing something personal.",
          "Significant life experiences can shape resilience, empathy, perspective, and personal growth. Based on what you've shared, we've identified a new experience in your profile.",
        ]}
        onContinue={d.dismissSensitiveIntro}
      />

      <QuestionInputModal
        visible={d.showQuestionInputModal && !!d.pendingQuestion}
        question={d.pendingQuestion || ""}
        textValue={d.userAnswer}
        onTextChange={d.setUserAnswer}
        onSelectInputType={d.handleInputTypeSelect}
        onSubmitText={d.handleSubmitTextFromModal}
        onSubmitTextAndImage={d.handleSubmitTextAndImage}
        attachedImageUri={d.combinedImageUri}
        onAttachImage={d.handleAttachImage}
        onRemoveAttachedImage={d.removeAttachedImage}
        onClose={d.closeQuestionInputModal}
        onBackdropDismiss={d.dismissQuestionInputModalToBackdrop}
        onNewQuestion={
          d.questionInputMode === "addDetail" ? undefined : () => d.handleSkipQuestion()
        }
        onNewTopic={d.questionInputMode === "addDetail" ? undefined : () => d.handleNewTopic()}
      />

      {d.pendingProofNotification && (
        <View style={styles.proofSnackbarContainer}>
          <Snackbar
            visible={proofSnackbarVisible}
            onDismiss={() => {
              setProofSnackbarVisible(false);
              d.clearProofNotification();
            }}
            duration={6000}
            action={{
              label: "Share",
              onPress: () => {
                setProofSnackbarVisible(false);
                d.activateProofFromNotification();
              },
            }}
          >
            {d.pendingProofNotification.artifactUploadReason}
          </Snackbar>
        </View>
      )}

      {d.showImageEditor && d.tempImageUri && (
        <ImageEditor
          imageUri={d.tempImageUri}
          onSave={d.handleImageEditorSave}
          onCancel={d.handleImageEditorCancel}
        />
      )}

      {d.showProofImageEditor && d.tempProofImageUri && (
        <ImageEditor
          imageUri={d.tempProofImageUri}
          onSave={d.handleProofImageEditorSave}
          onCancel={d.handleProofImageEditorCancel}
        />
      )}

      {zoomViewerVisible && d.selectedImage && (
        <ZoomableImageView
          imageUri={d.selectedImage}
          visible={zoomViewerVisible}
          onClose={() => setZoomViewerVisible(false)}
        />
      )}

      {d.isUploadingProof && <View style={styles.proofUploadOverlay} pointerEvents="none"></View>}
    </>
  );
}

const styles = StyleSheet.create({
  snackbar: { marginBottom: 80 },
  proofSnackbarContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 9999,
  },
  proofUploadOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
  },
});
