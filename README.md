# Onyx

> Encrypted data marketplace on Midnight Network where sellers keep data private until payment clears.

### Deployed on Preprod

| | |
|---|---|
| **Contract Address** | `1a7dabae6289b10f94636458b2c749b2396a3c9edc1e46877d4bb8a35a839b51` |
| **Network** | Preprod |
| **Wallet** | `mn_addr_preprod1xra3cc9jxvnjk7l9q8wauxh3mztqvm9yze7u9a2mq6f94ztkxmvqaupl0x` |
| **Explorer** | [midnightexplorer.com](https://preprod.midnightexplorer.com/) |

## What is Onyx?

Onyx is a privacy-first data marketplace built on Midnight Network. Sellers list datasets without revealing contents. Buyers verify quality through ZK proofs before purchase. Everyone keeps their competitive advantage private.

## The Problem

Data is the most valuable asset in the digital economy, but the current model is broken:

- **Sellers** must reveal data to prove it exists and is valuable then buyers have no reason to pay
- **Buyers** must trust sellers that the data is real, complete, and not tampered with
- **Intermediaries** (Google, Bloomberg, Reuters) take 40-70% cuts as trusted middlemen
- **Data breaches** happen because data is stored centrally and exposed in plaintext

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                  DATA SELLER                         │
│  1. Encrypts dataset locally                        │
│  2. Creates commitment: hash(dataset) + metadata     │
│  3. Lists on marketplace: "Dataset X, 1M records,   │
│     medical, age 25-45, US-based"                    │
│  4. Price: NIGHT                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              ONYX SMART CONTRACT                     │
│  Public state:                                       │
│  - Dataset exists ✓                                  │
│  - Description matches ✓ (ZK proof)                  │
│  - Price set ✓                                       │
│  - Seller reputation score ✓                         │
│                                                     │
│  Private state:                                      │
│  - Actual data (encrypted, local to seller)          │
│  - Full dataset contents                             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                  DATA BUYER                          │
│  1. Browses marketplace (sees descriptions only)     │
│  2. Sends NIGHT to contract                          │
│  3. Contract holds payment in escrow                 │
│  4. Seller receives payment                          │
│  5. Buyer receives decryption key                    │
│  6. ZK proof: "Data matches description"             │
│  7. If mismatch → dispute resolution                 │
└─────────────────────────────────────────────────────┘
```

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ DATA SELLER  │    │ DATA BUYER   │    │ DISPUTE      │      │
│  │              │    │              │    │ RESOLVER     │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│  ┌──────▼───────────────────▼───────────────────▼──────┐       │
│  │              FRONTEND (React + Vite)                 │       │
│  └──────────────────────┬──────────────────────────────┘       │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────┐       │
│  │           MIDNIGHT DAPP CONNECTOR API               │       │
│  └──────────────────────┬──────────────────────────────┘       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                    CONTRACT LAYER                                │
│  ┌──────────────────────▼──────────────────────────────┐       │
│  │              ONYX SMART CONTRACT                     │       │
│  │              (Compact Language)                      │       │
│  │                                                     │       │
│  │  - Marketplace Module (list, purchase, escrow)       │       │
│  │  - Access Control Module (grant, revoke, verify)     │       │
│  │  - Payment Module (escrow, release, refund)          │       │
│  │  - Verification Module (ZK proofs, validation)       │       │
│  └──────────────────────┬──────────────────────────────┘       │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────┐       │
│  │              MIDNIGHT NETWORK                        │       │
│  │  - Public State (commitments, listings)              │       │
│  │  - Private State (encrypted data, keys)              │       │
│  │  - ZK Proof Generation                               │       │
│  │  - DUST for transaction fees                         │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

#### On-Chain State (Public)

| Field | Type | Description |
|---|---|---|
| `listings` | `Map<Field, Field>` | datasetId → listingHash |
| `escrows` | `Map<Field, Field>` | transactionId → escrowHash |
| `disputes` | `Map<Field, Field>` | disputeId → disputeHash |
| `sellerScores` | `Map<Field, Field>` | sellerId → reputation score |
| `totalVolume` | `Field` | Aggregate trading volume |
| `totalDatasets` | `Field` | Total datasets listed |

#### Off-Chain State (Private)

| Field | Location | Description |
|---|---|---|
| `encryptedDataset` | Seller's device | Actual data (AES-256-GCM encrypted) |
| `decryptionKey` | Private state | Key to unlock data |
| `metadata` | Seller's device | Name, description, schema, row count |
| `purchasedKeys` | Buyer's device | datasetId → decryptionKey |
| `verificationProofs` | Buyer's device | ZK proofs of data quality |

## End-to-End Flow

### Flow A: Seller Lists Dataset

```
Seller → Create dataset → Encrypt locally → Generate metadata hash
    → Call listDataset() → ZK proof generated → Listing created
```

1. Seller creates dataset (CSV, JSON, etc.)
2. Seller encrypts dataset locally using AES-256-GCM
3. Seller generates metadata hash (name, description, schema, row count)
4. Frontend calls `listDataset()` on contract
5. Contract generates ZK proof that metadata is valid
6. Network verifies proof
7. Contract updates public state (listing created)
8. Seller receives confirmation + listing ID

### Flow B: Buyer Purchases Dataset

```
Buyer → Browse marketplace → Select dataset → Call purchaseDataset()
    → Escrow created → Seller notified → Seller sends key
    → ZK proof verified → Escrow released → Buyer receives key
```

1. Buyer browses marketplace (sees: name, price, category, row count)
2. Buyer selects dataset and clicks "Purchase"
3. Frontend calls `purchaseDataset()` with buyer commitment
4. Contract creates escrow (buyer's NIGHT locked)
5. Contract notifies seller of purchase intent
6. Seller sends decryption key (encrypted to buyer's public key)
7. Contract verifies ZK proof that key is valid
8. Contract releases escrow
9. Funds transferred to seller
10. Decryption key sent to buyer (private state)
11. Buyer decrypts dataset locally

### Flow C: Dispute Resolution

```
Buyer → Dispute dataset → Escrow frozen → Resolver notified
    → Resolver reviews → Resolution executed
```

1. Buyer initiates dispute with reason
2. Escrow frozen pending resolution
3. Neutral resolver reviews evidence
4. Resolver decides: refund buyer or release to seller
5. Resolution executed automatically
6. Seller/buyer reputation updated

## Smart Contract

### Entry Points

| Function | Description |
|---|---|
| `listDataset()` | Seller lists a new dataset |
| `purchaseDataset()` | Buyer initiates purchase |
| `releaseKey()` | Seller sends decryption key |
| `releaseEscrow()` | Release funds to seller |
| `disputeDataset()` | Buyer initiates dispute |
| `resolveDispute()` | Resolver decides outcome |

### ZK Proofs

| Proof | Purpose |
|---|---|
| Metadata validity | Proves description matches data without revealing data |
| Payment validity | Proves buyer has sufficient funds without revealing balance |
| Key validity | Proves decryption key is valid without revealing key |
| Data quality | Proves data meets claimed criteria without revealing content |

## Frontend Structure

```
src/
├── components/
│   ├── marketplace/     # ListingCard, ListingGrid, SearchBar
│   ├── seller/          # Dashboard, UploadDataset, ManageListings
│   ├── buyer/           # Dashboard, PurchaseHistory, DatasetViewer
│   └── shared/          # WalletConnect, TransactionStatus
├── hooks/               # useWallet, useMarketplace, useEscrow
├── lib/                 # contract, encryption, ipfs, utils
├── stores/              # walletStore, marketplaceStore, userStore
└── types/               # TypeScript definitions
```

## Security Model

| Layer | Protection |
|---|---|
| **Encryption** | AES-256-GCM for data, ECDH for key exchange |
| **ZK Proofs** | Metadata validity, payment validity, data quality |
| **Escrow** | Funds locked until key verified, automatic release |
| **Access Control** | Only buyer receives key, encrypted to buyer's public key |
| **Audit Trail** | All transactions logged on-chain, reputation tracked |

## Tech Stack

| Component | Technology |
|---|---|
| Blockchain | Midnight Network |
| Smart Contract | Compact Language |
| Frontend | React + Vite + TypeScript |
| Wallet | Lace (Midnight) |
| Encryption | AES-256-GCM + ECDH |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Testing | Vitest + Playwright |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for proof server)
- Lace Wallet extension

### Installation

```bash
# Clone repository
git clone https://github.com/Abd00lmalik/Onyx.git
cd Onyx

# Install dependencies
pnpm install

# Start proof server
docker run -p 6300:6300 midnightnetwork/proof-server -- \
  'midnight-proof-server --network testnet'

# Compile contracts
pnpm contract compact:all
pnpm contract build

# Deploy contract
pnpm cli deploy:marketplace

# Start frontend
pnpm frontend dev
```

### Environment Variables

```env
CONTRACT_ADDRESS=your_deployed_contract_address
NETWORK_ID=testnet
PROOF_SERVER_URL=http://localhost:6300
```

## Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| Phase 1 | Smart contract (Compact) | In Progress |
| Phase 2 | CLI tool for testing | Planned |
| Phase 3 | Frontend (React) | Planned |
| Phase 4 | Integration testing | Planned |
| Phase 5 | Preprod deployment | Planned |
| Phase 6 | User testing + feedback | Planned |
| Phase 7 | Mainnet launch | Planned |

## Use Cases

| Industry | Data | Buyer | Value |
|---|---|---|---|
| **Pharma** | Clinical trial results | Drug researchers | Avoid duplicate trials |
| **Finance** | Trading patterns | Hedge funds | Alpha generation |
| **Marketing** | Consumer behavior | Advertisers | Target without exposing profiles |
| **Climate** | Sensor data | Insurance companies | Risk modeling |
| **Genomics** | Genetic markers | Pharma/biotech | Drug discovery |


## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Midnight Network](https://midnight.network/) for the privacy-first blockchain
- [Rise In](https://risein.com/) for the New Moon to Full builder program
- [OpenZeppelin](https://www.openzeppelin.com/) for Compact contract patterns

---

Built with privacy by design. Powered by Midnight.
