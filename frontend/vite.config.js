import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Newer Vite versions reject requests with an unrecognized Host header
    // by default (DNS-rebinding protection). We need requests to
    // "<anything>.localhost:5173" to reach the dev server so vanity
    // subdomains (e.g. muthuwinss.localhost) can be tested without owning
    // a real domain — see DOMAIN_SETUP.md "Testing without a domain yet".
    allowedHosts: [".localhost"],
  },
});