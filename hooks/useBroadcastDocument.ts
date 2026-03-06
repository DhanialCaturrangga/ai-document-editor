'use client'

import { supabase } from '@/lib/supabase/client'
import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook untuk broadcast konten dokumen secara realtime via Supabase Channel.
 * - Publisher: memanggil `broadcastContent(content)` setiap kali konten berubah
 * - Subscriber: menerima konten baru via `onReceive` callback
 *
 * Menggunakan Supabase Broadcast (bukan postgres_changes) agar bisa
 * diakses oleh siapapun termasuk viewer tanpa login (bypass RLS).
 */
export function useBroadcastDocument(
    documentId: string | null,
    onReceive: (content: string) => void
) {
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
    const callbackRef = useRef(onReceive)

    // Selalu update ref agar callback terbaru dipakai
    useEffect(() => {
        callbackRef.current = onReceive
    }, [onReceive])

    // Subscribe ke channel broadcast
    useEffect(() => {
        if (!documentId) return

        const channel = supabase
            .channel(`broadcast:doc:${documentId}`)
            .on('broadcast', { event: 'content-update' }, (payload) => {
                if (payload.payload?.content !== undefined) {
                    callbackRef.current(payload.payload.content as string)
                }
            })
            .subscribe()

        channelRef.current = channel

        return () => {
            supabase.removeChannel(channel)
            channelRef.current = null
        }
    }, [documentId])

    // Fungsi untuk broadcast konten ke semua subscriber
    const broadcastContent = useCallback((content: string) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'content-update',
                payload: { content }
            })
        }
    }, [])

    return { broadcastContent }
}
