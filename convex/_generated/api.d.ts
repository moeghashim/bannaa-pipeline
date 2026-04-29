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
import type * as brand_defaults from "../brand/defaults.js";
import type * as brand_doc from "../brand/doc.js";
import type * as brand_preview from "../brand/preview.js";
import type * as brand_previewInternal from "../brand/previewInternal.js";
import type * as brand_sampleText from "../brand/sampleText.js";
import type * as brand_validators from "../brand/validators.js";
import type * as budget_todaySpend from "../budget/todaySpend.js";
import type * as carouselSlides_list from "../carouselSlides/list.js";
import type * as concepts_list from "../concepts/list.js";
import type * as concepts_seed from "../concepts/seed.js";
import type * as config_active from "../config/active.js";
import type * as crons from "../crons.js";
import type * as drafts_list from "../drafts/list.js";
import type * as drafts_mutate from "../drafts/mutate.js";
import type * as env_imageKeys from "../env/imageKeys.js";
import type * as env_postiz from "../env/postiz.js";
import type * as feedback_index from "../feedback/index.js";
import type * as feedback_internal from "../feedback/internal.js";
import type * as feedback_regenerate from "../feedback/regenerate.js";
import type * as feedback_tags from "../feedback/tags.js";
import type * as generate_backfillEmbeddings from "../generate/backfillEmbeddings.js";
import type * as generate_batch from "../generate/batch.js";
import type * as generate_brandPrompt from "../generate/brandPrompt.js";
import type * as generate_carousel from "../generate/carousel.js";
import type * as generate_carouselInternal from "../generate/carouselInternal.js";
import type * as generate_carouselPrompts from "../generate/carouselPrompts.js";
import type * as generate_draft from "../generate/draft.js";
import type * as generate_embeddings from "../generate/embeddings.js";
import type * as generate_hookTemplates from "../generate/hookTemplates.js";
import type * as generate_image_action from "../generate/image/action.js";
import type * as generate_image_bakedAction from "../generate/image/bakedAction.js";
import type * as generate_image_bakedCarouselAction from "../generate/image/bakedCarouselAction.js";
import type * as generate_image_carouselAction from "../generate/image/carouselAction.js";
import type * as generate_image_cleanupLegacyHyperframes from "../generate/image/cleanupLegacyHyperframes.js";
import type * as generate_image_internal from "../generate/image/internal.js";
import type * as generate_image_prompts from "../generate/image/prompts.js";
import type * as generate_image_providers from "../generate/image/providers.js";
import type * as generate_internal from "../generate/internal.js";
import type * as generate_languages from "../generate/languages.js";
import type * as generate_prompts from "../generate/prompts.js";
import type * as generate_rating from "../generate/rating.js";
import type * as generate_ratingPrompts from "../generate/ratingPrompts.js";
import type * as generate_smokeTest from "../generate/smokeTest.js";
import type * as generate_translate from "../generate/translate.js";
import type * as generate_translateInternal from "../generate/translateInternal.js";
import type * as http from "../http.js";
import type * as inbox_capture from "../inbox/capture.js";
import type * as inbox_fetch from "../inbox/fetch.js";
import type * as inbox_fetchInternal from "../inbox/fetchInternal.js";
import type * as inbox_fetchYoutube from "../inbox/fetchYoutube.js";
import type * as inbox_get from "../inbox/get.js";
import type * as inbox_list from "../inbox/list.js";
import type * as inbox_reject from "../inbox/reject.js";
import type * as lib_requireUser from "../lib/requireUser.js";
import type * as mediaAssets_list from "../mediaAssets/list.js";
import type * as mediaAssets_listInternal from "../mediaAssets/listInternal.js";
import type * as mediaAssets_url from "../mediaAssets/url.js";
import type * as migrations_renameLanguageCodes from "../migrations/renameLanguageCodes.js";
import type * as migrations_seedBrand from "../migrations/seedBrand.js";
import type * as publish_channelMatrix from "../publish/channelMatrix.js";
import type * as publish_integrations from "../publish/integrations.js";
import type * as publish_internal from "../publish/internal.js";
import type * as publish_postiz from "../publish/postiz.js";
import type * as publish_scheduleDraft from "../publish/scheduleDraft.js";
import type * as publish_status from "../publish/status.js";
import type * as publish_webhook from "../publish/webhook.js";
import type * as settings_doc from "../settings/doc.js";
import type * as users_me from "../users/me.js";
import type * as x_accounts from "../x/accounts.js";
import type * as x_inbox from "../x/inbox.js";
import type * as x_oauth from "../x/oauth.js";
import type * as x_oauthState from "../x/oauthState.js";
import type * as x_sync from "../x/sync.js";
import type * as x_tokens from "../x/tokens.js";

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
  "brand/defaults": typeof brand_defaults;
  "brand/doc": typeof brand_doc;
  "brand/preview": typeof brand_preview;
  "brand/previewInternal": typeof brand_previewInternal;
  "brand/sampleText": typeof brand_sampleText;
  "brand/validators": typeof brand_validators;
  "budget/todaySpend": typeof budget_todaySpend;
  "carouselSlides/list": typeof carouselSlides_list;
  "concepts/list": typeof concepts_list;
  "concepts/seed": typeof concepts_seed;
  "config/active": typeof config_active;
  crons: typeof crons;
  "drafts/list": typeof drafts_list;
  "drafts/mutate": typeof drafts_mutate;
  "env/imageKeys": typeof env_imageKeys;
  "env/postiz": typeof env_postiz;
  "feedback/index": typeof feedback_index;
  "feedback/internal": typeof feedback_internal;
  "feedback/regenerate": typeof feedback_regenerate;
  "feedback/tags": typeof feedback_tags;
  "generate/backfillEmbeddings": typeof generate_backfillEmbeddings;
  "generate/batch": typeof generate_batch;
  "generate/brandPrompt": typeof generate_brandPrompt;
  "generate/carousel": typeof generate_carousel;
  "generate/carouselInternal": typeof generate_carouselInternal;
  "generate/carouselPrompts": typeof generate_carouselPrompts;
  "generate/draft": typeof generate_draft;
  "generate/embeddings": typeof generate_embeddings;
  "generate/hookTemplates": typeof generate_hookTemplates;
  "generate/image/action": typeof generate_image_action;
  "generate/image/bakedAction": typeof generate_image_bakedAction;
  "generate/image/bakedCarouselAction": typeof generate_image_bakedCarouselAction;
  "generate/image/carouselAction": typeof generate_image_carouselAction;
  "generate/image/cleanupLegacyHyperframes": typeof generate_image_cleanupLegacyHyperframes;
  "generate/image/internal": typeof generate_image_internal;
  "generate/image/prompts": typeof generate_image_prompts;
  "generate/image/providers": typeof generate_image_providers;
  "generate/internal": typeof generate_internal;
  "generate/languages": typeof generate_languages;
  "generate/prompts": typeof generate_prompts;
  "generate/rating": typeof generate_rating;
  "generate/ratingPrompts": typeof generate_ratingPrompts;
  "generate/smokeTest": typeof generate_smokeTest;
  "generate/translate": typeof generate_translate;
  "generate/translateInternal": typeof generate_translateInternal;
  http: typeof http;
  "inbox/capture": typeof inbox_capture;
  "inbox/fetch": typeof inbox_fetch;
  "inbox/fetchInternal": typeof inbox_fetchInternal;
  "inbox/fetchYoutube": typeof inbox_fetchYoutube;
  "inbox/get": typeof inbox_get;
  "inbox/list": typeof inbox_list;
  "inbox/reject": typeof inbox_reject;
  "lib/requireUser": typeof lib_requireUser;
  "mediaAssets/list": typeof mediaAssets_list;
  "mediaAssets/listInternal": typeof mediaAssets_listInternal;
  "mediaAssets/url": typeof mediaAssets_url;
  "migrations/renameLanguageCodes": typeof migrations_renameLanguageCodes;
  "migrations/seedBrand": typeof migrations_seedBrand;
  "publish/channelMatrix": typeof publish_channelMatrix;
  "publish/integrations": typeof publish_integrations;
  "publish/internal": typeof publish_internal;
  "publish/postiz": typeof publish_postiz;
  "publish/scheduleDraft": typeof publish_scheduleDraft;
  "publish/status": typeof publish_status;
  "publish/webhook": typeof publish_webhook;
  "settings/doc": typeof settings_doc;
  "users/me": typeof users_me;
  "x/accounts": typeof x_accounts;
  "x/inbox": typeof x_inbox;
  "x/oauth": typeof x_oauth;
  "x/oauthState": typeof x_oauthState;
  "x/sync": typeof x_sync;
  "x/tokens": typeof x_tokens;
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
