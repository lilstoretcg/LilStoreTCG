const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-catalog";
const CATALOG_KEY = "cards";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore(STORE_NAME);
    const catalog = await store.get(CATALOG_KEY, { type: "json" });
    return json(200, Array.isArray(catalog) ? catalog : []);
  } catch (error) {
    return json(200, []);
  }
};
