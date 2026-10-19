import { existsSync } from 'node:fs'

import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// Vite solo expone VITE_* al cliente; las demás variables del .env deben estar
// en process.env para el código de servidor (env.ts, Prisma, Better Auth).
// Se carga solo .env (el único archivo de variables del proyecto).
// En producción (Railway) las variables vienen de la plataforma y no hay archivo `.env`.
const config = defineConfig(() => {
  if (existsSync('.env')) process.loadEnvFile('.env')

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      nitro({ rollupConfig: { external: [/^@sentry\//] } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})

export default config
