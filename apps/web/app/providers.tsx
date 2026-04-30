"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { PostHogProvider } from "posthog-js/react";
import type { ReactNode } from "react";
import { initPostHog, posthog } from "./_lib/posthog";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");

export function Providers({ children }: { children: ReactNode }) {
	initPostHog();
	return (
		<PostHogProvider client={posthog}>
			<ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>
		</PostHogProvider>
	);
}
