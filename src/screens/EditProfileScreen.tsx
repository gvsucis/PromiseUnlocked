import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { states } from "states-us";
import { updateProfile } from "../services/profileService";

type EditProfileFormState = {
  dob: Date | null;
  gender: string;
  ethnicity: string;
  phone: string;
  email: string;
  pageUrl: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  schoolName: string;
  schoolAddress: string;
};

function buildUpdatePayload(formState: EditProfileFormState) {
  return {
    email: formState.email.trim() || undefined,
    pageUrl: formState.pageUrl.trim() || undefined,
    gender: formState.gender || undefined,
    ethnicity: formState.ethnicity || undefined,
    phone: formState.phone || undefined,
    schoolName: formState.schoolName || undefined,
    schoolAddress: formState.schoolAddress || undefined,
    dateOfBirth: formState.dob ? formState.dob.toISOString().split("T")[0] : undefined,
    address:
      formState.street || formState.city || formState.state || formState.postalCode
        ? {
            street: formState.street || undefined,
            city: formState.city || undefined,
            state: formState.state || undefined,
            postalCode: formState.postalCode || undefined,
          }
        : undefined,
  };
}

function validateProfileForm(formState: EditProfileFormState): string | null {
  if (formState.email && !/^\S+@\S+\.\S+$/.test(formState.email)) {
    return "Please enter a valid email address.";
  }

  if (formState.postalCode && formState.postalCode.length !== 5) {
    return "ZIP code must be 5 digits.";
  }

  return null;
}

