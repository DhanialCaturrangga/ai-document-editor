'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
    role: 'user' | 'assistant'
    content: string
    functionCall?: { name: string; args: any }
}

interface Props {
    documentId: string | null
    documentContent: string
    onDocumentUpdate: (newContent: string) => void
}

export default function AIChat({ documentId, documentContent, onDocumentUpdate }: Props) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<{
        data: string
        type: string
        name: string
    } | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Reset chat when document changes
    useEffect(() => {
        setMessages([])
        setInput('')
        setSelectedFile(null)
    }, [documentId])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading])

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('File must be less than 10MB')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            setSelectedFile({
                data: reader.result as string,
                type: file.type,
                name: file.name,
            })
        }
        reader.readAsDataURL(file)

        // Reset file input so same file can be re-selected
        e.target.value = ''
    }

    async function sendMessage() {
        if (!input.trim() || isLoading) return

        setIsLoading(true)
        const userMessage: Message = { role: 'user', content: input }
        setMessages((prev) => [...prev, userMessage])
        setInput('')

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    documentContent,
                    file: selectedFile
                        ? { data: selectedFile.data, type: selectedFile.type }
                        : null,
                }),
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.error || 'Chat API failed')
            }

            const data = await response.json()

            // If AI updated the document, apply the change
            if (data.newDocumentContent !== undefined) {
                onDocumentUpdate(data.newDocumentContent)
            }

            setMessages((prev) => [...prev, data.message])
            setSelectedFile(null) // Clear file after send
        } catch (error: any) {
            console.error('Chat error:', error)
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: `❌ Error: ${error.message || 'Something went wrong. Please try again.'}`,
                },
            ])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="chat-container">
            {/* Header */}
            <div className="chat-header">
                <div className="chat-header-icon">🤖</div>
                <div className="chat-header-info">
                    <h3>AI Assistant</h3>
                    <span>Powered by Gemini 2.5 Flash</span>
                </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', fontSize: '13px', lineHeight: '1.8' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
                        <p>Hi! I&apos;m your AI document assistant.</p>
                        <p>Try: &quot;Tambah heading Hello World di baris 1&quot;</p>
                        <p>Or: &quot;Ganti semua kata foo jadi bar&quot;</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.role}`}>
                        <div className="message-bubble">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                            </ReactMarkdown>
                            {msg.functionCall && (
                                <div className="tool-badge">
                                    🔧 {msg.functionCall.name}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="typing-indicator">
                        <div className="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <span style={{ marginLeft: '4px' }}>AI is thinking...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* File Preview */}
            {selectedFile && (
                <div className="file-preview">
                    <span>📎</span>
                    <span>{selectedFile.name} ({selectedFile.type})</span>
                    <button
                        className="remove-file"
                        onClick={() => setSelectedFile(null)}
                        title="Remove file"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Input */}
            <div className="chat-input-area">
                <div className="chat-input-actions">
                    <label className="attach-btn">
                        📎 Attach File
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            accept="image/*,.pdf,.txt,.md,.doc,.docx,.csv,.json,.xml"
                        />
                    </label>
                </div>

                <div className="chat-input-row">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                sendMessage()
                            }
                        }}
                        placeholder="Ask AI to edit the document..."
                        rows={2}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isLoading || !input.trim()}
                        className="send-btn"
                        title="Send message"
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    )
}
