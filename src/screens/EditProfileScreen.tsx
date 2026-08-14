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
import { formatPhone, splitFullName, combineFullName } from "../utils/format";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProfileUpdatePayload } from "../types/profile";

type EditProfileFormState = {
  dob: Date | null;
  gender: string;
  ethnicity: string;
  firstName: string;
  lastName: string;
  phone: string;
  pageUrl: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  schoolName: string;
  schoolAddress: string;
};

type OriginalProfile = {
  dob: Date | null;
  gender: string;
  ethnicity: string;
  firstName: string;
  lastName: string;
  phone: string;
  pageUrl: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  schoolName: string;
  schoolAddress: string;
};

type FieldCompletion = Record<
  | "firstName"
  | "lastName"
  | "dob"
  | "gender"
  | "ethnicity"
  | "phone"
  | "street"
  | "city"
  | "state"
  | "postalCode"
  | "country"
  | "schoolName"
  | "schoolAddress",
  boolean
>;

const DEMOGRAPHIC_KEYS: (keyof FieldCompletion)[] = [
  "dob",
  "gender",
  "ethnicity",
  "phone",
  "street",
  "city",
  "state",
  "postalCode",
  "country",
  "schoolName",
  "schoolAddress",
];

function getFieldCompletion(s: EditProfileFormState): FieldCompletion {
  return {
    firstName: s.firstName.trim().length > 0,
    lastName: s.lastName.trim().length > 0,
    dob: !!s.dob,
    gender: !!s.gender,
    ethnicity: !!s.ethnicity,
    phone: s.phone.trim().length > 0,
    street: s.street.trim().length > 0,
    city: s.city.trim().length > 0,
    state: !!s.state,
    postalCode: s.postalCode.trim().length === 5,
    country: s.country.trim().length > 0,
    schoolName: s.schoolName.trim().length > 0,
    schoolAddress: s.schoolAddress.trim().length > 0,
  };
}

function isDemographicsComplete(completion: FieldCompletion): boolean {
  return DEMOGRAPHIC_KEYS.every((key) => completion[key]);
}

function buildUpdatePayload(formState: EditProfileFormState, original: OriginalProfile) {
  const payload: Partial<ProfileUpdatePayload> = {};
  const name = combineFullName(formState.firstName, formState.lastName);
  const originalName = combineFullName(original.firstName, original.lastName);

  if (name !== originalName) {
    payload.fullName = name || null;
    payload.displayName = name || null;
  }
  if (formState.firstName.trim() !== original.firstName) {
    payload.firstName = formState.firstName.trim() || null;
  }
  if (formState.lastName.trim() !== original.lastName) {
    payload.lastName = formState.lastName.trim() || null;
  }
  if (formState.pageUrl.trim() !== original.pageUrl) {
    payload.pageUrl = formState.pageUrl.trim() || null;
  }
  if (formState.gender !== original.gender) {
    payload.gender = formState.gender || null;
  }
  if (formState.ethnicity !== original.ethnicity) {
    payload.ethnicity = formState.ethnicity || null;
  }
  if (formState.phone !== original.phone) {
    payload.phone = formState.phone || null;
  }
  if (formState.schoolName !== original.schoolName) {
    payload.schoolName = formState.schoolName || null;
  }
  if (formState.schoolAddress !== original.schoolAddress) {
    payload.schoolAddress = formState.schoolAddress || null;
  }
  const formatDob = (d: Date | null) => (d ? d.toISOString().split("T")[0] : "");
  if (formatDob(formState.dob) !== formatDob(original.dob)) {
    payload.dateOfBirth = formState.dob ? formatDob(formState.dob) : null;
  }

  const addressChanged =
    formState.street !== original.street ||
    formState.city !== original.city ||
    formState.state !== original.state ||
    formState.postalCode !== original.postalCode ||
    formState.country !== original.country;

  if (addressChanged) {
    payload.address = {
      street: formState.street || null,
      city: formState.city || null,
      state: formState.state || null,
      postalCode: formState.postalCode || null,
      country: formState.country || null,
    };
  }

  const demographicsComplete = isDemographicsComplete(getFieldCompletion(formState));
  payload.metadata = { demographicsComplete };

  return payload;
}

