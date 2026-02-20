'use client'

import { useRef } from 'react'

interface Props {
    content: string
    onChange: (content: string) => void
}

export default function DocumentEditor({ content, onChange }: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const lineNumbersRef = useRef<HTMLDivElement>(null)

    // Calculate line numbers
    const lines = content.split('\n')
    const lineCount = lines.length
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')

    // Sync scroll between textarea and line numbers
    const handleScroll = () => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
        }
    }

    // Handle tab key in textarea
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault()
            const textarea = textareaRef.current
            if (!textarea) return

            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const newContent = content.substring(0, start) + '  ' + content.substring(end)
            onChange(newContent)

            // Restore cursor position after state update
            requestAnimationFrame(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 2
            })
        }
    }

    return (
        <div className="editor-container">
            {/* Line Numbers */}
            <div
                ref={lineNumbersRef}
                className="line-numbers"
                aria-hidden="true"
            >
                {lineNumbers}
            </div>

            {/* Editor */}
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                className="editor-textarea"
                placeholder="Start typing your document here..."
                spellCheck={false}
            />
        </div>
    )
}
