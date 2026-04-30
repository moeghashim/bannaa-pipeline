import {
	convexAuthNextjsMiddleware,
	createRouteMatcher,
	nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/sign-in"]);
const isPublicRoute = createRouteMatcher(["/ingest/(.*)"]);
const isProtectedRoute = createRouteMatcher(["/", "/(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
	if (isPublicRoute(request)) return;

	const authed = await convexAuth.isAuthenticated();
	if (isSignInPage(request) && authed) {
		return nextjsMiddlewareRedirect(request, "/");
	}
	if (isProtectedRoute(request) && !isSignInPage(request) && !authed) {
		return nextjsMiddlewareRedirect(request, "/sign-in");
	}
});

export const config = {
	matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
