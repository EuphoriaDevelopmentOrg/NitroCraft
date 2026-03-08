import pkg from "../../package.json";
import { getExternalBaseUrl } from "../utils/request";
import { jsonResponse } from "../utils/toolkit";

function imageResponse(description: string): Record<string, unknown> {
  return {
    description,
    content: {
      "image/png": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
  };
}

function queryStringParam(name: string, description: string, required = false): Record<string, unknown> {
  return {
    name,
    in: "query",
    required,
    schema: {
      type: "string",
    },
    description,
  };
}

export default defineEventHandler((event) => {
  const baseUrl = getExternalBaseUrl(event);
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "NitroCraft API",
      version: String((pkg as { version?: string }).version || "1.1.2"),
      description: "Minecraft avatars, skins, capes, renders, player lookup, formatting, and server status endpoints.",
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: baseUrl,
      },
    ],
    tags: [
      { name: "images", description: "Avatar, skin, cape, and render image endpoints." },
      { name: "players", description: "Player lookup and profile endpoints." },
      { name: "status", description: "Java/Bedrock server status probes." },
      { name: "formatting", description: "Minecraft formatting conversion and stripping." },
      { name: "meta", description: "Operational and metadata endpoints." },
    ],
    paths: {
      "/avatars/{id}": {
        get: {
          tags: ["images"],
          summary: "Fetch player avatar by UUID.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Mojang UUID (dashed or undashed).",
            },
            queryStringParam("size", "Avatar size in pixels."),
            queryStringParam("overlay", "Apply overlay layer when present."),
            queryStringParam("default", "Fallback UUID/default name/URL when the target has no skin."),
          ],
          responses: {
            200: imageResponse("Avatar PNG"),
            307: { description: "Redirect to fallback URL." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/skins/{id}": {
        get: {
          tags: ["images"],
          summary: "Fetch player skin by UUID.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Mojang UUID (dashed or undashed).",
            },
            queryStringParam("default", "Fallback UUID/default name/URL when the target has no skin."),
          ],
          responses: {
            200: imageResponse("Skin PNG"),
            307: { description: "Redirect to fallback URL." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/capes/{id}": {
        get: {
          tags: ["images"],
          summary: "Fetch player cape by UUID.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Mojang UUID (dashed or undashed).",
            },
            queryStringParam("default", "Fallback UUID or URL."),
          ],
          responses: {
            200: imageResponse("Cape PNG"),
            404: { description: "No cape found and no fallback configured." },
            307: { description: "Redirect to fallback URL." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/renders/head/{id}": {
        get: {
          tags: ["images"],
          summary: "Fetch isometric head render by UUID.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Mojang UUID (dashed or undashed).",
            },
            queryStringParam("scale", "Render scale factor."),
            queryStringParam("overlay", "Apply overlay layer when present."),
            queryStringParam("default", "Fallback UUID/default name/URL."),
          ],
          responses: {
            200: imageResponse("Head render PNG"),
            307: { description: "Redirect to fallback URL." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/renders/body/{id}": {
        get: {
          tags: ["images"],
          summary: "Fetch isometric body render by UUID.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Mojang UUID (dashed or undashed).",
            },
            queryStringParam("scale", "Render scale factor."),
            queryStringParam("overlay", "Apply overlay layer when present."),
            queryStringParam("default", "Fallback UUID/default name/URL."),
          ],
          responses: {
            200: imageResponse("Body render PNG"),
            307: { description: "Redirect to fallback URL." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/players/{id}": {
        get: {
          tags: ["players"],
          summary: "Resolve player identity and texture URLs.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "UUID or Minecraft username.",
            },
          ],
          responses: {
            200: { description: "Player identity + texture payload." },
            422: { description: "Invalid player input." },
          },
        },
      },
      "/players/{id}/profile": {
        get: {
          tags: ["players"],
          summary: "Fetch Mojang profile payload.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "UUID or Minecraft username.",
            },
          ],
          responses: {
            200: { description: "Mojang profile response." },
            422: { description: "Invalid player input." },
          },
        },
      },
      "/players/{id}/history": {
        get: {
          tags: ["players"],
          summary: "Fetch player name history.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "UUID or Minecraft username.",
            },
          ],
          responses: {
            200: { description: "Name history list." },
            422: { description: "Invalid player input." },
          },
        },
      },
      "/players/{id}/skin-metadata": {
        get: {
          tags: ["players"],
          summary: "Fetch skin metadata and optional color sample.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "UUID or Minecraft username.",
            },
            queryStringParam("dominantColor", "Whether to compute dominant color."),
            queryStringParam("x", "Sample region X."),
            queryStringParam("y", "Sample region Y."),
            queryStringParam("width", "Sample region width."),
            queryStringParam("height", "Sample region height."),
          ],
          responses: {
            200: { description: "Skin metadata payload." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/status/mc": {
        get: {
          tags: ["status"],
          summary: "NitroCraft upstream Mojang health report.",
          responses: {
            200: { description: "Health report payload." },
          },
        },
      },
      "/status/java": {
        get: {
          tags: ["status"],
          summary: "Probe Java server status.",
          parameters: [
            queryStringParam("address", "Server host or host:port.", true),
            queryStringParam("port", "Optional explicit port."),
            queryStringParam("timeoutMs", "Probe timeout in milliseconds."),
            queryStringParam("protocolVersion", "Optional protocol override."),
          ],
          responses: {
            200: { description: "Java status payload." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/status/bedrock": {
        get: {
          tags: ["status"],
          summary: "Probe Bedrock server status.",
          parameters: [
            queryStringParam("address", "Server host or host:port.", true),
            queryStringParam("port", "Optional explicit port."),
            queryStringParam("timeoutMs", "Probe timeout in milliseconds."),
          ],
          responses: {
            200: { description: "Bedrock status payload." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/status/server": {
        get: {
          tags: ["status"],
          summary: "Probe status with edition auto-detection.",
          parameters: [
            queryStringParam("address", "Server host or host:port.", true),
            queryStringParam("edition", "java, bedrock, or auto."),
            queryStringParam("port", "Optional explicit port."),
            queryStringParam("timeoutMs", "Probe timeout in milliseconds."),
            queryStringParam("protocolVersion", "Optional Java protocol override."),
          ],
          responses: {
            200: { description: "Java or Bedrock status payload." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/status/icon": {
        get: {
          tags: ["status"],
          summary: "Fetch Java server list icon.",
          parameters: [
            queryStringParam("address", "Java server host or host:port.", true),
            queryStringParam("port", "Optional explicit port."),
            queryStringParam("timeoutMs", "Probe timeout in milliseconds."),
            queryStringParam("protocolVersion", "Optional Java protocol override."),
          ],
          responses: {
            200: { description: "Icon payload (data URI + Base64)." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/format/html": {
        get: {
          tags: ["formatting"],
          summary: "Convert Minecraft formatting codes to HTML.",
          parameters: [
            queryStringParam("text", "Input text with § or & formatting codes.", true),
            queryStringParam("mode", "inline or class."),
            queryStringParam("classPrefix", "Class prefix when mode=class."),
          ],
          responses: {
            200: { description: "HTML output payload." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/format/strip": {
        get: {
          tags: ["formatting"],
          summary: "Strip Minecraft formatting codes from text.",
          parameters: [
            queryStringParam("text", "Input text with formatting codes.", true),
          ],
          responses: {
            200: { description: "Stripped text payload." },
            422: { description: "Invalid input." },
          },
        },
      },
      "/format/css": {
        get: {
          tags: ["formatting"],
          summary: "Generate CSS classes for formatting mode.",
          responses: {
            200: {
              description: "CSS stylesheet.",
              content: {
                "text/css": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      "/openapi.json": {
        get: {
          tags: ["meta"],
          summary: "OpenAPI schema for NitroCraft endpoints.",
          responses: {
            200: { description: "OpenAPI JSON." },
          },
        },
      },
      "/metrics": {
        get: {
          tags: ["meta"],
          summary: "Prometheus-compatible runtime metrics.",
          responses: {
            200: {
              description: "Prometheus text exposition.",
              content: {
                "text/plain": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      "/metrics/api-calls": {
        get: {
          tags: ["meta"],
          summary: "Current persisted API call count for homepage stat refresh.",
          responses: {
            200: {
              description: "API call count payload.",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  };

  return jsonResponse(event, spec);
});
