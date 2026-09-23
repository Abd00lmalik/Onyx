import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum ListingState { active = 0, sold = 1, disputed = 2, completed = 3 }

export type Witnesses<PS> = {
  local_secret_key(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_random_salt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  store_listing_salt(context: __compactRuntime.WitnessContext<Ledger, PS>,
                     listingId_0: Uint8Array,
                     salt_0: Uint8Array): [PS, []];
}

export type ImpureCircuits<PS> = {
  listData(context: __compactRuntime.CircuitContext<PS>,
           dataHash_0: Uint8Array,
           price_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  buyListing(context: __compactRuntime.CircuitContext<PS>,
             listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  confirmDelivery(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  disputeListing(context: __compactRuntime.CircuitContext<PS>,
                 listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  resolveDispute(context: __compactRuntime.CircuitContext<PS>,
                 listingId_0: Uint8Array,
                 refundBuyer_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  getListingSeller(context: __compactRuntime.CircuitContext<PS>,
                   listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getListingDataCommitment(context: __compactRuntime.CircuitContext<PS>,
                           listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getListingPrice(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  getListingState(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, ListingState>;
  getListingBuyer(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getEscrow(context: __compactRuntime.CircuitContext<PS>,
            listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  getTotalListings(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  getCompletedSales(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  getAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type ProvableCircuits<PS> = {
  listData(context: __compactRuntime.CircuitContext<PS>,
           dataHash_0: Uint8Array,
           price_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  buyListing(context: __compactRuntime.CircuitContext<PS>,
             listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  confirmDelivery(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  disputeListing(context: __compactRuntime.CircuitContext<PS>,
                 listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  resolveDispute(context: __compactRuntime.CircuitContext<PS>,
                 listingId_0: Uint8Array,
                 refundBuyer_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  getListingSeller(context: __compactRuntime.CircuitContext<PS>,
                   listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getListingDataCommitment(context: __compactRuntime.CircuitContext<PS>,
                           listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getListingPrice(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  getListingState(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, ListingState>;
  getListingBuyer(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getEscrow(context: __compactRuntime.CircuitContext<PS>,
            listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  getTotalListings(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  getCompletedSales(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  getAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  listData(context: __compactRuntime.CircuitContext<PS>,
           dataHash_0: Uint8Array,
           price_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  buyListing(context: __compactRuntime.CircuitContext<PS>,
             listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  confirmDelivery(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  disputeListing(context: __compactRuntime.CircuitContext<PS>,
                 listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  resolveDispute(context: __compactRuntime.CircuitContext<PS>,
                 listingId_0: Uint8Array,
                 refundBuyer_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  getListingSeller(context: __compactRuntime.CircuitContext<PS>,
                   listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getListingDataCommitment(context: __compactRuntime.CircuitContext<PS>,
                           listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getListingPrice(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  getListingState(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, ListingState>;
  getListingBuyer(context: __compactRuntime.CircuitContext<PS>,
                  listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getEscrow(context: __compactRuntime.CircuitContext<PS>,
            listingId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  getTotalListings(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  getCompletedSales(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  getAdmin(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly admin: Uint8Array;
  listingSeller: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  listingDataCommitment: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  listingPrice: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  listingState: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): ListingState;
    [Symbol.iterator](): Iterator<[Uint8Array, ListingState]>
  };
  listingBuyer: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  escrow: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  readonly listingCount: bigint;
  readonly completedCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
