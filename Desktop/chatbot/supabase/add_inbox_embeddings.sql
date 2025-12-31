-- Add embedding column to admin_queue for duplicate detection
ALTER TABLE admin_queue ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for vector similarity search on admin_queue
CREATE INDEX IF NOT EXISTS admin_queue_embedding_idx ON admin_queue
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RPC Function: match_inbox_questions
-- Checks if a similar question already exists in the inbox (pending status)
CREATE OR REPLACE FUNCTION match_inbox_questions(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.85,
    match_count int DEFAULT 1
)
RETURNS TABLE (
    id uuid,
    user_question text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        aq.id,
        aq.user_question,
        1 - (aq.embedding <=> query_embedding) AS similarity
    FROM admin_queue aq
    WHERE aq.embedding IS NOT NULL
        AND aq.status = 'pending'  -- Only check pending questions
        AND 1 - (aq.embedding <=> query_embedding) >= match_threshold
    ORDER BY aq.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

