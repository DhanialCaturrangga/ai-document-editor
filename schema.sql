-- ============================================
-- AI Document Editor - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Create documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  content text not null default '',
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents(user_id, updated_at DESC);

-- Enable RLS
alter table documents enable row level security;

-- Policies untuk documents
DROP POLICY IF EXISTS "Users can only access own documents" ON documents;
DROP POLICY IF EXISTS "Users manage own documents" ON documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can view public documents" ON documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

-- Baca: pemilik ATAU punya share yang valid
CREATE POLICY "Read own or shared documents"
  ON documents FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
        AND (
          expires_at IS NULL OR expires_at > now()
        )
    )
  );

-- Insert: hanya pemilik
CREATE POLICY "Insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update: pemilik ATAU punya share 'edit' yang valid
CREATE POLICY "Update own or edit-shared documents"
  ON documents FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
        AND permission = 'edit'
        AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- Delete: hanya pemilik
CREATE POLICY "Delete own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- 1. Tabel untuk menyimpan share links
CREATE TABLE IF NOT EXISTS document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
  expires_at TIMESTAMPTZ,  -- NULL = tidak expired
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- Hanya pemilik dokumen yang bisa manage share-nya
CREATE POLICY "Owner manages own shares"
  ON document_shares FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Enable realtime
alter publication supabase_realtime add table documents;
