import { createCache } from "@mybase-dev/sdk/cache";

// mybase project "lastlayer": Postgres, secrets, cache and users. MYBASE_URL and
// MYBASE_API_KEY come from the linked secrets env (server-side only).
export const mybase = {
  apiUrl: process.env.MYBASE_URL ?? "https://mybase.hangdong.lol",
  project: "lastlayer",
  apiKey: process.env.MYBASE_API_KEY as string,
};

/** The project's cache over HTTP. Every key gets the `lastlayer:` prefix. */
export const cache = createCache(mybase);
