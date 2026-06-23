import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { colors, typography, spacing, radius, globalStyles } from "../styles/global";
import { SafeAreaView } from "react-native-safe-area-context";

type ProfileNav = StackNavigationProp<RootStackParamList, "Profile">;
import { auth } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { useDialogue } from "../context/DialogueContext";
import { useLogout } from "../hooks/useLogout";
import {
  fetchProfile,
  updateProfile,
  buildLocalProfile,
  type UserProfile,
} from "../services/profileService";

function ChecklistItem({ label, complete }: Readonly<{ label: string; complete: boolean }>) {
  return (
    <View style={styles.progressItem}>
      <MaterialIcons
        name={complete ? "check-circle" : "radio-button-unchecked"}
        size={18}
        color={complete ? colors.accent.sky : colors.text.muted}
      />
      <Text style={complete ? styles.itemComplete : styles.itemIncomplete}>{label}</Text>
    </View>
  );
}

function GalleryPlaceholder() {
  return (
    <View style={styles.galleryPlaceholder}>
      <MaterialIcons name="image" size={28} color={colors.accent.sky} />
    </View>
  );
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savingBio, setSavingBio] = useState(false);

  const { reset } = useDialogue();
  const { confirmAndLogout } = useLogout();

  useFocusEffect(
    useCallback(() => {
      fetchProfile()
        .then((nextProfile) => {
          setProfile(nextProfile);
          const bioValue = nextProfile.metadata.bio;
          setBio(typeof bioValue === "string" ? bioValue : "");
        })
        .catch((error) => {
          console.warn(
            "Failed to fetch profile from backend, falling back to local auth data:",
            error
          );
          setProfile(buildLocalProfile());
          setBio("");
        })
        .finally(() => undefined);
    }, [])
  );

  const navigation = useNavigation<ProfileNav>();
  const { session } = useAuth();
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  const handleLogout = () => {
    confirmAndLogout(() => navigation.replace("Welcome"), "Switch to Guest");
  };

  const displayName = useMemo(() => {
    return profile?.fullName || profile?.displayName || "Your Profile";
  }, [profile]);

  const photoUrl = profile?.photoURL || auth.currentUser?.photoURL || null;

  const highSchool = useMemo(() => {
    return profile?.schoolName?.trim();
  }, [profile]);

  const handleSaveBio = async () => {
    if (!profile) return;
    setSavingBio(true);
    try {
      const result = await updateProfile({ metadata: { ...profile.metadata, bio } });
      console.log("[ProfileScreen] Bio save result:", JSON.stringify(result, null, 2));
      console.log("[ProfileScreen] Bio save result.metadata.bio:", result.metadata.bio);

      setProfile((prev) => (prev ? { ...prev, metadata: { ...prev.metadata, bio } } : prev));

      setEditingBio(false);
    } catch (error) {
      console.warn("[ProfileScreen] Failed to update profile:", error);
    } finally {
      setSavingBio(false);
    }
  };

  const checklist = [
    { label: "Basic Information", complete: true },
    { label: "About Me", complete: bio.trim().length > 0 },
    { label: "Upload Photos", complete: false },
    { label: "Complete Background Info", complete: false },
    { label: "Full Name", complete: displayName !== "Your Profile" },
  ];

  const progressPercent = Math.round(
    (checklist.filter((i) => i.complete).length / checklist.length) * 100
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={globalStyles.screen}>
        <View style={styles.floatingButtons} pointerEvents="box-none">
          <TouchableOpacity onPress={handleLogout} style={styles.floatingButton}>
            <MaterialIcons
              name={session.mode === "authenticated" ? "logout" : "person"}
              size={24}
              color={colors.background.card}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={reset} style={styles.floatingButton}>
            <MaterialIcons name="refresh" size={24} color={colors.background.card} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.bannerContainer}>
            <View style={styles.bannerClip}>
              <View style={styles.banner} />
            </View>

            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                ) : (
                  <MaterialIcons name="person" size={40} color={colors.text.inverse} />
                )}
              </View>
            </View>
          </View>

          <View style={styles.identitySection}>
            <Text style={styles.studentName}>{displayName}</Text>
            <Text style={styles.meta}>{profile?.email ?? "No email yet"}</Text>
            <Text style={styles.meta}>{highSchool}</Text>
            {profile?.schoolAddress?.trim() ? (
              <Text style={styles.meta}>{profile.schoolAddress}</Text>
            ) : null}
            {profile?.pageUrl && (
              <Text style={[styles.meta, { color: colors.accent.sky, marginTop: 4 }]}>
                {profile.pageUrl}
              </Text>
            )}
          </View>

          <View style={globalStyles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>About Me</Text>
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

          <View style={globalStyles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Moments</Text>
            </View>
            <View style={styles.galleryRow}>
              <GalleryPlaceholder />
              <GalleryPlaceholder />
              <TouchableOpacity style={styles.galleryAddCard}>
                <MaterialIcons name="add" size={28} color={colors.accent.sky} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={globalStyles.card}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <View style={[globalStyles.row, { marginBottom: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Add Your Personal Information</Text>
                <Text style={styles.cardSubtitle}>
                  Share details about your background and journey.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.accent.sky} />
            </View>
          </TouchableOpacity>

          <View style={globalStyles.card}>
            <View style={[globalStyles.row, { marginBottom: 14 }]}>
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

          {session.mode === "authenticated" && (
            <TouchableOpacity style={globalStyles.card} onPress={handleLogout}>
              <View style={globalStyles.row}>
                <MaterialIcons name="logout" size={20} color={colors.status.error} />
                <Text style={styles.logoutText}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const BANNER_HEIGHT = 160;
const AVATAR_SIZE = 88;

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.subtle,
  },

  bannerContainer: {
    marginHorizontal: -spacing.md,
    alignItems: "center",
    marginBottom: AVATAR_SIZE / 2 + spacing.sm,
  },
  bannerClip: {
    width: "100%",
    height: BANNER_HEIGHT,
    overflow: "hidden",
    alignItems: "center",
  },
  banner: {
    width: 900,
    height: 900,
    borderRadius: 450,
    backgroundColor: colors.accent.sky,
    position: "absolute",
    top: -900 + BANNER_HEIGHT,
  },
  avatarWrapper: {
    position: "absolute",
    bottom: -(AVATAR_SIZE / 2),
    alignSelf: "center",
    borderRadius: 999,
    padding: 4,
    backgroundColor: colors.text.inverse,
    shadowColor: colors.accent.sky,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.accent.teal,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },

  identitySection: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xxl,
  },
  studentName: { ...typography.screenTitle, fontSize: 20 },
  meta: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },

  cardTitle: { ...typography.cardTitle },
  cardSubtitle: { fontSize: 13, color: colors.text.secondary, marginTop: 4, lineHeight: 18 },

  progressPercent: { fontSize: 22, fontWeight: "700", color: colors.accent.sky },
  progressBarBg: {
    height: 10,
    backgroundColor: colors.background.tinted,
    borderRadius: radius.full,
    overflow: "hidden",
    marginBottom: 18,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accent.sky,
    borderRadius: radius.full,
  },
  progressChecklist: { gap: 12 },
  progressItem: { flexDirection: "row", alignItems: "center" },
  itemComplete: { marginLeft: 10, fontSize: 13, color: colors.text.primary, fontWeight: "500" },
  itemIncomplete: { marginLeft: 10, fontSize: 13, color: colors.text.muted },
  footnote: { ...typography.caption, marginTop: 18 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { ...typography.sectionTitle },
  linkText: { ...typography.link },
  bio: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    padding: 10,
    minHeight: 80,
    backgroundColor: colors.background.subtle,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    padding: 10,
    minHeight: 80,
    backgroundColor: colors.background.subtle,
  },

  galleryRow: { flexDirection: "row", gap: 12 },
  galleryPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.background.tinted,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  galleryAddCard: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.background.subtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accent.sky,
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: colors.status.error, marginLeft: 10 },
  floatingButtons: {
    position: "absolute",
    top: 52,
    right: 16,
    flexDirection: "row",
    gap: 8,
    zIndex: 10,
  },
  floatingButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
