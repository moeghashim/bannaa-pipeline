"use client";

// biome-ignore lint/style/noRestrictedImports: This helper is the single allowed mount-only effect escape hatch.
import { type EffectCallback, useEffect } from "react";

export function useMountEffect(effect: EffectCallback) {
	useEffect(effect, []);
}
