import React, { useCallback, useMemo, useRef, useState } from "react";
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
  Modal,
  Pressable,
  Animated,
  Linking,
} from "react-native";
// Snackbar replaced by custom toast
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { colors, typography, spacing, radius, globalStyles } from "../styles/global";
import { useSafeAreaInsets } from "react-native-safe-area-context";
type ProfileNav = StackNavigationProp<RootStackParamList, "Profile">;
import {
  fetchProfile,
  updateProfile,
  uploadProfilePicture,
  selectPva,
  buildLocalProfile,
  type UserProfile,
} from "../services/profileService";
import { listPvaCatalog, type PvaCatalogItem } from "../services/profileEmbeddingService";
import { ImagePickerService } from "../services/imagePickerService";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import {
  listArtifacts,
  uploadArtifact,
  deleteArtifact,
  type ArtifactItem,
  type ArtifactKind,
} from "../services/artifactService";
import * as DocumentPicker from "expo-document-picker";
import ArtifactPreviewModal from "../components/ArtifactPreviewModal";
import { SegmentedArc } from "@shipt/segmented-arc-for-react-native";

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

function FileTypeIcon({
  contentType,
  size = 28,
}: Readonly<{ contentType: string; size?: number }>) {
  let icon: keyof typeof MaterialIcons.glyphMap = "description";
  if (contentType.includes("pdf")) icon = "picture-as-pdf";
  else if (contentType.includes("wordprocessingml") || contentType.includes("msword"))
    icon = "article";
  else if (contentType.includes("text")) icon = "text-snippet";
  return <MaterialIcons name={icon} size={size} color={colors.accent.sky} />;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savingBio, setSavingBio] = useState(false);

  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [pvaCatalog, setPvaCatalog] = useState<PvaCatalogItem[]>([]);
  const [pvaModalVisible, setPvaModalVisible] = useState(false);
  const [selectingPva, setSelectingPva] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [uploadingArtifact, setUploadingArtifact] = useState(false);
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactItem | null>(null);
  const [processingCount, setProcessingCount] = useState(0);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (toast) {
      Animated.spring(toastAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
      const timer = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, toastAnim]);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  useFocusEffect(
    useCallback(() => {
      listPvaCatalog()
        .then(setPvaCatalog)
        .catch(() => undefined);
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      listArtifacts()
        .then(setArtifacts)
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
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        onPress: () => void signOut(auth).then(() => navigation.replace("Welcome")),
      },
    ]);
  };

  const displayName = useMemo(() => {
    return profile?.fullName || profile?.displayName || "Your Name";
  }, [profile]);

  const highSchool = useMemo(() => {
    return profile?.schoolName?.trim();
  }, [profile]);

  const selectedPvaName = useMemo(
    () => pvaCatalog.find((p) => p.id === profile?.selectedPvaId)?.name ?? null,
    [pvaCatalog, profile?.selectedPvaId]
  );

  const filteredCatalog = useMemo(
    () =>
      searchQuery.trim()
        ? pvaCatalog.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : pvaCatalog,
    [pvaCatalog, searchQuery]
  );

  const handleSaveBio = async () => {
    if (!profile) return;
    setSavingBio(true);
    try {
      const result = await updateProfile({ metadata: { ...profile.metadata, bio } });
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
  const handleSelectPva = async (item: PvaCatalogItem) => {
    if (selectingPva) return;
    if (item.embeddingStatus !== "ready") return;

    const isSelected = item.id === profile?.selectedPvaId;

    setPvaModalVisible(false);
    setSelectingPva(true);
    try {
      if (isSelected) {
        await selectPva(null);
        setProfile((prev) => (prev ? { ...prev, selectedPvaId: null } : prev));
      } else {
        await selectPva(item.id);
        setProfile((prev) => (prev ? { ...prev, selectedPvaId: item.id } : prev));
      }
    } catch (error) {
      console.warn("Failed to select PVA:", error);
      Alert.alert("Couldn't select", "We couldn't set that profile. Please try again.");
    } finally {
      setSelectingPva(false);
    }
  };

  const handlePhotoSelection = async (useCamera: boolean) => {
    const hasPermissions = await ImagePickerService.requestPermissions();
    if (!hasPermissions) {
      Alert.alert("Permissions Required", "Camera and photo library permissions are required.");
      return;
    }

    const result = useCamera
      ? await ImagePickerService.takePhotoWithCamera(true, [1, 1])
      : await ImagePickerService.pickImageFromGalleryWithOptions(true, [1, 1]);

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
    { label: "Upload Photos", complete: !!profile?.photoURL },
    { label: "Complete Background Info", complete: false },
    { label: "Full Name", complete: displayName !== "Your Name" },
  ];

  const progressPercent = Math.round(
    (checklist.filter((i) => i.complete).length / checklist.length) * 100
  );

  const arcSegments = checklist.map((item) => ({
    scale: 1 / checklist.length,
    filledColor: colors.accent.sky,
    emptyColor: colors.background.tinted,
    data: {
      label: item.label,
      complete: item.complete,
    },
  }));

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ],
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      if (asset.size && asset.size > MAX_FILE_SIZE) {
        Alert.alert(
          "File Too Large",
          `Selected file is ${(asset.size / (1024 * 1024)).toFixed(2)} MB. Maximum allowed is 5 MB.`
        );
        return;
      }

      startUpload(asset, "other");
    } catch (err) {
      Alert.alert("Error", "Failed to select document.");
      console.error(err);
    }
  };

  const startUpload = async (
    file: { uri: string; name: string; size?: number | null },
    kind: ArtifactKind
  ) => {
    setUploadingArtifact(true);
    try {
      const result = await uploadArtifact(file.uri, file.name ?? "document", kind);
      if (!result.success) {
        Alert.alert("Upload Failed", result.error ?? "Could not upload document.");
        return;
      }
      const updated = await listArtifacts();
      setArtifacts(updated);
      const processing = updated.filter((a) => a.embeddingsStatus === "processing").length;
      setProcessingCount(processing);
      if (processing === 0) return;

      if (pollTimer.current) clearInterval(pollTimer.current);
      let attempts = 0;
      const maxAttempts = 30;
      let prevProcessingIds = new Set(
        updated.filter((a) => a.embeddingsStatus === "processing").map((a) => a.id)
      );

      pollTimer.current = setInterval(async () => {
        attempts++;
        try {
          const fresh = await listArtifacts();
          setArtifacts(fresh);
          const nowProcessingIds = new Set(
            fresh.filter((a) => a.embeddingsStatus === "processing").map((a) => a.id)
          );
          setProcessingCount(nowProcessingIds.size);

          const justReady = fresh.filter(
            (a) => a.embeddingsStatus === "ready" && prevProcessingIds.has(a.id)
          );
          if (justReady.length > 0) {
            clearInterval(pollTimer.current!);
            pollTimer.current = null;
            setToast({ message: "Document is ready to review." });
            return;
          }
          prevProcessingIds = nowProcessingIds;
          if (nowProcessingIds.size === 0 || attempts >= maxAttempts) {
            clearInterval(pollTimer.current!);
            pollTimer.current = null;
          }
        } catch {
          if (attempts >= maxAttempts) {
            clearInterval(pollTimer.current!);
            pollTimer.current = null;
          }
        }
      }, 5000);
    } catch (err) {
      Alert.alert("Upload Failed", "An unexpected error occurred.");
      console.error(err);
    } finally {
      setUploadingArtifact(false);
    }
  };

  const handleDeleteArtifact = (id: string, name: string) => {
    Alert.alert("Delete Document", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => runDelete(id, name),
      },
    ]);
  };

  const runDelete = async (id: string, name: string) => {
    const ok = await deleteArtifact(id);
    if (ok) {
      setArtifacts((prev) => prev.filter((a) => a.id !== id));
    } else {
      Alert.alert("Delete Failed", "Could not delete document.", [
        { text: "Cancel", style: "cancel" },
        { text: "Retry", onPress: () => runDelete(id, name) },
      ]);
    }
  };

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
              <MaterialIcons name="logout" size={24} color={colors.background.card} />
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
                    resizeMode="cover"
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
              <TouchableOpacity
                onPress={() => {
                  const pageUrl = profile?.pageUrl ?? "";
                  void Linking.openURL(pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`);
                }}
                style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}
              >
                <Ionicons
                  name="link-outline"
                  size={14}
                  color={colors.accent.sky}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.meta, { color: colors.accent.sky }]}>Portfolio</Text>
              </TouchableOpacity>
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
              {uploadingArtifact && <ActivityIndicator size="small" color={colors.accent.sky} />}
            </View>
            {processingCount > 0 && (
              <Text style={styles.processingHint}>
                We're reviewing your document{processingCount > 1 ? "s" : ""}. This may take a
                minute.
              </Text>
            )}
            {artifacts.length === 0 && (
              <Text style={styles.artifactEmpty}>
                Upload essays, citations, or transcripts to build your experience profile.
              </Text>
            )}
            <View style={styles.artifactGrid}>
              {artifacts.map((item) => (
                <View key={item.id} style={styles.artifactCard}>
                  <TouchableOpacity
                    style={styles.artifactCardPreview}
                    onPress={() => setPreviewArtifact(item)}
                  >
                    <FileTypeIcon contentType={item.contentType} />
                    {item.embeddingsStatus === "ready" && (
                      <MaterialIcons
                        name="check-circle"
                        size={14}
                        color={colors.status.success}
                        style={styles.artifactCardBadge}
                      />
                    )}
                    {item.embeddingsStatus === "processing" && (
                      <ActivityIndicator
                        size="small"
                        color={colors.accent.sky}
                        style={styles.artifactCardBadge}
                      />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.artifactCardRemove}
                    onPress={() => handleDeleteArtifact(item.id, item.fileName)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                  <Text style={styles.artifactCardName} numberOfLines={2}>
                    {item.fileName}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.artifactCard}
                onPress={handleSelectFile}
                disabled={uploadingArtifact}
                activeOpacity={0.6}
              >
                <View style={styles.artifactCardAdd}>
                  <MaterialIcons name="add" size={28} color={colors.accent.sky} />
                </View>
                <Text style={styles.artifactCardName}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={globalStyles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Personality Profile (PVA)</Text>
            </View>
            <Text style={styles.pvaHelp}>
              Pick the profile that best matches you — it personalizes your conversation.
            </Text>
            <TouchableOpacity
              style={styles.pvaSelectField}
              onPress={() => {
                setSearchQuery("");
                setPvaModalVisible(true);
              }}
              disabled={selectingPva}
            >
              <Text style={styles.pvaSelectText} numberOfLines={1}>
                {selectedPvaName ?? (profile?.selectedPvaId ? "Loading…" : "Choose a profile…")}
              </Text>
              {selectingPva ? (
                <ActivityIndicator size="small" color={colors.accent.sky} />
              ) : (
                <MaterialIcons
                  name={pvaModalVisible ? "expand-less" : "expand-more"}
                  size={24}
                  color={colors.accent.sky}
                />
              )}
            </TouchableOpacity>

            <Modal
              visible={pvaModalVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setPvaModalVisible(false)}
            >
              <Pressable style={styles.sheetOverlay} onPress={() => setPvaModalVisible(false)}>
                <Pressable style={styles.sheetContent} onPress={() => {}}>
                  <View style={styles.sheetHandleWrapper}>
                    <View style={styles.sheetHandle} />
                  </View>
                  <Text style={styles.sheetTitle}>Select Profile</Text>
                  <View style={styles.sheetSearchBar}>
                    <MaterialIcons name="search" size={18} color={colors.text.muted} />
                    <TextInput
                      style={styles.sheetSearchInput}
                      placeholder="Search profiles…"
                      placeholderTextColor={colors.text.muted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>
                  <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
                    {filteredCatalog.length === 0 ? (
                      <Text style={styles.pvaOptionEmpty}>
                        {searchQuery.trim()
                          ? "No profiles match your search."
                          : "No profiles available yet."}
                      </Text>
                    ) : (
                      filteredCatalog.map((item, idx) => {
                        const ready = item.embeddingStatus === "ready";
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.pvaOption,
                              item.id === profile?.selectedPvaId && styles.pvaOptionSelected,
                            ]}
                            onPress={() => handleSelectPva(item)}
                            disabled={!ready}
                          >
                            <View style={styles.pvaOptionIndex}>
                              <Text style={styles.pvaOptionIndexText}>{idx + 1}</Text>
                            </View>
                            <Text
                              style={[
                                styles.pvaOptionText,
                                item.id === profile?.selectedPvaId && styles.pvaOptionTextSelected,
                                !ready && styles.pvaOptionDisabled,
                              ]}
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            {item.embeddingStatus === "processing" ? (
                              <Text style={styles.pvaStatusProcessing}>Indexing…</Text>
                            ) : null}
                            {item.embeddingStatus === "failed" ? (
                              <Text style={styles.pvaStatusFailed}>Unavailable</Text>
                            ) : null}
                            <MaterialIcons
                              name={
                                item.id === profile?.selectedPvaId
                                  ? "radio-button-checked"
                                  : "radio-button-unchecked"
                              }
                              size={22}
                              color={
                                item.id === profile?.selectedPvaId
                                  ? colors.accent.sky
                                  : colors.text.muted
                              }
                            />
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>
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

            <View style={styles.arcContainer}>
              <SegmentedArc
                segments={arcSegments}
                fillValue={progressPercent}
                radius={95}
                filledArcWidth={12}
                emptyArcWidth={12}
                isAnimated
                animationDuration={900}
                spaceBetweenSegments={0}
                capInnerColor={colors.accent.teal}
              >
                {() => (
                  <View style={styles.arcCenter}>
                    <Text style={styles.progressPercent}>{progressPercent}%</Text>

                    <Text style={styles.arcSubtitle}>Complete</Text>
                  </View>
                )}
              </SegmentedArc>
            </View>

            <View style={styles.progressChecklist}>
              {checklist.map((item) => (
                <ChecklistItem key={item.label} {...item} />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            { transform: [{ translateY: toastAnim }], paddingTop: insets.top + 8 },
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
          <TouchableOpacity
            onPress={() => {
              setToast(null);
              const ready = artifacts.filter((a) => a.embeddingsStatus === "ready");
              if (ready.length > 0) setPreviewArtifact(ready[0]);
            }}
          >
            <Text style={styles.toastAction}>View</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      <ArtifactPreviewModal
        fileName={previewArtifact?.fileName ?? ""}
        previewUrl={previewArtifact?.previewUrl ?? ""}
        visible={!!previewArtifact}
        onClose={() => setPreviewArtifact(null)}
      />
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

  processingHint: {
    fontSize: 12,
    color: colors.accent.sky,
    fontStyle: "italic",
    marginBottom: 8,
  },
  artifactEmpty: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  artifactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  artifactCard: {
    width: 80,
    alignItems: "center",
    position: "relative",
  },
  artifactCardPreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.background.tinted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  artifactCardBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.background.card,
    borderRadius: 7,
  },
  artifactCardRemove: {
    position: "absolute",
    top: -8,
    right: -8,
    zIndex: 1,
  },
  artifactCardName: {
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 14,
  },
  artifactCardAdd: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.accent.sky,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.subtle,
  },
  pvaHelp: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    marginBottom: 10,
  },
  pvaSelectField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pvaSelectText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  pvaOptions: {
    marginTop: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: "hidden",
  },
  pvaOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  pvaOptionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  pvaOptionDisabled: {
    color: colors.text.muted,
  },
  pvaOptionEmpty: {
    padding: 12,
    fontSize: 13,
    color: colors.text.secondary,
  },
  pvaStatusProcessing: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  pvaStatusFailed: {
    fontSize: 12,
    color: colors.status.error,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetContent: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandleWrapper: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border.medium,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 12,
  },
  sheetSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 4,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  sheetList: {
    maxHeight: 360,
  },
  pvaOptionIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.subtle,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  pvaOptionIndexText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  pvaOptionSelected: {
    backgroundColor: colors.background.tinted,
  },
  pvaOptionTextSelected: {
    fontWeight: "700",
    color: colors.accent.sky,
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: colors.status.error, marginLeft: 10 },
  floatingButtons: {
    position: "absolute",
    right: 16,
    paddingTop: 0,
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

  toast: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent.teal,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.inverse,
    fontWeight: "500",
  },
  toastAction: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.inverse,
    marginLeft: 12,
  },
  arcContainer: {
    alignItems: "center",
    marginBottom: 20,
  },

  arcCenter: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  arcSubtitle: {
    marginTop: -6,
    fontSize: 13,
    color: colors.text.secondary,
  },
});
