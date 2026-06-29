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
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { colors, typography, spacing, radius, globalStyles } from "../styles/global";

import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProfileNav = StackNavigationProp<RootStackParamList, "Profile">;
import { useAuth } from "../context/AuthContext";
import { useDialogue } from "../context/DialogueContext";
import { useLogout } from "../hooks/useLogout";
import {
  fetchProfile,
  updateProfile,
  uploadProfilePicture,
  uploadPvaResult,
  listPvaResults,
  getPvaFileUrl,
  deletePvaResult,
  buildLocalProfile,
  type UserProfile,
  type PvaResult,
} from "../services/profileService";

import { ImagePickerService } from "../services/imagePickerService";

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
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [uploadingPva, setUploadingPva] = useState(false);
  const [pvaFile, setPvaFile] = useState<PvaResult | null>(null);
  const [openingPva, setOpeningPva] = useState(false);
  const [deletingPva, setDeletingPva] = useState(false);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      listPvaResults()
        .then((results) => setPvaFile(results[0] ?? null))
        .catch(() => undefined);
    }, [])
  );

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
    return profile?.fullName || profile?.displayName || "Your Name";
  }, [profile]);

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

  const handleEditPhoto = () => {
    Alert.alert("Update Profile Photo", "Choose how to add your photo.", [
      { text: "Take Photo", onPress: () => handlePhotoSelection(true) },
      { text: "Choose from Gallery", onPress: () => handlePhotoSelection(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const handleUploadPVAprofile = async () => {
    if (uploadingPva) return;

    if (session.mode !== "authenticated") {
      Alert.alert("Sign in required", "Please sign in to upload your PVA result.");
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    setUploadingPva(true);
    try {
      const uploadResult = await uploadPvaResult(picked.assets[0].uri);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }
      const embeddingId = uploadResult.data?.embeddingId as string | undefined;
      if (embeddingId) {
        setPvaFile({
          id: embeddingId,
          fileName: (uploadResult.data?.fileName as string) ?? picked.assets[0].name,
          fileSizeBytes: (uploadResult.data?.fileSizeBytes as number) ?? 0,
        });
      }
      Alert.alert("Upload Complete", "Your PVA result has been uploaded.");
    } catch (error) {
      console.warn("Failed to upload PVA result:", error);
      Alert.alert(
        "Upload Failed",
        "We couldn't upload your PVA result. Please check your connection and try again."
      );
    } finally {
      setUploadingPva(false);
    }
  };

  const handlePreviewPva = async () => {
    if (!pvaFile || openingPva) return;
    setOpeningPva(true);
    try {
      const url = await getPvaFileUrl(pvaFile.id);
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.warn("Failed to open PVA result:", error);
      Alert.alert("Couldn't open file", "We couldn't open your PVA result. Please try again.");
    } finally {
      setOpeningPva(false);
    }
  };

  const handleDeletePva = () => {
    if (!pvaFile || deletingPva) return;
    Alert.alert(
      "Delete PVA Result",
      "Remove this uploaded report? You can upload a new one afterward.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingPva(true);
            try {
              await deletePvaResult(pvaFile.id);
              setPvaFile(null);
            } catch (error) {
              console.warn("Failed to delete PVA result:", error);
              Alert.alert("Delete Failed", "We couldn't delete your PVA result. Please try again.");
            } finally {
              setDeletingPva(false);
            }
          },
        },
      ]
    );
  };

  const handlePhotoSelection = async (useCamera: boolean) => {
    const hasPermissions = await ImagePickerService.requestPermissions();
    if (!hasPermissions) {
      Alert.alert("Permissions Required", "Camera and photo library permissions are required.");
      return;
    }
    const result = useCamera
      ? await ImagePickerService.takePhotoWithCamera(true)
      : await ImagePickerService.pickImageFromGalleryWithOptions(true);

    if (result.success && result.imageUri) {
      setLocalPhotoUri(result.imageUri);

      try {
        const uploadResult = await uploadProfilePicture(result.imageUri);

        if (!uploadResult.success) {
          throw new Error(uploadResult.error);
        }

        const refreshedProfile = await fetchProfile();
        setProfile(refreshedProfile);

        setLocalPhotoUri(null);
      } catch (error) {
        // Upload failed — drop the optimistic preview so the UI reflects the
        // photo that's actually saved, and tell the user instead of failing
        // silently.
        console.warn("Failed to upload profile photo:", error);
        setLocalPhotoUri(null);
        Alert.alert(
          "Upload Failed",
          "We couldn't upload your photo. Please check your connection and try again."
        );
      }
    } else if (result.error) {
      Alert.alert("Error", result.error);
    }
  };

  const checklist = [
    { label: "Basic Information", complete: true },
    { label: "About Me", complete: bio.trim().length > 0 },
    { label: "Upload Photos", complete: false },
    { label: "Complete Background Info", complete: false },
    { label: "Full Name", complete: displayName !== "Your Name" },
  ];

  const progressPercent = Math.round(
    (checklist.filter((i) => i.complete).length / checklist.length) * 100
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          globalStyles.screen,
          { paddingTop: insets.top, backgroundColor: colors.accent.sky },
        ]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
          <View style={styles.bannerContainer}>
            <View style={styles.bannerClip}>
              <View style={styles.banner} />
            </View>

            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                {(localPhotoUri ?? profile?.photoURL) ? (
                  <Image
                    source={{ uri: localPhotoUri ?? profile?.photoURL ?? "" }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <MaterialIcons name="person" size={40} color={colors.text.inverse} />
                )}
              </View>
              <TouchableOpacity style={styles.avatarEditBadge} onPress={handleEditPhoto}>
                <MaterialIcons name="edit" size={16} color={colors.text.inverse} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.identitySection}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <View style={styles.identityHeader}>
              <Text style={styles.studentName}>{displayName}</Text>
              <MaterialIcons name="edit" size={18} color={colors.accent.sky} />
            </View>

            <Text style={styles.meta}>{profile?.email ?? "yourname@email.com"}</Text>
            <Text style={styles.meta}>{highSchool}</Text>

            {profile?.schoolAddress?.trim() ? (
              <Text style={styles.meta}>{profile.schoolAddress}</Text>
            ) : null}

            {profile?.pageUrl && (
              <Text style={[styles.meta, { color: colors.accent.sky, marginTop: 4 }]}>
                {profile.pageUrl}
              </Text>
            )}
          </TouchableOpacity>

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
              <Text style={styles.cardTitle}>Moments & Artifacts</Text>
            </View>
            <View style={styles.galleryRow}>
              <GalleryPlaceholder />
              <GalleryPlaceholder />
              <TouchableOpacity style={styles.galleryAddCard}>
                <MaterialIcons name="add" size={28} color={colors.accent.sky} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={globalStyles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Upload PVA Result</Text>
            </View>
            {pvaFile ? (
              <View style={styles.pvaFileRow}>
                <MaterialIcons name="picture-as-pdf" size={25} color={colors.accent.sky} />
                <Text style={styles.pvaFileName} numberOfLines={1}>
                  {pvaFile.fileName}
                </Text>
                <TouchableOpacity onPress={handlePreviewPva} disabled={openingPva}>
                  {openingPva ? (
                    <ActivityIndicator size="large" color={colors.accent.sky} />
                  ) : (
                    <Text style={styles.linkText}>Preview</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeletePva}
                  disabled={deletingPva}
                  style={styles.pvaDeleteButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {deletingPva ? (
                    <ActivityIndicator size="large" color={colors.status.error} />
                  ) : (
                    <MaterialIcons name="delete-outline" size={22} color={colors.status.error} />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.galleryRow}>
                <TouchableOpacity
                  style={styles.galleryAddCard}
                  onPress={handleUploadPVAprofile}
                  disabled={uploadingPva}
                >
                  {uploadingPva ? (
                    <ActivityIndicator color={colors.accent.sky} />
                  ) : (
                    <MaterialIcons name="add" size={28} color={colors.accent.sky} />
                  )}
                </TouchableOpacity>
              </View>
            )}
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
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const BANNER_HEIGHT = 160;
const AVATAR_SIZE = 110;

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 120,
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
    marginBottom: spacing.xl,
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
    textAlignVertical: "top",
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
  pvaFileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pvaFileName: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  pvaDeleteButton: {
    marginLeft: 4,
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: colors.status.error, marginLeft: 10 },
  floatingButtons: {
    position: "absolute",
    right: 16,
    paddingTop: 2,
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

  avatarEditBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent.skyDark,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.text.inverse,
  },
  identityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
