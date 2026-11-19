import { effectiveMs, type Solve, type TimerSettings } from "../solves";

type Rule = Pick<TimerSettings, "videoSave" | "videoUnderMs" | "videoTopN">;

/**
 * Whether a just-finished solve's video is saved without asking. `session` is
 * every solve in its session, the new one included. Rules look only at the
 * moment the solve ends: a clip saved as a top 5 stays when it later drops out.
 * A DNF is never saved by a rule.
 */
export function autoSave(rule: Rule, solve: Solve, session: Solve[]): boolean {
  const t = effectiveMs(solve);
  if (rule.videoSave === "all") return true;
  if (!Number.isFinite(t)) return false;
  switch (rule.videoSave) {
    case "under":
      return t < rule.videoUnderMs;
    case "pb":
      return session.every((s) => s.id === solve.id || effectiveMs(s) > t);
    case "top": {
      const faster = session.filter((s) => s.id !== solve.id && effectiveMs(s) < t).length;
      return faster < Math.max(1, Math.round(rule.videoTopN));
    }
    default:
      return false;
  }
}
