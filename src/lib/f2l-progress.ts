"use client";

import { createStore } from "./store";
import { f2lVariantKey, recordF2LResult, type F2LCheck, type F2LProgress, type F2LSolution, type F2LVariant } from "./f2l-trainer";

const store = createStore<F2LProgress>("last-layer:f2l-lab:v1", {});
export const useF2LProgress = store.use;
export const getF2LProgress = store.read;

export function saveF2LAttempt(variant: F2LVariant, check: F2LCheck | null, target: F2LSolution, assisted: boolean) {
  const key = f2lVariantKey(variant);
  store.update((progress) => ({ ...progress, [key]: recordF2LResult(progress[key], check, target, assisted, Date.now()) }));
}

/** A better retry is worth keeping, but must not inflate first-attempt mastery. */
export function saveF2LBest(variant: F2LVariant, check: F2LCheck) {
  if (!check.ok || !check.solved) return;
  const key = f2lVariantKey(variant);
  store.update((progress) => {
    const entry = progress[key];
    if (!entry || (entry.best && (entry.best.htm < check.htm || (entry.best.htm === check.htm && entry.best.rotations <= check.rotations)))) return progress;
    return { ...progress, [key]: { ...entry, best: { alg: check.alg, htm: check.htm, rotations: check.rotations } } };
  });
}
