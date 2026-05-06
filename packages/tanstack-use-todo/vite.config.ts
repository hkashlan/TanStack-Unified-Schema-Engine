import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const SERVER_ONLY_PACKAGES = ['pg', 'drizzle-orm', 'drizzle-orm/node-postgres', 'drizzle-orm/pg-core'];

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//, /^pg$/, /^pg\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  optimizeDeps: {
    // Exclude Node-only packages from client pre-bundling.
    // They are server-only and must never be analysed for the browser bundle.
    exclude: SERVER_ONLY_PACKAGES,
  },
  ssr: {
    // Keep them external in the SSR bundle too so Node resolves them natively.
    external: SERVER_ONLY_PACKAGES,
    noExternal: [],
  },
  build: {
    rollupOptions: {
      // Prevent pg and drizzle from ever entering the client bundle.
      external: SERVER_ONLY_PACKAGES,
    },
  },
})

export default config
