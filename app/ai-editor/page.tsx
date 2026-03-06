'use client'

import AIChat from '@/components/AIChat'
import { useAuth } from '@/components/AuthProvider'
import { DocsSidebar } from '@/components/DocsSidebar'
import { ShareDialog } from '@/components/ShareDialog'
import DocumentEditor from '@/components/DocumentEditor'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useRealtimeDocument } from '@/hooks/useRealtimeDocument'
import { useBroadcastDocument } from '@/hooks/useBroadcastDocument'
import { supabase } from '@/lib/supabase/client'
import type { DocumentSummary } from '@/lib/documents'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

export default function EditorPage() {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    
    // Editor State
    const [activeDocument, setActiveDocument] = useState<DocumentSummary | null>(null)
    const [documentContent, setDocumentContent] = useState('')
    const [darkMode, setDarkMode] = useState(false)
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)

    // Undo/Redo state
    const [history, setHistory] = useState<string[]>([''])
    const [historyIndex, setHistoryIndex] = useState(0)

    // Auto-save
    const { saveStatus } = useAutoSave(activeDocument?.id ?? null, documentContent)

    // Real-time updates (from DB changes)
    const handleRealtimeUpdate = useCallback(
        (content: string) => {
            setDocumentContent(content)
        },
        []
    )
    useRealtimeDocument(activeDocument?.id ?? null, handleRealtimeUpdate)

    // Broadcast channel (instant sync across tabs)
    const handleBroadcastReceive = useCallback(
        (content: string) => {
            setDocumentContent(content)
        },
        []
    )
    const { broadcastContent } = useBroadcastDocument(activeDocument?.id ?? null, handleBroadcastReceive)

    // Dark mode persistence
    useEffect(() => {
        const saved = localStorage.getItem('ai-editor-theme')
        if (saved === 'dark') {
            setDarkMode(true)
            document.documentElement.setAttribute('data-theme', 'dark')
        }
    }, [])

    const toggleDarkMode = () => {
        const next = !darkMode
        setDarkMode(next)
        document.documentElement.setAttribute('data-theme', next ? 'dark' : '')
        localStorage.setItem('ai-editor-theme', next ? 'dark' : 'light')
    }

    // Auth redirect
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login')
        }
    }, [user, authLoading, router])

    // Load entire document content when selected
    useEffect(() => {
        if (!activeDocument) {
            setDocumentContent('')
            setHistory([''])
            setHistoryIndex(0)
            return
        }

        async function fetchContent() {
            const { data, error } = await supabase
                .from('documents')
                .select('content')
                .eq('id', activeDocument!.id)
                .single()

            if (data && !error) {
                const content = data.content || ''
                setDocumentContent(content)
                setHistory([content])
                setHistoryIndex(0)
            }
        }
        fetchContent()
    }, [activeDocument?.id]) // Re-run when document ID changes

    function handleDocumentDelete(deletedId: string) {
        if (activeDocument?.id === deletedId) {
            setActiveDocument(null)
        }
    }

    // Document change handler with undo history
    const handleDocumentChange = useCallback(
        (newContent: string) => {
            setDocumentContent(newContent)
            broadcastContent(newContent) // Broadcast ke semua viewer secara instan
            setHistory((prev) => {
                const newHistory = prev.slice(0, historyIndex + 1)
                newHistory.push(newContent)
                // Limit history to 50 entries
                if (newHistory.length > 50) newHistory.shift()
                return newHistory
            })
            setHistoryIndex((prev) => Math.min(prev + 1, 49))
        },
        [historyIndex, broadcastContent]
    )

    // AI document update (also tracked in history)
    const handleAIDocumentUpdate = useCallback(
        (newContent: string) => {
            setDocumentContent(newContent)
            broadcastContent(newContent) // Broadcast ke semua viewer secara instan
            setHistory((prev) => {
                const newHistory = [...prev]
                newHistory.push(newContent)
                if (newHistory.length > 50) newHistory.shift()
                return newHistory
            })
            setHistoryIndex((prev) => prev + 1)
        },
        [broadcastContent]
    )

    // Undo/Redo
    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1
            setHistoryIndex(newIndex)
            setDocumentContent(history[newIndex])
        }
    }, [historyIndex, history])

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1
            setHistoryIndex(newIndex)
            setDocumentContent(history[newIndex])
        }
    }, [historyIndex, history])

    // Export / Download
    const downloadDocument = () => {
        const blob = new Blob([documentContent], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeDocument?.title || 'document'}.md`
        a.click()
        URL.revokeObjectURL(url)
    }

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyboard = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault()
                    undo()
                } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                    e.preventDefault()
                    redo()
                } else if (e.key === 's') {
                    e.preventDefault()
                    // Auto-save handles this, but we show feedback
                }
            }
        }
        window.addEventListener('keydown', handleKeyboard)
        return () => window.removeEventListener('keydown', handleKeyboard)
    }, [undo, redo])

    // Loading state
    if (authLoading) {
        return (
            <div className="login-container">
                <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Loading...</div>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="layout-wrapper">
            {/* Sidebar */}
            <DocsSidebar
                userId={user.id}
                activeDocumentId={activeDocument?.id ?? null}
                onDocumentSelect={setActiveDocument}
                onDocumentDelete={handleDocumentDelete}
            />

            {/* Main Content Area */}
            <div className="layout-main">
                {activeDocument ? (
                    <div className="app-container" key={activeDocument.id}>
                        {/* Toolbar */}
                        <div className="toolbar border-b border-[var(--border)]">
                            <div className="toolbar-left">
                                <div className="toolbar-title ml-4">
                                    <div className="logo text-[var(--brand-primary)]">✦</div>
                                    <span className="font-medium text-[var(--text-primary)]">
                                        {activeDocument.title}
                                    </span>
                                </div>
                                <div className="save-status ml-4 flex items-center gap-2">
                                    {saveStatus === 'saving' && <span className="text-gray-400 text-xs">Menyimpan...</span>}
                                    {saveStatus === 'saved' && (
                                        <>
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success)' }}></div>
                                            <span className="text-green-500 text-xs">Tersimpan</span>
                                        </>
                                    )}
                                    {saveStatus === 'error' && <span className="text-red-500 text-xs">⚠ Gagal menyimpan</span>}
                                </div>
                            </div>

                            <div className="toolbar-right pr-4">
                                <button
                                    onClick={() => setIsShareDialogOpen(true)}
                                    className="btn btn-primary"
                                    style={{ padding: '4px 10px', fontSize: 13, marginRight: 8 }}
                                >
                                    🔗 Bagikan
                                </button>
                                <button
                                    className="btn-icon text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    onClick={undo}
                                    disabled={historyIndex <= 0}
                                    title="Undo (Ctrl+Z)"
                                >
                                    ↩
                                </button>
                                <button
                                    className="btn-icon text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    onClick={redo}
                                    disabled={historyIndex >= history.length - 1}
                                    title="Redo (Ctrl+Y)"
                                >
                                    ↪
                                </button>
                                <button
                                    className="btn-icon text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    onClick={downloadDocument}
                                    title="Download"
                                >
                                    ⬇
                                </button>
                                <button
                                    className="btn-icon text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    onClick={toggleDarkMode}
                                    title="Toggle dark mode"
                                >
                                    {darkMode ? '☀️' : '🌙'}
                                </button>
                                <div className="user-badge flex items-center gap-2 ml-4 px-3 py-1 bg-[var(--surface-raised)] rounded-full border border-[var(--border)]">
                                    <span className="text-sm font-medium text-[var(--text-primary)]">
                                        {user.email?.split('@')[0]}
                                    </span>
                                    <button
                                        onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                                        className="text-xs text-[var(--text-danger)] hover:underline bg-transparent border-none cursor-pointer p-0"
                                    >
                                        Keluar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Editor Panels */}
                        <div className="flex-1 overflow-hidden">
                            <PanelGroup direction="horizontal">
                                <Panel defaultSize={50} minSize={30} className="panel-editor h-full">
                                    <DocumentEditor
                                        content={documentContent}
                                        onChange={handleDocumentChange}
                                    />
                                </Panel>

                                <PanelResizeHandle className="w-1 bg-[var(--border)] hover:bg-[var(--brand-primary)] transition-colors cursor-col-resize" />

                                <Panel defaultSize={50} minSize={30} className="panel-chat border-l border-[var(--border)] h-full">
                                    <AIChat
                                        documentId={activeDocument?.id ?? null}
                                        documentContent={documentContent}
                                        onDocumentUpdate={handleAIDocumentUpdate}
                                    />
                                </Panel>
                            </PanelGroup>
                        </div>
                        {isShareDialogOpen && (
                            <ShareDialog
                                documentId={activeDocument.id}
                                ownerId={user.id}
                                onClose={() => setIsShareDialogOpen(false)}
                            />
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)] bg-[var(--surface-sunken)]">
                        <div className="text-4xl mb-4">📄</div>
                        <p className="text-lg">Pilih dokumen dari sidebar atau buat dokumen baru</p>
                    </div>
                )}
            </div>
        </div>
    )
}
