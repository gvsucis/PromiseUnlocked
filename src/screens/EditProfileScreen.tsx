import React, { useState, useCallback, useMemo } from "react";
import {
  Alert,
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { states } from "states-us";
import { updateProfile } from "firebase/auth";
import { auth } from "../config/firebase";
import { fetchProfile, updateProfile as updateProfileService } from "../services/profileService";
import { colors, spacing, radius } from "../styles/global";
import { formatPhone } from "../utils/format";

type EditProfileFormState = {
  dob: Date | null;
  gender: string;
  ethnicity: string;
  fullName: string;
  displayName: string;
  phone: string;
  email: string;
  pageUrl: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  schoolName: string;
};

function buildUpdatePayload(formState: EditProfileFormState) {
  const name = formState.fullName.trim() || undefined;
  return {
    fullName: name,
    displayName: name,
    pageUrl: formState.pageUrl.trim() || undefined,
    gender: formState.gender || undefined,
    ethnicity: formState.ethnicity || undefined,
    phone: formState.phone || undefined,
    schoolName: formState.schoolName || undefined,
    dateOfBirth: formState.dob ? formState.dob.toISOString().split("T")[0] : undefined,
    address:
      formState.street ||
      formState.city ||
      formState.state ||
      formState.postalCode ||
      formState.country
        ? {
            street: formState.street || undefined,
            city: formState.city || undefined,
            state: formState.state || undefined,
            postalCode: formState.postalCode || undefined,
            country: formState.country || undefined,
          }
        : undefined,
  };
}

function validateProfileForm(formState: EditProfileFormState): string | null {
  if (formState.postalCode && formState.postalCode.length !== 5) {
    return "ZIP code must be 5 digits.";
  }
  return null;
}

function formatDate(date: Date | null): string {
  if (!date) return "MM/DD/YYYY";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

type PickerFieldProps = {
  value: string;
  placeholder: string;
  options: { label: string; value: string }[];
  onValueChange: (value: string) => void;
  onPress: () => void;
};

function PickerField({ value, placeholder, options, onValueChange, onPress }: PickerFieldProps) {
  return Platform.OS === "ios" ? (
    <TouchableOpacity style={styles.pickerWrapper} onPress={onPress}>
      <Text style={value ? styles.pickerText : styles.pickerPlaceholder}>
        {value ? (options.find((o) => o.value === value)?.label ?? "") : placeholder}
      </Text>
    </TouchableOpacity>
  ) : (
    <View style={styles.pickerWrapper}>
      <Picker selectedValue={value} onValueChange={onValueChange} style={styles.picker}>
        {options.map((opt) => (
          <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
        ))}
      </Picker>
    </View>
  );
}

type ModalPickerProps = {
  visible: boolean;
  onClose: () => void;
  selectedValue: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
};

function ModalPicker({
  visible,
  onClose,
  selectedValue,
  onValueChange,
  options,
}: Readonly<ModalPickerProps>) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <Picker
            selectedValue={selectedValue}
            onValueChange={onValueChange}
            itemStyle={{ color: "#000" }}
          >
            {options.map((opt) => (
              <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
            ))}
          </Picker>
        </View>
      </View>
    </Modal>
  );
}

