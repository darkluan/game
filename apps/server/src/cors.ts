/**
 * CORS headers for one request. In production only listed origins are allowed and an empty list
 * denies every browser; in development an empty list allows any origin.
 */
export function corsHeadersFor(
  origin: string | null,
  allowed: readonly string[],
  isProduction: boolean,
): Record<string, string> {
  const open = allowed.length === 0 && !isProduction;
  const ok = origin !== null && (open || allowed.includes(origin));
  // "null" matches no real page, so the browser blocks the response for origins that are not allowed.
  return { 'Access-Control-Allow-Origin': ok ? origin : 'null', Vary: 'Origin' };
}
