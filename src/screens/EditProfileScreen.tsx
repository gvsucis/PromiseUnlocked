import React, { useState } from "react";
import { ScrollView, View, StyleSheet, TouchableOpacity, Platform, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [highSchool, setHighSchool] = useState("Hometown High School");
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
    { label: "Select state", value: "" },
    { label: "Alabama", value: "AL" },
    { label: "Alaska", value: "AK" },
    { label: "Arizona", value: "AZ" },
    { label: "Arkansas", value: "AR" },
    { label: "California", value: "CA" },
    { label: "Colorado", value: "CO" },
    { label: "Connecticut", value: "CT" },
    { label: "Delaware", value: "DE" },
    { label: "Florida", value: "FL" },
    { label: "Georgia", value: "GA" },
    { label: "Hawaii", value: "HI" },
    { label: "Idaho", value: "ID" },
    { label: "Illinois", value: "IL" },
    { label: "Indiana", value: "IN" },
    { label: "Iowa", value: "IA" },
    { label: "Kansas", value: "KS" },
    { label: "Kentucky", value: "KY" },
    { label: "Louisiana", value: "LA" },
    { label: "Maine", value: "ME" },
    { label: "Maryland", value: "MD" },
    { label: "Massachusetts", value: "MA" },
    { label: "Michigan", value: "MI" },
    { label: "Minnesota", value: "MN" },
    { label: "Mississippi", value: "MS" },
    { label: "Missouri", value: "MO" },
    { label: "Montana", value: "MT" },
    { label: "Nebraska", value: "NE" },
    { label: "Nevada", value: "NV" },
    { label: "New Hampshire", value: "NH" },
    { label: "New Jersey", value: "NJ" },
    { label: "New Mexico", value: "NM" },
    { label: "New York", value: "NY" },
    { label: "North Carolina", value: "NC" },
    { label: "North Dakota", value: "ND" },
    { label: "Ohio", value: "OH" },
    { label: "Oklahoma", value: "OK" },
    { label: "Oregon", value: "OR" },
    { label: "Pennsylvania", value: "PA" },
    { label: "Rhode Island", value: "RI" },
    { label: "South Carolina", value: "SC" },
    { label: "South Dakota", value: "SD" },
    { label: "Tennessee", value: "TN" },
    { label: "Texas", value: "TX" },
    { label: "Utah", value: "UT" },
    { label: "Vermont", value: "VT" },
    { label: "Virginia", value: "VA" },
    { label: "Washington", value: "WA" },
    { label: "West Virginia", value: "WV" },
    { label: "Wisconsin", value: "WI" },
    { label: "Wyoming", value: "WY" },
    { label: "District of Columbia", value: "DC" },
  ];

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
            {Platform.OS === "ios" ? (
              <TouchableOpacity style={styles.pickerWrapper} onPress={() => setShowDobPicker(true)}>
                <Text style={dob ? styles.pickerText : styles.pickerPlaceholder}>
                  {dob
                    ? `${String(dob.getMonth() + 1).padStart(2, "0")}/${String(dob.getDate()).padStart(2, "0")}/${dob.getFullYear()}`
                    : "MM/DD/YYYY"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.pickerWrapper} onPress={() => setShowDobPicker(true)}>
                <Text style={dob ? styles.pickerText : styles.pickerPlaceholder}>
                  {dob
                    ? `${String(dob.getMonth() + 1).padStart(2, "0")}/${String(dob.getDate()).padStart(2, "0")}/${dob.getFullYear()}`
                    : "MM/DD/ YYYY"}
                </Text>
              </TouchableOpacity>
            )}
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
                className="bg-white border-0 h-10 text-sm px-0"
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
                className="bg-white border-0 h-10 text-sm px-0"
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
                className="bg-white border-0 h-10 text-sm px-0"
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
                  className="bg-white border-0 h-10 text-sm px-0"
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
                value={zip}
                onChangeText={setZip}
                keyboardType="number-pad"
                maxLength={5}
                className="bg-white border-0 h-10 text-sm px-0"
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
                value={highSchool}
                onChangeText={setHighSchool}
                className="bg-white border-0 h-10 text-sm px-0"
                style={{ flex: 1 }}
              />
            </View>
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
