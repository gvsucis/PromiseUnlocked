import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputMethodModalProps {
  visible: boolean;
  onSelect: (method: 'text' | 'voice' | 'image') => void;
  onClose: () => void;
}

export function InputMethodModal({ visible, onSelect, onClose }: InputMethodModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.inputMethodModalContent}>
              <Text style={styles.inputMethodTitle}>Choose Input Method</Text>
              <Text style={styles.inputMethodSubtitle}>
                How would you like to provide your response?
              </Text>

              <View style={styles.inputMethodOptions}>
                <TouchableOpacity
                  style={styles.inputMethodOption}
                  onPress={() => onSelect('text')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.inputMethodIconContainer, { backgroundColor: '#45B7D1' }]}>
                    <Ionicons name="chatbubble" size={32} color="white" />
                  </View>
                  <Text style={styles.inputMethodOptionText}>Text</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.inputMethodOption}
                  onPress={() => onSelect('voice')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.inputMethodIconContainer, { backgroundColor: '#4ECDC4' }]}>
                    <Ionicons name="mic" size={32} color="white" />
                  </View>
                  <Text style={styles.inputMethodOptionText}>Voice</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.inputMethodOption}
                  onPress={() => onSelect('image')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.inputMethodIconContainer, { backgroundColor: '#FF6B6B' }]}>
                    <Ionicons name="camera" size={32} color="white" />
                  </View>
                  <Text style={styles.inputMethodOptionText}>Image</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.inputMethodCancelButton} onPress={onClose}>
                <Text style={styles.inputMethodCancelText}>Cancel</Text>
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
  inputMethodModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  inputMethodTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  inputMethodSubtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputMethodOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    gap: 15,
  },
  inputMethodOption: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#f8f8f8',
  },
  inputMethodIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputMethodOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  inputMethodCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  inputMethodCancelText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
});
