const assert = require("node:assert/strict");
const Module = require("node:module");

class MemoryStore {
  constructor() { this.values = new Map(); this.etags = new Map(); this.failKey = null; this.seq = 0; }
  async get(key) { return this.values.has(key) ? structuredClone(this.values.get(key)) : null; }
  async getWithMetadata(key) {
    if (!this.values.has(key)) return null;
    return { data: structuredClone(this.values.get(key)), etag: this.etags.get(key), metadata: {} };
  }
  async setJSON(key, value, options = {}) {
    if (this.failKey === key) { this.failKey = null; throw new Error("simulated storage failure"); }
    if (options.onlyIfNew && this.values.has(key)) return { modified: false };
    if (options.onlyIfMatch && this.etags.get(key) !== options.onlyIfMatch) return { modified: false };
    const etag = `etag-${++this.seq}`;
    this.values.set(key, structuredClone(value)); this.etags.set(key, etag);
    return { modified: true, etag };
  }
}

const stores = new Map();
const blobs = {
  connectLambda() {},
  setEnvironmentContext() {},
  getStore(options) {
    const name = typeof options === "string" ? options : options.name;
    if (!stores.has(name)) stores.set(name, new MemoryStore());
    return stores.get(name);
  }
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "@netlify/blobs") return blobs;
  return originalLoad.call(this, request, parent, isMain);
};
const { applyPricing, applyDotggQuote, updateState, PRICING_STATE_KEY } = require("../netlify/functions/pricing-state");
const settings = require("../netlify/functions/settings");
const manualPrices = require("../netlify/functions/manual-prices");
const { mergeCatalog } = require("../netlify/functions/sync-dotgg-catalog");
Module._load = originalLoad;

const settingsStore = blobs.getStore("lilstore-settings");
const catalogStore = blobs.getStore("lilstore-catalog");
const ordersStore = blobs.getStore("lilstore-orders");
const inventoryStore = blobs.getStore("lilstore-inventory");
process.env.ADMIN_PIN = "test-pin";
process.env.NETLIFY_BLOBS_API_TOKEN = "test-blobs-token";
const event = (method, body = {}, pin = "test-pin") => ({ httpMethod: method, headers: { "x-admin-pin": pin, "x-nf-site-id": "site-test" }, body: JSON.stringify(body) });
const response = result => JSON.parse(result.body);

