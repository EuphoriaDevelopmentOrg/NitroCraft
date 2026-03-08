import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  compatibilityDate: "2026-03-06",
  preset: "node-server",
  srcDir: "src",
  experimental: {
    openAPI: true,
  },
  openAPI: {
    // Keep docs available in prod builds.
    production: "runtime",
    // Use Nitro-generated spec route.
    route: "/_openapi.json",
    meta: {
      title: "NitroCraft API",
      description: "Minecraft avatars, skins, capes, renders, player lookup, formatting, and server status endpoints.",
    },
    ui: {
      // Serve /docs from an app route so we can reliably point Scalar at /openapi.json.
      scalar: false,
      swagger: false,
    },
  },
  publicAssets: [
    {
      // Resolved from srcDir, so use ../public for project-root static assets.
      dir: "../public",
      baseURL: "/",
      maxAge: 60 * 60 * 24 * 365,
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
