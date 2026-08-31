import 'dotenv/config';

/**
 * Every environment value is read here once and validated at boot.
 * Nothing else in the backend touches process.env directly.
 *
 * The service starts with an empty .env: every live integration degrades to a
 * deterministic sample implementation, and /api/health reports honestly which
 * of the two is running.
 */

function str(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

/** First non-empty of several names, so one .env can use either spelling. */
function firstOf(names: string[], fallback = ''): string {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== '') return value;
  }
  return fallback;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

function list(name: string, fallback = ''): string[] {
  return str(name, fallback)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

const nodeEnv = firstOf(['NODE_ENV', 'APP_ENV'], 'development');
const siteUrl = firstOf(['FRONTEND_BASE_URL', 'SITE_URL'], 'http://localhost:3000');
const apiUrl = firstOf(['BACKEND_BASE_URL', 'API_URL'], 'http://localhost:8000');

/** Derives the listen port from BACKEND_BASE_URL when PORT is not given. */
function portFromUrl(url: string, fallback: number): number {
  try {
    const parsed = new URL(url);
    return parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return fallback;
  }
}

/** Turns a full redirect URI into the path this server must serve. */
function pathOf(url: string, fallback: string): string {
  if (!url) return fallback;
  try {
    return new URL(url).pathname;
  } catch {
    return url.startsWith('/') ? url : fallback;
  }
}

export const env = {
  nodeEnv,
  appName: str('APP_NAME', 'HELM'),
  isProduction: nodeEnv === 'production',
  logLevel: str('LOG_LEVEL', 'info').toLowerCase(),

  // 8100 rather than 8000: a Docker or WSL port relay claims 8000 on a lot of
  // developer machines, and it takes it the moment this server releases it on
  // a restart — after which the API cannot get its own port back.
  port: num('PORT', portFromUrl(apiUrl, 8100)),
  host: str('HOST', '0.0.0.0'),

  /** Canonical public origin of the Next frontend. OAuth returns here. */
  siteUrl,
  /** Where this API is reachable from the frontend server and from Google. */
  apiUrl,
  corsOrigins: str('CORS_ORIGINS', siteUrl)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),

  session: {
    cookieName: str('SESSION_COOKIE_NAME', 'helm_session'),
    secret: firstOf(['JWT_SECRET', 'SESSION_SECRET'], 'helm-development-session-secret-change-me'),
    ttlSeconds: num('SESSION_TTL_SECONDS', 60 * 60 * 24 * 7),
    secure: bool('SESSION_COOKIE_SECURE', nodeEnv === 'production'),
    sameSite: str('SESSION_COOKIE_SAMESITE', 'lax') as 'lax' | 'strict' | 'none',
    domain: str('SESSION_COOKIE_DOMAIN') || undefined,
    /** AES-256-GCM key for provider tokens at rest. base64, 32 bytes. */
    tokenEncryptionKey: str('TOKEN_ENCRYPTION_KEY'),
  },

  /**
   * The decision graph.
   *
   * Neon Postgres is the store of record. Neo4j is supported for deployments
   * that already run one; with neither configured the in-process store keeps
   * the product demonstrable.
   */
  database: {
    url: firstOf(['DATABASE_URL', 'POSTGRES_URL']),
    get enabled() {
      return Boolean(firstOf(['DATABASE_URL', 'POSTGRES_URL']));
    },
  },

  neo4j: {
    uri: str('NEO4J_URI'),
    username: str('NEO4J_USERNAME', 'neo4j'),
    password: str('NEO4J_PASSWORD'),
    database: str('NEO4J_DATABASE', 'neo4j'),
    get enabled() {
      return Boolean(str('NEO4J_URI'));
    },
  },

  google: {
    clientId: str('GOOGLE_CLIENT_ID'),
    clientSecret: str('GOOGLE_CLIENT_SECRET'),
    /** Identity sign-in callback, served by this API. */
    authRedirectPath: pathOf(str('GOOGLE_REDIRECT_URI'), '/api/auth/google/callback'),

    /** Google Ads is a separate consent, and may use a separate client. */
    adsClientId: firstOf(['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_CLIENT_ID']),
    adsClientSecret: firstOf(['GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET']),
    adsRedirectPath: pathOf(
      str('GOOGLE_ADS_REDIRECT_URI'),
      '/api/integrations/google-ads/callback',
    ),
    adsDeveloperToken: str('GOOGLE_ADS_DEVELOPER_TOKEN'),
    adsLoginCustomerId: str('GOOGLE_ADS_LOGIN_CUSTOMER_ID'),
    adsApiVersion: str('GOOGLE_ADS_API_VERSION', 'v22'),
    /**
     * Runs the real OAuth grant but reads the sample portfolio instead of
     * calling the Ads API — the correct setting while a developer token is
     * still on basic access.
     */
    adsMock: bool('GOOGLE_ADS_MOCK', false),
  },

  meta: {
    appId: str('META_APP_ID'),
    appSecret: str('META_APP_SECRET'),
    apiVersion: str('META_API_VERSION', 'v21.0'),
    redirectPath: pathOf(str('META_REDIRECT_URI'), '/api/integrations/meta-ads/callback'),
    configId: str('META_CONFIG_ID'),
  },

  anthropic: {
    apiKey: str('ANTHROPIC_API_KEY'),
    /*
     * Two things about Haiku 4.5 that the code around this must respect:
     *
     *   - `output_config.effort` is rejected on it. Do not add an effort tier
     *     to the reasoning calls without changing this default first.
     *   - Its context window is 200K, not the 1M the Sonnet and Opus families
     *     carry. A fleet prompt that grew comfortably against Sonnet 5 can
     *     overflow here, so evidence handed to a specialist stays bounded.
     *
     * Thinking is off unless a call passes `{type: 'enabled', budget_tokens}`,
     * which none of them do — adaptive thinking is a 4.6-and-later feature.
     */
    /**
     * The analyst and the Creative Director write the things a person reads —
     * findings, proposals, creative direction, the memo. Haiku could hold the
     * shape but not the judgement: it graded every finding decision-grade and
     * invented creative asset ids the review gate then had to reject. Sonnet
     * is the floor for work that leaves the product as a document.
     */
    timeoutMs: num('ANTHROPIC_TIMEOUT_MS', 120_000),
    model: str('ANTHROPIC_MODEL', 'claude-sonnet-5'),
    /** The model that holds the review gate, kept separate on purpose. */
    reviewModel: firstOf(['ANTHROPIC_REVIEW_MODEL', 'ANTHROPIC_MODEL'], 'claude-sonnet-5'),
    /**
     * The scout reconciles accounts and writes no prose, so it stays on the
     * fast model. Paying Sonnet rates to sum spend buys nothing.
     */
    fastModel: firstOf(['ANTHROPIC_FAST_MODEL'], 'claude-haiku-4-5'),
    maxTokens: num('ANTHROPIC_MAX_TOKENS', 8000),
  },

  images: {
    /** gemini | openai | demo — demo renders art-directed posters locally. */
    provider: str('IMAGE_PROVIDER', 'demo').toLowerCase() as 'gemini' | 'openai' | 'demo',
    apiKey: firstOf(['IMAGE_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY']),
    model: str('IMAGE_MODEL'),
    geminiModel: str('GEMINI_IMAGE_MODEL', 'gemini-3.1-flash-image'),
    openaiModel: str('OPENAI_IMAGE_MODEL', 'gpt-image-1'),
  },

  /**
   * Two switches decide how much of the identity stack is live.
   *
   * AUTH_ENABLED=false signs every visitor in as the sample owner without
   * touching Google, so the product can be demonstrated with no consent
   * screen in the way. RBAC_ENABLED=false grants every permission regardless
   * of role, so a demo never hits a refusal it did not intend to show.
   *
   * Neither switch affects the database: the decision graph stays connected
   * and every write still lands in Neon.
   */
  auth: {
    enabled: bool('AUTH_ENABLED', true),
    rbacEnabled: bool('RBAC_ENABLED', true),
  },

  platform: {
    /** Operators who may open /ops. Everybody else gets a 404-shaped refusal. */
    adminEmails: list('PLATFORM_ADMIN_EMAILS'),
    /** Allows the no-Google sample sign-in. Turn off in production. */
    allowDevLogin: bool('ALLOW_DEV_LOGIN', false),
    /** A first-time Google sign-in gets its own workspace instead of a refusal. */
    autoProvisionTenant: bool('AUTO_PROVISION_TENANT', false),
    /** Same-domain colleagues join an existing workspace automatically. */
    allowDomainAutoJoin: bool('ALLOW_DOMAIN_AUTO_JOIN', false),
  },

  fleet: {
    /** Milliseconds between fleet steps, so a live demo stays legible. */
    stepDelayMs: num('FLEET_STEP_DELAY_MS', 700),
    maxConcurrentRuns: num('FLEET_MAX_CONCURRENT_RUNS', 4),
    /** How many times the review gate may send a specialist back. */
    maxRevisions: num('MAX_AGENT_REVISIONS', 3),
  },

  http: {
    /**
     * The ceiling on any single outbound provider call.
     *
     * Node's fetch has no default, so without this a hung connection is a
     * hung request — or a fleet run parked mid-step with nothing to time it
     * out.
     */
    timeoutMs: num('OUTBOUND_TIMEOUT_MS', 30_000),
  },
} as const;

