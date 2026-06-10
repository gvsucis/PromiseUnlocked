import { StyleSheet, TextStyle, ViewStyle } from "react-native";

export const palette = {
  purple: {
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#6d5efc",
    600: "#5b4ee0",
    700: "#4338ca",
    900: "#1e1b4b",
  },

  PU_Yellow: "#FEDB00",
  PU_Magenta: "#A52C87",
  PU_Brown: "#603D20",
  PU_Coral: "#FF8674",
  PU_Sky: "#5BC2E7",
  PU_Teal: "#44B59D",

  white: "#ffffff",
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    700: "#374151",
    900: "#111827",
  },
};

export const colors = {
  background: {
    base: palette.white,
    subtle: palette.gray[50],
    tinted: palette.purple[50],
    card: palette.white,
  },

  text: {
    primary: palette.gray[900],
    secondary: palette.gray[500],
    muted: palette.gray[400],
    inverse: palette.white,
    accent: palette.purple[500],
  },

  border: {
    subtle: palette.gray[200],
    medium: palette.gray[300],
    accent: palette.purple[200],
  },

  brand: {
    primary: palette.purple[500],
    light: palette.purple[100],
    dark: palette.purple[700],
  },

  accent: {
    yellow: palette.PU_Yellow,
    coral: palette.PU_Coral,
    sky: palette.PU_Sky,
    teal: palette.PU_Teal,
    magenta: palette.PU_Magenta,
  },

  status: {
    error: "#ef4444",
    success: palette.PU_Teal,
    warning: palette.PU_Yellow,
  },
};

export const typography = {
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.3,
  } as TextStyle,

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.secondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  } as TextStyle,

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  } as TextStyle,

  body: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 22,
  } as TextStyle,

  bodyMuted: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  } as TextStyle,

  caption: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
  } as TextStyle,

  link: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand.primary,
  } as TextStyle,

  buttonPrimary: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.inverse,
  } as TextStyle,

  buttonSecondary: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  } as TextStyle,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.base,
  } as ViewStyle,

  screenPadded: {
    flex: 1,
    backgroundColor: colors.background.base,
    paddingTop: 80,
  } as ViewStyle,

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  } as ViewStyle,

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.md,
  } as ViewStyle,

  screenHeader: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  } as ViewStyle,

  sectionLabel: {
    ...typography.sectionTitle,
    marginBottom: spacing.md,
  } as TextStyle,

  row: {
    flexDirection: "row",
    alignItems: "center",
  } as ViewStyle,

  rowSpaced: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
});
