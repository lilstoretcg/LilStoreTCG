const assert = require("node:assert/strict");
const { getStore, connectLambda } = require("@netlify/blobs");
const { connectSharedStorage, getSharedStore, requireStrongStorage } = require("../netlify/functions/pricing-state");

async function main() {
  const calls = [];
  let nextStatus = 200;
  const store = getStore({
    name: "sdk-compat-test",
    siteID: "site-test",
    token: "token-test",
    edgeURL: "https://blobs-edge.example",
    uncachedEdgeURL: "https://blobs-strong.example",
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      const status = nextStatus;
      return new Response(status === 200 ? "{}" : "failure", {
        status,
        headers: status === 200 ? { etag: '"etag-next"' } : {}
      });
    }
  });

  const created = await store.setJSON("state", { version: 1 }, { onlyIfNew: true });
  assert.deepEqual(created, { etag: '"etag-next"', modified: true });
  assert.equal(calls.at(-1).options.headers["if-none-match"], "*");

  const updated = await store.setJSON("state", { version: 2 }, { onlyIfMatch: '"etag-prev"' });
  assert.deepEqual(updated, { etag: '"etag-next"', modified: true });
  assert.equal(calls.at(-1).options.headers["if-match"], '"etag-prev"');

  nextStatus = 412;
  assert.deepEqual(await store.setJSON("state", { version: 3 }, { onlyIfMatch: '"stale"' }), { modified: false });

  nextStatus = 503;
  const outage = await store.setJSON("state", { version: 4 }, { onlyIfMatch: '"etag-prev"' });
  assert.equal(outage.modified, true, "documents SDK conditional-write error behavior");
  assert.equal(outage.etag, "", "application must reject this empty-ETag false success");

  nextStatus = 200;
  const read = await store.getWithMetadata("state", { type: "json", consistency: "strong" });
  assert.deepEqual(read.data, {});
  assert.equal(new URL(calls.at(-1).url).origin, "https://blobs-strong.example", "strong reads use the uncached endpoint");

  connectLambda({
    blobs: Buffer.from(JSON.stringify({ url: "https://edge.example", token: "edge-token" })).toString("base64"),
    headers: { "x-nf-site-id": "site-test" }
  });
  await assert.rejects(
    () => getStore({ name: "lambda-strong-test", consistency: "strong" }).get("state"),
    /uncachedEdgeURL/
  );

  const originalFetch = global.fetch;
  const directUrls = [];
  global.fetch = async url => {
    directUrls.push(String(url));
    return directUrls.length === 1
      ? new Response(JSON.stringify({ url: "https://signed-blobs.example/state" }), { status: 200 })
      : new Response("{}", { status: 200, headers: { etag: '"read-etag"' } });
  };
  process.env.NETLIFY_BLOBS_API_TOKEN = "private-test-token";
  process.env.NETLIFY_SITE_ID = "site-test";
  assert.throws(
    () => connectSharedStorage({ blobs: Buffer.from(JSON.stringify({ url: "https://edge.example", token: "edge-token" })).toString("base64"), headers: { "x-nf-site-id": "other-site" } }),
    /no coincide con NETLIFY_SITE_ID/,
    "a request header cannot select another Blobs site when the deployment site is configured"
  );
  connectSharedStorage({ blobs: Buffer.from(JSON.stringify({ url: "https://edge.example", token: "edge-token" })).toString("base64"), headers: { "x-nf-site-id": "site-test" } });
  assert.deepEqual(await getSharedStore("pricing-test").get("state", { type: "json" }), {});
  assert.equal(new URL(directUrls[0]).origin, "https://api.netlify.com", "configured private API token activates strong direct API reads");
  delete process.env.NETLIFY_BLOBS_API_TOKEN;
  delete process.env.NETLIFY_SITE_ID;
  global.fetch = originalFetch;
  connectSharedStorage({ blobs: Buffer.from(JSON.stringify({ url: "https://edge.example", token: "edge-token" })).toString("base64"), headers: { "x-nf-site-id": "site-test" } });
  assert.throws(() => requireStrongStorage(), error => error.statusCode === 503, "versioned writes fail closed without the private API token");

  console.log("Netlify Blobs 10.7.13 API compatibility tests passed.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
