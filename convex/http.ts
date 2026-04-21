import { auth } from "./auth";
import { httpRouter } from "convex/server";
import { callback as xCallback } from "./x/oauth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/auth/x/callback", method: "GET", handler: xCallback });

export default http;
