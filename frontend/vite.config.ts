import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("react-force-graph-2d") || id.includes("force-graph") || id.includes("d3-")) {
            return "graph-vendor";
          }

          if (id.includes("recharts")) {
            return "chart-vendor";
          }

          if (id.includes("framer-motion")) {
            return "motion-vendor";
          }

          if (id.includes("html2canvas")) {
            return "capture-vendor";
          }

          if (id.includes("@supabase") || id.includes("openai")) {
            return "service-vendor";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "framework-vendor";
          }
        },
      },
    },
  },
});
