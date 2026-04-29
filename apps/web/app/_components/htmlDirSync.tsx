"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useLayoutEffect } from "react";
import { directionFor, isRtl, type OutputLanguage } from "../_lib/languages";

// Mirrors the user's primary-language setting onto <html dir="rtl|ltr"> and a
// `data-rtl` attribute. CSS uses `[dir="rtl"]` selectors to flip layouts and
// `[data-flip-rtl]` to flip directional icons. Mounts at layout root, before
// auth gates — skip the auth-gated settings query when not signed in.
//
// Uses useLayoutEffect (synchronous external DOM sync) rather than the
// banned useEffect; the component is "use client" so SSR doesn't run it.
export function HtmlDirSync() {
	const { isAuthenticated } = useConvexAuth();
	const settings = useQuery(api.settings.doc.get, isAuthenticated ? {} : "skip");
	const lang = (settings?.defaultPrimaryLanguage as OutputLanguage | undefined) ?? "en";
	useLayoutEffect(() => {
		const el = document.documentElement;
		el.setAttribute("dir", directionFor(lang));
		el.setAttribute("lang", lang);
		if (isRtl(lang)) el.setAttribute("data-rtl", "");
		else el.removeAttribute("data-rtl");
	}, [lang]);
	return null;
}
