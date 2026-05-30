import { type Address } from 'viem';
import { publicClient, serializeBigInts } from '../client.js';
import { CONTRACTS } from '../config.js';
import { SentryLaunchFactoryABI } from '../abis/SentryLaunchFactory.js';
import { TsunamiQuoterV2ABI } from '../abis/TsunamiQuoterV2.js';
import { querySubgraph } from './subgraph.js';

const FACTORY = CONTRACTS.SentryLaunchFactory as Address;
const QUOTER = CONTRACTS.TsunamiQuoterV2 as Address;

const num = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

async function readLaunchType(tokenId: string | number): Promise<Record<string, unknown> | null> {
  try {
    const id = BigInt(tokenId);
    const [isAgent, isKraken, isGoPump] = await Promise.all([
      publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isAgentPosition', args: [id] }).catch(() => false),
      publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isKrakenVerifiedPosition', args: [id] }).catch(() => false),
      publicClient.readContract({ address: FACTORY, abi: SentryLaunchFactoryABI, functionName: 'isGoPumpMePosition', args: [id] }).catch(() => false),
    ]) as [boolean, boolean, boolean];
    const type = isGoPump ? 'gopumpme' : isKraken ? 'kraken_verified' : isAgent ? 'agent' : 'permissionless';
    return { tokenId: id.toString(), type, isAgent, isKrakenVerified: isKraken, isGoPumpMe: isGoPump };
  } catch {
    return null;
  }
}

export const analyticsTools = [
  {
    name: 'analytics_token_report',
    description: 'Premium analytics (free). One-call dossier for a token: USD price, FDV, total liquidity, 24h volume and price change, every Tsunami pool it trades in, and — for Sentry tokens — launch type (agent/kraken/gopumpme) and creator. Composes the Tsunami subgraph with onchain Sentry reads.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'Token contract address.' },
      },
      required: ['token'],
    },
  },
  {
    name: 'analytics_pool_health',
    description: 'Premium analytics (free). Health report for a Tsunami pool: TVL, 7d volume/fees, estimated fee APR, and an onchain price-impact curve for sample trade sizes (via the Tsunami quoter).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pool: { type: 'string', description: 'Pool contract address.' },
        sampleSizes: { type: 'array', items: { type: 'string' }, description: 'Optional token0 trade sizes in WHOLE token0 units for the impact curve (default ["1","10","100","1000"]).' },
      },
      required: ['pool'],
    },
  },
  {
    name: 'analytics_top_movers',
    description: 'Premium analytics (free). Top Tsunami tokens by volume over a window, with price change ("what is pumping"). Useful for discovery agents.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        window: { type: 'string', description: '24h (default) or 7d.' },
        first: { type: 'number', description: 'How many tokens to return (default 15).' },
      },
    },
  },
  {
    name: 'analytics_new_launches',
    description: 'Premium analytics (free). Most recently launched Sentry tokens with early traction (TVL, volume, fees, tx count), newest first. Optionally limited to a recent window.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        window: { type: 'string', description: '24h, 7d, or all (default 7d).' },
        first: { type: 'number', description: 'How many launches to return (default 15).' },
      },
    },
  },
  {
    name: 'analytics_creator_dashboard',
    description: 'Premium analytics (free). Creator-wide rollup across all of a creator\'s Sentry tokens: token count, aggregate TVL/volume/pool fees, total creator fees paid out (USD + base amount), and best/worst performers by volume.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        creator: { type: 'string', description: 'Creator wallet address.' },
      },
      required: ['creator'],
    },
  },
  {
    name: 'analytics_wallet_pnl',
    description: 'Premium analytics (free). Estimated PnL for a wallet\'s Tsunami LP positions: deposited vs withdrawn value, collected fees, and a realized-PnL estimate (USD), valued at current token prices. Estimate only — current prices, not historical cost basis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        wallet: { type: 'string', description: 'Wallet address.' },
      },
      required: ['wallet'],
    },
  },
  {
    name: 'analytics_token_risk',
    description: 'Premium analytics (free). Heuristic risk/safety assessment for a token: liquidity-lock status (Sentry LP is permanently locked in the factory — no liquidity rug), launch type, liquidity depth, pool age, and drawdown from recent high. Returns a 0-100 safety score with flags. Not financial advice.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'Token contract address.' },
      },
      required: ['token'],
    },
  },
  {
    name: 'analytics_search',
    description: 'Premium analytics (free). Search indexed Tsunami tokens by symbol or name substring (case-insensitive), ranked by lifetime volume. Returns price, FDV inputs, liquidity, and volume per match.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Symbol or name substring to search for.' },
        first: { type: 'number', description: 'Max results (default 15).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'analytics_leaderboard',
    description: 'Premium analytics (free). Ecosystem leaderboards: top creators by creator fees paid out, or top tokens by volume.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        by: { type: 'string', description: 'Leaderboard type: "creators" (default, by creator fees paid out) or "tokens" (by lifetime volume).' },
        first: { type: 'number', description: 'How many entries to return (default 15).' },
      },
    },
  },
];

