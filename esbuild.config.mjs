import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "module";
import { fileURLToPath } from "url";
import { collectBuildInfo } from "./scripts/buildInfo.mjs";

const prod = process.argv[2] === "production";
const buildInfo = collectBuildInfo({ cwd: fileURLToPath(new URL(".", import.meta.url)) });

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  loader: { '.jpg': 'dataurl', '.png': 'dataurl', '.md': 'text' },
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  define: { __BUILD_INFO__: JSON.stringify(buildInfo) },
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
