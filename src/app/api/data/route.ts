import { getSession } from "@/lib/auth";
import { BadData, applySync } from "@/lib/user-data.server";
import type { SyncOps } from "@/lib/user-data";

const MAX_BODY = 8 * 1024 * 1024;

/** Save what changed in the signed-in account's data. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "Too large" }, { status: 413 });
  let ops: SyncOps;
  try {
    ops = JSON.parse(text);
    if (typeof ops !== "object" || ops === null) throw new Error();
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  try {
    await applySync(session.user.id, ops);
  } catch (e) {
    if (e instanceof BadData) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return Response.json({ ok: true });
}
