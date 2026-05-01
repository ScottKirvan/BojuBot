// Tell TypeScript that image imports are data URLs (handled by esbuild's dataurl loader)
declare module '*.jpg' {
  const dataUrl: string;
  export default dataUrl;
}

declare module '*.png' {
  const dataUrl: string;
  export default dataUrl;
}

