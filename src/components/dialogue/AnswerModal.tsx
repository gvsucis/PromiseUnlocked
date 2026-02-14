import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AnswerModalProps {
  visible: boolean;
  currentPrompt: string;
  userAnswer: string;
  setUserAnswer: (answer: string) => void;
  selectedImage: string | null;
  isAnswerFromVoice: boolean;
  isAnalyzingImage: boolean;
  onSubmit: () => void;
  onSubmitImage: () => void;
  onChangeImage: () => void;
  onZoomImage: () => void;
  onRecordAgain: () => void;
  onDismiss: () => void;
  onAnswerChange: (text: string) => void;
}

export function AnswerModal({
  visible,
  currentPrompt,
  userAnswer,
  selectedImage,
  isAnswerFromVoice,
  isAnalyzingImage,
  onSubmit,
  onSubmitImage,
  onChangeImage,
  onZoomImage,
  onRecordAgain,
  onDismiss,
  onAnswerChange,
}: AnswerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={() =>
        console.log('✅ Answer modal onShow callback fired with prompt:', currentPrompt)
      }
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={onDismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.questionTitle}>Question for You</Text>
                <ScrollView
                  style={{ maxHeight: 200 }}
                  contentContainerStyle={{ paddingVertical: 4 }}
                >
                  <Text style={styles.questionText}>{currentPrompt || '(No question loaded)'}</Text>
                </ScrollView>

                {selectedImage ? (
                  /* Image Answer Mode */
                  <>
                    <TouchableOpacity onPress={onZoomImage}>
                      <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                    </TouchableOpacity>
                    <View style={styles.imageActions}>
                      <TouchableOpacity style={styles.changeImageButton} onPress={onChangeImage}>
                        <Text style={styles.changeImageButtonText}>Change Image</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.submitButton}
                        onPress={onSubmitImage}
                        disabled={isAnalyzingImage}
                      >
                        <Text style={styles.submitButtonText}>
                          {isAnalyzingImage ? 'Analyzing...' : 'Submit Image'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* Text Answer Mode */
                  <>
                    {isAnswerFromVoice && (
                      <View style={styles.voiceTranscriptionBanner}>
                        <Ionicons name="mic" size={16} color="#4ECDC4" />
                        <Text style={styles.voiceTranscriptionText}>Voice transcription</Text>
                        <TouchableOpacity onPress={onRecordAgain} style={styles.recordAgainButton}>
                          <Ionicons name="refresh" size={14} color="#4ECDC4" />
                          <Text style={styles.recordAgainText}>Record again</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <TextInput
                      style={[styles.answerInput, isAnswerFromVoice && styles.answerInputVoice]}
                      value={userAnswer}
                      onChangeText={onAnswerChange}
                      placeholder="Example: 'I led a team of 5 students to build a mobile app that helps local farmers track inventory. We used React Native and Firebase, and it's now used by 50+ farmers in our community.'"
                      placeholderTextColor="#999"
                      multiline
                      autoCorrect={true}
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity style={styles.submitButton} onPress={onSubmit}>
                      <Text style={styles.submitButtonText}>Submit Answer</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 500,
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  questionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 15,
    marginBottom: 15,
    resizeMode: 'cover',
  },
  imageActions: {
    flexDirection: 'row',
    gap: 10,
  },
  changeImageButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  changeImageButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  voiceTranscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fcfc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  voiceTranscriptionText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  recordAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  recordAgainText: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
    marginLeft: 4,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    marginBottom: 15,
    fontSize: 15,
    minHeight: 120,
    backgroundColor: '#fafafa',
  },
  answerInputVoice: {
    borderColor: '#4ECDC4',
    borderWidth: 2,
    backgroundColor: '#f9fffe',
  },
  submitButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
