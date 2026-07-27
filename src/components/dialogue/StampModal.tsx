import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import StampBadge from "../stamps/StampBadge";
import { colors } from "../../styles/global";
import { TIER_CONFIG, DEFAULT_TIER } from "../../config/stampConstants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface BaseStampModalProps {
  visible: boolean;
  stampName: string;
  region: string;
  showConfetti?: boolean;
  onContinue: () => void;
  onViewStamp: () => void;
}

type StampModalVariant =
  | { variant: "unlock"; tier?: number; sensitive?: boolean }
  | { variant: "upgrade"; previousTier: number; newTier: number };

type StampModalProps = BaseStampModalProps & StampModalVariant;

export function StampModal(props: StampModalProps) {
  const { visible, stampName, region, showConfetti = false, onContinue, onViewStamp } = props;

  const isUpgrade = props.variant === "upgrade";
  const unlockProps = !isUpgrade
    ? (props as BaseStampModalProps & { variant: "unlock"; tier?: number; sensitive?: boolean })
    : null;
  const isSensitive = unlockProps?.sensitive ?? false;

  const iconName = isUpgrade ? "trending-up" : "celebration";
  const iconColor = isUpgrade ? colors.accent.coral : colors.accent.yellow;
  const titleText = isUpgrade
    ? "Tier Up!"
    : isSensitive
      ? "We unlocked a new stamp."
      : "Congratulations!";
  const subtitleText = isUpgrade
    ? "Your stamp leveled up!"
    : isSensitive
      ? "We've added a new experience to your profile."
      : "You unlocked a new stamp!";

  const tier = isUpgrade ? props.newTier : (props.tier ?? DEFAULT_TIER);
  const tierCfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG[DEFAULT_TIER];
  const prevCfg = isUpgrade
    ? (TIER_CONFIG[props.previousTier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG[DEFAULT_TIER])
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={onContinue}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.card}>
                <MaterialIcons name={iconName} size={48} color={iconColor} style={styles.icon} />
                <Text style={[styles.title, isUpgrade && styles.titleUpgrade]}>{titleText}</Text>

                <View style={styles.stampContainer}>
                  <StampBadge stampName={stampName} tier={tier} size="detail" />
                </View>

                {isUpgrade ? (
                  <View style={styles.tierTransitionRow}>
                    <View
                      style={[styles.tierBadge, { backgroundColor: prevCfg!.color, opacity: 0.6 }]}
                    >
                      <Text style={styles.tierText}>{prevCfg!.label}</Text>
                    </View>
                    <MaterialIcons
                      name="arrow-forward"
                      size={20}
                      color={colors.text.muted}
                      style={styles.transitionArrow}
                    />
                    <View style={[styles.tierBadge, { backgroundColor: tierCfg.color }]}>
                      <Text style={styles.tierText}>{tierCfg.label}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.tierBadge, { backgroundColor: tierCfg.color }]}>
                    <Text style={styles.tierText}>{tierCfg.label}</Text>
                  </View>
                )}

                <Text style={styles.subtitle}>{subtitleText}</Text>
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

        {showConfetti && (
          <ConfettiCannon
            count={200}
            origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
            autoStart={true}
            fadeOut={true}
            fallSpeed={3000}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
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
  icon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.accent.yellow,
    marginBottom: 20,
    textAlign: "center",
  },
  titleUpgrade: {
    color: colors.accent.coral,
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
    marginBottom: 12,
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