function useProfileForm() {
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [gender, setGender] = useState("");
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [ethnicity, setEthnicity] = useState("");
  const [showEthnicityPicker, setShowEthnicityPicker] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchProfile()
        .then((profile) => {
          setFullName(profile.fullName ?? "");
          setDisplayName(profile.displayName ?? "");
          setDob(profile.dateOfBirth ? new Date(profile.dateOfBirth + "T00:00:00") : null);
          setGender(profile.gender ?? "");
          setEthnicity(profile.ethnicity ?? "");
          setPhone(profile.phone ?? "");
          setEmail(profile.email ?? "");
          setPageUrl(profile.pageUrl ?? "");
          setStreet(profile.address?.street ?? "");
          setCity(profile.address?.city ?? "");
          setState(profile.address?.state ?? "");
          setPostalCode(profile.address?.postalCode ?? "");
          setCountry(profile.address?.country ?? "");
          setSchoolName(profile.schoolName ?? "");
        })
        .catch((error) => {
          console.warn("[EditProfile] Failed to fetch profile:", error);
        })
        .finally(() => setIsLoading(false));
    }, [])
  );

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

  const stateOptions = [...states.map((s) => ({ label: s.name, value: s.abbreviation }))];

  const requiredProgress = useMemo(() => {
    const checks = [
      !!dob,
      !!gender,
      !!ethnicity,
      phone.trim().length > 0,
      street.trim().length > 0,
      city.trim().length > 0,
      !!state,
      postalCode.trim().length === 5,
      country.trim().length > 0,
      schoolName.trim().length > 0,
    ];
    return { completed: checks.filter(Boolean).length, total: checks.length };
  }, [dob, gender, ethnicity, phone, street, city, state, postalCode, country, schoolName]);

  async function saveProfile(): Promise<boolean> {
    const formState: EditProfileFormState = {
      dob,
      gender,
      ethnicity,
      fullName,
      displayName,
      phone,
      email,
      pageUrl,
      street,
      city,
      state,
      postalCode,
      country,
      schoolName,
    };

    const validationError = validateProfileForm(formState);
    if (validationError) {
      Alert.alert("Invalid profile", validationError);
      return false;
    }

    try {
      setSaving(true);
      await updateProfileService(buildUpdatePayload(formState));

      const user = auth.currentUser;
      if (user && fullName.trim()) {
        await updateProfile(user, { displayName: fullName.trim() });
      }

      setSaving(false);
      Alert.alert("Saved", "Your profile was updated.");
      return true;
    } catch (error) {
      setSaving(false);
      console.error("UpdateProfile error:", error);
      Alert.alert("Save failed", "Could not update profile. Please try again.");
      return false;
    }
  }

  return {
    fullName,
    setFullName,
    displayName,
    setDisplayName,
    dob,
    setDob,
    showDobPicker,
    setShowDobPicker,
    gender,
    setGender,
    showGenderPicker,
    setShowGenderPicker,
    ethnicity,
    setEthnicity,
    showEthnicityPicker,
    setShowEthnicityPicker,
    phone,
    setPhone,
    email,
    setEmail,
    pageUrl,
    setPageUrl,
    street,
    setStreet,
    city,
    setCity,
    state,
    setState,
    showStatePicker,
    setShowStatePicker,
    postalCode,
    setPostalCode,
    country,
    setCountry,
    schoolName,
    setSchoolName,
    saving,
    isLoading,
    genderOptions,
    ethnicityOptions,
    stateOptions,
    requiredProgress,
    saveProfile,
  };
}

