import { useState } from 'react'
import { KeyRound, PackageCheck, Download, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { Listing } from '../../types'
import { bytesToHex, encodeMeta, hexToBytes } from '../../lib/hex'
import {
  generateRecipientKeys,
  openPackage,
  parsePackage,
  serializePackage,
  unwrapKeyForRecipient,
  verifyPackage,
} from '../../lib/package'
import {
  downloadBytes,
  downloadText,
  hasRecipientKeys,
  loadRecipientKeys,
  parseRequest,
  parseVault,
  recipientBuild,
  saveRecipientKeys,
  serializeRequest,
  slugify,
  type RequestFile,
  type VaultFile,
} from '../../lib/vault'

interface DeliveryPanelProps {
  listing: Listing
  /** `buyer` publishes a request and imports the delivery; `seller` fulfils it. */
  role: 'buyer' | 'seller'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function FilePicker({
  label,
  hint,
  onFile,
}: {
  label: string
  hint: string
  onFile: (file: File) => void
}) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-foreground-light mb-1.5">{label}</label>
      <input
        type="file"
        accept=".json,application/json"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
        className="block w-full text-sm text-foreground-light file:mr-3 file:rounded-lg file:border-0 file:bg-cream-dark file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-amber-border/40 cursor-pointer"
      />
      <p className="mt-1 text-xs text-amber-muted">{hint}</p>
    </div>
  )
}

