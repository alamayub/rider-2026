/**
 * Strip formatting and a single leading international calling code so stored phones are national digits only.
 * Strips a calling code only when the input looks international (+ / 00 prefix) or the digit length suggests a prefix.
 */

const CALLING_CODES = [
  ...new Set(
    `386 385 383 382 381 380 379 378 377 376 375 374 373 372 371 370 359 358 357 356 355 354 353 352 351 350
     299 298 297 291 290 269 268 267 266 265 264 263 262 261 260 258 257 256 255 254 253 252 251 250 249 248 246 245 244 243 242 241 240 239 238 237 236 235 234 233 232 231 230 229 228 227 226 225 224 223 222 221 220 218 216 213 212 211
     998 996 995 994 993 992 991 990 979 978 977 976 975 974 973 972 971 970 968 967 966 965 964 963 962 961 960
     886 880 856 855 853 852
     98 95 94 93 92 91 90 86 84 82 81 66 65 64 63 62 61 60 58 57 56 55 54 52 51 49 48 47 46 45 44 43 41 40 39 36 34 33 32 31 30 27 20`
      .split(/\s+/)
      .filter(Boolean),
  ),
].sort((a, b) => b.length - a.length);

/**
 * @param {unknown} raw
 * @returns {string} digits only, no country calling code when rules apply; empty if nothing usable
 */
export function normalizeUserPhone(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';

  s = s.replace(/[\s\-().]/g, '');
  let hadInternational = false;
  if (s.startsWith('00')) {
    hadInternational = true;
    s = s.slice(2);
  }
  if (s.startsWith('+')) {
    hadInternational = true;
    s = s.slice(1);
  }

  let digits = s.replace(/\D/g, '');
  if (!digits) return '';

  const shouldStripCc = hadInternational || digits.length > 10;

  if (shouldStripCc) {
    for (const cc of CALLING_CODES) {
      if (digits.startsWith(cc) && digits.length > cc.length) {
        digits = digits.slice(cc.length);
        break;
      }
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    if (digits.length === 11 && digits.startsWith('7')) {
      digits = digits.slice(1);
    }
  }

  return digits;
}
