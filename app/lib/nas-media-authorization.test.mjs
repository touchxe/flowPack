import assert from "node:assert/strict";
import test from "node:test";

import { userOwnsNasObjectReference } from "./nas-media-authorization.mjs";

const KEY = `objects/aa/${"a".repeat(64)}.png`;

function repository(results = {}) {
  const calls = [];
  const table = (name) => ({
    async findFirst(query) {
      calls.push({ name, query });
      return results[name] ? { id: `${name}-owned` } : null;
    },
  });
  return {
    calls,
    data: {
      mediaFile: table("mediaFile"),
      contentImage: table("contentImage"),
      content: table("content"),
    },
  };
}

test("authorizes any owned reference while issuing only bounded read queries", async () => {
  for (const ownerTable of ["mediaFile", "contentImage", "content"]) {
    const mock = repository({ [ownerTable]: true });
    assert.equal(
      await userOwnsNasObjectReference({ db: mock.data, userId: "user-1", key: KEY }),
      true,
    );
    assert.deepEqual(mock.calls.map(({ name }) => name).sort(), ["content", "contentImage", "mediaFile"]);
    for (const { query } of mock.calls) assert.deepEqual(query.select, { id: true });
    assert.equal(JSON.stringify(mock.calls).includes("user-1"), true);
    assert.equal(JSON.stringify(mock.calls).includes(`/api/nas-owned-media/${KEY}`), true);
  }
});

test("fails closed for missing identity, malformed input, or an unowned key", async () => {
  const mock = repository();
  assert.equal(await userOwnsNasObjectReference({ db: mock.data, userId: "user-1", key: KEY }), false);
  assert.equal(await userOwnsNasObjectReference({ db: mock.data, userId: "", key: KEY }), false);
  assert.equal(await userOwnsNasObjectReference({ db: mock.data, userId: "user-1", key: "../escape" }), false);
});
