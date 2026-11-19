/** What both sides agree on about saved solve clips. */

/** Uploads go through a Cloudflare tunnel, which drops single requests over 100 MB. */
export const CLIP_MAX_BYTES = 95 * 1024 * 1024;

const EXT: Record<string, string> = { "video/webm": "webm", "video/mp4": "mp4" };

export const isClipMime = (mime: string) => mime in EXT;
export const clipExt = (mime: string) => EXT[mime.split(";")[0]] ?? "webm";
