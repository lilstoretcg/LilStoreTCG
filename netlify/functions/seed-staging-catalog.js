const { updateState, connectSharedStorage, getSharedStore, requireStrongStorage, applyPricing } = require("./pricing-state");

const CATALOG_STORE = "lilstore-catalog";
const SETTINGS_STORE = "lilstore-settings";
const INVENTORY_STORE = "lilstore-inventory";
const FIXTURE_KEY = "staging-seed-v1";
const FIXTURE = require("../../tests/fixtures/staging-catalog.json");
const DEFAULT_BASE_PRICES = {
  common:{normal:100,foil:200}, uncommon:{normal:300,foil:400}, rare:{normal:500,foil:0},
  epic:{normal:1000,foil:0}, showcase:{normal:2000,foil:0}
};

function json(statusCode, body){
  return { statusCode, headers:{"Content-Type":"application/json", "Access-Control-Allow-Headers":"Content-Type, x-admin-pin", "Access-Control-Allow-Methods":"POST, OPTIONS"}, body:JSON.stringify(body) };
}

exports.handler = async event => {
  if(event.httpMethod === "OPTIONS") return json(200,{ok:true});
  if(event.httpMethod !== "POST") return json(405,{error:"Método no permitido."});

  const host = String(event.headers?.host || event.headers?.Host || "").toLowerCase().split(":")[0];
  const configuredSite = process.env.NETLIFY_SITE_ID || "";
  const stagingSite = process.env.STAGING_NETLIFY_SITE_ID || "";
  const requestSite = event.headers?.["x-nf-site-id"] || event.headers?.["X-Nf-Site-Id"] || "";
  if(host !== "pruebastienda.netlify.app" || !stagingSite || !configuredSite || configuredSite !== stagingSite || (requestSite && requestSite !== stagingSite)){
    return json(403,{error:"La inicialización está habilitada solo para el proyecto aislado de staging configurado."});
  }

  const adminPin = process.env.ADMIN_PIN || "";
  const receivedPin = event.headers?.["x-admin-pin"] || event.headers?.["X-Admin-Pin"] || "";
  if(!adminPin) return json(503,{error:"Falta configurar ADMIN_PIN en el proyecto de staging."});
  if(receivedPin !== adminPin) return json(401,{error:"PIN incorrecto."});

  try{
    connectSharedStorage(event);
    requireStrongStorage();
    const catalogStore = getSharedStore(CATALOG_STORE);
    const settingsStore = getSharedStore(SETTINGS_STORE);
    const inventoryStore = getSharedStore(INVENTORY_STORE);
    const inventory = await inventoryStore.get("inventory",{type:"json"});
    if(inventory && Object.keys(inventory).length) return json(409,{error:"El inventario remoto no está vacío; se detuvo la inicialización sin modificar datos."});
    const basePrices = await settingsStore.get("base-prices",{type:"json"});
    const state = await updateState(catalogStore, latest => {
      if(Array.isArray(latest.cards) && latest.cards.length) {
        const conflict = new Error("El catálogo no está vacío; se detuvo la inicialización sin reemplazar cartas.");
        conflict.statusCode = 409;
        throw conflict;
      }
      return { ...latest, cards:applyPricing(FIXTURE,latest.pricing || {dollar:900,margin:1},basePrices || DEFAULT_BASE_PRICES) };
    }, FIXTURE_KEY);
    return json(200,{ok:true,replayed:Boolean(state._replayedOperationId),cards:state.cards.length,stateVersion:state.version,catalogVersion:state.catalogVersion,pricingVersion:state.pricingVersion});
  }catch(error){
    if(error.statusCode === 409) return json(409,{error:error.message});
    return json(error.statusCode || 503,{error:"No se pudo inicializar el catálogo sintético de staging."});
  }
};