function validateProfileForm(formState: EditProfileFormState): string | null {
  if (!formState.firstName.trim()) {
    return "First name is required.";
  }
  if (!formState.lastName.trim()) {
    return "Last name is required.";
  }
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

function FieldStatus({
  complete,
  required = false,
}: Readonly<{ complete: boolean; required?: boolean }>) {
  if (complete) {
    return <MaterialIcons name="check-circle" size={16} color={colors.status.success} />;
  }
  if (required) {
    return <MaterialIcons name="error-outline" size={16} color={colors.status.error} />;
  }
  return null;
}

function FieldLabel({
  label,
  complete,
  required = false,
}: Readonly<{ label: string; complete: boolean; required?: boolean }>) {
  return (
    <View style={styles.labelRow}>
      <Label style={styles.label}>{label}</Label>
      <FieldStatus complete={complete} required={required} />
    </View>
  );
}

function PickerField({
  value,
  placeholder,
  options,
  onValueChange,
  onPress,
}: Readonly<PickerFieldProps>) {
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [gender, setGender] = useState("");
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [ethnicity, setEthnicity] = useState("");
  const [showEthnicityPicker, setShowEthnicityPicker] = useState(false);
  const [phone, setPhone] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [originalProfile, setOriginalProfile] = useState<OriginalProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchProfile()
        .then((profile) => {
          const fallback = splitFullName(profile.fullName ?? "");
          const first = profile.firstName ?? fallback.firstName;
          const last = profile.lastName ?? fallback.lastName;
          const original: OriginalProfile = {
            dob: profile.dateOfBirth ? new Date(profile.dateOfBirth + "T00:00:00") : null,
            gender: profile.gender ?? "",
            ethnicity: profile.ethnicity ?? "",
            firstName: first,
            lastName: last,
            phone: profile.phone ?? "",
            pageUrl: profile.pageUrl ?? "",
            street: profile.address?.street ?? "",
            city: profile.address?.city ?? "",
            state: profile.address?.state ?? "",
            postalCode: profile.address?.postalCode ?? "",
            country: profile.address?.country ?? "",
            schoolName: profile.schoolName ?? "",
            schoolAddress: profile.schoolAddress ?? "",
          };
          setOriginalProfile(original);
          setFirstName(first);
          setLastName(last);
          setDob(profile.dateOfBirth ? new Date(profile.dateOfBirth + "T00:00:00") : null);
          setGender(profile.gender ?? "");
          setEthnicity(profile.ethnicity ?? "");
          setPhone(profile.phone ?? "");
          setPageUrl(profile.pageUrl ?? "");
          setStreet(profile.address?.street ?? "");
          setCity(profile.address?.city ?? "");
          setState(profile.address?.state ?? "");
          setPostalCode(profile.address?.postalCode ?? "");
          setCountry(profile.address?.country ?? "");
          setSchoolName(profile.schoolName ?? "");
          setSchoolAddress(profile.schoolAddress ?? "");
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

  const formState = useMemo<EditProfileFormState>(
    () => ({
      dob,
      gender,
      ethnicity,
      firstName,
      lastName,
      phone,
      pageUrl,
      street,
      city,
      state,
      postalCode,
      country,
      schoolName,
      schoolAddress,
    }),
    [
      dob,
      gender,
      ethnicity,
      firstName,
      lastName,
      phone,
      pageUrl,
      street,
      city,
      state,
      postalCode,
      country,
      schoolName,
      schoolAddress,
    ]
  );

  const completion = useMemo(() => getFieldCompletion(formState), [formState]);

  const requiredProgress = {
    completed: DEMOGRAPHIC_KEYS.filter((key) => completion[key]).length,
    total: DEMOGRAPHIC_KEYS.length,
  };

  const missingFields = [
    { label: "First name", complete: completion.firstName },
    { label: "Last name", complete: completion.lastName },
  ]
    .filter((f) => !f.complete)
    .map((f) => f.label);

  async function saveProfile(): Promise<boolean> {
    if (!originalProfile) return false;

    const validationError = validateProfileForm(formState);
    if (validationError) {
      Alert.alert("Invalid profile", validationError);
      return false;
    }

    try {
      setSaving(true);
      await updateProfileService(buildUpdatePayload(formState, originalProfile));

      const user = auth.currentUser;
      const combinedName = combineFullName(firstName, lastName);
      if (user && combinedName.trim()) {
        await updateProfile(user, { displayName: combinedName.trim() });
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
    firstName,
    setFirstName,
    lastName,
    setLastName,
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
    schoolAddress,
    setSchoolAddress,
    saving,
    isLoading,
    genderOptions,
    ethnicityOptions,
    stateOptions,
    completion,
    requiredProgress,
    missingFields,
    saveProfile,
  };
}

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const {
    firstName,
    setFirstName,
    lastName,
    setLastName,
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
    schoolAddress,
    setSchoolAddress,
    saving,
    isLoading,
    genderOptions,
    ethnicityOptions,
    stateOptions,
    completion,
    requiredProgress,
    missingFields,
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
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
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
                {requiredProgress.completed} of {requiredProgress.total} demographic fields complete
              </Text>
              {missingFields.length > 0 && (
                <Text style={styles.missingLine}>Missing: {missingFields.join(", ")}</Text>
              )}
            </View>

            {/* Personal Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PERSONAL INFO</Text>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Date of birth" complete={completion.dob} />
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

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <FieldLabel label="First name *" complete={completion.firstName} required />
                  <View style={styles.inputWrapper}>
                    <Input
                      placeholder="First name"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      className="h-10 px-0 text-sm bg-white border-0"
                      style={styles.flex1}
                    />
                  </View>
                </View>

                <View style={styles.fieldHalf}>
                  <FieldLabel label="Last name *" complete={completion.lastName} required />
                  <View style={styles.inputWrapper}>
                    <Input
                      placeholder="Last name"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      className="h-10 px-0 text-sm bg-white border-0"
                      style={styles.flex1}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Gender" complete={completion.gender} />
                <PickerField
                  value={gender}
                  placeholder="Select gender"
                  options={genderOptions}
                  onValueChange={setGender}
                  onPress={() => setShowGenderPicker(true)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Ethnicity" complete={completion.ethnicity} />
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
                <FieldLabel label="Phone" complete={completion.phone} />
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
                <FieldLabel label="Street address" complete={completion.street} />
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
                  <FieldLabel label="City" complete={completion.city} />
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
                  <FieldLabel label="State" complete={completion.state} />
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
                <FieldLabel label="ZIP code" complete={completion.postalCode} />
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
                <FieldLabel label="Country" complete={completion.country} />
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
                <FieldLabel label="High school" complete={completion.schoolName} />
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

              <View style={styles.fieldGroup}>
                <FieldLabel label="School address" complete={completion.schoolAddress} />
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="123 School St, City, State"
                    value={schoolAddress}
                    onChangeText={setSchoolAddress}
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
  // Stable identity so memoized <Input> fields don't re-render on each keystroke.
  flex1: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  missingLine: {
    fontSize: 13,
    color: colors.status.error,
    marginTop: 6,
    textAlign: "center",
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
    paddingTop: 3,
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
