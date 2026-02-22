import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';

interface CompletionModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function CompletionModal({ visible, onDismiss }: CompletionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.completeTitle}>🎉 Congratulations!!! 🎉</Text>
              <Text style={styles.completeText}>
                You have completed your skills passport with a flourish and can look forward to a
                very bright future. Thanks for participating.
              </Text>
              <Text style={styles.completeSubtext}>
                Tap the Reset button if you want to try again.
              </Text>
              <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
                <Text style={styles.dismissButtonText}>Dismiss Message</Text>
              </TouchableOpacity>
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
  completeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 20,
    textAlign: 'center',
  },
  completeText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  completeSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 25,
    textAlign: 'center',
  },
  dismissButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
