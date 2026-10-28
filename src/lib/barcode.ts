// Barcode helpers. Generated barcodes are EAN-13 in the 200–299 "in-store" range,
// which is reserved for internal use, so they never clash with manufacturer barcodes.

export function ean13CheckDigit(first12: string) {
  const sum = [...first12].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

/** EAN-13 built from the product's 4-digit code: 200 00000 CCCC + check digit. */
export function internalBarcodeFor(productCode: string) {
  const first12 = `20000000${productCode.padStart(4, "0")}`;
  return first12 + ean13CheckDigit(first12);
}

/** Split free text (one per line, or separated by commas/spaces) into unique barcodes. */
export function parseBarcodes(input: string) {
  return [...new Set(input.split(/[\s,;]+/).map((b) => b.trim()).filter(Boolean))];
}
