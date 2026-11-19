import { getSession } from "@/lib/auth";
import { ClipError, deleteClips, finishUpload, playUrl } from "@/lib/clips.server";

type Context = { params: Promise<{ solveId: string }> };

async function run(handler: (userId: string, solveId: string) => Promise<unknown>, { params }: Context) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const { solveId } = await params;
  try {
    return Response.json((await handler(session.user.id, solveId)) ?? { ok: true });
  } catch (e) {
    if (e instanceof ClipError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

/** A URL to play the solve's saved video. */
export const GET = (_: Request, ctx: Context) => run(playUrl, ctx);

/** The upload is done: `{ mime, durationMs }`. */
export const PUT = async (request: Request, ctx: Context) => {
  const body = await request.json().catch(() => ({}));
  return run((userId, solveId) => finishUpload(userId, solveId, body ?? {}), ctx);
};

/** Delete the solve's saved video. */
export const DELETE = (_: Request, ctx: Context) => run((userId, solveId) => deleteClips(userId, [solveId]), ctx);
