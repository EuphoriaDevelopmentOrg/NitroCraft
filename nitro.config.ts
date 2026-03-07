import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  compatibilityDate: "2026-03-06",
  preset: "node-server",
  srcDir: "src",
  publicAssets: [
    {
      // Resolved from srcDir, so use ../public for project-root static assets.
      dir: "../public",
      baseURL: "/",
    },
  ],
  externals: {
    // Keep native module out of the server bundle; load it from node_modules at runtime.
    external: ["canvas"],
  },
  typescript: {
    strict: true,
  },
});
