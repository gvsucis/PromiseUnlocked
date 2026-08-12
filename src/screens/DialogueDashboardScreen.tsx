import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Text, Card } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { CATEGORY_TAXONOMY } from "../services/categoryTaxonomyService";
import { useDialogue } from "../context/DialogueProvider";
import { DialogueButton } from "../components/dialogue/DialogueButton";
import { useAuth } from "../context/AuthContext";
import { colors } from "../styles/global";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import StampBadge from "../components/stamps/StampBadge";

const HeaderActions: React.FC<{ onLogout: () => void }> = () => null;
const HEADER_HEIGHT = 130;

export default function DialogueDashboardScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "DialogueDashboard">>();
  const { session } = useAuth();
  const d = useDialogue();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    React.useCallback(() => {
      d.refreshData();
    }, [d.refreshData])
  );

  React.useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      headerRight: () => <HeaderActions onLogout={handleLogout} />,
    });
  }, [navigation, session.mode]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        onPress: () => void signOut(auth).then(() => navigation.replace("Login")),
      },
    ]);
  };

  const totalStampsUnlocked = React.useMemo(() => {
    let stamps = 0;
    for (const mc of d.mappedCategories) {
      stamps += Array.isArray(mc.unlockedStamps) ? mc.unlockedStamps.length : 0;
    }
    return stamps;
  }, [d.mappedCategories]);

  const upgradableStamp = React.useMemo(() => {
    const candidates: {
      stamp: { name: string; tier?: number };
      category: string;
      categoryId: string;
    }[] = [];
    for (const mc of d.mappedCategories) {
      for (const s of mc.unlockedStamps ?? []) {
        if ((s.tier ?? 1) <= 2)
          candidates.push({ stamp: s, category: mc.category, categoryId: mc.categoryId });
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Date.now() / 60000) % candidates.length];
  }, [d.mappedCategories]);

  const unexploredRegions = React.useMemo(() => {
    const exploredSet = new Set(
      d.mappedCategories
        .filter((mc) => (mc.unlockedStamps?.length ?? 0) > 0)
        .map((mc) => mc.category)
    );
    return CATEGORY_TAXONOMY.filter((cat) => !exploredSet.has(cat.category))
      .sort((a, b) => a.category.localeCompare(b.category))
      .slice(0, 3);
  }, [d.mappedCategories]);

  if (d.loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your journey...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBarBackground, { height: insets.top }]} />

      <View style={{ flex: 1, paddingTop: insets.top }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.floatingButtons} pointerEvents="box-none">
            <TouchableOpacity onPress={handleLogout} style={styles.floatingButton}>
              <MaterialIcons name="logout" size={24} color={colors.text.inverse} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerContainer}>
            <View style={styles.headerClip}>
              <View style={styles.headerCircle} />
              <Text style={styles.headerTitle}>My Dashboard</Text>
            </View>
          </View>

          <Card style={styles.nextStepsCard}>
            <Card.Content>
              <View style={styles.progressHeader}>
                <MaterialIcons name="trending-up" size={24} color={colors.accent.sky} />
                <Text style={styles.nextStepsTitle}>Chat to Unlock Stamps</Text>
              </View>
              <DialogueButton variant="dashboard" />
            </Card.Content>
          </Card>

          {upgradableStamp && (
            <Card style={styles.nextStepsCard}>
              <Card.Content>
                <View style={styles.nextStepsHeader}>
                  <MaterialIcons name="auto-awesome" size={20} color={colors.accent.sky} />
                  <Text style={styles.nextStepsTitle}>Add More Detail</Text>
                </View>
                <View style={styles.stampUpgradeBody}>
                  <View style={styles.stampUpgradeBadgeContainer}>
                    <StampBadge
                      stampName={upgradableStamp.stamp.name}
                      tier={upgradableStamp.stamp.tier ?? 1}
                      size="detail"
                    />
                  </View>
                  <Text style={styles.stampUpgradeName}>{upgradableStamp.stamp.name}</Text>
                  <Text style={styles.stampUpgradeRegion}>{upgradableStamp.category}</Text>
                  <TouchableOpacity
                    style={styles.stampUpgradeButton}
                    onPress={() =>
                      navigation.navigate("StampDetails", {
                        stamp: upgradableStamp.stamp.name,
                        region: upgradableStamp.category,
                        categoryId: upgradableStamp.categoryId,
                      })
                    }
                  >
                    <Text style={styles.stampUpgradeButtonText}>View Stamp</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>
          )}

          {unexploredRegions.length > 0 && (
            <Card style={styles.nextStepsCard}>
              <Card.Content>
                <View style={styles.nextStepsHeader}>
                  <MaterialIcons name="explore" size={20} color={colors.accent.sky} />
                  <Text style={styles.nextStepsTitle}>Explore New Regions</Text>
                </View>
                {unexploredRegions.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.nextStepsRow}
                    onPress={() =>
                      navigation.navigate("Stamps", { region: cat.category, categoryId: cat.id })
                    }
                  >
                    <View style={styles.nextStepsRowLeft}>
                      <MaterialIcons
                        name={
                          (cat.icon as React.ComponentProps<typeof MaterialIcons>["name"]) ??
                          "place"
                        }
                        size={20}
                        color={colors.accent.sky}
                      />
                      <Text style={styles.nextStepsRowTitle}>{cat.category}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
                  </TouchableOpacity>
                ))}
              </Card.Content>
            </Card>
          )}

          {(() => {
            const next = [
              { label: "Collect your first stamp", target: 1 },
              { label: "Collect 5 stamps", target: 5 },
              { label: "Collect 10 stamps", target: 10 },
            ].find(({ target }) => totalStampsUnlocked < target);
            if (!next) return null;
            return (
              <Card style={styles.nextStepsCard}>
                <Card.Content>
                  <View style={styles.nextStepsHeader}>
                    <MaterialIcons name="military-tech" size={20} color={colors.accent.sky} />
                    <Text style={styles.nextStepsTitle}>Next Milestone</Text>
                  </View>
                  <View style={styles.stampUpgradeBody}>
                    <View style={styles.stampUpgradePlaceholder}>
                      <Text style={styles.milestoneBubbleText}>{next.target}</Text>
                    </View>
                    <Text style={styles.stampUpgradeName}>{next.label}</Text>
                    <Text style={styles.stampUpgradeRegion}>
                      {totalStampsUnlocked} / {next.target} stamps
                    </Text>
                    <DialogueButton variant="dashboard" />
                  </View>
                </Card.Content>
              </Card>
            );
          })()}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", marginRight: 8 },
  headerActionButton: { marginLeft: 12 },

  container: {
    flex: 1,
    backgroundColor: colors.background.subtle,
  },

  topBarBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.brand.primary,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tinted,
  },

  loadingText: { marginTop: 15, fontSize: 16, color: colors.text.accent },
  scrollView: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    backgroundColor: colors.background.subtle,
  },

  headerContainer: {
    marginHorizontal: -20,
    alignItems: "center",
    marginBottom: 72,
  },

  headerClip: {
    width: "100%",
    height: HEADER_HEIGHT,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  headerCircle: {
    width: 900,
    height: 900,
    borderRadius: 450,
    backgroundColor: colors.brand.primary,
    position: "absolute",
    top: -900 + HEADER_HEIGHT,
  },

  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.inverse,
  },

  stampUpgradeBadgeContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  subtitle: { fontSize: 16, color: colors.text.secondary, marginTop: 5 },
  progressCard: { marginBottom: 20, elevation: 4 },
  progressHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 15 },
  statsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  statBox: { alignItems: "center" },
  statNumber: { fontSize: 32, fontWeight: "bold", color: colors.brand.primary },
  statLabel: { fontSize: 12, color: "#666", marginTop: 5 },
  progressBar: { height: 10, backgroundColor: "#E0E0E0", borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.brand.primary },
  floatingButtons: { position: "absolute", right: 16, flexDirection: "row", gap: 8, zIndex: 10 },
  floatingButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  nextStepsCard: {
    marginBottom: 20,
    elevation: 4,
    backgroundColor: colors.background.card,
  },

  nextStepsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  nextStepsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },

  nextStepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border.accent,
  },

  nextStepsRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  nextStepsRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },

  milestoneBubbleText: {
    color: colors.accent.magenta,
    fontSize: 32,
    fontWeight: "800",
  },

  stampUpgradeBody: {
    alignItems: "center",
    paddingVertical: 12,
  },

  stampUpgradePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent.yellow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  stampUpgradeName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 4,
  },

  stampUpgradeRegion: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 14,
  },

  stampUpgradeButton: {
    backgroundColor: colors.accent.teal,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 10,
  },

  stampUpgradeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
