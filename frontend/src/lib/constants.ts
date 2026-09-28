export const CONTRACT_ADDRESS = 'a7791112a07144af7da22e51b0a504cc07df513585abf5066d333802e2ca4998'

export const PRIVATE_STATE_ID = 'onyxMarketplacePrivateState'

export const NETWORK = 'preprod' as const

export const ZK_ARTIFACTS_PATH = '/zk-artifacts'

export const PROOF_SERVER_URL = 'http://localhost:6300'

export const DEFAULT_INDEXER_URI = 'https://indexer.preprod.midnight.network/api/v4/graphql'

export const DEFAULT_INDEXER_WS_URI = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'

export const APP_NAME = 'Onyx'

/** Absolute URL for ZK artifacts. FetchZkConfigProvider calls `new URL(baseURL)`,
 *  so a root-relative path throws in the browser. */
export function zkArtifactsUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${ZK_ARTIFACTS_PATH}`
  }
  return `http://127.0.0.1:5173${ZK_ARTIFACTS_PATH}`
}

export function proofServerUrl(): string {
  const fromEnv = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PROOF_SERVER_URL
  return fromEnv || PROOF_SERVER_URL
}

export const ROUTES = {
  HOME: '/',
  BROWSE: '/browse',
  LIST: '/list',
  LISTING_DETAIL: '/listing/:id',
  DASHBOARD: '/dashboard',
} as const
