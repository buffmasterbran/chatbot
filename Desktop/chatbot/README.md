# Pirani Chatbot

A Next.js chatbot application with Supabase backend, vector embeddings, and knowledge base management. Uses OpenAI for embeddings and Gemini for text generation with Google Search capabilities.

## Getting Started

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to your project settings → API
3. Copy your project URL and API keys

### 2. Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your_session_secret

# OpenAI (for embeddings)
OPENAI_API_KEY=your_openai_key

# Gemini (for text generation with Google Search)
GEMINI_API_KEY=your_gemini_key

# NetSuite (optional, for authentication)
NETSUITE_REALM=your_netsuite_realm
NETSUITE_CONSUMER_KEY=your_consumer_key
NETSUITE_CONSUMER_SECRET=your_consumer_secret
NETSUITE_TOKEN_ID=your_token_id
NETSUITE_TOKEN_SECRET=your_token_secret
```

### 3. Database Setup

1. Go to your Supabase project → SQL Editor
2. Copy and paste the contents of `supabase/schema.sql`
3. Run the query

This will create:
- `users` table for user management
- `knowledge_base` table with vector embeddings for RAG
- `admin_queue` table for unanswered questions
- `chat_threads` and `chat_messages` tables for chat persistence
- `match_documents` function for similarity search
- Required indexes and extensions (including pgvector)

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `app/` - Next.js app router pages and API routes
  - `chat/` - Main chat interface
  - `admin/` - Admin dashboard (chat, inbox, data management)
  - `api/` - API endpoints for chat, auth, admin operations
- `components/` - React components
  - `admin/` - Admin panel components
  - `ui/` - Reusable UI components
- `lib/` - Utility functions and clients
  - `supabase.ts` - Supabase client configuration
  - `openai.ts` - OpenAI embeddings and Gemini text generation with Google Search
  - `session.ts` - Session management
- `supabase/` - Database schema

## Features

- **RAG (Retrieval Augmented Generation)**: Vector similarity search for knowledge base using OpenAI embeddings
- **Hybrid AI Approach**: OpenAI for embeddings, Gemini with Google Search for text generation
- **Admin Queue**: Unanswered questions are queued for admin review with AI-generated proposed answers
- **Knowledge Base Management**: Admin interface for managing Q&A pairs
- **Chat Persistence**: Chat threads and messages stored in database
- **Web Search Integration**: Automatic web search fallback when database doesn't have answers
- **Source Attribution**: Clear distinction between database, Pirani website, and web search sources

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | Yes |
| `SESSION_SECRET` | Secret key for JWT session encryption | Yes |
| `OPENAI_API_KEY` | OpenAI API key for embeddings | Yes |
| `GEMINI_API_KEY` | Gemini API key for text generation | Yes |
| `NETSUITE_*` | NetSuite OAuth credentials | Optional |

## Technology Stack

- **Next.js 14** - React framework with App Router
- **Supabase** - PostgreSQL database with pgvector extension
- **OpenAI** - Text embeddings (text-embedding-3-small)
- **Gemini** - Text generation with Google Search (gemini-2.5-flash)
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
