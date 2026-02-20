import { AuthProvider } from '@/components/AuthProvider'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'AI Document Editor',
    description: 'Collaborative document editor with AI assistant powered by Gemini',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    )
}
