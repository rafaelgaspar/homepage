let hydrated = false;

export function markScalingHydrated() {
  hydrated = true;
}

export function isScalingHydrated() {
  return hydrated;
}

export function resetScalingHydrationForTests() {
  hydrated = false;
}
