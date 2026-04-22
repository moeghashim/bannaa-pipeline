import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { handleWebhook as postizWebhook } from "./publish/webhook";
import { callback as xCallback } from "./x/oauth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/auth/x/callback", method: "GET", handler: xCallback });
http.route({ path: "/postiz/webhook", method: "POST", handler: postizWebhook });

export default http;
