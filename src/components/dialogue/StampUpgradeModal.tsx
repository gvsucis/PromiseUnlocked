import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import StampBadge from "../stamps/StampBadge";
import { colors } from "../../styles/global";
import { TIER_CONFIG, DEFAULT_TIER } from "../../config/stampConstants";

interface StampUpgradeModalProps {
  visible: boolean;
  stampName: string;
  previousTier: number;
  newTier: number;
  region: string;
  onContinue: () => void;
  onViewStamp: () => void;
}

export function StampUpgradeModal({
  visible,
  stampName,
  previousTier,
  newTier,
  region,
  onContinue,
  onViewStamp,
}: Readonly<StampUpgradeModalProps>) {
  const prevCfg =
    TIER_CONFIG[previousTier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG[DEFAULT_TIER];
  const newCfg = TIER_CONFIG[newTier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG[DEFAULT_TIER];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onContinue}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <MaterialIcons
                name="trending-up"
                size={48}
                color={colors.accent.coral}
                style={styles.upgradeIcon}
              />
              <Text style={styles.title}>Tier Up!</Text>

              <View style={styles.stampContainer}>
                <StampBadge stampName={stampName} tier={newTier} size="detail" />
              </View>

              <View style={styles.tierTransitionRow}>
                <View style={[styles.tierBadge, { backgroundColor: prevCfg.color, opacity: 0.6 }]}>
                  <Text style={styles.tierText}>{prevCfg.label}</Text>
                </View>
                <MaterialIcons
                  name="arrow-forward"
                  size={20}
                  color={colors.text.muted}
                  style={styles.transitionArrow}
                />
                <View style={[styles.tierBadge, { backgroundColor: newCfg.color }]}>
                  <Text style={styles.tierText}>{newCfg.label}</Text>
                </View>
              </View>

              <Text style={styles.subtitle}>Your stamp leveled up!</Text>
              <Text style={styles.regionLabel}>{region}</Text>

              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonOutline]}
                  onPress={onViewStamp}
                >
                  <MaterialIcons name="stars" size={18} color={colors.accent.skyDark} />
                  <Text style={styles.buttonOutlineText}>View Stamp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={onContinue}
                >
                  <MaterialIcons name="arrow-forward" size={18} color={colors.text.inverse} />
                  <Text style={styles.buttonPrimaryText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 24,
    padding: 32,
    width: "85%",
    maxWidth: 380,
    alignItems: "center",
  },
  upgradeIcon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.accent.coral,
    marginBottom: 20,
    textAlign: "center",
  },
  stampContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  tierTransitionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  transitionArrow: {
    marginHorizontal: 2,
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 4,
  },
  regionLabel: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: "center",
    marginBottom: 24,
    fontStyle: "italic",
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.accent.skyDark,
  },
  buttonPrimary: {
    backgroundColor: colors.accent.sky,
  },
  buttonOutlineText: {
    color: colors.accent.skyDark,
    fontSize: 14,
    fontWeight: "600",
  },
  buttonPrimaryText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: "600",
  },
});
