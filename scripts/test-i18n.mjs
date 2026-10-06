/**
 * i18n consistency test: every UI string exists in zh and en, English has no
 * leftover CJK text, interpolation placeholders match, every plane group has
 * reference data + a description, and locale detection maps tags correctly.
 * Run: node scripts/test-i18n.mjs
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = path.join(root, "packages", "core", "src");

const entry = `
export { zh, en } from "./i18n/locales";
export { PLANE_GROUP_INFO } from "./symmetry/groupInfo";
export { SPACE_GROUPS, SPACE_GROUP_IDS } from "./symmetry/groups";
export { matchLang, detectInitialLang, SUPPORTED_LANGS, FALLBACK_LANG } from "./i18n";
`;
const out = await build({
  stdin: { contents: entry, resolveDir: core, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64")
);
const { zh, en, PLANE_GROUP_INFO, SPACE_GROUPS, SPACE_GROUP_IDS, matchLang, detectInitialLang } = mod;

const han = /\p{Script=Han}/u;
const placeholders = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

let checks = 0;
const zhKeys = Object.keys(zh).sort();
const enKeys = Object.keys(en).sort();
assert.deepEqual(enKeys, zhKeys, "zh and en must have identical key sets");
checks++;

for (const k of zhKeys) {
  assert.ok(typeof zh[k] === "string" && zh[k].length > 0, `zh.${k} empty`);
  assert.ok(typeof en[k] === "string" && en[k].length > 0, `en.${k} empty`);
  assert.ok(!han.test(en[k]), `en.${k} contains Chinese text: ${en[k]}`);
  assert.deepEqual(placeholders(en[k]), placeholders(zh[k]), `placeholder mismatch in ${k}`);
  checks += 4;
}

assert.equal(SPACE_GROUP_IDS.length, 17, "17 plane groups expected");
const numbers = new Set();
for (const id of SPACE_GROUP_IDS) {
  const info = PLANE_GROUP_INFO[id];
  assert.ok(info, `missing PLANE_GROUP_INFO.${id}`);
  numbers.add(info.itaNumber);
  assert.ok(zh[`group.${id}.desc`] && en[`group.${id}.desc`], `missing description for ${id}`);
  assert.ok(zh[`lattice.${SPACE_GROUPS[id].lattice}`], `missing lattice name for ${id}`);
  // A mirror or glide forces an even number of copies; rotation orders divide the count.
  for (const n of info.rotationOrders) assert.equal(info.copiesPerCell % n, 0, `${id}: order ${n}`);
  // Centred cells hold two lattice points.
  const centred = id.startsWith("c");
  assert.equal(SPACE_GROUPS[id].lattice === "centered", centred, `${id}: centring`);
  checks += 5;
}
assert.deepEqual([...numbers].sort((a, b) => a - b), Array.from({ length: 17 }, (_, i) => i + 1));
checks++;

assert.equal(matchLang("zh-CN"), "zh");
assert.equal(matchLang("zh-Hant-TW"), "zh");
assert.equal(matchLang("en-GB"), "en");
assert.equal(matchLang("de-DE"), null);
assert.equal(matchLang(undefined), null);
// Node >= 21 exposes a global navigator that reflects the OS locale.
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const withNavigator = (nav, fn) => {
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (realNavigator) Object.defineProperty(globalThis, "navigator", realNavigator);
    else delete globalThis.navigator;
  }
};
assert.equal(withNavigator(undefined, detectInitialLang), "en", "no navigator/localStorage → English fallback");
assert.equal(withNavigator({ languages: ["de-DE"], language: "de-DE" }, detectInitialLang), "en", "unsupported locale → English");
assert.equal(withNavigator({ languages: ["zh-CN"], language: "zh-CN" }, detectInitialLang), "zh", "zh locale → Chinese");
checks += 8;

console.log(`i18n OK — ${zhKeys.length} keys × 2 languages, 17 groups, ${checks} checks`);
