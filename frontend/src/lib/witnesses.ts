export type OnyxPrivateState = {
  readonly secretKey: Uint8Array
  readonly listingSalts: Record<string, Uint8Array>
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length)
  crypto.getRandomValues(out)
  return out
}

export const createInitialPrivateState = (secretKey?: Uint8Array): OnyxPrivateState => ({
  secretKey: secretKey ?? randomBytes(32),
  listingSalts: {},
})

export const witnesses = {
  local_secret_key: (
    ctx: { privateState: OnyxPrivateState },
  ): [OnyxPrivateState, Uint8Array] => [ctx.privateState, ctx.privateState.secretKey],

  get_random_salt: (ctx: { privateState: OnyxPrivateState }): [OnyxPrivateState, Uint8Array] => [
    ctx.privateState,
    randomBytes(32),
  ],

  store_listing_salt: (
    ctx: { privateState: OnyxPrivateState },
    listingId: Uint8Array,
    salt: Uint8Array,
  ): [OnyxPrivateState, []] => {
    const key = Array.from(listingId)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return [
      { ...ctx.privateState, listingSalts: { ...ctx.privateState.listingSalts, [key]: salt } },
      [],
    ]
  },
}
