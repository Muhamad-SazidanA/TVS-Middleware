export interface MismatchTarget {
  fieldId: string;
  docCode: string;
}

/**
 * Returns the next mismatch target in sequential top-to-bottom order, wrapping
 * from the last mismatch back to the first (1 -> 2 -> 3 -> 1).
 */
export function getNextMismatchTarget<T extends MismatchTarget>(
  targets: T[],
  activeFieldId: string | null,
  lastCycledFieldId?: string | null
): T | null {
  if (targets.length === 0) return null;

  const anchorId =
    activeFieldId && targets.some((t) => t.fieldId === activeFieldId)
      ? activeFieldId
      : lastCycledFieldId && targets.some((t) => t.fieldId === lastCycledFieldId)
      ? lastCycledFieldId
      : null;

  if (!anchorId) {
    return targets[0]!;
  }

  const currentIndex = targets.findIndex((t) => t.fieldId === anchorId);
  const nextIndex = (currentIndex + 1) % targets.length;
  return targets[nextIndex]!;
}
