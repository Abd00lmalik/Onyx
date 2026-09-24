# Onyx Frontend

React + TypeScript + Vite marketplace UI for the Onyx encrypted data marketplace on Midnight Network.

**Live site:** [https://onyx-market.vercel.app](https://onyx-market.vercel.app)

All page and component files are `.tsx` under `src/` (23 TypeScript React files).

## Structure

```
src/
├── pages/              # HomePage, BrowsePage, ListPage, ListingDetailPage, DashboardPage
├── components/
│   ├── layout/         # Header, Footer, WaveBackground
│   ├── marketplace/    # ListingCard, ListingGrid, SearchBar, ListDataForm, BuyDialog
│   ├── ui/             # Button, Card, Badge, Dialog, Input, Reveal, Spinner
│   └── wallet/         # WalletConnect
├── hooks/              # useWallet, useMarketplace, useContract
├── lib/                # mockData, midnight, constants, witnesses
└── types/              # TypeScript definitions
```

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy on Vercel

Live site: [https://onyx-market.vercel.app](https://onyx-market.vercel.app)

This folder is ready for Vercel:

1. Import the GitHub repo `Abd00lmalik/Onyx`
2. Set **Root Directory** to `frontend` (or leave blank and use the root `vercel.json`)
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy

SPA rewrites are configured in `vercel.json` so routes like `/browse` and `/listing/:id` work on refresh.

## Lint

```bash
npm run lint
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

