import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  test: {
    include: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.test.tsx"],
    globals: false,
    // Use jsdom for React component tests (.test.tsx files)
    environmentMatchGlobs: [
      ["packages/*/src/**/*.test.tsx", "jsdom"],
    ],
  },
});
