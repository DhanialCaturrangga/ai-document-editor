import { getDocumentByToken } from '@/lib/sharing-server'
import { SharedDocumentView } from './SharedDocumentView'

interface PageProps {
  params: { token: string }
}

export default async function SharedDocumentPage(props: PageProps) {
  // Await params object for Next 15 compatibility
  const params = await props.params;
  const result = await getDocumentByToken(params.token)

  // Link tidak valid atau sudah expired
  if (!result) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <h1 style={{ marginBottom: 16 }}>Link Tidak Valid</h1>
          <p className="subtitle">
            Link ini sudah kedaluwarsa atau dokumen sudah dihapus.
          </p>
        </div>
      </div>
    )
  }

  return (
    <SharedDocumentView
      documentData={result.document}
      permission={result.permission}
      token={params.token}
    />
  )
}
