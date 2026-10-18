// Tell TypeScript that image imports are data URLs (handled by esbuild's dataurl loader)
declare module '*.jpg' {
  const dataUrl: string;
  export default dataUrl;
}

declare module '*.png' {
  const dataUrl: string;
  export default dataUrl;
}

// Tell TypeScript that .md imports are strings (handled by esbuild's text loader)
declare module '*.md' {
  const content: string;
  export default content;
}


/** Build facts baked in by esbuild (esbuild.config.mjs → scripts/buildInfo.mjs). */
declare const __BUILD_INFO__: import('./utils/buildInfo').BuildInfo;
