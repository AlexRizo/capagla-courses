// Una imagen del texto enriquecido solo puede ser un archivo propio (`/images/...`) o una
// dirección https. Lo comprueban el servidor al guardar (`lib/rich-text.ts`) y el visor.
export const isSafeImageSrc = (src: unknown): src is string =>
  typeof src === 'string' && (/^\/(?!\/)/.test(src) || /^https:\/\//.test(src))
