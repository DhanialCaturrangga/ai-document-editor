'use client'

import { type Document } from '@/lib/documents'
import { type Permission } from '@/lib/sharing'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useRealtimeDocument } from '@/hooks/useRealtimeDocument'
import { useBroadcastDocument } from '@/hooks/useBroadcastDocument'
import AIChat from '@/components/AIChat'

interface SharedDocumentViewProps {
  documentData: Document
  permission: Permission
  token: string
}

export function SharedDocumentView({ documentData, permission, token }: SharedDocumentViewProps) {
  const isViewOnly = permission === 'view'
  const { user, loading } = useAuth()
  const router = useRouter()
  
  const [content, setContent] = useState(documentData.content || '')

  useEffect(() => {
    if (!isViewOnly && !loading && !user) {
      router.push(`/login?returnUrl=/shared/${token}`)
    }
  }, [isViewOnly, loading, user, router, token])

  // Auto save applies for Edit mode
  const { saveStatus } = useAutoSave(isViewOnly ? null : documentData.id, content)

  // Real-time updates (from DB changes)
  const handleRealtimeUpdate = useCallback((newContent: string) => {
    setContent(newContent)
  }, [])
  useRealtimeDocument(documentData.id, handleRealtimeUpdate)

  // Broadcast channel (instant sync across tabs)
  const handleBroadcastReceive = useCallback((newContent: string) => {
    setContent(newContent)
  }, [])
  const { broadcastContent } = useBroadcastDocument(documentData.id, handleBroadcastReceive)

  const handleAIDocumentUpdate = useCallback((newContent: string) => {
    setContent(newContent)
    broadcastContent(newContent)
  }, [broadcastContent])

  if (!isViewOnly && loading) {
    return (
      <div className="login-container">
        <div style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="layout-wrapper" style={{ flexDirection: 'column' }}>
      {/* Banner */}
      <div style={{
        padding: '8px 16px',
        fontSize: 13,
        textAlign: 'center',
        backgroundColor: isViewOnly ? 'var(--bg-tertiary)' : 'rgba(59, 130, 246, 0.1)',
        color: isViewOnly ? 'var(--text-secondary)' : '#3b82f6',
        borderBottom: '1px solid var(--border-primary)'
      }}>
        {isViewOnly
          ? `👁 Kamu sedang melihat dokumen "${documentData.title}" (hanya baca)`
          : `✏️ Kamu sedang mengedit dokumen "${documentData.title}" yang dibagikan`
        }
      </div>

      <div className="layout-main" style={{ flexDirection: 'row' }}>
        <div className="editor-container" style={{ flex: 1, flexDirection: 'column' }}>
          {/* Header */}
          <div className="toolbar" style={{ borderBottom: '1px solid var(--border-primary)' }}>
             <div className="toolbar-left">
                <div className="toolbar-title" style={{ marginLeft: 16 }}>
                   <div className="logo" style={{ color: 'var(--brand-primary)' }}>✦</div>
                   <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                       {documentData.title}
                   </span>
                </div>
                {!isViewOnly && (
                  <div className="save-status" style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {saveStatus === 'saving' && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Menyimpan...</span>}
                      {saveStatus === 'saved' && (
                          <>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--text-success)' }}></div>
                              <span style={{ color: 'var(--text-success)', fontSize: 12 }}>Tersimpan</span>
                          </>
                      )}
                      {saveStatus === 'error' && <span style={{ color: 'var(--text-danger)', fontSize: 12 }}>⚠ Gagal menyimpan</span>}
                  </div>
                )}
             </div>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div className="line-numbers">
                {content.split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                ))}
            </div>
            <textarea
                className="editor-textarea"
                value={content}
                onChange={(e) => !isViewOnly && setContent(e.target.value)}
                readOnly={isViewOnly}
                spellCheck={false}
                placeholder={isViewOnly ? '' : "Start typing your document here..."}
            />
          </div>
        </div>

        {!isViewOnly && (
           <div style={{ width: 350, borderLeft: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-chat)' }}>
               <AIChat
                  documentId={documentData.id}
                  documentContent={content}
                  onDocumentUpdate={handleAIDocumentUpdate}
              />
           </div>
        )}
      </div>
    </div>
  )
}
