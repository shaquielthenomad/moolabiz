// Gateway-pool routing for packed MoolaBiz profiles.
//
// One OpenClaw process = one profile = many merchants (each = 2 agents). A pool of
// N gateway processes spreads merchants for density + crash blast-radius limits.
// The Hub uses this map to address the right gateway for a merchant (notify, etc.).

/**
 * Capacity model. Each merchant = 2 agents (admin + shop). Default budget keeps a
 * single 16GB VM comfortable; tune against real memory once measured.
 */
export const PACKING_DEFAULTS = {
  merchantsPerGateway: 60, // ~120 agents/process; conservative vs. the ~6-7/VM today
  gatewayBasePort: 18789, // gateway 0 = 18789, gateway 1 = 18790, ...
};

/** Stable gateway id for a merchant, given a fixed pool size. */
export function gatewayIndexForMerchant(index, merchantsPerGateway = PACKING_DEFAULTS.merchantsPerGateway) {
  return Math.floor(index / merchantsPerGateway);
}

/**
 * Assign an ordered merchant list to gateway processes.
 * @param {Array<{slug:string}>} merchants  (stable order = stable assignment)
 * @returns {Array<{gatewayId:string, index:number, port:number, merchants:Array}>}
 */
export function assignGateways(merchants, opts = {}) {
  const per = opts.merchantsPerGateway || PACKING_DEFAULTS.merchantsPerGateway;
  const basePort = opts.gatewayBasePort || PACKING_DEFAULTS.gatewayBasePort;
  const gateways = [];
  merchants.forEach((m, i) => {
    const idx = gatewayIndexForMerchant(i, per);
    if (!gateways[idx]) {
      gateways[idx] = {
        gatewayId: `moolabiz-gw-${idx}`,
        index: idx,
        port: basePort + idx,
        profile: `moolabiz-gw-${idx}`,
        merchants: [],
      };
    }
    gateways[idx].merchants.push(m);
  });
  return gateways.filter(Boolean);
}

/** slug -> { gatewayId, port } map for the Hub to route notify/catalog calls. */
export function buildSlugRoutingMap(merchants, opts = {}) {
  const map = {};
  for (const gw of assignGateways(merchants, opts)) {
    for (const m of gw.merchants) {
      map[m.slug] = { gatewayId: gw.gatewayId, port: gw.port, profile: gw.profile };
    }
  }
  return map;
}

/** Find the gateway that should host a new merchant (first with spare capacity). */
export function gatewayForNewMerchant(existingGateways, opts = {}) {
  const per = opts.merchantsPerGateway || PACKING_DEFAULTS.merchantsPerGateway;
  const withSpace = existingGateways.find((gw) => gw.merchants.length < per);
  if (withSpace) return withSpace;
  const nextIdx = existingGateways.length;
  const basePort = opts.gatewayBasePort || PACKING_DEFAULTS.gatewayBasePort;
  return {
    gatewayId: `moolabiz-gw-${nextIdx}`,
    index: nextIdx,
    port: basePort + nextIdx,
    profile: `moolabiz-gw-${nextIdx}`,
    merchants: [],
  };
}
