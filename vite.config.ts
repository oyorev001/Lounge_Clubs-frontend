import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    TanStackRouterVite(),
    viteReact(),
    tailwindcss(),
  ],
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Dev proxy → the .NET API (self-signed cert is fine server-side).
      // Leave VITE_API_URL unset so calls go through this proxy.
      "/api": {
        target: "https://localhost:7063",
        changeOrigin: true,
        secure: false,
      },
      // Locally stored uploads (dev file provider) are served by the API too.
      "/uploads": {
        target: "https://localhost:7063",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
