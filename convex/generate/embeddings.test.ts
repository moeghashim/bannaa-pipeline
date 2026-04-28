import assert from "node:assert/strict";
import test from "node:test";

import { cosine } from "./embeddings.js";

test("cosine of identical vectors is 1", () => {
	assert.equal(cosine([1, 0, 0], [1, 0, 0]), 1);
});

test("cosine of orthogonal vectors is 0", () => {
	assert.equal(cosine([1, 0, 0], [0, 1, 0]), 0);
});

test("cosine of opposite vectors is -1", () => {
	assert.equal(cosine([1, 0], [-1, 0]), -1);
});

test("cosine of parallel vectors is 1 regardless of magnitude", () => {
	const sim = cosine([1, 1], [2, 2]);
	assert.ok(Math.abs(sim - 1) < 1e-9, `expected ~1, got ${sim}`);
});

test("cosine of [1,2,3] and [4,5,6] matches known value", () => {
	const dot = 1 * 4 + 2 * 5 + 3 * 6;
	const expected = dot / (Math.sqrt(14) * Math.sqrt(77));
	const sim = cosine([1, 2, 3], [4, 5, 6]);
	assert.ok(Math.abs(sim - expected) < 1e-9, `expected ${expected}, got ${sim}`);
});

test("cosine returns 0 for empty vectors", () => {
	assert.equal(cosine([], []), 0);
});

test("cosine returns 0 for mismatched lengths", () => {
	assert.equal(cosine([1, 2], [1, 2, 3]), 0);
});

test("cosine returns 0 when one vector is zero", () => {
	assert.equal(cosine([0, 0, 0], [1, 1, 1]), 0);
});

test("cosine returns 0 when both vectors are zero", () => {
	assert.equal(cosine([0, 0], [0, 0]), 0);
});
