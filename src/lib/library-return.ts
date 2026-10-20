"use client";

/**
 * Where you were in the Library (its URL with filters, and how far down),
 * so a case page's "Back to library" lands there like the browser's Back.
 * Kept in sessionStorage: per tab, gone when the tab closes.
 */

const KEY = "last-layer:library-return";
const RESTORE = "last-layer:library-restore";

type Spot = { url: string; y: number };

function read(): Spot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Spot) : null;
  } catch {
    return null;
  }
}

/** Remember the Library's current URL and scroll position. */
export function saveLibrarySpot() {
  try {
    const spot: Spot = { url: `${window.location.pathname}${window.location.search}`, y: window.scrollY };
    sessionStorage.setItem(KEY, JSON.stringify(spot));
  } catch {
    // Storage blocked: Back to library just opens the plain Library.
  }
}

/**
 * The saved Library URL to go back to for a case on `puzzle`, marking its
 * scroll position to be put back. Null when there is none for that puzzle.
 */
export function libraryReturnUrl(puzzle: string): string | null {
  const spot = read();
  if (!spot) return null;
  const saved = new URLSearchParams(spot.url.split("?")[1] ?? "").get("puzzle") ?? "3x3";
  if (saved !== puzzle) return null;
  try {
    sessionStorage.setItem(RESTORE, "1");
  } catch {}
  return spot.url;
}

/** The scroll position to put back, once, if Back to library asked for it. */
export function takeLibraryScroll(): number | null {
  try {
    if (!sessionStorage.getItem(RESTORE)) return null;
    sessionStorage.removeItem(RESTORE);
  } catch {
    return null;
  }
  return read()?.y ?? null;
}
