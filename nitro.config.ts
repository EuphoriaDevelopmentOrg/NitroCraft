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
    // Leave generated spec on internal route and keep custom /openapi.json intact.
    route: "/_openapi.json",
    meta: {
      title: "NitroCraft API",
      description: "Minecraft avatars, skins, capes, renders, player lookup, formatting, and server status endpoints.",
    },
    ui: {
      scalar: {
        route: "/docs",
        // Point Scalar UI at the richer hand-authored schema route.
        url: "/openapi.json",
        spec: {
          url: "/openapi.json",
        },
      },
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