export type Env = typeof env;

export type Capabilities = {
  graph: 'neon' | 'neo4j' | 'memory';
  identity: 'google' | 'demo' | 'disabled';
  rbac: 'enforced' | 'open';
  googleAds: 'live' | 'mock' | 'unconfigured';
  metaAds: 'live' | 'sample';
  reasoning: 'anthropic' | 'scripted';
  imageGeneration: 'gemini' | 'openai' | 'studio-render';
};

/** Capability report surfaced to the product so the UI never has to guess. */
export function capabilities(): Capabilities {
  return {
    graph: env.database.enabled ? 'neon' : env.neo4j.enabled ? 'neo4j' : 'memory',
    identity: !env.auth.enabled
      ? 'disabled'
      : env.google.clientId && env.google.clientSecret
        ? 'google'
        : 'demo',
    rbac: env.auth.rbacEnabled ? 'enforced' : 'open',
    googleAds: !env.google.adsClientId
      ? 'unconfigured'
      : env.google.adsMock || !env.google.adsDeveloperToken
        ? 'mock'
        : 'live',
    metaAds: env.meta.appId && env.meta.appSecret ? 'live' : 'sample',
    reasoning: reasoningIsLive() ? 'anthropic' : 'scripted',
    imageGeneration:
      env.images.provider === 'gemini' && env.images.apiKey
        ? 'gemini'
        : env.images.provider === 'openai' && env.images.apiKey
          ? 'openai'
          : 'studio-render',
  };
}

/**
 * Set once the boot probe has spoken. Until then a configured key is assumed
 * good, so a slow probe never makes the product claim less than it can do.
 */
let reasoningLive: boolean | null = null;

export function setReasoningLive(value: boolean) {
  reasoningLive = value;
}

function reasoningIsLive(): boolean {
  if (!env.anthropic.apiKey) return false;
  return reasoningLive ?? true;
}

export function isPlatformAdmin(email: string | undefined): boolean {
  // With RBAC off, the operator console is open too — otherwise turning role
  // checks off would still leave one surface refusing the demo user.
  if (!env.auth.rbacEnabled) return true;
  if (!email) return false;
  return env.platform.adminEmails.includes(email.toLowerCase());
}
