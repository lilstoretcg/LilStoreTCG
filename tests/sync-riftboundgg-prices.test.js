const assert = require("node:assert/strict");
const Module = require("node:module");

class Store {
  constructor() { this.data = new Map(); this.etags = new Map(); this.sequence = 0; this.writes = new Map(); }
  async get(key) { return this.data.has(key) ? structuredClone(this.data.get(key)) : null; }
  async getWithMetadata(key) { return this.data.has(key) ? { data: structuredClone(this.data.get(key)), etag: this.etags.get(key), metadata: {} } : null; }
  async setJSON(key, value, conditions = {}) {
    this.writes.set(key, (this.writes.get(key) || 0) + 1);
    if (conditions.onlyIfNew && this.data.has(key)) return { modified: false };
    if (conditions.onlyIfMatch && this.etags.get(key) !== conditions.onlyIfMatch) return { modified: false };
    const etag = `etag-${++this.sequence}`;
    this.data.set(key, structuredClone(value)); this.etags.set(key, etag);
    return { modified: true, etag };
  }
}

const stores = new Map();
const blobs = { connectLambda() {}, setEnvironmentContext() {}, getStore(input) { const name = typeof input === "string" ? input : input.name; if (!stores.has(name)) stores.set(name, new Store()); return stores.get(name); } };
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) { return request === "@netlify/blobs" ? blobs : originalLoad.call(this, request, parent, isMain); };
const { handler } = require("../netlify/functions/sync-riftboundgg-prices");
Module._load = originalLoad;

const inventory = blobs.getStore("lilstore-inventory");
const catalog = blobs.getStore("lilstore-catalog");
const settings = blobs.getStore("lilstore-settings");
const originalFetch = global.fetch;
process.env.ADMIN_PIN = "test-pin";
process.env.NETLIFY_BLOBS_API_TOKEN = "test-blobs-token";
const event = body => ({ httpMethod: "POST", headers: { "x-admin-pin": "test-pin", "x-nf-site-id": "site-test" }, body: JSON.stringify(body) });

(async () => {
  const card = { publicCode: "OGN-001", dotggCode: "OGN-001", name: "Card", rarity: "common", stock: 7, foilStock: 2 };
  await catalog.setJSON("cards", [{ ...card, marketPrice: 8, storePrice: 7200, priceSource: "dotgg" }]);
  await settings.setJSON("pricing", { dollar: 900, margin: 1 });
  await inventory.setJSON("inventory", { "OGN-001": { stock: 1, foilStock: 1, variants: { special: 2 } } });
  const inventoryWritesBefore = inventory.writes.get("inventory");
  global.fetch = async () => {
    // Simulate a stock/variant edit while the external DotGG request is in flight.
    await inventory.setJSON("inventory", { "OGN-001": { stock: 12, foilStock: 8, variants: { special: 5, alt: 3 } } });
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ normalPrice: 10, foilPrice: 11 }] }) };
  };
  const result = await handler(event({ cards: [card], offset: 0, limit: 25, dollar: 900, margin: 1, expectedPricingVersion: 0, operationId: "stock-during-dotgg" }));
  global.fetch = originalFetch;
  assert.equal(result.statusCode, 200);
  assert.deepEqual(await inventory.get("inventory"), { "OGN-001": { stock: 12, foilStock: 8, variants: { special: 5, alt: 3 } } });
  assert.equal(inventory.writes.get("inventory"), inventoryWritesBefore + 1, "only the simulated editor wrote inventory; DotGG never replaces it");

  const current = await catalog.get("pricing-state");
  current.pricingVersion = 1;
  await catalog.setJSON("pricing-state", current);
  const beforeConflictInventory = await inventory.get("inventory");
  const conflict = await handler(event({ cards: [card], offset: 0, limit: 25, dollar: 900, margin: 1, expectedPricingVersion: 0, operationId: "conflicting-dotgg" }));
  assert.equal(conflict.statusCode, 409, "a stale pricing version must fail");
  assert.deepEqual(await inventory.get("inventory"), beforeConflictInventory, "a price conflict does not partially apply stock");

  console.log("DotGG inventory concurrency tests passed (handler/store simulation; Netlify concurrency still requires staging verification).");
})().catch(error => { global.fetch = originalFetch; console.error(error); process.exitCode = 1; });
