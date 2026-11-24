interface ImportMetaEnv {
  /** URL base de la API NestJS (obligatoria), ej. https://api.mitaller.com/api */
  readonly PUBLIC_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
