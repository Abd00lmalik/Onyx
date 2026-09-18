const { randomBytes } = require('node:crypto');

const makeInitialPrivateState = () => ({
  secretKey: randomBytes(32),
  listingSalts: {},
});

const witnesses = {
  local_secret_key: (ctx) => [ctx.privateState, ctx.privateState.secretKey],
  get_random_salt: (ctx) => [ctx.privateState, randomBytes(32)],
  store_listing_salt: (ctx, listingId, salt) => {
    const key = Buffer.from(listingId).toString('hex');
    const updatedSalts = { ...ctx.privateState.listingSalts, [key]: salt };
    return [{ ...ctx.privateState, listingSalts: updatedSalts }, []];
  },
};

module.exports = { witnesses, makeInitialPrivateState };
