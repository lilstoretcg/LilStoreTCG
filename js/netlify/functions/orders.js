const { getStore, connectLambda } = require("@netlify/blobs");

const ORDER_STORE = "lilstore-orders";
const INVENTORY_STORE = "lilstore-inventory";
const INVENTORY_KEY = "inventory";
const COUNTER_KEY = "counter";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-pin",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function orderKey(orderId) {
  return `order-${String(orderId).replace("#", "").padStart(5, "0")}`;
}

function normalizeOrderId(orderId) {
  return String(orderId || "").replace("#", "").trim().padStart(5, "0");
}

async function nextOrderId(store) {
  const current = await store.get(COUNTER_KEY, { type: "json" });
  const next = Number(current?.last || 0) + 1;
  await store.setJSON(COUNTER_KEY, { last: next, updatedAt: new Date().toISOString() });
  return String(next).padStart(5, "0");
}

function validateItems(items) {
  if (!Array.isArray(items) || !items.length) return [];

  return items
    .map(item => ({
      cardKey: String(item.cardKey || item.publicCode || item.dotggCode || "").trim(),
      name: String(item.name || "Carta").trim(),
      code: String(item.code || item.publicCode || item.dotggCode || item.cardKey || "").trim(),
      variant: item.variant === "foil" ? "foil" : "normal",
      qty: Math.max(1, Math.round(Number(item.qty || 1))),
      unitPrice: Math.max(0, Math.round(Number(item.unitPrice || 0))),
      subtotal: Math.max(0, Math.round(Number(item.subtotal || 0)))
    }))
    .filter(item => item.cardKey && item.qty > 0);
}

async function completeOrder(orderStore, inventoryStore, orderId) {
  const id = normalizeOrderId(orderId);
  const key = orderKey(id);
  const order = await orderStore.get(key, { type: "json" });

  if (!order) {
    return { ok: false, statusCode: 404, body: { error: `No existe el pedido #${id}.` } };
  }

  if (order.status === "completed") {
    return { ok: false, statusCode: 409, body: { error: `El pedido #${id} ya fue descontado anteriormente.`, order } };
  }

  if (order.status === "cancelled") {
    return { ok: false, statusCode: 409, body: { error: `El pedido #${id} está cancelado.`, order } };
  }

  const inventory = await inventoryStore.get(INVENTORY_KEY, { type: "json" }) || {};
  const problems = [];

  for (const item of order.items || []) {
    const entry = inventory[item.cardKey] || {};
    const field = item.variant === "foil" ? "foilStock" : "stock";
    const currentStock = Number(entry[field] || 0);

    if (currentStock < item.qty) {
      problems.push({
        cardKey: item.cardKey,
        name: item.name,
        variant: item.variant,
        requested: item.qty,
        available: currentStock
      });
    }
  }

  if (problems.length) {
    return {
      ok: false,
      statusCode: 409,
      body: {
        error: "No hay stock suficiente para descontar este pedido.",
        problems,
        order
      }
    };
  }

  for (const item of order.items || []) {
    inventory[item.cardKey] = inventory[item.cardKey] || {};
    const field = item.variant === "foil" ? "foilStock" : "stock";
    inventory[item.cardKey][field] = Math.max(0, Number(inventory[item.cardKey][field] || 0) - item.qty);
  }

  order.status = "completed";
  order.completedAt = new Date().toISOString();

  await inventoryStore.setJSON(INVENTORY_KEY, inventory);
  await orderStore.setJSON(key, order);

  return {
    ok: true,
    statusCode: 200,
    body: {
      ok: true,
      message: `Pedido #${id} descontado correctamente.`,
      order,
      inventory
    }
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    connectLambda(event);
    const orderStore = getStore(ORDER_STORE);
    const inventoryStore = getStore(INVENTORY_STORE);

    if (event.httpMethod === "GET") {
      const orderId = normalizeOrderId(event.queryStringParameters?.id || "");
      if (!orderId || orderId === "00000") return json(400, { error: "Falta el número de pedido." });

      const order = await orderStore.get(orderKey(orderId), { type: "json" });
      if (!order) return json(404, { error: `No existe el pedido #${orderId}.` });

      return json(200, { ok: true, order });
    }

    if (event.httpMethod === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "JSON inválido." });
      }

      const action = payload.action || "create";

      if (action === "create") {
        const items = validateItems(payload.items || []);
        if (!items.length) return json(400, { error: "El pedido no contiene cartas válidas." });

        const orderId = await nextOrderId(orderStore);
        const total = items.reduce((sum, item) => sum + Number(item.subtotal || item.unitPrice * item.qty || 0), 0);

        const order = {
          id: orderId,
          status: "pending",
          source: "LilStore TCG",
          createdAt: new Date().toISOString(),
          completedAt: null,
          customerNote: payload.customerNote || "",
          items,
          total
        };

        await orderStore.setJSON(orderKey(orderId), order);

        return json(200, { ok: true, order });
      }

      if (action === "complete") {
        const adminPin = process.env.ADMIN_PIN || "";
        const receivedPin = event.headers["x-admin-pin"] || event.headers["X-Admin-Pin"] || "";

        if (!adminPin) return json(500, { error: "Falta configurar ADMIN_PIN en Netlify." });
        if (receivedPin !== adminPin) return json(401, { error: "PIN incorrecto." });

        const result = await completeOrder(orderStore, inventoryStore, payload.orderId);
        return json(result.statusCode, result.body);
      }

      if (action === "cancel") {
        const adminPin = process.env.ADMIN_PIN || "";
        const receivedPin = event.headers["x-admin-pin"] || event.headers["X-Admin-Pin"] || "";

        if (!adminPin) return json(500, { error: "Falta configurar ADMIN_PIN en Netlify." });
        if (receivedPin !== adminPin) return json(401, { error: "PIN incorrecto." });

        const id = normalizeOrderId(payload.orderId);
        const key = orderKey(id);
        const order = await orderStore.get(key, { type: "json" });
        if (!order) return json(404, { error: `No existe el pedido #${id}.` });

        order.status = "cancelled";
        order.cancelledAt = new Date().toISOString();
        await orderStore.setJSON(key, order);
        return json(200, { ok: true, order });
      }

      return json(400, { error: "Acción no válida." });
    }

    return json(405, { error: "Método no permitido." });
  } catch (error) {
    return json(500, {
      error: "Error interno en orders.js",
      message: error.message || String(error)
    });
  }
};
