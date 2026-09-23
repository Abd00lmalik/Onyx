export type ListingState = 'active' | 'sold' | 'disputed' | 'completed'

export interface Listing {
  id: string
  seller: string
  dataCommitment: string
  price: bigint
  state: ListingState
  buyer: string
  title: string
  description: string
  category: string
  size: string
  records: string
}

export interface WalletInfo {
  connected: boolean
  address: string
  shieldedAddress: string
  balance: bigint
  dustBalance: bigint
  networkId: string
}

export const MOCK_LISTINGS: Listing[] = [
  {
    id: '0x7a3f8c1e4b9d2f6a0e3c5b8d1f4a7c2e9b3d6f0a1c4e8b2d5f7a0c3e6b9d2f1a',
    seller: '0x4f2a8b1c7d2e9f3a6b8c4e7d2f9a1c3b7e6d2f8a4c1b9e3d6f0a2c5b8d1e4f7a',
    dataCommitment: '0xcf3a7e1c4b8d2f5a0e3c6b9d1f4a7c2e8b5d0f3a6c1e9b4d7f0a2c5e8b1d4f6a',
    price: 1500000000n,
    state: 'active',
    buyer: '',
    title: 'Health Records: Cardiovascular',
    description: 'Anonymized cardiovascular patient records from a network of 12 clinics across 3 regions. Includes diagnostic imaging metadata, lab results, and treatment outcome vectors. All PII stripped, verified via ZKP attestation.',
    category: 'Healthcare',
    size: '2.4 GB',
    records: '48,200',
  },
  {
    id: '0x9e6d3f7a2c8b1e4d5a0f3c6b9d2e7a1f4c8b0d3e6a9f2c5b8d1e4a7f0c3b6d9e',
    seller: '0x8c3e7d2f9a1b4c6e0d3f5a8b2c7e1d4f6a9b3c0e5d8f2a7b1c4e6d0f3a9b5c8e',
    dataCommitment: '0xae5c2f8b1d4e7a0c3f6b9d2e5a8c1f4b7d0e3a6c9f2b5d8e1a4c7f0b3e6d9a2c',
    price: 2750000000n,
    state: 'active',
    buyer: '',
    title: 'Satellite Imagery: Agriculture',
    description: 'Multi-spectral satellite imagery covering 14,000 hectares of farmland in the Midwest. NDVI indices, soil moisture estimates, and crop health classifications updated weekly over a 6-month period.',
    category: 'Geospatial',
    size: '18.7 GB',
    records: '3,640',
  },
  {
    id: '0xc1be6a9d4f2e8b3c7a0d5f1e4b8c2a6d9f3e7b0c4a1d8f5e2b6c9a3d7f0e4b8c',
    seller: '0x2d7a5c8e1b4f9a3c6d0e2b5f8a1c4d7e0b3f6a9c2d5e8b1a4f7c0d3e6a9b2f5c',
    dataCommitment: '0xbe7d4f1a8c2e5b0d3f6a9c4e1b7d0a3f8c5e2b6d9a1f4c7e0b3d6a8f2c5e9b1d',
    price: 1200000000n,
    state: 'sold',
    buyer: '0x3e6a9c2d5f8b1e4a7c0d3f6b9a2e5c8d1f4b7a0e3c6d9f2a5b8c1e4d7f0a3b6e',
    title: 'Energy Consumption: Residential',
    description: 'Smart meter readings from 8,400 residential households across California. Hourly granularity over 12 months, with anonymized usage patterns, peak demand windows, and appliance-level disaggregation labels.',
    category: 'Energy',
    size: '890 MB',
    records: '73,100,000',
  },
  {
    id: '0x5c7f2e4b8a1d6c9f3e0b5a2d8c4f7e1b6a3d9f0c5e2b8a4d1f7c6e3b9a0d5f2c',
    seller: '0x6b2e9f3a7c1d4b8e0a5f2c6d9b3e7a1f4c8d0b5e2a6f9c3d7b1e4a8f0c5d2b6e',
    dataCommitment: '0xde2a5f8c1b4e7d0a3f6c9b2e5a8d1f4c7b0e3a6d9f2c5b8e1a4d7f0c3b6a9e2d',
    price: 4000000000n,
    state: 'disputed',
    buyer: '0x1a4d7f0c3b6e9a2d5f8c1b4e7a0d3f6c9b2e5a8d1f4c7b0e3a6d9f2c5b8e1a4d',
    title: 'Genomic Sequences: Rare Disease',
    description: 'Whole-genome sequencing data from a rare disease research consortium. Covers 1,200 affected individuals and 3,600 control samples. Includes variant call format files, phenotype annotations, and family pedigree data.',
    category: 'Healthcare',
    size: '42.1 GB',
    records: '4,800',
  },
  {
    id: '0x8d4a7c1e5b0f3a6d9c2e8b4f1a7d0c3e6b9f2a5d8c1e4b7f0a3d6c9e2b5a8f1d',
    seller: '0x1f9c6a3d7b0e4c8f2a5d1b6e9c3f7a0d4b8e2c5f1a6d9b3e7c0f4a8d2b5e1c6f',
    dataCommitment: '0xce8b5a2d7f1c4e0a3b6d9f2c5a8e1d4b7f0a3c6d9e2b5a8f1c4d7e0b3a6c9f2d',
    price: 950000000n,
    state: 'completed',
    buyer: '0x4b7f0a3d6c9e2b5a8f1c4d7e0b3a6c9f2d5a8e1b4f7c0d3e6a9b2f5c8d1e4a7f',
    title: 'Climate Sensor: Ocean Buoy',
    description: 'Real-time ocean buoy sensor readings from 340 stations in the Pacific basin. Temperature, salinity, wave height, and barometric pressure measurements at 10-minute intervals over 18 months.',
    category: 'Climate',
    size: '5.6 GB',
    records: '91,800,000',
  },
  {
    id: '0x2e9b6d3f0a7c4e1b8d5f2a9c6e3b0d7f4a1c8e5b2d9f6a3c0e7b4d1f8a5c2e9b',
    seller: '0x9a4e1b7d0c3f6a9e2b5d8f1c4a7e0b3d6f9a2c5e8b1d4f7a0c3e6b9d2f5a8c1e',
    dataCommitment: '0xae1b4d7f0c3a6e9b2d5f8c1a4e7b0d3f6a9c2e5b8d1f4a7c0e3b6d9f2a5c8e1b',
    price: 3500000000n,
    state: 'active',
    buyer: '',
    title: 'Financial Transactions: Forex',
    description: 'Anonymized forex transaction records from a European payment processor. Covers 2.1 million cross-border transactions with currency pairs, timestamps, amount ranges, and risk scoring labels. No account identifiers.',
    category: 'Finance',
    size: '1.8 GB',
    records: '2,100,000',
  },
]

