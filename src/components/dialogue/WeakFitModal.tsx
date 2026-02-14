import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface WeakFitModalProps {
  visible: boolean;
  justification: string;
  onTryAgain: () => void;
  onNewQuestion: () => void;
}

export function WeakFitModal({
  visible,
  justification,
  onTryAgain,
  onNewQuestion,
}: WeakFitModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onNewQuestion}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <MaterialIcons
                name="help-outline"
                size={48}
                color="#ff9800"
                style={styles.weakFitIcon}
              />
              <Text style={styles.weakFitTitle}>Need More Details</Text>
              <Text style={styles.weakFitJustification}>{justification}</Text>
              <Text style={styles.weakFitPrompt}>
                Would you like to provide more details about your answer, or move to a different
                question?
              </Text>
              <View style={styles.weakFitButtons}>
                <TouchableOpacity
                  style={[styles.weakFitButton, styles.weakFitButtonSecondary]}
                  onPress={onNewQuestion}
                >
                  <MaterialIcons name="skip-next" size={20} color="#667eea" />
                  <Text style={styles.weakFitButtonTextSecondary}>New Question</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.weakFitButton, styles.weakFitButtonPrimary]}
                  onPress={onTryAgain}
                >
                  <MaterialIcons name="edit" size={20} color="#fff" />
                  <Text style={styles.weakFitButtonTextPrimary}>Add Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    padding: 30,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  weakFitIcon: {
    marginBottom: 15,
  },
  weakFitTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  weakFitJustification: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  weakFitPrompt: {
    fontSize: 16,
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 24,
  },
  weakFitButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  weakFitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  weakFitButtonSecondary: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  weakFitButtonPrimary: {
    backgroundColor: '#667eea',
  },
  weakFitButtonTextSecondary: {
    color: '#667eea',
    fontSize: 15,
    fontWeight: '600',
  },
  weakFitButtonTextPrimary: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
