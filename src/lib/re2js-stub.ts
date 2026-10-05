// Stand-in for `re2js` (aliased in vite.config.ts). Firestore 4.16+ imports the whole RE2
// engine for Pipelines regex expressions (Enterprise edition only), and it is not
// tree-shakeable: ~150 KB minified on every page (firebase/firebase-js-sdk#10424).
// This app never runs Pipelines, so nothing calls it; fail loudly if that ever changes.
export const RE2JS = {
  compile(): never {
    throw new Error("Firestore Pipelines regex is not bundled (see src/lib/re2js-stub.ts).");
  },
};
