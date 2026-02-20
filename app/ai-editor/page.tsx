'use client'

import AIChat from '@/components/AIChat'
import { useAuth } from '@/components/AuthProvider'
import DocumentEditor from '@/components/DocumentEditor'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useRealtimeDocument } from '@/hooks/useRealtimeDocument'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface DocInfo {
    id: string
    title: string
}

export default function EditorPage() {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    const [documentContent, setDocumentContent] = useState('')
    const [currentDoc, setCurrentDoc] = useState<DocInfo | null>(null)
    const [documents, setDocuments] = useState<any[]>([])
    const [showDocList, setShowDocList] = useState(true)
    const [darkMode, setDarkMode] = useState(false)

    // Undo/Redo state
    const [history, setHistory] = useState<string[]>([''])
    const [historyIndex, setHistoryIndex] = useState(0)

    // Auto-save
    useAutoSave(currentDoc?.id ?? null, documentContent)

    // Real-time updates
    const handleRealtimeUpdate = useCallback(
        (content: string) => {
            setDocumentContent(content)
        },
        []
    )
    useRealtimeDocument(currentDoc?.id ?? null, handleRealtimeUpdate)

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

    // Load user documents
    useEffect(() => {
        if (!user) return
        loadDocuments()
    }, [user])

    async function loadDocuments() {
        const { data } = await supabase
            .from('documents')
            .select('*')
            .order('updated_at', { ascending: false })

        if (data) setDocuments(data)
    }

    async function createDocument() {
        if (!user) return
        const title = prompt('Document title:') || 'Untitled Document'
        const { data, error } = await supabase
            .from('documents')
            .insert({ title, content: '', user_id: user.id })
            .select()
            .single()

        if (data && !error) {
            await loadDocuments()
            openDocument(data)
        }
    }

    async function openDocument(doc: any) {
        setCurrentDoc({ id: doc.id, title: doc.title })
        setDocumentContent(doc.content || '')
        setHistory([doc.content || ''])
        setHistoryIndex(0)
        setShowDocList(false)
    }

    async function deleteDocument(docId: string, e: React.MouseEvent) {
        e.stopPropagation()
        if (!confirm('Delete this document?')) return
        await supabase.from('documents').delete().eq('id', docId)
        if (currentDoc?.id === docId) {
            setCurrentDoc(null)
            setDocumentContent('')
            setShowDocList(true)
        }
        await loadDocuments()
    }

    // Document change handler with undo history
    const handleDocumentChange = useCallback(
        (newContent: string) => {
            setDocumentContent(newContent)
            setHistory((prev) => {
                const newHistory = prev.slice(0, historyIndex + 1)
                newHistory.push(newContent)
                // Limit history to 50 entries
                if (newHistory.length > 50) newHistory.shift()
                return newHistory
            })
            setHistoryIndex((prev) => Math.min(prev + 1, 49))
        },
        [historyIndex]
    )

    // AI document update (also tracked in history)
    const handleAIDocumentUpdate = useCallback(
        (newContent: string) => {
            setDocumentContent(newContent)
            setHistory((prev) => {
                const newHistory = [...prev]
                newHistory.push(newContent)
                if (newHistory.length > 50) newHistory.shift()
                return newHistory
            })
            setHistoryIndex((prev) => prev + 1)
        },
        []
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
        a.download = `${currentDoc?.title || 'document'}.md`
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

    // Document list view
    if (showDocList) {
        return (
            <div className="docs-container" data-theme={darkMode ? 'dark' : undefined}>
                <div className="docs-header">
                    <h1>
                        <span>📝</span> My Documents
                    </h1>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-icon" onClick={toggleDarkMode} title="Toggle dark mode">
                            {darkMode ? '☀️' : '🌙'}
                        </button>
                        <button className="btn btn-primary" onClick={createDocument}>
                            + New Document
                        </button>
                    </div>
                </div>

                <div className="docs-grid">
                    <div className="doc-card doc-card-new" onClick={createDocument}>
                        <div className="plus-icon">+</div>
                        <span>New Document</span>
                    </div>
                    {documents.map((doc) => (
                        <div key={doc.id} className="doc-card" onClick={() => openDocument(doc)}>
                            <h3>{doc.title}</h3>
                            <div className="doc-preview">
                                {doc.content || 'Empty document'}
                            </div>
                            <div className="doc-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                                <button
                                    className="btn-icon"
                                    style={{ width: 24, height: 24, fontSize: 12, color: 'var(--text-danger)' }}
                                    onClick={(e) => deleteDocument(doc.id, e)}
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ textAlign: 'center', marginTop: 32 }}>
                    <div className="user-badge" style={{ display: 'inline-flex' }}>
                        <span>👤</span>
                        <span>{user.email}</span>
                        <button
                            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8, color: 'var(--text-danger)', fontSize: 12 }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Editor view
    return (
        <div className="app-container">
            {/* Toolbar */}
            <div className="toolbar">
                <div className="toolbar-left">
                    <button
                        className="btn-icon"
                        onClick={() => setShowDocList(true)}
                        title="Back to documents"
                    >
                        ←
                    </button>
                    <div className="toolbar-title">
                        <div className="logo">✦</div>
                        <span>{currentDoc?.title || 'Untitled'}</span>
                    </div>
                    <div className="save-status">
                        <div className="dot"></div>
                        <span>Auto-saved</span>
                    </div>
                </div>

                <div className="toolbar-right">
                    <button
                        className="btn-icon"
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        title="Undo (Ctrl+Z)"
                    >
                        ↩
                    </button>
                    <button
                        className="btn-icon"
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        title="Redo (Ctrl+Y)"
                    >
                        ↪
                    </button>
                    <button
                        className="btn-icon"
                        onClick={downloadDocument}
                        title="Download"
                    >
                        ⬇
                    </button>
                    <button
                        className="btn-icon"
                        onClick={toggleDarkMode}
                        title="Toggle dark mode"
                    >
                        {darkMode ? '☀️' : '🌙'}
                    </button>
                    <div className="user-badge">
                        <span>{user.email?.split('@')[0]}</span>
                    </div>
                </div>
            </div>

            {/* Panels */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <PanelGroup direction="horizontal">
                    <Panel defaultSize={50} minSize={30} className="panel-editor">
                        <DocumentEditor
                            content={documentContent}
                            onChange={handleDocumentChange}
                        />
                    </Panel>

                    <PanelResizeHandle className="resize-handle" />

                    <Panel defaultSize={50} minSize={30} className="panel-chat">
                        <AIChat
                            documentContent={documentContent}
                            onDocumentUpdate={handleAIDocumentUpdate}
                        />
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    )
}
