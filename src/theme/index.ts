import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        "area.scripture": { value: "#7c3aed" },
        "area.theology": { value: "#2563eb" },
        "area.philosophy": { value: "#0891b2" },
        "area.spiritual": { value: "#16a34a" },
        "area.canon": { value: "#dc2626" },
        "area.liturgy": { value: "#d97706" },
        "area.languages": { value: "#9333ea" },

        "status.planned": { value: "#6b7280" },
        "status.available": { value: "#3b82f6" },
        "status.in_progress": { value: "#f97316" },
        "status.completed": { value: "#22c55e" },
        "status.deferred": { value: "#a855f7" },
        "status.cancelled": { value: "#ef4444" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