export default function EditProfileScreen() {
  const navigation = useNavigation();

  const {
    fullName,
    setFullName,
    dob,
    setDob,
    showDobPicker,
    setShowDobPicker,
    gender,
    setGender,
    showGenderPicker,
    setShowGenderPicker,
    ethnicity,
    setEthnicity,
    showEthnicityPicker,
    setShowEthnicityPicker,
    phone,
    setPhone,
    pageUrl,
    setPageUrl,
    street,
    setStreet,
    city,
    setCity,
    state,
    setState,
    showStatePicker,
    setShowStatePicker,
    postalCode,
    setPostalCode,
    country,
    setCountry,
    schoolName,
    setSchoolName,
    saving,
    isLoading,
    genderOptions,
    ethnicityOptions,
    stateOptions,
    requiredProgress,
    saveProfile,
  } = useProfileForm();

  const handleSave = async () => {
    if (await saveProfile()) {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.sky} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color={colors.accent.skyDark} />
            </TouchableOpacity>

            <View style={styles.header}>
              <MaterialIcons name="person" size={40} color={colors.accent.skyDark} />
              <Text style={styles.title}>Personal Information</Text>
              <Text style={styles.subtitle}>Update your personal information</Text>
              <Text style={styles.progressLine}>
                {requiredProgress.completed} of {requiredProgress.total} required fields complete
              </Text>
            </View>

            {/* Personal Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PERSONAL INFO</Text>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>Date of birth *</Label>
                <TouchableOpacity
                  style={styles.pickerWrapper}
                  onPress={() => setShowDobPicker(true)}
                >
                  <Text style={dob ? styles.pickerText : styles.pickerPlaceholder}>
                    {formatDate(dob)}
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
                <Label style={styles.label}>Full Name *</Label>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="Your full name"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    className="h-10 px-0 text-sm bg-white border-0"
                    style={styles.flex1}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>Gender *</Label>
                <PickerField
                  value={gender}
                  placeholder="Select gender"
                  options={genderOptions}
                  onValueChange={setGender}
                  onPress={() => setShowGenderPicker(true)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>Ethnicity *</Label>
                <PickerField
                  value={ethnicity}
                  placeholder="Select ethnicity"
                  options={ethnicityOptions}
                  onValueChange={setEthnicity}
                  onPress={() => setShowEthnicityPicker(true)}
                />
              </View>
            </View>

            {/* Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CONTACT</Text>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>Phone *</Label>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="555-555-5555"
                    value={phone}
                    onChangeText={(text) => setPhone(formatPhone(text))}
                    keyboardType="phone-pad"
                    className="h-10 px-0 text-sm bg-white border-0"
                    style={styles.flex1}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>Portfolio / Profile URL (Optional)</Label>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="linkedin.com/in/username or personal website"
                    value={pageUrl}
                    onChangeText={setPageUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                    className="h-10 px-0 text-sm bg-white border-0"
                    style={styles.flex1}
                  />
                </View>
              </View>
            </View>

            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ADDRESS</Text>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>Street address *</Label>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="123 Main St"
                    value={street}
                    onChangeText={setStreet}
                    className="h-10 px-0 text-sm bg-white border-0"
                    style={styles.flex1}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Label style={styles.label}>City *</Label>
                  <View style={styles.inputWrapper}>
                    <Input
                      placeholder="City"
                      value={city}
                      onChangeText={setCity}
                      className="h-10 px-0 text-sm bg-white border-0"
                      style={styles.flex1}
                    />
                  </View>
                </View>

                <View style={styles.fieldHalf}>
                  <Label style={styles.label}>State *</Label>
                  <PickerField
                    value={state}
                    placeholder="Select state"
                    options={stateOptions}
                    onValueChange={setState}
                    onPress={() => setShowStatePicker(true)}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>ZIP code *</Label>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="49512"
                    value={postalCode}
                    onChangeText={setPostalCode}
                    keyboardType="number-pad"
                    maxLength={5}
                    className="h-10 px-0 text-sm bg-white border-0"
                    style={styles.flex1}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>Country *</Label>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="United States"
                    value={country}
                    onChangeText={setCountry}
                    autoCapitalize="words"
                    className="h-10 px-0 text-sm bg-white border-0"
                    style={styles.flex1}
                  />
                </View>
              </View>
            </View>

            {/* School */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SCHOOL</Text>

              <View style={styles.fieldGroup}>
                <Label style={styles.label}>High school *</Label>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="Hometown High School"
                    value={schoolName}
                    onChangeText={setSchoolName}
                    className="h-10 px-0 text-sm bg-white border-0"
                    style={styles.flex1}
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
        )}

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

            <ModalPicker
              visible={showGenderPicker}
              onClose={() => setShowGenderPicker(false)}
              selectedValue={gender}
              onValueChange={setGender}
              options={genderOptions}
            />

            <ModalPicker
              visible={showEthnicityPicker}
              onClose={() => setShowEthnicityPicker(false)}
              selectedValue={ethnicity}
              onValueChange={setEthnicity}
              options={ethnicityOptions}
            />

            <ModalPicker
              visible={showStatePicker}
              onClose={() => setShowStatePicker(false)}
              selectedValue={state}
              onValueChange={setState}
              options={stateOptions}
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Stable reference so memoized <Input> fields don't re-render on every
  // keystroke just because an inline `{ flex: 1 }` object changes identity.
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: colors.background.subtle,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    color: colors.text.primary,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 5,
  },
  progressLine: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent.sky,
    marginTop: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.accent.sky,
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
    color: colors.accent.skyDark,
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
    color: colors.text.primary,
    marginBottom: 6,
  },
  inputWrapper: {
    backgroundColor: colors.background.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    overflow: "hidden",
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  pickerWrapper: {
    backgroundColor: colors.background.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    overflow: "hidden",
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  picker: {
    height: 50,
  },
  pickerText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  pickerPlaceholder: {
    fontSize: 14,
    color: colors.text.muted,
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
    color: colors.accent.sky,
  },
  saveButton: {
    backgroundColor: colors.accent.sky,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: 18,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: colors.background.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
