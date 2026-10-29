// Barcodes drawn as SVG for shelf labels. EAN-13 for 13-digit codes (the retail standard, and what
// products get from internalBarcodeFor); Code 128 for anything else (letters, other lengths).

// Bar/space widths for each of the 107 symbols (Start A/B/C = 103/104/105, Stop = 106).
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;

/** Symbol values for a text, with the check symbol and stop. Only printable ASCII (32–126). */
export function code128Symbols(text: string): number[] {
  if (!text || /[^\x20-\x7e]/.test(text)) throw new Error("Code 128 needs printable characters");
  const numeric = /^\d+$/.test(text) && text.length % 2 === 0 && text.length >= 4;
  const symbols: number[] = [];
  if (numeric) {
    symbols.push(START_C);
    for (let i = 0; i < text.length; i += 2) symbols.push(Number(text.slice(i, i + 2)));
  } else {
    symbols.push(START_B);
    let i = 0;
    while (i < text.length) {
      // Switch to code set C for long runs of digits (4+ at the end, 6+ in the middle).
      const run = /^\d+/.exec(text.slice(i))?.[0].length ?? 0;
      const atEnd = i + run === text.length;
      if (run >= (atEnd ? 4 : 6)) {
        const pairs = Math.floor(run / 2) * 2;
        symbols.push(CODE_C);
        for (let j = 0; j < pairs; j += 2) symbols.push(Number(text.slice(i + j, i + j + 2)));
        i += pairs;
        if (i < text.length) symbols.push(CODE_B);
        continue;
      }
      symbols.push(text.charCodeAt(i) - 32);
      i++;
    }
  }
  const check = symbols.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  return [...symbols, check, STOP];
}

/** The barcode as modules: "1" = bar, "0" = space (each module is one narrow bar wide). */
export function code128Modules(text: string): string {
  return code128Symbols(text)
    .map((s) =>
      PATTERNS[s]
        .split("")
        .map((w, i) => (i % 2 === 0 ? "1" : "0").repeat(Number(w)))
        .join(""),
    )
    .join("");
}

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** A 13-digit code with a correct check digit. */
export function isEan13(text: string) {
  if (!/^\d{13}$/.test(text)) return false;
  const sum = [...text.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === Number(text[12]);
}

/** EAN-13 modules: guard, 6 digits (parity set by the first digit), centre guard, 6 digits, guard. */
export function ean13Modules(text: string): string {
  const d = [...text].map(Number);
  const parity = EAN_PARITY[d[0]];
  const left = d.slice(1, 7).map((n, i) => (parity[i] === "L" ? EAN_L : EAN_G)[n]).join("");
  const right = d.slice(7).map((n) => EAN_R[n]).join("");
  return `101${left}01010${right}101`;
}

/** The modules for a code: EAN-13 when it is one, otherwise Code 128. */
export function barcodeModules(text: string) {
  return isEan13(text) ? { type: "EAN-13" as const, modules: ean13Modules(text) } : { type: "Code 128" as const, modules: code128Modules(text) };
}

/** SVG of the barcode, scaled to fill its box (quiet zone of 10 modules on each side). */
export function barcodeSvg(text: string) {
  const { modules } = barcodeModules(text);
  const quiet = 10;
  const width = modules.length + quiet * 2;
  let bars = "";
  for (let i = 0; i < modules.length; ) {
    if (modules[i] === "1") {
      let j = i;
      while (modules[j] === "1") j++;
      bars += `<rect x="${i + quiet}" y="0" width="${j - i}" height="40"/>`;
      i = j;
    } else i++;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 40" preserveAspectRatio="none" shape-rendering="crispEdges">${bars}</svg>`;
}
