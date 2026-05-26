import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";

type ProfileNav = StackNavigationProp<RootStackParamList, "Profile">;
import { fetchProfile, updateProfile, type UserProfile } from "../services/profileService";

function ChecklistItem({ label, complete }: { label: string; complete: boolean }) {
  return (
    <View style={styles.progressItem}>
      <MaterialIcons
        name={complete ? "check-circle" : "radio-button-unchecked"}
        size={18}
        color={complete ? "#6d5efc" : "#9ca3af"}
      />
      <Text style={complete ? styles.itemComplete : styles.itemIncomplete}>{label}</Text>
    </View>
  );
}

function GalleryPlaceholder() {
  return (
    <View style={styles.galleryPlaceholder}>
      <MaterialIcons name="image" size={28} color="#c4b5fd" />
    </View>
  );
}

export default function ProfileScreen() {
  //Profile
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBio, setSavingBio] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((nextProfile) => {
        setProfile(nextProfile);
        const bioValue = nextProfile.metadata.bio;
        setBio(typeof bioValue === "string" ? bioValue : "");
      })
      .catch((error) => {
        console.log("Failed to fetch profile:", error);
      })
      .finally(() => setLoading(false));
  }, []);

  const navigation = useNavigation<ProfileNav>();
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  const highSchool = useMemo(() => {
    const value = profile?.metadata.highSchool;
    return typeof value === "string" && value.trim().length > 0 ? value : "Hometown High School";
  }, [profile]);

  const handleSaveBio = async () => {
    if (!profile) {
      return;
    }

    setSavingBio(true);
    try {
      const updatedProfile = await updateProfile({
        metadata: {
          ...profile.metadata,
          bio,
        },
      });
      setProfile(updatedProfile);
      const nextBio = updatedProfile.metadata.bio;
      setBio(typeof nextBio === "string" ? nextBio : "");
      setEditingBio(false);
    } catch (error) {
      console.log("Failed to update profile:", error);
    } finally {
      setSavingBio(false);
    }
  };

  const checklist = [
    { label: "Basic Information", complete: true },
    { label: "About Me", complete: bio.trim().length > 0 },
    { label: "Upload Photos", complete: false },
    { label: "Complete Background Info", complete: false },
  ];

  const progressPercent = Math.round(
    (checklist.filter((i) => i.complete).length / checklist.length) * 100
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>Track your journey and manage your progress.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={32} color="#ffffff" />
            </View>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={styles.studentName}>{profile?.displayName ?? "Your Profile"}</Text>
              <Text style={styles.meta}>{profile?.email ?? "No email yet"}</Text>
              <Text style={styles.meta}>{highSchool}</Text>
            </View>
          </View>
        </View>

        {/* Personal info CTA */}
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("EditProfile")}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Add Your Personal Information</Text>
              <Text style={styles.cardSubtitle}>
                Share details about your background and journey.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8b85c9" />
          </View>
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={[styles.row, { marginBottom: 14 }]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.cardTitle}>Profile Completion</Text>
              <Text style={styles.cardSubtitle}>
                Complete your profile to unlock more opportunities.
              </Text>
            </View>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.progressChecklist}>
            {checklist.map((item) => (
              <ChecklistItem key={item.label} {...item} />
            ))}
          </View>

          <Text style={styles.footnote}>
            Your journey continues beyond profile completion through stamps and experiences.
          </Text>
        </View>

        <View style={styles.cardRow}>
          <TouchableOpacity
            style={styles.passportCard}
            onPress={() => navigation.navigate("Passport")}
          >
            <MaterialIcons name="card-travel" size={32} color="#ffffff" />
            <Text style={styles.passportTitle}>Passport</Text>
            <Text style={styles.passportSubtitle}>View your stamps</Text>
          </TouchableOpacity>

          <View style={styles.disabledCard}>
            <MaterialIcons name="groups" size={32} color="#9ca3af" />
            <Text style={styles.disabledTitle}>My Network</Text>
            <Text style={styles.disabledSubtitle}>Coming soon!</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <TouchableOpacity
              onPress={() => {
                if (editingBio) {
                  void handleSaveBio();
                  return;
                }
                setEditingBio(true);
              }}
              disabled={savingBio}
            >
              <Text style={styles.linkText}>{editingBio ? "Save" : "Edit"}</Text>
            </TouchableOpacity>
          </View>
          {editingBio ? (
            <TextInput value={bio} onChangeText={setBio} style={styles.bioInput} multiline />
          ) : (
            <Text style={styles.bio}>
              {bio || "Add a short bio about your goals and interests."}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Moments</Text>
            <TouchableOpacity>
              <Text style={styles.linkText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.galleryRow}>
            <GalleryPlaceholder />
            <GalleryPlaceholder />
            <TouchableOpacity style={styles.galleryAddCard}>
              <MaterialIcons name="add" size={28} color="#8b85c9" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f7fc" },
  scrollContent: { paddingBottom: 32 },

  headerSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "700", color: "#111827", marginTop: 10 },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 6, textAlign: "center" },

  card: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e9e7f7",
  },

  row: { flexDirection: "row", alignItems: "center" },

  profileHeader: { flexDirection: "row", alignItems: "center" },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6d5efc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  studentName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 13, color: "#6b7280", marginTop: 2 },

  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1f2937" },
  cardSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 4, lineHeight: 18 },

  progressPercent: { fontSize: 22, fontWeight: "700", color: "#6d5efc" },
  progressBarBg: {
    height: 10,
    backgroundColor: "#ede9fe",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 18,
  },
  progressBarFill: { height: "100%", backgroundColor: "#6d5efc", borderRadius: 999 },
  progressChecklist: { gap: 12 },
  progressItem: { flexDirection: "row", alignItems: "center" },
  itemComplete: { marginLeft: 10, fontSize: 13, color: "#374151", fontWeight: "500" },
  itemIncomplete: { marginLeft: 10, fontSize: 13, color: "#9ca3af" },
  footnote: { marginTop: 18, fontSize: 12, lineHeight: 18, color: "#6b7280" },

  cardRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  passportCard: {
    flex: 1,
    backgroundColor: "#6d5efc",
    borderRadius: 14,
    padding: 16,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5b4ee0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  passportTitle: { fontSize: 13, fontWeight: "700", marginTop: 8, color: "#ffffff" },
  passportSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
    textAlign: "center",
  },
  disabledCard: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    padding: 16,
    minHeight: 180,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledTitle: { fontSize: 13, fontWeight: "700", marginTop: 8, color: "#9ca3af" },
  disabledSubtitle: { fontSize: 12, color: "#9ca3af", marginTop: 2, textAlign: "center" },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  linkText: { fontSize: 13, color: "#6d5efc", fontWeight: "600" },
  bio: { fontSize: 14, color: "#374151", lineHeight: 20 },
  bioInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    backgroundColor: "#ffffff",
  },

  galleryRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  galleryPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: "#f5f3ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  galleryAddCard: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: "#fafafa",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d8d4fe",
  },
});
