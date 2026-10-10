interface ImportMetaEnv {
  /** URL base de la API NestJS. Si no se define, la app usa el mock en localStorage. */
  readonly PUBLIC_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
