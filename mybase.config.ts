import type { MybaseConfig } from "@mybase-dev/sdk/config";

// `mybase deploy` builds the Dockerfile and serves it at https://lastlayer.hangdong.lol.
// A plain object, not defineConfig(): the CLI binary can't resolve packages
// from node_modules when it loads this file (type-only imports are erased).
const config: MybaseConfig = {
  project: "lastlayer",
  hosting: {
    sites: {
      lastlayer: { port: 3000, healthPath: "/", context: ".", dockerfile: "Dockerfile" },
    },
  },
};

export default config;
