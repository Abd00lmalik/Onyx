import { ListDataForm } from '../components/marketplace/ListDataForm'

export function ListPage() {
  return (
    <div className="min-h-screen bg-cream pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-foreground mb-2">
            List Your Data
          </h1>
          <p className="text-foreground-light text-sm sm:text-base max-w-lg mx-auto">
            Encrypted datasets are committed on-chain. The actual data never leaves your device.
          </p>
        </div>

        <ListDataForm />
      </div>
    </div>
  )
}
