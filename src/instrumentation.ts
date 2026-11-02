// Config lives in mybase secrets (project "lastlayer", env "prod"), not in
// Vercel's env. Vercel holds only MYBASE_API_URL and MYBASE_TOKEN (a key with
// secrets:read on prod); this copies the env into process.env before the
// server takes requests. Locally, `mybase run` sets everything and there's no
// MYBASE_TOKEN, so this does nothing.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.MYBASE_TOKEN) {
    if (process.env.VERCEL === "1") throw new Error("Vercel deployment is missing MYBASE_TOKEN");
    return;
  }
  const { createSecretsClient, MybaseApiError } = await import("@mybase-dev/sdk/secrets");
  const secrets = createSecretsClient({
    apiUrl: process.env.MYBASE_API_URL ?? "https://mybase.hangdong.lol",
    project: "lastlayer",
    env: "prod",
    apiKey: process.env.MYBASE_TOKEN,
  });

  // A failed load leaves this instance unusable until it recycles, so ride out
  // server restarts and tunnel reconnects (5xx, network errors) for ~20 s.
  const deadline = Date.now() + 20_000;
  for (let attempt = 1; ; attempt++) {
    try {
      await secrets.load({ override: true });
      return;
    } catch (err) {
      const retryable = !(err instanceof MybaseApiError) || err.status >= 500;
      const wait = Math.min(500 * 2 ** (attempt - 1), 4000);
      if (!retryable || Date.now() + wait > deadline) throw err;
      console.warn(`mybase secrets load failed, retrying (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
