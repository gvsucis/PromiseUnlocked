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
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { CommonActions, useFocusEffect, useNavigation } from "@react-navigation/native";
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
import { useDialogue } from "../context/DialogueProvider";

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

function StatPill({
  value,
  label,
  onPress,
  disabled,
  rightAdornment,
}: Readonly<{
  value: string | number;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  rightAdornment?: React.ReactNode;
}>) {
  const content = (
    <View style={styles.statPill}>
      <Text style={styles.statPillValue}>{value}</Text>
      <Text style={styles.statPillLabel} numberOfLines={2}>
        {label}
        {rightAdornment ? " " : null}
        {rightAdornment}
      </Text>
    </View>
  );
  if (!onPress) return <View style={styles.statPillTouchWrap}>{content}</View>;
  return (
    <TouchableOpacity
      style={styles.statPillTouchWrap}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {content}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const d = useDialogue();
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

  const navigation = useNavigation<ProfileNav>();
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  // Tracks the last-saved bio so we know whether there's anything to discard.
  const originalBioRef = useRef("");
  // Mirrors "editingBio && bio !== originalBioRef.current" into a ref so
  // navigation listeners (which close over stale state otherwise) can read
  // the latest value.
  const hasUnsavedBioRef = useRef(false);
  React.useEffect(() => {
    hasUnsavedBioRef.current = editingBio && bio !== originalBioRef.current;
  }, [editingBio, bio]);

  const { totalStampsUnlocked, totalXp } = useMemo(() => {
    let stamps = 0;
    let xp = 0;
    for (const mc of d.mappedCategories) {
      const list = mc.unlockedStamps;
      const count = Array.isArray(list) ? list.length : 0;
      stamps += count;
      if (Array.isArray(list)) {
        for (const st of list) {
          xp += (st.tier ?? 1) * 5;
        }
      }
    }
    return { totalStampsUnlocked: stamps, totalXp: xp };
  }, [d.mappedCategories]);

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
          const nextBio = typeof bioValue === "string" ? bioValue : "";
          setBio(nextBio);
          originalBioRef.current = nextBio;
        })
        .catch((error) => {
          console.warn(
            "Failed to fetch profile from backend, falling back to local auth data:",
            error
          );
          setProfile(buildLocalProfile());
          setBio("");
          originalBioRef.current = "";
        })
        .finally(() => undefined);
    }, [])
  );

  // Warn before this screen is removed from its stack (sign out, back nav,
  // etc.) if there's an unsaved bio edit sitting around.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!hasUnsavedBioRef.current) return;
      e.preventDefault();
      Alert.alert("Discard changes?", "Your bio changes haven't been saved yet.", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setBio(originalBioRef.current);
            setEditingBio(false);
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation]);

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
      originalBioRef.current = bio;
      setEditingBio(false);
    } catch (error) {
      console.warn("[ProfileScreen] Failed to update profile:", error);
      Alert.alert("Couldn't save", "We couldn't save your bio. Please try again.");
    } finally {
      setSavingBio(false);
    }
  };

  const handleDiscardBio = () => {
    setBio(originalBioRef.current);
    setEditingBio(false);
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

  const hasEarnedStamp = useMemo(
    () => d.mappedCategories.some((mc) => (mc.unlockedStamps?.length ?? 0) > 0),
    [d.mappedCategories]
  );

  const hasDemographics = Boolean(
    (profile?.metadata as Record<string, unknown> | undefined)?.demographicsComplete
  );

  const checklist = [
    { label: "About Me", complete: bio.trim().length > 0 },
    { label: "Photo", complete: !!profile?.photoURL },
    { label: "Full Name", complete: displayName !== "Your Name" },
    { label: "Personal Info", complete: hasDemographics },
    { label: "First Stamp", complete: hasEarnedStamp },
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
          </TouchableOpacity>

          <View style={styles.statsPillRow}>
            <StatPill
              value="✈️"
              label={selectedPvaName ?? "Select Your PVA"}
              onPress={() => {
                setSearchQuery("");
                setPvaModalVisible(true);
              }}
              disabled={selectingPva}
              rightAdornment={
                selectingPva ? (
                  <ActivityIndicator size="small" color={colors.accent.sky} />
                ) : (
                  <MaterialIcons
                    name="keyboard-arrow-down"
                    size={18}
                    color={colors.text.secondary}
                  />
                )
              }
            />

            <StatPill
              value={totalStampsUnlocked}
              label="Stamps"
              onPress={() => navigation.navigate("Passport")}
            />
            <StatPill value={totalXp} label="XP" />
          </View>

          <View style={styles.tileGrid}>
            <TouchableOpacity
              activeOpacity={editingBio ? 1 : 0.75}
              style={[
                styles.tile,
                styles.tileFull,
                styles.bioTile,
                editingBio && styles.bioTileActive,
              ]}
              onPress={() => {
                if (editingBio) return;
                originalBioRef.current = bio;
                setEditingBio(true);
              }}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>About Me</Text>
                {editingBio ? (
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <TouchableOpacity onPress={handleDiscardBio} disabled={savingBio}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void handleSaveBio()} disabled={savingBio}>
                      {savingBio ? (
                        <ActivityIndicator size="small" color={colors.accent.sky} />
                      ) : (
                        <Text style={styles.linkText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.linkText}>Edit</Text>
                )}
              </View>
              {editingBio ? (
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  style={styles.bioInput}
                  multiline
                  autoFocus
                  placeholder="Share your goals, interests, and what makes you, you."
                  placeholderTextColor={colors.text.muted}
                />
              ) : (
                <Text style={bio ? styles.bio : styles.bioPlaceholder}>
                  {bio || "Tap to add a short bio about your goals and interests."}
                </Text>
              )}
            </TouchableOpacity>

            <View style={globalStyles.card}>
              <View style={[globalStyles.row, { marginBottom: 14 }]}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text style={styles.cardTitle}>Start Your Journey</Text>
                  <Text style={styles.cardSubtitle}>
                    Complete your basic profile to earn XP points.
                  </Text>
                </View>

                <Text style={styles.progressPercent}>+ 20 XP</Text>
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

              <View style={styles.journeyChips}>
                {checklist.map((item) => (
                  <View
                    key={item.label}
                    style={[styles.journeyChip, item.complete && styles.journeyChipComplete]}
                  >
                    <MaterialIcons
                      name={item.complete ? "check-circle" : "radio-button-unchecked"}
                      size={14}
                      color={item.complete ? colors.status.success : colors.text.muted}
                    />
                    <Text
                      style={[
                        styles.journeyChipText,
                        item.complete && styles.journeyChipTextComplete,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.tile, styles.tileFull]}>
              <View style={[styles.sectionHeader, { alignItems: "flex-start" }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.cardTitle}>Uploads</Text>
                  <Text style={styles.cardSubtitle}>
                    Upload your essays, transcripts, or any document — we'll personalize your
                    questions to your experiences.
                  </Text>
                </View>
                {uploadingArtifact && <ActivityIndicator size="small" color={colors.accent.sky} />}
              </View>

              {processingCount > 0 && (
                <Text style={styles.processingHint}>
                  Reviewing your document{processingCount > 1 ? "s" : ""} — this may take a minute.
                </Text>
              )}
              {artifacts.length === 0 && (
                <Text style={styles.artifactEmpty}>
                  No documents yet. Tap "Add" to get started.
                </Text>
              )}

              <View style={styles.artifactGrid}>
                {artifacts.map((item) => {
                  const isProcessing = item.embeddingsStatus === "processing";
                  return (
                    <View key={item.id} style={styles.artifactCard}>
                      <TouchableOpacity
                        style={[
                          styles.artifactCardPreview,
                          isProcessing && styles.artifactCardPreviewPending,
                        ]}
                        onPress={() => setPreviewArtifact(item)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color={colors.text.muted} />
                        ) : (
                          <FileTypeIcon contentType={item.contentType} />
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
                  );
                })}
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

            {(() => {
              const address = (profile as any)?.address as
                | {
                    street?: string;
                    city?: string;
                    state?: string;
                    postalCode?: string;
                    country?: string;
                  }
                | undefined;

              const formatDob = (dobStr?: string | null) => {
                if (!dobStr) return null;
                const date = new Date(dobStr + "T00:00:00");
                if (Number.isNaN(date.getTime())) return null;
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              };

              const formatLabel = (value?: string | null) =>
                value
                  ? value
                      .split("-")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")
                  : null;

              const cityState = [address?.city, address?.state].filter(Boolean).join(", ");

              const rows: { label: string; value: string | null }[] = [
                { label: "Date of Birth", value: formatDob((profile as any)?.dateOfBirth) },
                { label: "Gender", value: formatLabel((profile as any)?.gender) },
                { label: "Ethnicity", value: formatLabel((profile as any)?.ethnicity) },
                { label: "Phone", value: (profile as any)?.phone || null },
                { label: "Location", value: cityState || null },
              ];

              return (
                <View style={[styles.tile, styles.tileFull, styles.demoTile]}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.cardTitle}>Demographic Info</Text>
                    {!hasDemographics && (
                      <View style={styles.ctaTileBadgeInline}>
                        <Text style={styles.ctaTileBadgeInlineText}>+ 10 XP</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.demoRows}>
                    {rows.map((row) => (
                      <View key={row.label} style={styles.demoRow}>
                        <Text style={styles.demoRowLabel}>{row.label}</Text>
                        <Text style={row.value ? styles.demoRowValue : styles.demoRowValueEmpty}>
                          {row.value ?? "Not provided"}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.demoEditButton}
                    onPress={() => navigation.navigate("EditProfile")}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons
                      name={hasDemographics ? "edit" : "add"}
                      size={16}
                      color={colors.accent.sky}
                    />
                    <Text style={styles.demoEditButtonText}>
                      {hasDemographics ? "Edit Info" : "Add Info"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>

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

const BANNER_HEIGHT = 130;
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
    marginBottom: spacing.lg,
  },
  studentName: { ...typography.screenTitle, fontSize: 20 },
  meta: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },

  cardTitle: { ...typography.cardTitle },
  cardSubtitle: { fontSize: 13, color: colors.text.secondary, marginTop: 4, lineHeight: 18 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  linkText: { ...typography.link },
  cancelText: { ...typography.link, color: colors.text.muted },

  bio: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  bioPlaceholder: {
    fontSize: 14,
    color: colors.text.muted,
    lineHeight: 20,
    fontStyle: "italic",
  },
  bioInput: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: "top",
    padding: 0,
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
    marginBottom: 4,
  },
  artifactCard: {
    width: 80,
    alignItems: "center",
    position: "relative",
  },
  artifactCardPreviewPending: {
    backgroundColor: colors.background.subtle,
    opacity: 0.6,
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
  artifactCardBadgeLeft: {
    position: "absolute",
    top: -4,
    left: -4,
    backgroundColor: colors.background.card,
    borderRadius: 7,
  },
  artifactCardRemove: {
    position: "absolute",
    top: -4,
    right: -4,
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

  tileValue: {
    fontSize: 14,
    color: colors.text.primary,
    marginTop: 4,
    marginBottom: 8,
  },

  pvaOptionEmpty: {
    padding: 12,
    fontSize: 13,
    color: colors.text.secondary,
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

  statsPillRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: -10,
    marginBottom: spacing.md,
  },
  statPillTouchWrap: {},
  statPill: {
    flex: 1,
    width: 96,
    paddingVertical: 30,
    paddingHorizontal: 8,
    borderRadius: 50,
    backgroundColor: colors.background.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent.sky,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  statPillValue: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.accent.teal,
    marginTop: 6,
    marginBottom: 8,
  },
  statPillLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 4,
    maxWidth: "100%",
  },
  statPillLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: "center",
    flexShrink: 1,
  },

  // --- Journey / progress card (moved above the tile grid) ---
  journeyCard: {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg ?? 20,
    padding: 16,
    marginBottom: spacing.md,
    shadowColor: colors.accent.sky,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  journeyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  journeyTitle: {
    ...typography.cardTitle,
  },
  journeySubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  journeyArcWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  arcCenterSmall: {
    alignItems: "center",
    justifyContent: "center",
  },
  journeyPercent: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.accent.sky,
  },
  journeyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  journeyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  journeyChipComplete: {
    backgroundColor: colors.background.tinted,
    borderColor: colors.status.success,
  },
  journeyChipText: {
    fontSize: 12,
    color: colors.text.muted,
    fontWeight: "500",
  },
  journeyChipTextComplete: {
    color: colors.text.primary,
    fontWeight: "600",
  },

  // --- Tile grid ---
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg ?? 20,
    padding: 16,
    shadowColor: colors.accent.sky,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  tileFull: {
    width: "100%",
  },
  tileHalf: {
    flexBasis: "48%",
    flexGrow: 1,
  },

  bioTile: {
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  bioTileActive: {
    borderColor: colors.accent.sky,
  },

  ctaTile: {
    backgroundColor: colors.accent.sky,
    position: "relative",
    overflow: "hidden",
  },
  ctaTileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  ctaTileTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.inverse,
  },
  ctaTileSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    lineHeight: 16,
  },
  ctaTileBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  ctaTileBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text.inverse,
  },
  progressPercent: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.accent.sky,
  },

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

  arcContainer: {
    alignItems: "center",
    marginBottom: 20,
  },

  arcCenter: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },

  arcSubtitle: {
    marginTop: -6,
    fontSize: 13,
    color: colors.text.secondary,
  },
  demoTile: {},
  demoRows: {
    gap: 10,
    marginBottom: 16,
  },
  demoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  demoRowLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  demoRowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  demoRowValueEmpty: {
    fontSize: 14,
    color: colors.text.muted,
    fontStyle: "italic",
  },
  demoEditButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accent.sky,
    borderRadius: radius.md ?? 12,
    paddingVertical: 12,
  },
  demoEditButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accent.sky,
  },
  ctaTileBadgeInline: {
    backgroundColor: colors.background.tinted,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  ctaTileBadgeInlineText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent.sky,
  },
});
