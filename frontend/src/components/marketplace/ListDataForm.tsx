import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Shield, CheckCircle } from 'lucide-react'

interface ListDataFormProps {
  onSubmit?: (data: { name: string; description: string; price: string; category: string }) => void
}

const CATEGORIES = ['Finance', 'Healthcare', 'Marketing', 'Climate', 'Genomics', 'Other']

export function ListDataForm({ onSubmit }: ListDataFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [txHash, setTxHash] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    await new Promise(resolve => setTimeout(resolve, 1500))

    const mockHash = '0x' + Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    setTxHash(mockHash)
    setSubmitted(true)
    setLoading(false)

    onSubmit?.({ name, description, price, category })
  }

  if (submitted) {
    return (
      <Card className="p-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30">
          <CheckCircle size={20} className="text-success shrink-0" />
          <div>
            <p className="font-medium text-foreground">Listed!</p>
            <p className="text-sm font-mono text-amber-muted break-all">TX: {txHash}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/browse')}>Browse Marketplace</Button>
          <Button onClick={() => { setSubmitted(false); setName(''); setDescription(''); setPrice(''); setCategory('') }}>List Another</Button>
        </div>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 max-w-xl mx-auto">
        <div className="space-y-4">
          <Input label="Dataset Name" placeholder="e.g. Financial Market Data Q4" value={name} onChange={e => setName(e.target.value)} required />

          <div className="w-full">
            <label className="block text-sm font-medium text-foreground-light mb-1.5">Description</label>
            <textarea
              placeholder="Describe your dataset..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-cream-light border border-amber-border text-foreground placeholder-amber-muted/50 focus:outline-none focus:ring-2 focus:ring-amber-primary/30 focus:border-amber-primary transition-all duration-200 text-sm resize-none"
              required
            />
          </div>

          <Input label="Price (DUST)" type="number" placeholder="1500" value={price} onChange={e => setPrice(e.target.value)} required />

          <div className="w-full">
            <label className="block text-sm font-medium text-foreground-light mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-cream-light border border-amber-border text-foreground focus:outline-none focus:ring-2 focus:ring-amber-primary/30 focus:border-amber-primary transition-all duration-200 text-sm"
              required
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 p-3 rounded-lg bg-cream-light border border-amber-border/50">
          <Shield size={16} className="text-amber-primary shrink-0" />
          <p className="text-xs text-amber-muted">
            Proved without revealing your input. Data hash is computed locally
          </p>
        </div>

        <Button type="submit" loading={loading} className="w-full mt-5">
          List Dataset
        </Button>
      </Card>
    </form>
  )
}
