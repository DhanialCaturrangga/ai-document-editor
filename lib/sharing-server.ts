// lib/sharing-server.ts
// File ini HANYA boleh diimpor di Server Components / API Routes
import 'server-only'
import { supabaseAdmin } from './supabase/admin'
import type { Document } from './documents'
import type { Permission } from './sharing'

export interface SharedDocumentResult {
  document: Document
  permission: Permission
}

export async function getDocumentByToken(
  token: string
): Promise<SharedDocumentResult | null> {
  // Ambil share record via admin client (bypass RLS)
  const { data: share, error: shareError } = await supabaseAdmin
    .from('document_shares')
    .select('document_id, permission, expires_at')
    .eq('share_token', token)
    .maybeSingle()

  if (shareError || !share) return null

  // Cek apakah sudah expired
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return null
  }

  // Ambil dokumen via admin client
  const { data: document, error: docError } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', share.document_id)
    .single()

  if (docError || !document) return null

  return {
    document,
    permission: share.permission as Permission,
  }
}
