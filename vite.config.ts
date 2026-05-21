import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/brunch-web.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
})
