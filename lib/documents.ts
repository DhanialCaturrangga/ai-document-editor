import { supabase } from './supabase/client'

// Core Document Type
export interface Document {
    id: string
    title: string
    content: string
    user_id: string
    is_public: boolean
    updated_at: string
    created_at: string
}

// Summary view without full content
export type DocumentSummary = Pick<Document, 'id' | 'title' | 'updated_at' | 'is_public'>

// --- Get all documents for a user ---
export async function getUserDocuments(userId: string): Promise<DocumentSummary[]> {
    const { data, error } = await supabase
        .from('documents')
        .select('id, title, updated_at, is_public')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

    if (error) {
        console.error('getUserDocuments error:', error)
        throw new Error('Gagal mengambil daftar dokumen')
    }

    return data
}

// --- Get a single document ---
export async function getDocument(documentId: string): Promise<Document> {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

    if (error) {
        console.error('getDocument error:', error)
        throw new Error('Dokumen tidak ditemukan')
    }

    return data
}

// --- Create a new document ---
export async function createDocument(
    userId: string,
    title: string = 'Untitled'
): Promise<Document> {
    const { data, error } = await supabase
        .from('documents')
        .insert({
            user_id: userId,
            title,
            content: '',
        })
        .select()
        .single()

    if (error) {
        console.error('createDocument error:', error.message, error.details, error.hint, error)
        throw new Error('Gagal membuat dokumen baru: ' + (error.message || 'Unknown error'))
    }

    return data
}

// --- Rename a document ---
export async function renameDocument(
    documentId: string,
    newTitle: string
): Promise<void> {
    const trimmed = newTitle.trim()
    if (!trimmed) throw new Error('Judul tidak boleh kosong')

    const { error } = await supabase
        .from('documents')
        .update({ title: trimmed, updated_at: new Date().toISOString() })
        .eq('id', documentId)

    if (error) {
        console.error('renameDocument error:', error)
        throw new Error('Gagal mengganti nama dokumen')
    }
}

// --- Delete a document ---
export async function deleteDocument(documentId: string): Promise<void> {
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

    if (error) {
        console.error('deleteDocument error:', error)
        throw new Error('Gagal menghapus dokumen')
    }
}

// --- Search documents ---
export async function searchDocuments(
    userId: string,
    query: string
): Promise<DocumentSummary[]> {
    if (!query.trim()) {
        return getUserDocuments(userId)
    }

    const { data, error } = await supabase
        .from('documents')
        .select('id, title, updated_at, is_public')
        .eq('user_id', userId)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('updated_at', { ascending: false })
        .limit(20)

    if (error) {
        console.error('searchDocuments error:', error)
        throw new Error('Pencarian gagal')
    }

    return data
}

// --- Toggle Document Sharing ---
export async function toggleDocumentSharing(
    documentId: string,
    isPublic: boolean
): Promise<void> {
    const { error } = await supabase
        .from('documents')
        .update({ is_public: isPublic, updated_at: new Date().toISOString() })
        .eq('id', documentId)

    if (error) {
        console.error('toggleDocumentSharing error:', error)
        throw new Error('Gagal merubah status berbagi dokumen')
    }
}
