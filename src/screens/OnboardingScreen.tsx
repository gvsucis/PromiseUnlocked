import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  Dimensions,
  PanResponder,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";

const { width } = Dimensions.get("window");

const RING = 80;
const BTN = 56;
const HALF = RING / 2;
const INSET = (RING - BTN) / 2;

type OnboardingNavigationProp = StackNavigationProp<RootStackParamList, "Onboarding">;

interface Props {
  navigation: OnboardingNavigationProp;
}

const SLIDES = [
  {
    icon: "fingerprint" as const,
    title: "Welcome",
    subtitle:
      "Your story is more than your school transcript. The Experience Passport helps you discover who you are, what drives you, and which pathways feel like yours.",
  },
  {
    icon: "explore" as const,
    title: "How it Works",
    subtitle:
      "You'll move through a short guided experience, part reflection, part exploration. An AI guide will ask you questions and help you connect the dots between your experiences, values, and goals.",
  },
  {
    icon: "psychology" as const,
    title: "Personalized to You",
    subtitle:
      "Your responses shape everything. The more you share, the more the passport reflects what's actually true about you not a version of yourself squeezed into a checkbox.",
  },
  {
    icon: "card-membership" as const,
    title: "What You'll Get",
    subtitle:
      "By the end, you'll have a clearer sense of what you're looking for in a college or beyond — and a record of your thinking you can build on.",
  },
  {
    icon: "rocket-launch" as const,
    title: "You're a Pilot",
    subtitle:
      "You're one of the first students to experience this. Your feedback matters. After you finish, you'll have a chance to tell us what landed — and what didn't.",
  },
];

export default function OnboardingScreen({ navigation }: Readonly<Props>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  // starts at 1/4 progress (first slide visible)
  const progressAnim = useRef(new Animated.Value(90)).current;

  // Right fill: rotates from -180° (hidden) to 0° (full right half)
  const rightRotation = progressAnim.interpolate({
    inputRange: [0, 90, 180, 270, 360],
    outputRange: ["-180deg", "-90deg", "0deg", "0deg", "0deg"],
  });

  // Left fill: rotates clockwise 180° → 270° → 360° (bottom-left first, then top-left)
  const leftRotation = progressAnim.interpolate({
    inputRange: [0, 90, 180, 270, 360],
    outputRange: ["180deg", "180deg", "180deg", "270deg", "360deg"],
  });

  const animateTransition = (nextIndex: number) => {
    const nextAngle = (nextIndex + 1) * 90;
    const forward = nextIndex > currentIndexRef.current;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, {
        toValue: forward ? -20 : 20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      slideAnim.setValue(forward ? 24 : -24);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(progressAnim, {
          toValue: nextAngle,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();
    });
  };

  const goToNext = () => {
    if (currentIndexRef.current < SLIDES.length - 1) {
      animateTransition(currentIndexRef.current + 1);
    } else {
      navigation.replace("Welcome");
    }
  };

  const goToPrev = () => {
    if (currentIndexRef.current > 0) {
      animateTransition(currentIndexRef.current - 1);
    }
  };

  const skip = () => navigation.replace("Welcome");

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -50) goToNext();
        else if (dx > 50) goToPrev();
      },
    })
  ).current;

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <LinearGradient colors={["#818cf8", "#c084fc"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.skipRow}>
          {isLast ? (
            <View />
          ) : (
            <TouchableOpacity onPress={skip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <Animated.View
          style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.iconBadge}>
            <MaterialIcons name={slide.icon} size={40} color="#fff" />
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </Animated.View>

        <View style={styles.swipeHint}>
          <MaterialIcons name="swipe" size={16} color="rgba(255,255,255,0.50)" />
          <Text style={styles.swipeHintText}>swipe to explore</Text>
        </View>

        <View style={styles.footer}>
          {/* Circular progress button */}
          <View style={styles.ringContainer}>
            {/* Track ring */}
            <View style={styles.track} />

            {/* Right half progress fill */}
            <View style={styles.rightClipper}>
              <Animated.View
                style={[
                  styles.rightFill,
                  {
                    transform: [
                      { translateX: -HALF / 2 },
                      { rotate: rightRotation },
                      { translateX: HALF / 2 },
                    ],
                  },
                ]}
              />
            </View>

            {/* Left half progress fill */}
            <View style={styles.leftClipper}>
              <Animated.View
                style={[
                  styles.leftFill,
                  {
                    transform: [
                      { translateX: HALF / 2 },
                      { rotate: leftRotation },
                      { translateX: -HALF / 2 },
                    ],
                  },
                ]}
              />
            </View>

            {/* Inner button — covers fill center to create arc illusion */}
            <TouchableOpacity style={styles.innerButton} onPress={goToNext} activeOpacity={0.85}>
              <MaterialIcons name={isLast ? "check" : "arrow-forward"} size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  skipRow: {
    alignItems: "flex-end",
    paddingHorizontal: 28,
    paddingTop: 16,
    minHeight: 44,
  },
  skipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    lineHeight: 40,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 18,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    letterSpacing: 0.15,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    maxWidth: width * 0.78,
    fontFamily: "Avenir Next",
    marginBottom: 10,
  },
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 0,
    marginBottom: 12,
  },
  swipeHintText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5,
  },
  footer: {
    paddingBottom: 56,
    alignItems: "center",
  },
  // Outer ring container — clips fills to a circle
  ringContainer: {
    width: RING,
    height: RING,
    borderRadius: HALF,
    overflow: "hidden",
  },
  // Semi-transparent track ring
  track: {
    position: "absolute",
    width: RING,
    height: RING,
    borderRadius: HALF,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
  },
  // Right half clipper
  rightClipper: {
    position: "absolute",
    top: 0,
    left: HALF,
    width: HALF,
    height: RING,
    overflow: "hidden",
  },
  // Right fill — HALF×RING white rectangle, rotates around left edge
  rightFill: {
    position: "absolute",
    top: 0,
    left: 0,
    width: HALF,
    height: RING,
    backgroundColor: "white",
  },
  // Left half clipper
  leftClipper: {
    position: "absolute",
    top: 0,
    left: 0,
    width: HALF,
    height: RING,
    overflow: "hidden",
  },
  // Left fill — HALF×RING white rectangle, rotates around right edge
  leftFill: {
    position: "absolute",
    top: 0,
    left: 0,
    width: HALF,
    height: RING,
    backgroundColor: "white",
  },
  // Inner button — centered, covers fill center to create arc illusion
  innerButton: {
    position: "absolute",
    top: INSET,
    left: INSET,
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    backgroundColor: "#6C5CE7",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});