(async () => {
  const manual = { publicCode: "OGN-001", rarity: "common", priceSource: "manual", requiresManualPrice: true, marketPrice: 10, storePrice: 1234, foilMarketPrice: 8, foilStorePrice: 987, tcgplayerId: "keep-me" };
  const automatic = { publicCode: "OGN-002", rarity: "common", priceSource: "dotgg", marketPrice: 10, storePrice: 1, foilMarketPrice: 5, foilStorePrice: 1 };
  const noQuote = { publicCode: "OGN-003", rarity: "rare", marketPrice: 0, storePrice: 777, requiresManualPrice: true };
  await catalogStore.setJSON("cards", [manual, automatic, noQuote]);
  await settingsStore.setJSON("base-prices", { common: { normal: 100, foil: 200 }, rare: { normal: 500, foil: 0 } });

  const calculated = applyPricing([manual, automatic, noQuote], { dollar: 900, margin: 1.1 }, { common: { normal: 100, foil: 200 }, rare: { normal: 500, foil: 0 } });
  assert.deepEqual(calculated[0], manual, "manual Normal/Foil prices and all metadata stay intact");
  assert.equal(calculated[1].storePrice, 9900, "automatic Normal uses USD × dollar × multiplier");
  assert.equal(calculated[1].foilStorePrice, 4950, "automatic Foil uses its own USD quote");
  assert.equal(applyPricing([{ rarity: "rare", marketPrice: 0, storePrice: 777 }], { dollar: 900, margin: 1 }, { rare: { normal: 500 } })[0].storePrice, 777, "no quote preserves the current price");
  assert.equal(applyPricing([{ rarity: "rare", marketPrice: 1, storePrice: 0 }], { dollar: 100, margin: 1 }, { rare: { normal: 500 } })[0].storePrice, 500, "rarity base is a floor");
  const manualDotgg = applyDotggQuote(manual, { normalPrice: 12, foilPrice: 9 }, { dollar: 900, margin: 1 }, {}, true);
  assert.equal(manualDotgg.changed, false, "DotGG does not change a manual quote");
  assert.deepEqual(manualDotgg.card, manual, "manual prices and requiresManualPrice survive DotGG");
  const dotggAuto = applyDotggQuote({ ...automatic, requiresManualPrice: true }, { normalPrice: 10, effectivePrice: 11, foilPrice: 5 }, { dollar: 900, margin: 1 }, { common: { normal: 100, foil: 200 } }, true);
  assert.equal(dotggAuto.card.marketPrice, 10, "DotGG normal USD price retains priority over fallback");
  assert.equal(dotggAuto.card.storePrice, 9000);
  assert.equal(dotggAuto.card.requiresManualPrice, false);

  const rebuilt = mergeCatalog([
    { publicCode: "OGN-001", dotggCode: "OGN-001", name: "Manual Name", set: "Origins", stock: 7, foilStock: 3, variants: { alt: 2 }, extraMeta: "keep", priceSource: "manual", requiresManualPrice: true, marketPrice: 9, storePrice: 1234 },
    { publicCode: "VEN-SP1", dotggCode: "VEN-SP1", name: "Missing from feed", stock: 4, foilStock: 1, specialVariants: [{ id: "promo", stock: 6 }], custom: true }
  ], [{ publicCode: "OGN-001", dotggCode: "OGN-001", name: "DotGG Name", set: "Origins", marketPrice: 99, storePrice: 0 }]);
  assert.equal(rebuilt.added, 0);
  assert.deepEqual(rebuilt.modified, ["OGN-001"]);
  assert.deepEqual(rebuilt.missing.map(card => card.publicCode), ["VEN-SP1"]);
  const preservedManual = rebuilt.cards.find(card => card.publicCode === "OGN-001");
  assert.equal(preservedManual.name, "DotGG Name");
  assert.equal(preservedManual.stock, 7);
  assert.equal(preservedManual.foilStock, 3);
  assert.deepEqual(preservedManual.variants, { alt: 2 });
  assert.equal(preservedManual.extraMeta, "keep");
  assert.equal(preservedManual.priceSource, "manual");
  assert.equal(preservedManual.requiresManualPrice, true);
  assert.equal(preservedManual.storePrice, 1234);
  assert.equal(rebuilt.cards.find(card => card.publicCode === "VEN-SP1").specialVariants[0].stock, 6);

  const unauthorized = await settings.handler(event("POST", { pricing: { dollar: 500, margin: 1 }, expectedVersion: 0 }, "wrong"));
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(await catalogStore.get(PRICING_STATE_KEY), null, "wrong PIN cannot write pricing or catalog");

  catalogStore.failKey = PRICING_STATE_KEY;
  const failedUpdate = await settings.handler(event("POST", { pricing: { dollar: 900, margin: 1 }, expectedVersion: 0, operationId: "write-fail" }));
  assert.equal(failedUpdate.statusCode, 500);
  assert.equal(await catalogStore.get(PRICING_STATE_KEY), null, "failed first write leaves no published configuration");
  assert.equal((await settings.handler(event("POST", { pricing: { dollar: 900, margin: 1 }, expectedVersion: 0, operationId: "write-fail-retry" }))).statusCode, 200);
  const savedState = await catalogStore.get(PRICING_STATE_KEY);
  assert.equal(savedState.cards.find(c => c.publicCode === "OGN-001").storePrice, 1234);
  assert.equal(savedState.cards.find(c => c.publicCode === "OGN-001").foilStorePrice, 987);
  assert.equal(savedState.cards.find(c => c.publicCode === "OGN-001").priceSource, "manual");
  assert.equal(savedState.cards.find(c => c.publicCode === "OGN-001").requiresManualPrice, true);

  const shared = response(await settings.handler(event("GET")));
  assert.deepEqual(shared.pricing, { dollar: 900, margin: 1 });
  assert.equal(shared.pricingVersion, savedState.pricingVersion);
  assert.equal(shared.catalogVersion, savedState.catalogVersion);

  const adminEdit = await manualPrices.handler(event("POST", { updates: [{ cardKey: "OGN-001", storePrice: 2345, foilStorePrice: 1987 }] }));
  assert.equal(adminEdit.statusCode, 200, "administrator can still edit manual prices");
  const afterEdit = await catalogStore.get(PRICING_STATE_KEY);
  assert.equal(afterEdit.cards[0].storePrice, 2345);
  assert.equal(afterEdit.cards[0].foilStorePrice, 1987);
  assert.equal(afterEdit.cards[0].priceSource, "manual");

  const beforeConfig = structuredClone(afterEdit);
  catalogStore.failKey = PRICING_STATE_KEY;
  const failedCatalogWrite = await settings.handler(event("POST", { pricing: { dollar: 1000, margin: 1.2 }, expectedVersion: afterEdit.pricingVersion, operationId: "catalog-fail" }));
  assert.equal(failedCatalogWrite.statusCode, 500, "storage error is not reported as success");
  assert.deepEqual(await catalogStore.get(PRICING_STATE_KEY), beforeConfig, "failed write preserves prior config and prices");

  const opId = "retry-safe";
  const retryInput = { pricing: { dollar: 1000, margin: 1.2 }, expectedVersion: beforeConfig.pricingVersion, operationId: opId };
  assert.equal((await settings.handler(event("POST", retryInput))).statusCode, 200);
  const committed = await catalogStore.get(PRICING_STATE_KEY);
  const replay = await settings.handler(event("POST", retryInput));
  assert.equal(replay.statusCode, 200);
  assert.equal((await catalogStore.get(PRICING_STATE_KEY)).version, committed.version, "replay does not commit twice");
  assert.equal(committed.cards.find(c => c.publicCode === "OGN-001").storePrice, 2345);
  assert.equal(committed.cards.find(c => c.publicCode === "OGN-002").storePrice, 12000);
  assert.equal(committed.cards.find(c => c.publicCode === "OGN-002").foilStorePrice, 6000);
  assert.equal(committed.cards.find(c => c.publicCode === "OGN-003").storePrice, 777);

  const concurrentVersion = committed.pricingVersion;
  const concurrent = await Promise.all([
    settings.handler(event("POST", { pricing: { dollar: 1100, margin: 1 }, expectedVersion: concurrentVersion, operationId: "concurrent-a" })),
    settings.handler(event("POST", { pricing: { dollar: 1200, margin: 1 }, expectedVersion: concurrentVersion, operationId: "concurrent-b" }))
  ]);
  assert.deepEqual(concurrent.map(x => x.statusCode).sort(), [200, 409], "stale concurrent settings cannot replace the newer version");

  const beforeOldReplay = await catalogStore.get(PRICING_STATE_KEY);
  const oldReplay = await settings.handler(event("POST", { pricing: retryInput.pricing, expectedVersion: retryInput.expectedVersion, operationId: opId }));
  assert.equal(oldReplay.statusCode, 409, "an old operation ID cannot report success after later commits");
  assert.equal((await catalogStore.get(PRICING_STATE_KEY)).version, beforeOldReplay.version, "old replay cannot commit a second time");

  const currentState = await catalogStore.get(PRICING_STATE_KEY);
  currentState.catalogVersion = currentState.version - 1;
  await catalogStore.setJSON(PRICING_STATE_KEY, currentState);
  assert.equal(response(await settings.handler(event("GET"))).recoveryRequired, true, "version mismatch is detectable");
  const recovered = await settings.handler(event("POST", { pricing: currentState.pricing, expectedVersion: currentState.pricingVersion, operationId: "recover-version" }));
  assert.equal(recovered.statusCode, 200);
  const recoveredState = await catalogStore.get(PRICING_STATE_KEY);
  assert.equal(recoveredState.catalogVersion, recoveredState.version, "update repairs the version marker");

  const order = { id: "00001", items: [{ unitPrice: 2500, subtotal: 5000 }], total: 5000 };
  await ordersStore.setJSON("order-00001", order);
  const inventory = { OGN: { stock: 9, foilStock: 3 } };
  await inventoryStore.setJSON("inventory", inventory);
  const beforeOrder = await ordersStore.get("order-00001");
  const beforeInventory = await inventoryStore.get("inventory");
  await settings.handler(event("POST", { pricing: { dollar: 1300, margin: 1 }, expectedVersion: (await catalogStore.get(PRICING_STATE_KEY)).pricingVersion, operationId: "isolated-config" }));
  assert.deepEqual(await ordersStore.get("order-00001"), beforeOrder, "price config does not alter historical orders");
  assert.deepEqual(await inventoryStore.get("inventory"), beforeInventory, "price config does not alter stock or reintegration data");

  console.log("Pricing-state tests passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
