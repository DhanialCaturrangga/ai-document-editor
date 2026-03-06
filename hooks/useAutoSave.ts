'use client'

import { supabase } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'

export function useAutoSave(documentId: string | null, content: string) {
    const savedContentRef = useRef(content)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')

    useEffect(() => {
        if (!documentId) return
        // Skip if content hasn't changed
        if (content === savedContentRef.current) return

        // Debounce save
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        setSaveStatus('saving')
        timeoutRef.current = setTimeout(async () => {
            try {
                const { error } = await supabase
                    .from('documents')
                    .update({ content, updated_at: new Date().toISOString() })
                    .eq('id', documentId)

                if (error) throw error

                savedContentRef.current = content
                setSaveStatus('saved')
            } catch (err) {
                console.error('Auto-save failed:', err)
                setSaveStatus('error')
            }
        }, 2000)

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [documentId, content])

    return { saveStatus }
}
