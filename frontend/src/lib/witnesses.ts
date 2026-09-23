import { Buffer } from 'buffer'

export type OnyxPrivateState = {
  readonly secretKey: Uint8Array
  readonly listingSalts: Record<string, Uint8Array>
}

export const createInitialPrivateState = (secretKey?: Uint8Array): OnyxPrivateState => ({
  secretKey: secretKey ?? new Uint8Array(32).map(() => Math.floor(Math.random() * 256)),
  listingSalts: {},
})

export const witnesses = {
  local_secret_key: (
    ctx: { privateState: OnyxPrivateState },
  ): [OnyxPrivateState, Uint8Array] => [ctx.privateState, ctx.privateState.secretKey],

  get_random_salt: (
    ctx: { privateState: OnyxPrivateState },
  ): [OnyxPrivateState, Uint8Array] => {
    const salt = new Uint8Array(32).map(() => Math.floor(Math.random() * 256))
    return [ctx.privateState, salt]
  },

  store_listing_salt: (
    ctx: { privateState: OnyxPrivateState },
    listingId: Uint8Array,
    salt: Uint8Array,
  ): [OnyxPrivateState, []] => {
    const key = Buffer.from(listingId).toString('hex')
    const updatedSalts = { ...ctx.privateState.listingSalts, [key]: salt }
    return [{ ...ctx.privateState, listingSalts: updatedSalts }, []]
  },
}
