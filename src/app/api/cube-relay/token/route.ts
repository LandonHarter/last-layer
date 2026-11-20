import { createRealtimeToken } from "@mybase-dev/sdk/realtime";
import { getSession } from "@/lib/auth";
import { mybase } from "@/lib/mybase";
import { PAIR_CODE_RE, pairChannel, userChannel } from "@/lib/smartcube/relay";

/**
 * A realtime token for the smart cube relay (`src/lib/smartcube/relay.ts`). It grants
 * the pairing code's channel (anyone with the code) and, signed in, the account's.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const role = params.get("role");
  if (role !== "cube" && role !== "screen") return Response.json({ error: "Bad role" }, { status: 400 });
  const code = params.get("code");
  if (code !== null && !PAIR_CODE_RE.test(code)) return Response.json({ error: "Bad code" }, { status: 400 });

  const session = await getSession();
  const channels = [...(code ? [pairChannel(code)] : []), ...(session ? [userChannel(session.user.id)] : [])];
  if (!channels.length) return Response.json({ error: "Sign in, or use a pairing code" }, { status: 401 });

  const secret = process.env.MYBASE_REALTIME_SECRET;
  if (!secret) return Response.json({ error: "Relay not configured" }, { status: 503 });
  const token = await createRealtimeToken(secret, {
    project: mybase.project,
    userId: `${role}-${crypto.randomUUID()}`,
    userInfo: { role },
    subscribe: channels,
    publish: channels,
    ttl: 3600,
  });
  return Response.json({ token, channels, apiUrl: mybase.apiUrl, project: mybase.project });
}
