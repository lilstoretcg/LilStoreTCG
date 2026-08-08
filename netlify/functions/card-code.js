// Riftbound card codes use a three-letter set prefix followed by an
// alphanumeric collector identifier that contains at least one digit.
// Examples: OGN-001, SFD-R01, SFD-R01A, VEN-SP1 and VEN-SP12A.
const CARD_CODE_PATTERN = /^([A-Z]{3})[-\s]?([A-Z]*\d+[A-Z0-9]*)(?:-P)?$/;

function normalizeCardCode(raw = "") {
  const text = String(raw || "")
    .toUpperCase()
    .trim()
    .split("/")[0];

  const match = text.match(CARD_CODE_PATTERN);
  return match ? `${match[1]}-${match[2]}` : "";
}

module.exports = { CARD_CODE_PATTERN, normalizeCardCode };