export const MOCK_WALLET: WalletInfo = {
  connected: false,
  address: '0x4f2a8b1c7d2e9f3a6b8c4e7d2f9a1c3b7e6d2f8a4c1b9e3d6f0a2c5b8d1e4f7a',
  shieldedAddress: 'mn_addr_preprod1xra3cc9jxvnjk7l9q8wauxh3mztqvm9yze7u9a2mq6f94ztkxmvqaupl0x',
  balance: 12450320000n,
  dustBalance: 12450320000n,
  networkId: 'preprod',
}

export const MOCK_STATS = {
  totalListings: 0,
  completedSales: 0,
  totalVolume: 0n,
}

export function formatDust(price: bigint): string {
  const val = Number(price)
  if (val >= 1_000_000) return `${(val / 1_000_000).toLocaleString()}`
  if (val >= 1_000) return `${(val / 1_000).toLocaleString()}`
  return val.toLocaleString()
}

export function formatBalance(val: bigint): string {
  const num = Number(val) / 1_000_000
  if (num === 0) return '0.00'
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function getListingById(id: string): Listing | undefined {
  return MOCK_LISTINGS.find(l => l.id === id)
}

export function getListingsBySeller(address: string): Listing[] {
  return MOCK_LISTINGS.filter(l => l.seller === address)
}

export function getListingsByBuyer(address: string): Listing[] {
  return MOCK_LISTINGS.filter(l => l.buyer === address)
}