// NOSONAR
export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [schoolName, setSchoolName] = useState("Hometown High School");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showEthnicityPicker, setShowEthnicityPicker] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const genderOptions = [
    { label: "Select gender", value: "" },
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
    { label: "Non-binary", value: "non-binary" },
    { label: "Prefer not to say", value: "prefer-not-to-say" },
    { label: "Other", value: "other" },
  ];

  const ethnicityOptions = [
    { label: "Select ethnicity", value: "" },
    { label: "American Indian or Alaska Native", value: "american-indian-alaska-native" },
    { label: "Asian", value: "asian" },
    { label: "Black or African American", value: "black-african-american" },
    { label: "Hispanic or Latino", value: "hispanic-latino" },
    {
      label: "Native Hawaiian or Other Pacific Islander",
      value: "native-hawaiian-pacific-islander",
    },
    { label: "White", value: "white" },
    { label: "Two or More Races", value: "two-or-more" },
    { label: "Prefer not to say", value: "prefer-not-to-say" },
    { label: "Other", value: "other" },
  ];

  const getLabel = (options: { label: string; value: string }[], value: string) =>
    options.find((o) => o.value === value)?.label ?? "";

  const stateOptions = [
    ...states.map((state) => ({ label: state.name, value: state.abbreviation })),
  ];

  // Save handler: gather form state, validate, call backend via profileService
  async function handleSave(): Promise<void> {
    const formState: EditProfileFormState = {
      dob,
      gender,
      ethnicity,
      phone,
      email,
      pageUrl,
      street,
      city,
      state,
      postalCode,
      schoolName,
      schoolAddress,
    };

    const validationError = validateProfileForm(formState);
    if (validationError) {
      Alert.alert("Invalid profile", validationError);
      return;
    }

    try {
      setSaving(true);
      await updateProfile(buildUpdatePayload(formState));
      setSaving(false);
      Alert.alert("Saved", "Your profile was updated.");
      navigation.goBack();
    } catch (error) {
      setSaving(false);
      console.error("UpdateProfile error:", error);
      Alert.alert("Save failed", "Could not update profile. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>

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
              <TouchableOpacity style={styles.pickerWrapper} onPress={() => setShowDobPicker(true)}>
                <Text style={dob ? styles.pickerText : styles.pickerPlaceholder}>
                  {dob
                    ? `${String(dob.getMonth() + 1).padStart(2, "0")}/${String(dob.getDate()).padStart(2, "0")}/${dob.getFullYear()}`
                    : "MM/DD/YYYY"}
                </Text>
              </TouchableOpacity>
              {Platform.OS === "android" && showDobPicker && (
                <DateTimePicker
                  value={dob ?? new Date()}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDobPicker(false);
                    if (event.type === "set" && selectedDate) {
                      setDob(selectedDate);
                    }
                  }}
                />
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Label style={styles.label}>Gender</Label>
              {Platform.OS === "ios" ? (
                <TouchableOpacity
                  style={styles.pickerWrapper}
                  onPress={() => setShowGenderPicker(true)}
                >
                  <Text style={gender ? styles.pickerText : styles.pickerPlaceholder}>
                    {gender ? getLabel(genderOptions, gender) : "Select gender"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={gender}
                    onValueChange={(value) => setGender(value)}
                    style={styles.picker}
                  >
                    {genderOptions.map((opt) => (
                      <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                    ))}
                  </Picker>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Label style={styles.label}>Ethnicity</Label>
              {Platform.OS === "ios" ? (
                <TouchableOpacity
                  style={styles.pickerWrapper}
                  onPress={() => setShowEthnicityPicker(true)}
                >
                  <Text style={ethnicity ? styles.pickerText : styles.pickerPlaceholder}>
                    {ethnicity ? getLabel(ethnicityOptions, ethnicity) : "Select ethnicity"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={ethnicity}
                    onValueChange={(value) => setEthnicity(value)}
                    style={styles.picker}
                  >
                    {ethnicityOptions.map((opt) => (
                      <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                    ))}
                  </Picker>
                </View>
              )}
            </View>
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONTACT</Text>

            <View style={styles.fieldGroup}>
              <Label style={styles.label}>Phone</Label>
              <View style={styles.inputWrapper}>
                <Input
                  placeholder="555-555-5555"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  className="h-10 px-0 text-sm bg-white border-0"
                  style={{ flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Label style={styles.label}>Email</Label>
              <View style={styles.inputWrapper}>
                <Input
                  placeholder="student@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="h-10 px-0 text-sm bg-white border-0"
                  style={{ flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Label style={styles.label}>Portfolio / Profile URL</Label>
              <View style={styles.inputWrapper}>
                <Input
                  placeholder="linkedin.com/in/username or personal website"
                  value={pageUrl}
                  onChangeText={setPageUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  className="h-10 px-0 text-sm bg-white border-0"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADDRESS</Text>

            <View style={styles.fieldGroup}>
              <Label style={styles.label}>Street address</Label>
              <View style={styles.inputWrapper}>
                <Input
                  placeholder="123 Main St"
                  value={street}
                  onChangeText={setStreet}
                  className="h-10 px-0 text-sm bg-white border-0"
                  style={{ flex: 1 }}
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Label style={styles.label}>City</Label>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="City"
                    value={city}
                    onChangeText={setCity}
                    className="h-10 px-0 text-sm bg-white border-0"
                    style={{ flex: 1 }}
                  />
                </View>
              </View>

              <View style={styles.fieldHalf}>
                <Label style={styles.label}>State</Label>
                {Platform.OS === "ios" ? (
                  <TouchableOpacity
                    style={styles.pickerWrapper}
                    onPress={() => setShowStatePicker(true)}
                  >
                    <Text style={state ? styles.pickerText : styles.pickerPlaceholder}>
                      {state || "Select state"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={state}
                      onValueChange={(value) => setState(value)}
                      style={styles.picker}
                    >
                      {stateOptions.map((opt) => (
                        <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Label style={styles.label}>ZIP code</Label>
              <View style={styles.inputWrapper}>
                <Input
                  placeholder="49512"
                  value={postalCode}
                  onChangeText={setPostalCode}
                  keyboardType="number-pad"
                  maxLength={5}
                  className="h-10 px-0 text-sm bg-white border-0"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>

          {/* School */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SCHOOL</Text>

            <View style={styles.fieldGroup}>
              <Label style={styles.label}>High school</Label>
              <View style={styles.inputWrapper}>
                <Input
                  placeholder="Hometown High School"
                  value={schoolName}
                  onChangeText={setSchoolName}
                  className="h-10 px-0 text-sm bg-white border-0"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>

          {/* Buttons */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save changes"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* iOS Modal Pickers */}
        {Platform.OS === "ios" && (
          <>
            <Modal visible={showDobPicker} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowDobPicker(false)}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <DateTimePicker
                      value={dob ?? new Date()}
                      mode="date"
                      display="spinner"
                      maximumDate={new Date()}
                      themeVariant="light"
                      style={{ width: "100%" }}
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setDob(selectedDate);
                        }
                      }}
                    />
                  </View>
                </View>
              </View>
            </Modal>

            <Modal visible={showGenderPicker} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <Picker
                    selectedValue={gender}
                    onValueChange={(value) => setGender(value)}
                    itemStyle={{ color: "#000" }}
                  >
                    {genderOptions.map((opt) => (
                      <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                    ))}
                  </Picker>
                </View>
              </View>
            </Modal>

            <Modal visible={showEthnicityPicker} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowEthnicityPicker(false)}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <Picker
                    selectedValue={ethnicity}
                    onValueChange={(value) => setEthnicity(value)}
                    itemStyle={{ color: "#000" }}
                  >
                    {ethnicityOptions.map((opt) => (
                      <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                    ))}
                  </Picker>
                </View>
              </View>
            </Modal>

            <Modal visible={showStatePicker} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                      <Text style={styles.modalDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <Picker
                    selectedValue={state}
                    onValueChange={(value) => setState(value)}
                    itemStyle={{ color: "#000" }}
                  >
                    {stateOptions.map((opt) => (
                      <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                    ))}
                  </Picker>
                </View>
              </View>
            </Modal>
          </>
        )}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  backButton: {
    marginBottom: 8,
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
    marginBottom: 16,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
  },
  inputWrapper: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  pickerWrapper: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  picker: {
    height: 42,
  },
  pickerText: {
    fontSize: 14,
    color: "#111827",
  },
  pickerPlaceholder: {
    fontSize: 14,
    color: "#9ca3af",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  modalDone: {
    fontSize: 17,
    fontWeight: "600",
    color: "#667eea",
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
