import { getSession } from "@/lib/auth";
import { ClipError, listClips, startUpload } from "@/lib/clips.server";

/** The solves that have a saved video. */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  return Response.json({ solveIds: await listClips(session.user.id) });
}

/** Start saving a video: `{ solveId, mime, bytes }` gives a URL to PUT the file to. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(await startUpload(session.user.id, body ?? {}));
  } catch (e) {
    if (e instanceof ClipError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
