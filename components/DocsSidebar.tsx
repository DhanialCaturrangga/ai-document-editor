'use client'

import { useState, useEffect } from 'react'
import {
    getUserDocuments,
    createDocument,
    renameDocument,
    deleteDocument,
    searchDocuments,
    type DocumentSummary
} from '@/lib/documents'
import { useDebounce } from '@/hooks/useDebounce'

interface DocsSidebarProps {
    userId: string
    activeDocumentId: string | null
    onDocumentSelect: (doc: DocumentSummary) => void
    onDocumentDelete: (deletedId: string) => void
}

export function DocsSidebar({
    userId,
    activeDocumentId,
    onDocumentSelect,
    onDocumentDelete
}: DocsSidebarProps) {
    const [documents, setDocuments] = useState<DocumentSummary[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Search State
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedQuery = useDebounce(searchQuery, 300)

    // Rename Inline State
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')

    // Delete Confirmation State
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        performSearch(debouncedQuery)
    }, [debouncedQuery, userId])

    async function performSearch(query: string) {
        setIsLoading(true)
        setError(null)
        try {
            const results = await searchDocuments(userId, query)
            setDocuments(results)
        } catch (err) {
            setError('Pencarian gagal')
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleCreate() {
        try {
            const newDoc = await createDocument(userId, 'Untitled')
            setDocuments(prev => [newDoc, ...prev])
            onDocumentSelect(newDoc)
            setRenamingId(newDoc.id)
            setRenameValue('Untitled')
        } catch (err: any) {
            console.error('FULL ERROR FROM createDocument:', err)
            alert('Gagal membuat dokumen baru: ' + (err.message || JSON.stringify(err)))
        }
    }

    function startRename(doc: DocumentSummary) {
        setRenamingId(doc.id)
        setRenameValue(doc.title)
    }

    async function submitRename(documentId: string) {
        try {
            await renameDocument(documentId, renameValue)
            setDocuments(prev =>
                prev.map(d => (d.id === documentId ? { ...d, title: renameValue.trim() } : d))
            )
        } catch (err) {
            alert('Gagal mengganti nama')
            console.error(err)
        } finally {
            setRenamingId(null)
        }
    }

    async function handleDelete(documentId: string) {
        try {
            await deleteDocument(documentId)
            setDocuments(prev => prev.filter(d => d.id !== documentId))
            setDeletingId(null)
            if (documentId === activeDocumentId) {
                onDocumentDelete(documentId)
            }
        } catch (err) {
            alert('Gagal menghapus dokumen')
            console.error(err)
        }
    }

    if (isLoading && documents.length === 0) return <div className="sidebar" style={{justifyContent: 'center', alignItems: 'center', color: 'var(--text-tertiary)', fontSize: 13}}>Memuat dokumen...</div>
    if (error) return (
        <div className="sidebar" style={{padding: 16}}>
            <p className="error-message">{error}</p>
            <button onClick={() => performSearch(debouncedQuery)} className="btn-ghost" style={{marginTop: 8}}>
                Coba lagi
            </button>
        </div>
    )

    return (
        <div className="sidebar">
            {/* Header */}
            <div className="sidebar-header">
                <h2>Dokumen Saya</h2>
                <button
                    onClick={handleCreate}
                    className="sidebar-btn-new"
                    title="Dokumen Baru"
                >
                    + Baru
                </button>
            </div>

            {/* Search Input */}
            <div className="sidebar-search">
                <input
                    type="text"
                    placeholder="Cari dokumen..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="sidebar-list">
                {documents.length === 0 ? (
                    searchQuery ? (
                        <div className="sidebar-empty">
                            <p>Tidak ada dokumen dengan kata &quot;{searchQuery}&quot;</p>
                        </div>
                    ) : (
                        <div className="sidebar-empty">
                            <p>Belum ada dokumen.</p>
                            <button
                                onClick={handleCreate}
                                className="sidebar-btn-new"
                                style={{ marginTop: 12 }}
                            >
                                Buat dokumen pertama
                            </button>
                        </div>
                    )
                ) : (
                    documents.map(doc => (
                        <div
                            key={doc.id}
                            className={`sidebar-item ${doc.id === activeDocumentId ? 'active' : ''}`}
                            onClick={() => renamingId !== doc.id && onDocumentSelect(doc)}
                        >
                            {renamingId === doc.id ? (
                                <input
                                    type="text"
                                    value={renameValue}
                                    autoFocus
                                    onChange={e => setRenameValue(e.target.value)}
                                    onBlur={() => submitRename(doc.id)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') submitRename(doc.id)
                                        if (e.key === 'Escape') setRenamingId(null)
                                    }}
                                    className="sidebar-item-input"
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <>
                                    <div className="sidebar-item-content">
                                        <span className="sidebar-item-title">{doc.title}</span>
                                        <span className="sidebar-item-date">
                                            {new Date(doc.updated_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="sidebar-item-actions">
                                        <button
                                            onClick={e => {
                                                e.stopPropagation()
                                                startRename(doc)
                                            }}
                                            className="btn-icon"
                                            style={{ width: 24, height: 24, fontSize: 12 }}
                                            title="Ganti nama"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={e => {
                                                e.stopPropagation()
                                                setDeletingId(doc.id)
                                            }}
                                            className="btn-icon"
                                            style={{ width: 24, height: 24, fontSize: 12, color: 'var(--text-danger)' }}
                                            title="Hapus"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Confirm Delete Dialog */}
            {deletingId && (
                <div className="sidebar-dialog-overlay">
                    <div className="sidebar-dialog">
                        <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Hapus Dokumen?</h3>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                            Dokumen ini akan dihapus permanen dan tidak bisa dipulihkan.
                        </p>
                        <div className="sidebar-dialog-actions">
                            <button
                                onClick={() => setDeletingId(null)}
                                className="btn btn-ghost"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => handleDelete(deletingId)}
                                className="btn btn-primary"
                                style={{ background: 'var(--bg-danger)' }}
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
