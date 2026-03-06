'use client'

import { useState, useEffect } from 'react'
import {
  createShareLink,
  getDocumentShares,
  revokeShareLink,
  type Permission,
  type ShareRecord
} from '@/lib/sharing'

interface ShareDialogProps {
  documentId: string
  ownerId: string
  onClose: () => void
}

export function ShareDialog({ documentId, ownerId, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<ShareRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [permission, setPermission] = useState<Permission>('view')
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined)
  const [isCreating, setIsCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => {
    loadShares()
  }, [documentId])

  async function loadShares() {
    try {
      const data = await getDocumentShares(documentId)
      setShares(data)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate() {
    setIsCreating(true)
    try {
      const url = await createShareLink(documentId, ownerId, permission, expiresInDays)
      await navigator.clipboard.writeText(url)
      await loadShares()  // refresh daftar
      setCopiedToken('new') // temporary state
      setTimeout(() => setCopiedToken(null), 2000)
    } catch (err: any) {
      console.error('FULL ERROR FROM createShareLink:', err)
      alert('Gagal membuat link: ' + (err.message || JSON.stringify(err)))
    } finally {
      setIsCreating(false)
    }
  }

  async function handleCopy(token: string) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const url = `${baseUrl}/shared/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)  // reset setelah 2 detik
  }

  async function handleRevoke(shareId: string) {
    if (!confirm('Hapus link ini? Siapapun yang punya link ini tidak bisa akses lagi.')) return
    try {
      await revokeShareLink(shareId)
      setShares(prev => prev.filter(s => s.id !== shareId))
    } catch (e) {
      alert('Gagal menghapus link')
    }
  }

  return (
    <div className="sidebar-dialog-overlay" onClick={onClose}>
      <div className="sidebar-dialog" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Share Dokumen</h2>
          <button onClick={onClose} className="btn-icon" style={{ width: 28, height: 28 }}>✕</button>
        </div>

        {/* Form buat link baru */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Permission</label>
            <select
              value={permission}
              onChange={e => setPermission(e.target.value as Permission)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                outline: 'none'
              }}
            >
              <option value="view">View Only (hanya bisa baca)</option>
              <option value="edit">Edit (bisa ubah dokumen)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Kedaluwarsa (opsional)</label>
            <select
              value={expiresInDays ?? ''}
              onChange={e => setExpiresInDays(e.target.value ? Number(e.target.value) : undefined)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                outline: 'none'
              }}
            >
              <option value="">Tidak kedaluwarsa</option>
              <option value="1">1 hari</option>
              <option value="7">7 hari</option>
              <option value="30">30 hari</option>
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
          >
            {isCreating ? 'Membuat link...' : copiedToken === 'new' ? '✔ Link Disalin!' : 'Buat & Salin Link'}
          </button>
        </div>

        {/* Daftar link yang sudah ada */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Link Aktif</h3>
          {isLoading ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Memuat...</p>
          ) : shares.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Belum ada link yang dibuat.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shares.map(share => (
                <div key={share.id} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: share.permission === 'edit' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                      color: share.permission === 'edit' ? '#eab308' : 'var(--text-accent)'
                    }}>
                      {share.permission === 'edit' ? 'Edit' : 'View'}
                    </span>
                    {share.expires_at && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Exp: {new Date(share.expires_at).toLocaleDateString('id-ID')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(share.share_token)}
                    className="btn-ghost"
                    style={{ border: 'none', padding: '4px 8px', fontSize: 12 }}
                  >
                    {copiedToken === share.share_token ? '✓ Disalin' : 'Salin'}
                  </button>
                  <button
                    onClick={() => handleRevoke(share.id)}
                    className="btn-ghost"
                    style={{ border: 'none', padding: '4px 8px', fontSize: 12, color: 'var(--text-danger)' }}
                  >
                    Hapus
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
