import { auth } from "./auth";
import { httpRouter } from "convex/server";
import { callback as xCallback, start as xStart } from "./x/oauth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/auth/x/start", method: "GET", handler: xStart });
http.route({ path: "/auth/x/callback", method: "GET", handler: xCallback });

export default http;
