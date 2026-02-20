'use client'

import { supabase } from '@/lib/supabase/client'
import { useCallback, useEffect } from 'react'

export function useRealtimeDocument(
    documentId: string | null,
    onUpdate: (content: string) => void
) {
    const handleUpdate = useCallback(onUpdate, [onUpdate])

    useEffect(() => {
        if (!documentId) return

        const channel = supabase
            .channel(`document:${documentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'documents',
                    filter: `id=eq.${documentId}`
                },
                (payload: any) => {
                    handleUpdate(payload.new.content)
                }
            )
            .subscribe()

        // IMPORTANT: Use removeChannel for proper cleanup (not just unsubscribe)
        return () => {
            supabase.removeChannel(channel)
        }
    }, [documentId, handleUpdate])
}