const SENTRY_POOL_FIELDS = `
  id feeTier token0 { id symbol name decimals } token1 { id symbol name decimals }
  token0Price token1Price totalValueLockedUSD volumeUSD feesUSD txCount
  isSentry sentryCreator sentryTokenId sentryToken
`;

export async function handleAnalyticsTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'analytics_token_report': {
      const id = String(args.token).toLowerCase();
      const data = await querySubgraph(
        `query($id: ID!, $addr: String!) {
          token(id: $id) { id symbol name decimals totalSupply volumeUSD feesUSD totalValueLockedUSD derivedETH txCount poolCount }
          bundles(first: 1) { ethPriceUSD }
          day: tokenDayDatas(where: { token: $addr }, orderBy: date, orderDirection: desc, first: 8) {
            date priceUSD open close high low volumeUSD feesUSD
          }
          p0: pools(where: { token0: $addr }, orderBy: totalValueLockedUSD, orderDirection: desc, first: 10) { ${SENTRY_POOL_FIELDS} }
          p1: pools(where: { token1: $addr }, orderBy: totalValueLockedUSD, orderDirection: desc, first: 10) { ${SENTRY_POOL_FIELDS} }
        }`,
        { id, addr: id },
      );
      const t = data.token;
      if (!t) throw new Error(`Token ${args.token} not indexed in the Tsunami subgraph (no pool yet).`);
      const ethUsd = num(data.bundles?.[0]?.ethPriceUSD);
      const decimals = num(t.decimals) || 18;
      const priceUSD = num(t.derivedETH) * ethUsd;
      const supply = num(t.totalSupply) / 10 ** decimals;
      const fdvUSD = priceUSD * supply;
      const days = (data.day ?? []) as Array<Record<string, unknown>>;
      const today = days[0];
      const prev = days[1];
      const change24hPct = today && prev && num(prev.close) > 0
        ? ((num(today.close) - num(prev.close)) / num(prev.close)) * 100
        : null;
      const pools = [...(data.p0 ?? []), ...(data.p1 ?? [])] as Array<Record<string, unknown>>;
      const liquidityUSD = pools.reduce((s, p) => s + num(p.totalValueLockedUSD), 0);
      const sentryPool = pools.find((p) => p.isSentry);
      const launch = sentryPool && sentryPool.sentryTokenId != null
        ? await readLaunchType(sentryPool.sentryTokenId as string)
        : null;
      return serializeBigInts({
        token: { address: t.id, symbol: t.symbol, name: t.name, decimals },
        priceUSD,
        fdvUSD,
        liquidityUSD,
        volume24hUSD: today ? num(today.volumeUSD) : null,
        change24hPct,
        lifetimeVolumeUSD: num(t.volumeUSD),
        lifetimeFeesUSD: num(t.feesUSD),
        txCount: num(t.txCount),
        isSentryToken: Boolean(sentryPool),
        launch,
        pools: pools.map((p) => ({
          pool: p.id,
          feeTier: num(p.feeTier),
          pair: `${(p.token0 as any)?.symbol}/${(p.token1 as any)?.symbol}`,
          tvlUSD: num(p.totalValueLockedUSD),
          volumeUSD: num(p.volumeUSD),
          feesUSD: num(p.feesUSD),
          isSentry: Boolean(p.isSentry),
          sentryCreator: p.sentryCreator ?? null,
          sentryTokenId: p.sentryTokenId ?? null,
        })),
      });
    }

    case 'analytics_pool_health': {
      const id = String(args.pool).toLowerCase();
      const data = await querySubgraph(
        `query($id: ID!) {
          pool(id: $id) {
            id feeTier liquidity tick token0Price token1Price
            totalValueLockedToken0 totalValueLockedToken1 totalValueLockedUSD volumeUSD feesUSD
            isSentry sentryTokenId sentryCreator
            token0 { id symbol decimals } token1 { id symbol decimals }
          }
          day: poolDayDatas(where: { pool: $id }, orderBy: date, orderDirection: desc, first: 7) {
            date feesUSD volumeUSD tvlUSD
          }
        }`,
        { id },
      );
      const p = data.pool;
      if (!p) throw new Error(`Pool ${args.pool} not found in the Tsunami subgraph.`);
      const tvlUSD = num(p.totalValueLockedUSD);
      const dayRows = (data.day ?? []) as Array<Record<string, unknown>>;
      const fees7dUSD = dayRows.reduce((s, x) => s + num(x.feesUSD), 0);
      const vol7dUSD = dayRows.reduce((s, x) => s + num(x.volumeUSD), 0);
      const feeAprPct = tvlUSD > 0 ? ((fees7dUSD / Math.max(dayRows.length, 1)) * 365) / tvlUSD * 100 : null;

      // Onchain price-impact curve: sell token0 -> token1 at increasing sizes.
      const token0 = (p.token0 as any).id as Address;
      const token1 = (p.token1 as any).id as Address;
      const dec0 = num((p.token0 as any).decimals) || 18;
      const feeTier = num(p.feeTier);
      const sizes = (Array.isArray(args.sampleSizes) && args.sampleSizes.length
        ? (args.sampleSizes as string[])
        : ['1', '10', '100', '1000']);
      let priceImpact: Array<Record<string, unknown>> | null = null;
      try {
        const refIn = BigInt(Math.round(10 ** dec0)); // 1 whole token0
        const refSim = await publicClient.simulateContract({
          address: QUOTER, abi: TsunamiQuoterV2ABI, functionName: 'quoteExactInputSingle',
          args: [{ tokenIn: token0, tokenOut: token1, amountIn: refIn, fee: feeTier, sqrtPriceLimitX96: 0n }],
        });
        const refOut = (refSim.result as any)[0] as bigint;
        const refPrice = Number(refOut) / Number(refIn);
        priceImpact = [];
        for (const whole of sizes) {
          const amountIn = BigInt(Math.round(Number(whole) * 10 ** dec0));
          if (amountIn <= 0n) continue;
          const sim = await publicClient.simulateContract({
            address: QUOTER, abi: TsunamiQuoterV2ABI, functionName: 'quoteExactInputSingle',
            args: [{ tokenIn: token0, tokenOut: token1, amountIn, fee: feeTier, sqrtPriceLimitX96: 0n }],
          });
          const out = (sim.result as any)[0] as bigint;
          const execPrice = Number(out) / Number(amountIn);
          const impactPct = refPrice > 0 ? (1 - execPrice / refPrice) * 100 : null;
          priceImpact.push({ sizeToken0: whole, amountOut: out.toString(), impactPct });
        }
      } catch {
        priceImpact = null; // quoter unavailable / illiquid direction
      }

      return serializeBigInts({
        pool: {
          address: p.id,
          pair: `${(p.token0 as any).symbol}/${(p.token1 as any).symbol}`,
          feeTier,
          isSentry: Boolean(p.isSentry),
          sentryTokenId: p.sentryTokenId ?? null,
          sentryCreator: p.sentryCreator ?? null,
        },
        tvlUSD,
        volume7dUSD: vol7dUSD,
        fees7dUSD,
        feeAprPct,
        liquidity: p.liquidity,
        tick: num(p.tick),
        priceImpact,
        impactDirection: `${(p.token0 as any).symbol} -> ${(p.token1 as any).symbol}`,
      });
    }

    case 'analytics_top_movers': {
      const window = String(args.window ?? '24h') === '7d' ? '7d' : '24h';
      const first = num(args.first) || 15;
      const days = window === '7d' ? 7 : 1;
      const sinceDate = Math.floor((Date.now() / 1000 - days * 86400) / 86400) * 86400;
      const data = await querySubgraph(
        `query($date: Int!, $first: Int!) {
          tokenDayDatas(where: { date_gte: $date }, orderBy: volumeUSD, orderDirection: desc, first: $first) {
            date volumeUSD open close token { id symbol name }
          }
        }`,
        { date: sinceDate, first: first * 4 },
      );
      const rows = (data.tokenDayDatas ?? []) as Array<Record<string, unknown>>;
      const agg = new Map<string, { symbol: string; name: string; volumeUSD: number; open: number; openDate: number; close: number; closeDate: number }>();
      for (const r of rows) {
        const tok = r.token as any;
        const key = tok.id as string;
        const date = num(r.date);
        const cur = agg.get(key) ?? { symbol: tok.symbol, name: tok.name, volumeUSD: 0, open: num(r.open), openDate: date, close: num(r.close), closeDate: date };
        cur.volumeUSD += num(r.volumeUSD);
        if (date <= cur.openDate) { cur.open = num(r.open); cur.openDate = date; }
        if (date >= cur.closeDate) { cur.close = num(r.close); cur.closeDate = date; }
        agg.set(key, cur);
      }
      const movers = [...agg.entries()]
        .map(([address, v]) => ({
          address,
          symbol: v.symbol,
          name: v.name,
          volumeUSD: v.volumeUSD,
          priceOpen: v.open,
          priceClose: v.close,
          changePct: v.open > 0 ? ((v.close - v.open) / v.open) * 100 : null,
        }))
        .sort((a, b) => b.volumeUSD - a.volumeUSD)
        .slice(0, first);
      return serializeBigInts({ window, count: movers.length, movers });
    }

    case 'analytics_new_launches': {
      const window = String(args.window ?? '7d');
      const first = num(args.first) || 15;
      const where: Record<string, unknown> = { isSentry: true };
      if (window === '24h') where.createdAtTimestamp_gte = Math.floor(Date.now() / 1000 - 86400);
      else if (window === '7d') where.createdAtTimestamp_gte = Math.floor(Date.now() / 1000 - 7 * 86400);
      const data = await querySubgraph(
        `query($where: Pool_filter!, $first: Int!) {
          pools(where: $where, orderBy: createdAtTimestamp, orderDirection: desc, first: $first) {
            id createdAtTimestamp sentryCreator sentryTokenId sentryToken feeTier
            token0 { id symbol name } token1 { id symbol name }
            totalValueLockedUSD volumeUSD feesUSD txCount
          }
        }`,
        { where, first },
      );
      const pools = (data.pools ?? []) as Array<Record<string, unknown>>;
      return serializeBigInts({
        window,
        count: pools.length,
        launches: pools.map((p) => ({
          pool: p.id,
          createdAt: new Date(num(p.createdAtTimestamp) * 1000).toISOString(),
          sentryToken: p.sentryToken ?? null,
          sentryTokenId: p.sentryTokenId ?? null,
          creator: p.sentryCreator ?? null,
          pair: `${(p.token0 as any)?.symbol}/${(p.token1 as any)?.symbol}`,
          feeTier: num(p.feeTier),
          tvlUSD: num(p.totalValueLockedUSD),
          volumeUSD: num(p.volumeUSD),
          feesUSD: num(p.feesUSD),
          txCount: num(p.txCount),
        })),
      });
    }

    case 'analytics_creator_dashboard': {
      const creator = String(args.creator).toLowerCase();
      const data = await querySubgraph(
        `query($creator: String!) {
          pools(where: { isSentry: true, sentryCreator: $creator }, first: 200) {
            id sentryTokenId sentryToken feeTier
            token0 { id symbol } token1 { id symbol }
            totalValueLockedUSD volumeUSD feesUSD txCount
          }
          creatorFeePayments(where: { creator: $creator }, orderBy: timestamp, orderDirection: desc, first: 1000) {
            tokenId wethAmount amountUSD timestamp
          }
        }`,
        { creator },
      );
      const pools = (data.pools ?? []) as Array<Record<string, unknown>>;
      const payments = (data.creatorFeePayments ?? []) as Array<Record<string, unknown>>;
      const totalTvlUSD = pools.reduce((s, p) => s + num(p.totalValueLockedUSD), 0);
      const totalVolumeUSD = pools.reduce((s, p) => s + num(p.volumeUSD), 0);
      const totalPoolFeesUSD = pools.reduce((s, p) => s + num(p.feesUSD), 0);
      const feesPaidOutUSD = payments.reduce((s, p) => s + num(p.amountUSD), 0);
      const baseAmountPaidOut = payments.reduce((s, p) => s + num(p.wethAmount), 0);
      const ranked = [...pools].sort((a, b) => num(b.volumeUSD) - num(a.volumeUSD));
      const fmtPool = (p?: Record<string, unknown>) => p ? {
        pool: p.id, sentryTokenId: p.sentryTokenId ?? null,
        pair: `${(p.token0 as any)?.symbol}/${(p.token1 as any)?.symbol}`,
        volumeUSD: num(p.volumeUSD), tvlUSD: num(p.totalValueLockedUSD), feesUSD: num(p.feesUSD),
      } : null;
      return serializeBigInts({
        creator,
        tokenCount: pools.length,
        totalTvlUSD,
        totalVolumeUSD,
        totalPoolFeesUSD,
        creatorFeesPaidOutUSD: feesPaidOutUSD,
        creatorFeesPaidOutBase: baseAmountPaidOut,
        feePaymentCount: payments.length,
        topPerformer: fmtPool(ranked[0]),
        bottomPerformer: fmtPool(ranked[ranked.length - 1]),
        tokens: ranked.map(fmtPool),
      });
    }

    case 'analytics_wallet_pnl': {
      const wallet = String(args.wallet).toLowerCase();
      const data = await querySubgraph(
        `query($owner: String!) {
          positions(where: { owner: $owner }, first: 1000) {
            id liquidity depositedToken0 depositedToken1 withdrawnToken0 withdrawnToken1
            collectedFeesToken0 collectedFeesToken1
            pool { id token0 { id symbol decimals derivedETH } token1 { id symbol decimals derivedETH } }
          }
          bundles(first: 1) { ethPriceUSD }
        }`,
        { owner: wallet },
      );
      const ethUsd = num(data.bundles?.[0]?.ethPriceUSD);
      const positions = (data.positions ?? []) as Array<Record<string, unknown>>;
      let depositedUSD = 0, withdrawnUSD = 0, collectedFeesUSD = 0;
      const rows = positions.map((p) => {
        const pool = p.pool as any;
        const price0 = num(pool.token0.derivedETH) * ethUsd;
        const price1 = num(pool.token1.derivedETH) * ethUsd;
        const dep = num(p.depositedToken0) * price0 + num(p.depositedToken1) * price1;
        const wd = num(p.withdrawnToken0) * price0 + num(p.withdrawnToken1) * price1;
        const fees = num(p.collectedFeesToken0) * price0 + num(p.collectedFeesToken1) * price1;
        depositedUSD += dep; withdrawnUSD += wd; collectedFeesUSD += fees;
        return {
          position: p.id,
          pair: `${pool.token0.symbol}/${pool.token1.symbol}`,
          open: num(p.liquidity) > 0,
          depositedUSD: dep,
          withdrawnUSD: wd,
          collectedFeesUSD: fees,
          netUSD: wd + fees - dep,
        };
      });
      return serializeBigInts({
        wallet,
        positionCount: positions.length,
        depositedUSD,
        withdrawnUSD,
        collectedFeesUSD,
        realizedPnlEstimateUSD: withdrawnUSD + collectedFeesUSD - depositedUSD,
        note: 'Estimate valued at current token prices (derivedETH * ETH/USD); not historical cost basis. Open positions still hold deposited liquidity.',
        positions: rows,
      });
    }

    case 'analytics_token_risk': {
      const id = String(args.token).toLowerCase();
      const data = await querySubgraph(
        `query($id: ID!, $addr: String!) {
          token(id: $id) { id symbol name decimals derivedETH totalValueLockedUSD volumeUSD txCount }
          bundles(first: 1) { ethPriceUSD }
          day: tokenDayDatas(where: { token: $addr }, orderBy: date, orderDirection: desc, first: 14) { date high low close }
          p0: pools(where: { token0: $addr }, orderBy: totalValueLockedUSD, orderDirection: desc, first: 10) { id createdAtTimestamp totalValueLockedUSD volumeUSD isSentry sentryTokenId sentryCreator }
          p1: pools(where: { token1: $addr }, orderBy: totalValueLockedUSD, orderDirection: desc, first: 10) { id createdAtTimestamp totalValueLockedUSD volumeUSD isSentry sentryTokenId sentryCreator }
        }`,
        { id, addr: id },
      );
      const t = data.token;
      if (!t) throw new Error(`Token ${args.token} not indexed in the Tsunami subgraph (no pool yet).`);
      const pools = [...(data.p0 ?? []), ...(data.p1 ?? [])] as Array<Record<string, unknown>>;
      const liquidityUSD = pools.reduce((s, p) => s + num(p.totalValueLockedUSD), 0);
      const sentryPool = pools.find((p) => p.isSentry);
      const isSentry = Boolean(sentryPool);
      const launch = isSentry && sentryPool!.sentryTokenId != null
        ? await readLaunchType(sentryPool!.sentryTokenId as string)
        : null;
      const oldestCreated = pools.reduce((min, p) => {
        const c = num(p.createdAtTimestamp);
        return c > 0 && (min === 0 || c < min) ? c : min;
      }, 0);
      const ageDays = oldestCreated > 0 ? (Date.now() / 1000 - oldestCreated) / 86400 : 0;
      const days = (data.day ?? []) as Array<Record<string, unknown>>;
      const high = days.reduce((m, d) => Math.max(m, num(d.high)), 0);
      const close = days[0] ? num(days[0].close) : 0;
      const drawdownPct = high > 0 && close > 0 ? ((high - close) / high) * 100 : null;

      const flags: string[] = [];
      let score = 50;
      if (isSentry) { score += 30; flags.push('liquidity permanently locked in Sentry factory (no liquidity rug)'); }
      else { score -= 10; flags.push('not a Sentry-launched pool — verify LP lock independently'); }
      if (launch?.type === 'kraken_verified') { score += 15; flags.push('Kraken Verified deployer + restricted transfers'); }
      else if (launch?.type === 'gopumpme') { score += 8; flags.push('GoPumpMe: Kraken Verified deployer, open trading'); }
      else if (launch?.type === 'agent') { flags.push('ERC-8004 agent launch'); }
      if (liquidityUSD >= 10000) score += 20;
      else if (liquidityUSD >= 1000) score += 10;
      else { score -= 10; flags.push('thin liquidity (< $1k) — high price impact / volatility'); }
      if (ageDays >= 30) score += 15;
      else if (ageDays >= 7) score += 8;
      else flags.push('very new (< 7 days) — limited track record');
      if (drawdownPct !== null && drawdownPct >= 80) { score -= 20; flags.push('down >80% from recent high'); }
      else if (drawdownPct !== null && drawdownPct >= 50) { score -= 10; flags.push('down >50% from recent high'); }
      score = Math.max(0, Math.min(100, score));
      const rating = score >= 75 ? 'lower-risk' : score >= 50 ? 'moderate' : score >= 25 ? 'elevated' : 'high-risk';

      return serializeBigInts({
        token: { address: t.id, symbol: t.symbol, name: t.name },
        safetyScore: score,
        rating,
        isSentryToken: isSentry,
        launch,
        liquidityUSD,
        ageDays: Math.floor(ageDays),
        drawdownFromHighPct: drawdownPct,
        lifetimeVolumeUSD: num(t.volumeUSD),
        flags,
        disclaimer: 'Heuristic signal, not financial advice. Always verify independently.',
      });
    }

    case 'analytics_search': {
      const q = String(args.query ?? '').trim();
      if (!q) throw new Error('query is required.');
      const first = num(args.first) || 15;
      const fields = `id symbol name decimals derivedETH totalValueLockedUSD volumeUSD txCount`;
      const data = await querySubgraph(
        `query($q: String!, $first: Int!) {
          bySymbol: tokens(where: { symbol_contains_nocase: $q }, orderBy: volumeUSD, orderDirection: desc, first: $first) { ${fields} }
          byName: tokens(where: { name_contains_nocase: $q }, orderBy: volumeUSD, orderDirection: desc, first: $first) { ${fields} }
          bundles(first: 1) { ethPriceUSD }
        }`,
        { q, first },
      );
      const ethUsd = num(data.bundles?.[0]?.ethPriceUSD);
      const seen = new Set<string>();
      const merged: Array<Record<string, unknown>> = [];
      for (const tok of [...(data.bySymbol ?? []), ...(data.byName ?? [])] as Array<Record<string, unknown>>) {
        const key = String(tok.id);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({
          address: tok.id,
          symbol: tok.symbol,
          name: tok.name,
          priceUSD: num(tok.derivedETH) * ethUsd,
          liquidityUSD: num(tok.totalValueLockedUSD),
          volumeUSD: num(tok.volumeUSD),
          txCount: num(tok.txCount),
        });
      }
      merged.sort((a, b) => (b.volumeUSD as number) - (a.volumeUSD as number));
      return serializeBigInts({ query: q, count: Math.min(merged.length, first), results: merged.slice(0, first) });
    }

    case 'analytics_leaderboard': {
      const by = String(args.by ?? 'creators').toLowerCase() === 'tokens' ? 'tokens' : 'creators';
      const first = num(args.first) || 15;

      if (by === 'tokens') {
        const data = await querySubgraph(
          `query($first: Int!) {
            tokens(orderBy: volumeUSD, orderDirection: desc, first: $first) {
              id symbol name derivedETH totalValueLockedUSD volumeUSD txCount
            }
            bundles(first: 1) { ethPriceUSD }
          }`,
          { first },
        );
        const ethUsd = num(data.bundles?.[0]?.ethPriceUSD);
        const tokens = (data.tokens ?? []) as Array<Record<string, unknown>>;
        return serializeBigInts({
          by,
          count: tokens.length,
          leaderboard: tokens.map((t, i) => ({
            rank: i + 1,
            address: t.id,
            symbol: t.symbol,
            name: t.name,
            priceUSD: num(t.derivedETH) * ethUsd,
            liquidityUSD: num(t.totalValueLockedUSD),
            volumeUSD: num(t.volumeUSD),
            txCount: num(t.txCount),
          })),
        });
      }

      // by creators: aggregate creator fee payments
      const data = await querySubgraph(
        `query {
          creatorFeePayments(orderBy: timestamp, orderDirection: desc, first: 1000) {
            creator amountUSD wethAmount tokenId
          }
        }`,
      );
      const payments = (data.creatorFeePayments ?? []) as Array<Record<string, unknown>>;
      const agg = new Map<string, { amountUSD: number; baseAmount: number; payments: number; tokens: Set<string> }>();
      for (const p of payments) {
        const c = String(p.creator).toLowerCase();
        const cur = agg.get(c) ?? { amountUSD: 0, baseAmount: 0, payments: 0, tokens: new Set<string>() };
        cur.amountUSD += num(p.amountUSD);
        cur.baseAmount += num(p.wethAmount);
        cur.payments += 1;
        cur.tokens.add(String(p.tokenId));
        agg.set(c, cur);
      }
      const board = [...agg.entries()]
        .map(([creator, v]) => ({ creator, feesUSD: v.amountUSD, feesBase: v.baseAmount, tokenCount: v.tokens.size, payments: v.payments }))
        .sort((a, b) => b.feesUSD - a.feesUSD)
        .slice(0, first)
        .map((e, i) => ({ rank: i + 1, ...e }));
      return serializeBigInts({ by, count: board.length, leaderboard: board });
    }

    default:
      throw new Error(`Unknown analytics tool: ${name}`);
  }
}
