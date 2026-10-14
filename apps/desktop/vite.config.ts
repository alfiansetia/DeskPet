import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // P1 fix (Windows): never watch Rust build output — locked .exe files
    // under src-tauri/target crash Vite's watcher with EBUSY.
    watch: { ignored: ["**/src-tauri/target/**", "**/src-tauri/gen/**", "**/node_modules/**"] },
  },
  build: { target: "es2021" },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/vitest.setup.ts"] } as never
});
