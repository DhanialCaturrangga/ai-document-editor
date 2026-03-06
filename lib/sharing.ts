import { nanoid } from 'nanoid'
import { supabase } from './supabase/client'
import type { Document } from './documents'

export type Permission = 'view' | 'edit'

export interface ShareRecord {
  id: string
  document_id: string
  share_token: string
  permission: Permission
  expires_at: string | null
  created_at: string
}

// ─── Buat share link ───────────────────────────────────────────────────────

export async function createShareLink(
  documentId: string,
  ownerId: string,
  permission: Permission,
  expiresInDays?: number  // undefined = tidak expired
): Promise<string> {
  const token = nanoid(21)  // 21 karakter, aman dan tidak bisa ditebak

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { error } = await supabase
    .from('document_shares')
    .insert({
      document_id: documentId,
      owner_id: ownerId,
      share_token: token,
      permission,
      expires_at: expiresAt,
    })

  if (error) {
    console.error('createShareLink error:', error)
    throw new Error('Gagal membuat share link')
  }

  // Kembalikan URL lengkap yang bisa langsung di-copy
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/shared/${token}`
}

// ─── Ambil semua share links milik sebuah dokumen ──────────────────────────

export async function getDocumentShares(documentId: string): Promise<ShareRecord[]> {
  const { data, error } = await supabase
    .from('document_shares')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getDocumentShares error details:', error.message, error.details, error.hint, error)
    throw new Error('Gagal mengambil daftar share: ' + (error.message || 'Unknown error'))
  }
  return data
}

// ─── Hapus share link (revoke) ─────────────────────────────────────────────

export async function revokeShareLink(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('document_shares')
    .delete()
    .eq('id', shareId)

  if (error) throw new Error('Gagal menghapus share link')
}

// getDocumentByToken sudah dipindah ke lib/sharing-server.ts (server-only)

