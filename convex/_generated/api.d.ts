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
import type * as carouselSlides_list from "../carouselSlides/list.js";
import type * as concepts_list from "../concepts/list.js";
import type * as concepts_seed from "../concepts/seed.js";
import type * as config_active from "../config/active.js";
import type * as crons from "../crons.js";
import type * as drafts_list from "../drafts/list.js";
import type * as drafts_mutate from "../drafts/mutate.js";
import type * as env_imageKeys from "../env/imageKeys.js";
import type * as generate_carousel from "../generate/carousel.js";
import type * as generate_carouselInternal from "../generate/carouselInternal.js";
import type * as generate_carouselPrompts from "../generate/carouselPrompts.js";
import type * as generate_draft from "../generate/draft.js";
import type * as generate_image_action from "../generate/image/action.js";
import type * as generate_image_carouselAction from "../generate/image/carouselAction.js";
import type * as generate_image_composite from "../generate/image/composite.js";
import type * as generate_image_compositeCarouselAction from "../generate/image/compositeCarouselAction.js";
import type * as generate_image_hyperframes from "../generate/image/hyperframes.js";
import type * as generate_image_internal from "../generate/image/internal.js";
import type * as generate_image_prompts from "../generate/image/prompts.js";
import type * as generate_image_providers from "../generate/image/providers.js";
import type * as generate_internal from "../generate/internal.js";
import type * as generate_prompts from "../generate/prompts.js";
import type * as http from "../http.js";
import type * as inbox_capture from "../inbox/capture.js";
import type * as inbox_get from "../inbox/get.js";
import type * as inbox_list from "../inbox/list.js";
import type * as inbox_reject from "../inbox/reject.js";
import type * as lib_requireUser from "../lib/requireUser.js";
import type * as mediaAssets_list from "../mediaAssets/list.js";
import type * as mediaAssets_url from "../mediaAssets/url.js";
import type * as settings_doc from "../settings/doc.js";
import type * as users_me from "../users/me.js";
import type * as x_accounts from "../x/accounts.js";
import type * as x_inbox from "../x/inbox.js";
import type * as x_oauth from "../x/oauth.js";
import type * as x_oauthState from "../x/oauthState.js";
import type * as x_sync from "../x/sync.js";

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
  "carouselSlides/list": typeof carouselSlides_list;
  "concepts/list": typeof concepts_list;
  "concepts/seed": typeof concepts_seed;
  "config/active": typeof config_active;
  crons: typeof crons;
  "drafts/list": typeof drafts_list;
  "drafts/mutate": typeof drafts_mutate;
  "env/imageKeys": typeof env_imageKeys;
  "generate/carousel": typeof generate_carousel;
  "generate/carouselInternal": typeof generate_carouselInternal;
  "generate/carouselPrompts": typeof generate_carouselPrompts;
  "generate/draft": typeof generate_draft;
  "generate/image/action": typeof generate_image_action;
  "generate/image/carouselAction": typeof generate_image_carouselAction;
  "generate/image/composite": typeof generate_image_composite;
  "generate/image/compositeCarouselAction": typeof generate_image_compositeCarouselAction;
  "generate/image/hyperframes": typeof generate_image_hyperframes;
  "generate/image/internal": typeof generate_image_internal;
  "generate/image/prompts": typeof generate_image_prompts;
  "generate/image/providers": typeof generate_image_providers;
  "generate/internal": typeof generate_internal;
  "generate/prompts": typeof generate_prompts;
  http: typeof http;
  "inbox/capture": typeof inbox_capture;
  "inbox/get": typeof inbox_get;
  "inbox/list": typeof inbox_list;
  "inbox/reject": typeof inbox_reject;
  "lib/requireUser": typeof lib_requireUser;
  "mediaAssets/list": typeof mediaAssets_list;
  "mediaAssets/url": typeof mediaAssets_url;
  "settings/doc": typeof settings_doc;
  "users/me": typeof users_me;
  "x/accounts": typeof x_accounts;
  "x/inbox": typeof x_inbox;
  "x/oauth": typeof x_oauth;
  "x/oauthState": typeof x_oauthState;
  "x/sync": typeof x_sync;
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
