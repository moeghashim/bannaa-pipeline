/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analyses_list from "../analyses/list.js";
import type * as analyze_internal from "../analyze/internal.js";
import type * as analyze_prompts from "../analyze/prompts.js";
import type * as analyze_providers from "../analyze/providers.js";
import type * as analyze_run from "../analyze/run.js";
import type * as auth from "../auth.js";
import type * as budget_todaySpend from "../budget/todaySpend.js";
import type * as concepts_list from "../concepts/list.js";
import type * as concepts_seed from "../concepts/seed.js";
import type * as config_active from "../config/active.js";
import type * as http from "../http.js";
import type * as inbox_capture from "../inbox/capture.js";
import type * as inbox_get from "../inbox/get.js";
import type * as inbox_list from "../inbox/list.js";
import type * as inbox_reject from "../inbox/reject.js";
import type * as lib_requireUser from "../lib/requireUser.js";
import type * as settings_doc from "../settings/doc.js";
import type * as users_me from "../users/me.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "analyses/list": typeof analyses_list;
  "analyze/internal": typeof analyze_internal;
  "analyze/prompts": typeof analyze_prompts;
  "analyze/providers": typeof analyze_providers;
  "analyze/run": typeof analyze_run;
  auth: typeof auth;
  "budget/todaySpend": typeof budget_todaySpend;
  "concepts/list": typeof concepts_list;
  "concepts/seed": typeof concepts_seed;
  "config/active": typeof config_active;
  http: typeof http;
  "inbox/capture": typeof inbox_capture;
  "inbox/get": typeof inbox_get;
  "inbox/list": typeof inbox_list;
  "inbox/reject": typeof inbox_reject;
  "lib/requireUser": typeof lib_requireUser;
  "settings/doc": typeof settings_doc;
  "users/me": typeof users_me;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
