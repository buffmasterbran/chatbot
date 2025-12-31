-- ============================================
-- TIERED RAG CHATBOT SCHEMA
-- Run this manually in Supabase SQL Editor
-- ============================================

-- Enable the vector extension for pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base table with vector embeddings
-- Schema: content (chunk of text), source (SOP/document title)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL, -- The chunk of text/answer
    source TEXT NOT NULL,  -- Title of the SOP or document
    embedding vector(1536), -- Compatible with text-embedding-3-small
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin queue for unanswered questions
CREATE TABLE IF NOT EXISTS admin_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL UNIQUE, -- Enforce uniqueness to prevent duplicate "unanswered" entries
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RPC Function: match_documents
-- Performs cosine similarity search on knowledge_base
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.78,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    content text,
    source text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.content,
        kb.source,
        1 - (kb.embedding <=> query_embedding) AS similarity
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
        AND 1 - (kb.embedding <=> query_embedding) >= match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create index on admin_queue status for faster queries
CREATE INDEX IF NOT EXISTS admin_queue_status_idx ON admin_queue(status);

-- Create index on admin_queue created_at for sorting
CREATE INDEX IF NOT EXISTS admin_queue_created_at_idx ON admin_queue(created_at DESC);

