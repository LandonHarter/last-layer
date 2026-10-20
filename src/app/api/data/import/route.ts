import { getSession } from "@/lib/auth";
import { BadData, replaceUserData } from "@/lib/user-data.server";

const MAX_BODY = 32 * 1024 * 1024;

/** Replace the signed-in account's data with a backup's `data` (empty to start fresh). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "Too large" }, { status: 413 });
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text).data;
    if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error();
  } catch {
    return Response.json({ error: "Not a Last Layer backup" }, { status: 400 });
  }
  try {
    await replaceUserData(session.user.id, data);
  } catch (e) {
    if (e instanceof BadData) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return Response.json({ ok: true });
}
