import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, "src/background/index.ts"),
        sidepanel: path.resolve(__dirname, "src/sidepanel/index.tsx"),
        options: path.resolve(__dirname, "src/options/index.tsx"),
        popup: path.resolve(__dirname, "src/popup/index.tsx"),
        onboarding: path.resolve(__dirname, "src/onboarding/index.tsx"),
        contentScript: path.resolve(__dirname, "src/content/contentScript.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "assets/styles.css";
          }
          return "assets/[name].[hash].[ext]";
        },
        // Keep content script as single file (no dynamic imports)
        inlineDynamicImports: false,
      },
    },
  },
});
