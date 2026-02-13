/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID: string
  readonly VITE_APP_ID: string
  readonly VITE_OWNER_ID: string
  readonly VITE_PORT: string
  readonly VITE_HOST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}