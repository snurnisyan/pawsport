import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  globalCss: {
    "html, body": {
      bg: "bg.canvas",
      color: "fg.default",
      fontFamily: "body",
      minH: "100vh",
    },
    "*::placeholder": { color: "fg.muted", opacity: 0.7 },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" },
        body: { value: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" },
      },
      colors: {
        primary: {
          50: { value: "#EBF1FF" },
          100: { value: "#C4D4FF" },
          200: { value: "#9CB6FF" },
          300: { value: "#7497FF" },
          400: { value: "#4F7FFF" },
          500: { value: "#3B82F6" },
          600: { value: "#2563EB" },
          700: { value: "#1D4ED8" },
          800: { value: "#1E3A8A" },
          900: { value: "#172554" },
        },
        secondary: {
          950: { value: "#050810" },
          900: { value: "#0A0F1F" },
          800: { value: "#0F1525" },
          700: { value: "#131A2C" },
          600: { value: "#1A2238" },
          500: { value: "#222C45" },
          400: { value: "#2C3754" },
        },
        status: {
          danger: { value: "#EF4444" },
          warning: { value: "#F59E0B" },
          success: { value: "#10B981" },
          purple: { value: "#A855F7" },
          teal: { value: "#14B8A6" },
        },
      },
      radii: {
        card: { value: "20px" },
        field: { value: "14px" },
      },
      shadows: {
        glow: { value: "0 0 24px rgba(59, 130, 246, 0.45)" },
        glowSoft: { value: "0 0 16px rgba(59, 130, 246, 0.25)" },
        card: { value: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)" },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          canvas: { value: "{colors.secondary.950}" },
          surface: { value: "{colors.secondary.800}" },
          subtle: { value: "{colors.secondary.700}" },
          muted: { value: "{colors.secondary.600}" },
          field: { value: "{colors.secondary.700}" },
        },
        fg: {
          default: { value: "#FFFFFF" },
          muted: { value: "#6B7A99" },
          subtle: { value: "#8A99B8" },
          accent: { value: "{colors.primary.400}" },
        },
        border: {
          subtle: { value: "rgba(255, 255, 255, 0.06)" },
          default: { value: "rgba(255, 255, 255, 0.10)" },
          accent: { value: "{colors.primary.500}" },
        },
        accent: {
          solid: { value: "{colors.primary.500}" },
          emphasized: { value: "{colors.primary.600}" },
          fg: { value: "#FFFFFF" },
        },
      },
    },
  },
});

export const theme = createSystem(defaultConfig, config);
