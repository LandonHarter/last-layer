import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, type _Object } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "./db";
import { CLIP_MAX_BYTES, clipExt, isClipMime } from "./video/clip";

/**
 * Saved solve videos: the files live in the project bucket under
 * `clips/<userId>/<solveId>.<ext>` (private; never under `public/`), and a
 * `solve_clip` row says which solves have one. The browser uploads and plays
 * them through presigned URLs.
 */

const bucket = () => process.env.S3_BUCKET as string;

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    // Otherwise presigned PUTs carry a checksum of an empty body, and Garage refuses the real file.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID as string, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string },
  });
  return client;
}

export class ClipError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const keyFor = (userId: string, solveId: string, mime: string) => `clips/${userId}/${solveId}.${clipExt(mime)}`;
const cleanId = (id: unknown) => (typeof id === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(id) ? id : null);

/** A URL the browser can PUT the clip to, good for 10 minutes. */
export async function startUpload(userId: string, body: { solveId?: unknown; mime?: unknown; bytes?: unknown }) {
  const solveId = cleanId(body.solveId);
  if (!solveId) throw new ClipError("Bad solve id");
  const mime = typeof body.mime === "string" ? body.mime.split(";")[0] : "";
  if (!isClipMime(mime)) throw new ClipError("Not a video");
  const bytes = Number(body.bytes);
  if (!Number.isInteger(bytes) || bytes <= 0) throw new ClipError("Bad size");
  if (bytes > CLIP_MAX_BYTES) throw new ClipError("Clip too large", 413);
  const key = keyFor(userId, solveId, mime);
  const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime, ContentLength: bytes }), { expiresIn: 600 });
  return { url, key };
}

/** After the upload: check the file is there and record it. */
export async function finishUpload(userId: string, solveId: string, body: { mime?: unknown; durationMs?: unknown; stopMs?: unknown }) {
  if (!cleanId(solveId)) throw new ClipError("Bad solve id");
  const mime = typeof body.mime === "string" ? body.mime.split(";")[0] : "";
  if (!isClipMime(mime)) throw new ClipError("Not a video");
  const key = keyFor(userId, solveId, mime);
  const bytes = await objectSize(key);
  if (bytes === null) throw new ClipError("Upload not found", 404);
  if (bytes > CLIP_MAX_BYTES) {
    await removeObjects([key]);
    throw new ClipError("Clip too large", 413);
  }
  const durationMs = Math.max(0, Math.min(2 ** 31 - 1, Math.round(Number(body.durationMs) || 0)));
  const stop = Number(body.stopMs);
  const stopMs = Number.isFinite(stop) && stop >= 0 ? Math.min(2 ** 31 - 1, Math.round(stop)) : null;
  const old = await prisma.solveClip.findUnique({ where: { userId_solveId: { userId, solveId } } });
  await prisma.solveClip.upsert({
    where: { userId_solveId: { userId, solveId } },
    create: { userId, solveId, key, mime, bytes, durationMs, stopMs },
    update: { key, mime, bytes, durationMs, stopMs, createdAt: new Date() },
  });
  // Saved again in another format: the old file is no longer pointed at.
  if (old && old.key !== key) await removeObjects([old.key]);
}

/** A URL to play a saved clip, good for an hour. */
export async function playUrl(userId: string, solveId: string) {
  const id = cleanId(solveId);
  const clip = id && (await prisma.solveClip.findUnique({ where: { userId_solveId: { userId, solveId: id } } }));
  if (!clip) throw new ClipError("No clip", 404);
  const url = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: clip.key, ResponseContentType: clip.mime }), { expiresIn: 3600 });
  return { url, mime: clip.mime, durationMs: clip.durationMs, bytes: clip.bytes, stopMs: clip.stopMs };
}

/** Every object under a prefix (with retries: the S3 tunnel sometimes refuses a request). */
async function listObjects(prefix: string): Promise<_Object[]> {
  const out: _Object[] = [];
  let token: string | undefined;
  do {
    const page = await retry(() => s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token })));
    out.push(...(page.Contents ?? []));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

async function retry<T>(f: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await f();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 300 * i));
    }
  }
}

/**
 * The size of an uploaded file, or null if it isn't there. Uses a listing, not
 * HEAD: HEAD through the tunnel sometimes comes back 403 for a file that exists.
 */
async function objectSize(key: string): Promise<number | null> {
  try {
    const found = (await listObjects(key)).find((o) => o.Key === key);
    return found ? (found.Size ?? 0) : null;
  } catch {
    return null;
  }
}

/**
 * Every solve with a saved clip. A file that was uploaded but never recorded
 * (the last step failed) is taken in here, if its solve still exists.
 */
export async function listClips(userId: string) {
  const rows = await prisma.solveClip.findMany({ where: { userId }, select: { solveId: true } });
  const have = new Set(rows.map((r) => r.solveId));
  try {
    const files = await listObjects(`clips/${userId}/`);
    const stray = files.flatMap((o) => {
      const m = o.Key?.match(/^clips\/[^/]+\/([A-Za-z0-9._-]+)\.(webm|mp4)$/);
      return m && !have.has(m[1]) && (o.Size ?? 0) <= CLIP_MAX_BYTES ? [{ key: o.Key!, solveId: m[1], mime: `video/${m[2]}`, bytes: o.Size ?? 0 }] : [];
    });
    if (stray.length) {
      const solves = await prisma.solve.findMany({ where: { userId, id: { in: stray.map((f) => f.solveId) } }, select: { id: true } });
      const live = new Set(solves.map((s) => s.id));
      const adopt = stray.filter((f) => live.has(f.solveId));
      if (adopt.length) {
        await prisma.solveClip.createMany({ data: adopt.map((f) => ({ userId, ...f, durationMs: 0 })), skipDuplicates: true });
        adopt.forEach((f) => have.add(f.solveId));
      }
    }
  } catch (e) {
    console.error("clip listing failed", e);
  }
  return [...have];
}

async function removeObjects(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }));
  }
}

/** Drop the clips of these solves (rows and files). */
export async function deleteClips(userId: string, solveIds: string[]) {
  if (!solveIds.length) return;
  const clips = await prisma.solveClip.findMany({ where: { userId, solveId: { in: solveIds } }, select: { key: true } });
  if (!clips.length) return;
  await prisma.solveClip.deleteMany({ where: { userId, solveId: { in: solveIds } } });
  await removeObjects(clips.map((c) => c.key));
}

/** Drop the clips whose solve is gone (after the account's data was replaced). */
export async function deleteOrphanClips(userId: string) {
  const [clips, solves] = await Promise.all([
    prisma.solveClip.findMany({ where: { userId }, select: { solveId: true } }),
    prisma.solve.findMany({ where: { userId }, select: { id: true } }),
  ]);
  const kept = new Set(solves.map((s) => s.id));
  await deleteClips(
    userId,
    clips.map((c) => c.solveId).filter((id) => !kept.has(id)),
  );
}

/** Never let a storage hiccup fail a data sync. */
export function bestEffort(p: Promise<unknown>) {
  return p.catch((e) => console.error("clip cleanup failed", e));
}
