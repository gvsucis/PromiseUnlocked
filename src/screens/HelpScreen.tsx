import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";

export default function HelpScreen() {
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    Alert.alert(
      "Bug Report Submitted",
      "Thank you for helping us improve the app."
    );

    setLocation("");
    setDescription("");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Report an Issue</Text>

      <Text style={styles.label}>Where did you notice the issue?</Text>

      <View style={styles.optionContainer}>
        {["Chat", "Dashboard", "Profile", "Other"].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.option,
              location === item && styles.optionSelected,
            ]}
            onPress={() => setLocation(item)}
          >
            <Text
              style={[
                styles.optionText,
                location === item && styles.optionTextSelected,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Please describe the issue</Text>

      <TextInput
        style={styles.textArea}
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Tell us what happened..."
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
      >
        <Text style={styles.submitText}>Submit Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 80,
    paddingHorizontal: 24,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },

  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 12,
  },

  optionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  option: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },

  optionSelected: {
    backgroundColor: "#ede9fe",
    borderColor: "#6d5efc",
  },

  optionText: {
    color: "#555",
  },

  optionTextSelected: {
    color: "#6d5efc",
    fontWeight: "600",
  },

  textArea: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 12,
    minHeight: 150,
    padding: 12,
    marginTop: 8,
  },

  submitButton: {
    backgroundColor: "#6d5efc",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
  },

  submitText: {
    color: "white",
    fontWeight: "700",
  },
});