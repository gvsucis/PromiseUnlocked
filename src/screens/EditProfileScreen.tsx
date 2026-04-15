import React, { useState } from "react";
import { ScrollView, View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [highSchool, setHighSchool] = useState("Hometown High School");

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <MaterialIcons name="person" size={40} color="#fff" />
          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>Update your personal information</Text>
        </View>

        {/* Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERSONAL INFO</Text>

          <View style={styles.fieldGroup}>
            <Label style={styles.label}>Date of birth</Label>
            <Input
              placeholder="MM / DD / YYYY"
              value={dob}
              onChangeText={setDob}
              className="bg-white border-gray-200 h-12 rounded-lg text-base"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Label style={styles.label}>Gender</Label>
            <Input
              placeholder="Gender"
              value={gender}
              onChangeText={setGender}
              className="bg-white border-gray-200 h-12 rounded-lg text-base"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Label style={styles.label}>Ethnicity</Label>
            <Input
              placeholder="Ethnicity"
              value={ethnicity}
              onChangeText={setEthnicity}
              className="bg-white border-gray-200 h-12 rounded-lg text-base"
            />
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT</Text>

          <View style={styles.fieldGroup}>
            <Label style={styles.label}>Phone</Label>
            <Input
              placeholder="(555) 000-0000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              className="bg-white border-gray-200 h-12 rounded-lg text-base"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Label style={styles.label}>Email</Label>
            <Input
              placeholder="student@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-white border-gray-200 h-12 rounded-lg text-base"
            />
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ADDRESS</Text>

          <View style={styles.fieldGroup}>
            <Label style={styles.label}>Street address</Label>
            <Input
              placeholder="123 Main St"
              value={street}
              onChangeText={setStreet}
              className="bg-white border-gray-200 h-12 rounded-lg text-base"
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Label style={styles.label}>City</Label>
              <Input
                placeholder="City"
                value={city}
                onChangeText={setCity}
                className="bg-white border-gray-200 h-12 rounded-lg text-base"
              />
            </View>

            <View style={styles.fieldHalf}>
              <Label style={styles.label}>State</Label>
              <Input
                placeholder="State"
                value={state}
                onChangeText={setState}
                className="bg-white border-gray-200 h-12 rounded-lg text-base"
              />
            </View>
          </View>
        </View>

        {/* School */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SCHOOL</Text>

          <View style={styles.fieldGroup}>
            <Label style={styles.label}>High school</Label>
            <Input
              placeholder="Hometown High School"
              value={highSchool}
              onChangeText={setHighSchool}
              className="bg-white border-gray-200 h-12 rounded-lg text-base"
            />
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.saveButton} onPress={() => navigation.goBack()}>
          <Text style={styles.saveButtonText}>Save changes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e3a5f",
    letterSpacing: 1,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
  },
  saveButton: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
});