export function DeliveryPanel({ listing, role }: DeliveryPanelProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [report, setReport] = useState<{ hashOk: boolean; commitmentOk: boolean; metaOk: boolean; ok: boolean } | null>(null)
  const [plaintext, setPlaintext] = useState<Uint8Array | null>(null)
  // Seller side: hold whichever half has been picked until both are present.
  const [vault, setVault] = useState<VaultFile | null>(null)
  const [request, setRequest] = useState<RequestFile | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  const deliver = async (picked: VaultFile, asked: RequestFile) => {
    const pkg = await recipientBuild(
      picked.package,
      hexToBytes(picked.dataKey, 'vault.dataKey'),
      hexToBytes(asked.publicKey, 'request.publicKey'),
    )
    downloadText(
      `${slugify(listing.title || 'dataset')}-for-buyer.onyx-package.json`,
      serializePackage(pkg),
    )
    setVault(null)
    setRequest(null)
    setNotice('Recipient package created. Hand the downloaded file to the buyer.')
  }

  if (role === 'seller') {
    return (
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <PackageCheck size={16} className="text-amber-primary" />
          <h3 className="text-sm font-semibold text-foreground">Deliver to the buyer</h3>
        </div>
        <p className="text-xs text-amber-muted mb-4">
          The chain never sees the file. Use the buyer&apos;s request to wrap the data key, then hand
          the package over however you like, since it stays encrypted end to end.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FilePicker
            label="Your vault file"
            hint="Downloaded when you listed this dataset (.onyx-vault.json)"
            onFile={file =>
              void run(async () => {
                const picked = parseVault(await file.text())
                if (picked.listingId !== listing.id) throw new Error('That vault belongs to a different listing')
                setVault(picked)
                setNotice('Vault loaded. Now pick the buyer request file.')
                if (request) await deliver(picked, request)
              })
            }
          />
          <FilePicker
            label="Buyer request"
            hint="The file the buyer sent you (.onyx-request.json)"
            onFile={file =>
              void run(async () => {
                const asked = parseRequest(await file.text())
                if (asked.listingId !== listing.id) throw new Error('That request is for a different listing')
                setRequest(asked)
                setNotice('Request loaded. Now pick your vault file.')
                if (vault) await deliver(vault, asked)
              })
            }
          />
        </div>

        {vault && !request && (
          <p className="mt-3 text-xs text-amber-muted">Vault ready, waiting for the buyer request.</p>
        )}
        {request && !vault && (
          <p className="mt-3 text-xs text-amber-muted">Request ready, waiting for your vault file.</p>
        )}

        <StatusPanels notice={notice} error={error} busy={busy} busyLabel="Preparing the recipient package…" />
      </Card>
    )
  }

  /* ---------------------------------------------------------------- buyer -- */

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-amber-primary" />
        <h3 className="text-sm font-semibold text-foreground">Get the encrypted package</h3>
      </div>
      <p className="text-xs text-amber-muted mb-4">
        Generate a request for this listing, send it to the seller, then import the package they
        deliver. Your decryption key stays in this browser.
      </p>

      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={() =>
          void run(async () => {
            let keys = loadRecipientKeys(listing.id)
            const fresh = !keys
            if (!keys) {
              keys = await generateRecipientKeys()
              saveRecipientKeys(listing.id, keys)
            }
            downloadText(
              `${slugify(listing.title || 'dataset')}-request.onyx-request.json`,
              serializeRequest({
                type: 'onyx:package-request',
                version: 1,
                listingId: listing.id,
                publicKey: bytesToHex(keys.publicKey),
              }),
            )
            setNotice(
              fresh
                ? 'New key pair created and request downloaded. Send the file to the seller.'
                : 'Request downloaded again for the key pair already stored here.',
            )
          })
        }
      >
        <Download size={15} />
        {hasRecipientKeys(listing.id) ? 'Download request again' : 'Create package request'}
      </Button>

      <div className="mt-5">
        <FilePicker
          label="Import delivered package"
          hint="The .onyx-package.json file the seller hands over"
          onFile={file =>
            void run(async () => {
              setReport(null)
              setPlaintext(null)
              const pkg = parsePackage(await file.text())
              if (pkg.listingId !== listing.id) throw new Error('That package is for a different listing')
              if (!pkg.wrap) throw new Error('This file has no wrapped key. Ask the seller for a recipient build.')
              const keys = loadRecipientKeys(listing.id)
              if (!keys) throw new Error('No key pair stored for this listing. Create a request first.')
              const dataKey = await unwrapKeyForRecipient(pkg, keys)
              const opened = await openPackage(pkg, { dataKey })
              const result = await verifyPackage(opened, pkg, {
                dataCommitment: hexToBytes(listing.dataCommitment, 'listing dataCommitment'),
                meta: encodeMeta({
                  title: listing.title ?? '',
                  description: listing.description ?? '',
                  category: listing.category ?? '',
                  size: listing.size ?? '',
                  records: listing.records ?? '',
                }),
              })
              setPlaintext(opened)
              setReport(result)
              if (!result.ok) throw new Error('Package opened but does not match the on-chain commitment')
              setNotice(`Verified and decrypted ${opened.length.toLocaleString('en-US')} bytes.`)
            })
          }
        />
      </div>

      {report && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { label: 'SHA-256 hash', ok: report.hashOk },
            { label: 'Data commitment', ok: report.commitmentOk },
            { label: 'On-chain metadata', ok: report.metaOk },
          ].map(check => (
            <div
              key={check.label}
              className={`rounded-lg border px-3 py-2 text-xs ${
                check.ok
                  ? 'border-success/30 bg-success/10 text-foreground'
                  : 'border-danger/30 bg-danger/10 text-danger'
              }`}
            >
              {check.ok ? '✓' : '✗'} {check.label}
            </div>
          ))}
        </div>
      )}

      {plaintext && report?.ok && (
        <Button
          size="sm"
          className="mt-4"
          onClick={() => downloadBytes(`${slugify(listing.title || 'dataset')}-decrypted.bin`, plaintext)}
        >
          <Download size={15} />
          Download decrypted data
        </Button>
      )}

      <StatusPanels notice={notice} error={error} busy={busy} busyLabel="Decrypting and verifying…" />
    </Card>
  )
}

function StatusPanels({
  notice,
  error,
  busy,
  busyLabel,
}: {
  notice: string | null
  error: string | null
  busy: boolean
  busyLabel: string
}) {
  return (
    <>
      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-sm text-foreground">
          <ShieldCheck size={15} className="text-success shrink-0" />
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {busy && <p className="mt-3 text-xs text-amber-muted">{busyLabel}</p>}
    </>
  )
}
