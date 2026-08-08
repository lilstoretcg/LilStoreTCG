const assert = require("node:assert/strict");
const { normalizeCardCode } = require("../netlify/functions/card-code");

for (const code of ["OGN-001", "SFD-R01", "UNL-R01A", "VEN-SP1", "VEN-SP6", "VEN-SP12A"]) {
  assert.equal(normalizeCardCode(code), code);
}

assert.equal(normalizeCardCode("VEN SP42"), "VEN-SP42");
assert.equal(normalizeCardCode("VEN-SP1/999"), "VEN-SP1");
assert.equal(normalizeCardCode("VEN-SP"), "");
assert.equal(normalizeCardCode("VEN-SPECIAL"), "");
console.log("Card-code format tests passed.");
