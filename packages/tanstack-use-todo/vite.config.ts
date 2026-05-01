import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  optimizeDeps: {
    // Exclude Node-only packages from client pre-bundling.
    // They are server-only and must never be analysed for the browser bundle.
    exclude: ['pg', 'drizzle-orm', 'drizzle-orm/node-postgres', 'drizzle-orm/pg-core'],
  },
  ssr: {
    // Keep them external in the SSR bundle too so Node resolves them natively.
    external: ['pg', 'drizzle-orm', 'drizzle-orm/node-postgres', 'drizzle-orm/pg-core'],
  },
})

export default config
