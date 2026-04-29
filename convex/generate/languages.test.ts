import assert from "node:assert/strict";
import test from "node:test";

import {
	ARABIC_DIALECTS,
	canonicalizeLanguage,
	descriptorFor,
	directionFor,
	isArabicDialect,
	isOutputLanguage,
	isRtl,
	LANG_LABELS,
	LANG_NAMES,
	LANGUAGE_CODES,
	LANGUAGES,
	type OutputLanguage,
} from "./languages.js";

test("LANGUAGES has 21 entries", () => {
	assert.equal(LANGUAGES.length, 21);
	assert.equal(LANGUAGE_CODES.length, 21);
});

test("LANGUAGES order is stable: en is first, AR dialects follow", () => {
	assert.equal(LANGUAGES[0].code, "en");
	assert.equal(LANGUAGES[1].code, "ar-msa");
	assert.equal(LANGUAGES[2].code, "ar-saudi");
	assert.equal(LANGUAGES[3].code, "ar-egy");
});

test("isOutputLanguage accepts every canonical code", () => {
	for (const code of LANGUAGE_CODES) {
		assert.ok(isOutputLanguage(code), `expected ${code} to be a valid OutputLanguage`);
	}
});

test("isOutputLanguage rejects unknown and legacy codes", () => {
	assert.equal(isOutputLanguage("ar-khaleeji"), false);
	assert.equal(isOutputLanguage("ar-levantine"), false);
	assert.equal(isOutputLanguage("xx"), false);
	assert.equal(isOutputLanguage(""), false);
});

test("isRtl returns true exactly for RTL languages", () => {
	const expectedRtl = new Set<OutputLanguage>(["ar-msa", "ar-saudi", "ar-egy", "fa", "ur"]);
	for (const code of LANGUAGE_CODES) {
		assert.equal(isRtl(code), expectedRtl.has(code), `mismatch for ${code}`);
	}
});

test("directionFor returns 'rtl' or 'ltr' for every language", () => {
	for (const code of LANGUAGE_CODES) {
		const dir = directionFor(code);
		assert.ok(dir === "ltr" || dir === "rtl", `bad direction for ${code}: ${dir}`);
	}
});

test("LANG_LABELS and LANG_NAMES cover every code", () => {
	for (const code of LANGUAGE_CODES) {
		assert.ok(LANG_LABELS[code], `missing label for ${code}`);
		assert.ok(LANG_NAMES[code], `missing name for ${code}`);
	}
});

test("descriptorFor returns the matching descriptor", () => {
	for (const code of LANGUAGE_CODES) {
		assert.equal(descriptorFor(code).code, code);
	}
});

test("ARABIC_DIALECTS contains exactly the three AR codes", () => {
	assert.deepEqual([...ARABIC_DIALECTS].sort(), ["ar-egy", "ar-msa", "ar-saudi"]);
});

test("isArabicDialect agrees with ARABIC_DIALECTS membership", () => {
	for (const code of LANGUAGE_CODES) {
		const expected = (ARABIC_DIALECTS as readonly OutputLanguage[]).includes(code);
		assert.equal(isArabicDialect(code), expected, `mismatch for ${code}`);
	}
});

test("canonicalizeLanguage rewrites legacy codes", () => {
	assert.equal(canonicalizeLanguage("ar-khaleeji"), "ar-saudi");
	assert.equal(canonicalizeLanguage("ar-levantine"), "ar-msa");
});

test("canonicalizeLanguage is identity on canonical codes", () => {
	for (const code of LANGUAGE_CODES) {
		assert.equal(canonicalizeLanguage(code), code);
	}
});
