import assert from "node:assert/strict";
import test from "node:test";

import { hello } from "../src/lib/hello.js";

test("hello()", () => {
	assert.equal(hello("Moe"), "Hello, Moe!");
});
