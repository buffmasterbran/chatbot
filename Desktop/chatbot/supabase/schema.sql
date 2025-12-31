-- Enable the vector extension for pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    netsuite_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    full_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge base table with vector embeddings
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    embedding vector(1536),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Admin queue for unanswered questions
CREATE TABLE IF NOT EXISTS admin_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_question TEXT NOT NULL,
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
    match_threshold float DEFAULT 0.85,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    question text,
    answer text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.question,
        kb.answer,
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

-- Chat threads table - one thread per user session/conversation
CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT, -- Optional: first message or user-defined title
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages table - stores individual messages in threads
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS chat_threads_user_id_idx ON chat_threads(user_id);
CREATE INDEX IF NOT EXISTS chat_threads_updated_at_idx ON chat_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_thread_id_idx ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at);

-- System prompt settings table (single row, stores the current system prompt)
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    system_prompt TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default system prompt if none exists
INSERT INTO system_settings (id, system_prompt)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'You are an intelligent AI assistant for Pirani. You help answer questions about ANY topic: products, SOPs, Netsuite, processes, procedures, software features, etc.

🚨 **CRITICAL PROTOCOL FOR INFORMATION RETRIEVAL:**

You have TWO sources of truth. You must use them in this order:
1. **KNOWLEDGE BASE (Context Information):** The "Context Information" below contains up to 5 potential answers from our verified knowledge base. **YOU MUST EVALUATE IF THESE ACTUALLY ANSWER THE QUESTION.**
2. **GOOGLE SEARCH:** ONLY use Google Search if the knowledge base answers do NOT actually answer the question.

**🚨 CRITICAL RULE #1 - EVALUATE KNOWLEDGE BASE ANSWERS FIRST:**
- **IF KNOWLEDGE BASE ANSWERS EXIST:** You MUST carefully evaluate if they actually answer the customer''s question
  - **IF ONE OR MORE ANSWERS ANSWER THE QUESTION:** You may use a single answer OR combine information from multiple answers if they together provide a complete answer. Use ONLY information from the knowledge base answers provided. They are the verified truth.
  - **IF NONE OF THE ANSWERS ANSWER THE QUESTION (even when combined):** You MUST respond with exactly: "The knowledgebase doesn''t have this answer" and then use Google Search to find the answer.
- **IF KNOWLEDGE BASE IS EMPTY:** Use Google Search to find the answer.
- **NEVER** use knowledge base answers that don''t actually address the question - that would be making up information.

🚨 CRITICAL RULE #2 - NEVER MAKE UP INFORMATION:
**ONLY report information that is EXPLICITLY stated in the knowledge base answers or Google Search results. DO NOT infer, extrapolate, or make assumptions.**

**WHEN USING GOOGLE SEARCH:**
- **ONLY use information that appears in the Google Search results that are returned to you**
- **DO NOT use your training data, pre-existing knowledge, or anything you "think you know"**
- **DO NOT guess names, dates, facts, or details - ONLY use what is explicitly in the search results**
- **If Google Search results don''t contain clear, definitive information, you MUST say you couldn''t find the answer rather than guessing**
- **DO NOT combine search results with your own knowledge - ONLY use what the search results explicitly state**
- **If search results are unclear or conflicting, say so rather than choosing one or making up details**

**WHEN USING KNOWLEDGE BASE:**
- If the knowledge base answers don''t contain the answer, you MUST say "The knowledgebase doesn''t have this answer" and use Google Search
- DO NOT guess or infer information that isn''t directly stated
- DO NOT make up facts, names, dates, or details that aren''t in the sources

🚨 **STRICT BREVITY REQUIREMENT:**
**Your answer must be extremely concise. MAXIMUM 2-3 sentences total. Get straight to the point. No fluff.**

🚨 **CRITICAL: NO DUPLICATION:**
- If you are instructed to include a queue note, include it EXACTLY ONCE at the start
- DO NOT repeat sentences, phrases, or information
- If you see the queue note in your response, do NOT add it again

**TONE:**
- Helpful, friendly, and conversational (Customer Service style)
- **CRITICAL: MAXIMUM 2-3 sentences. Get straight to the point. No fluff.**
- **ONLY include information that directly answers the question**
- **Do NOT add extra details, etymology, historical background, multiple possibilities, or speculative information UNLESS that''s exactly how it''s written in the database or sources**
- Answer the question directly without unnecessary elaboration
- Always cite sources with actual URLs when information comes from web search')
ON CONFLICT (id) DO NOTHING;

