import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding as generateEmbeddingUtil } from '@/lib/openai';
import { judgeContextRelevance, generateInternalAnswer, generateWebSearchAnswer } from '@/lib/gemini';

/**
 * Add question to admin_queue (fire-and-forget, non-blocking)
 * Checks for duplicates using embedding similarity before adding
 */
function addToAdminQueue(question: string, questionEmbedding: number[]) {
  // Fire and forget - don't await, don't block the response
  (async () => {
    try {
      console.log('   🔍 Checking for duplicate questions in inbox...');
      
      // Check if a similar question already exists in the inbox (pending status)
      const { data: similarInboxQuestions, error: inboxCheckError } = await supabaseAdmin.rpc(
        'match_inbox_questions',
        {
          query_embedding: questionEmbedding,
          match_threshold: 0.85, // High threshold to catch semantically similar questions
          match_count: 1,
        }
      );

      if (inboxCheckError) {
        console.error('   ⚠️  Error checking inbox for duplicates:', inboxCheckError);
        // Continue anyway - better to add a duplicate than miss a question
      } else if (similarInboxQuestions && similarInboxQuestions.length > 0) {
        const similar = similarInboxQuestions[0];
        console.log(`   ⚠️  Similar question already in inbox (similarity: ${(similar.similarity * 100).toFixed(1)}%): "${similar.user_question}"`);
        console.log('   ❌ Skipping duplicate - not adding to inbox');
        return; // Don't add duplicate
      }

      // No similar question found in inbox, proceed to add
      console.log('   ✅ No similar questions found in inbox, adding to queue...');
      const { error } = await supabaseAdmin
        .from('admin_queue')
        .insert({ 
          user_question: question.trim(), 
          status: 'pending',
          embedding: questionEmbedding // Store embedding for future duplicate checks
        });
      
      // Ignore duplicate key errors (exact text match - expected behavior)
      if (error && error.code !== '23505') {
        console.error('   ❌ Error adding to admin queue:', error);
      } else if (!error) {
        console.log('   ✅ Question added to admin queue:', question.trim());
      } else {
        console.log('   ⚠️  Exact duplicate question (skipped)');
      }
    } catch (error: any) {
      // Ignore duplicate key errors (expected behavior)
      if (error?.code !== '23505') {
        console.error('   ❌ Error adding to admin queue:', error);
      }
    }
  })();
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { question } = await request.json();
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    console.log('\n' + '='.repeat(80));
    console.log('=== TIERED RAG CHATBOT ===');
    console.log('='.repeat(80));
    console.log('📥 Question:', question);
    console.log('');

    // ============================================
    // STEP 1: The Retrieval (Tier 1)
    // ============================================
    console.log('🔍 STEP 1: Retrieving from knowledge base...');
    console.log('   Generating embedding for question...');
    
    // Generate embedding from question only for search
    // Database embeddings are now stored from question-only (matching search queries)
    const queryEmbedding = await generateEmbeddingUtil(question);
    console.log(`   ✅ Embedding generated (${queryEmbedding.length} dimensions)`);
    
    console.log('   Searching database with threshold: 0.50, max results: 5');
    const { data: matches, error: searchError } = await supabaseAdmin.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.50, // Lower threshold to catch more matches (was 0.70, then 0.60, trying 0.50)
        match_count: 5,
      }
    );

    if (searchError) {
      console.error('❌ Database search error:', searchError);
      return NextResponse.json(
        { error: 'Failed to search knowledge base' },
        { status: 500 }
      );
    }

    // Extract answer content from matches (database uses question/answer columns)
    const dbChunks = matches?.map((match: any) => match.answer || match.content) || [];
    console.log(`   📊 Found ${matches?.length || 0} matches from database`);
    if (matches && matches.length > 0) {
      console.log('   📋 Match details:');
      matches.forEach((match: any, idx: number) => {
        console.log(`      ${idx + 1}. Similarity: ${((match.similarity || 0) * 100).toFixed(2)}%`);
        console.log(`         Question: ${(match.question || 'N/A').substring(0, 60)}...`);
        console.log(`         Answer preview: ${(match.answer || match.content || '').substring(0, 80)}...`);
      });
    }
    console.log(`   ✅ Extracted ${dbChunks.length} chunks for evaluation`);
    console.log('');

    // ============================================
    // STEP 2: The Judge (Verification)
    // ============================================
    console.log('⚖️  STEP 2: Judge Evaluation');
    if (dbChunks.length === 0) {
      console.log('   ⚠️  No chunks found - skipping judge, defaulting to NO');
      console.log('   📊 Decision: NO (no database chunks to evaluate)');
    } else {
      console.log(`   📝 Evaluating ${dbChunks.length} chunk(s) against question...`);
      console.log(`   Question: "${question}"`);
      console.log(`   Chunk previews:`);
      dbChunks.slice(0, 3).forEach((chunk: string, idx: number) => {
        console.log(`      ${idx + 1}. ${chunk.substring(0, 100)}...`);
      });
    }
    console.log('');
    
    const judgment = dbChunks.length > 0
      ? await judgeContextRelevance(question, dbChunks)
      : 'NO';
    
    console.log('   ' + '─'.repeat(60));
    console.log(`   🎯 JUDGE DECISION: ${judgment}`);
    console.log('   ' + '─'.repeat(60));
    console.log('');

    // ============================================
    // STEP 3A or 3B: Answer Generation
    // ============================================
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (judgment === 'YES') {
            // STEP 3A: Internal Answer Generation
            console.log('📚 STEP 3A: Generating answer from INTERNAL KNOWLEDGE BASE');
            console.log('   ✅ Using database chunks as source');
            console.log('   📝 Source footer will show: "Database (Internal Knowledge Base)"');
            console.log('');
            for await (const chunk of generateInternalAnswer(question, dbChunks)) {
              controller.enqueue(encoder.encode(chunk));
            }
            console.log('   ✅ Step 3A complete - answer streamed from database');
          } else {
            // STEP 3B: Web Search Fallback
            console.log('🌐 STEP 3B: Generating answer via WEB SEARCH');
            console.log('   ⚠️  Database chunks did not pass judge evaluation');
            console.log('   🔍 Falling back to Google Search');
            console.log('   📝 Source footer will show: "Google Search" or web sources');
            console.log('');
            
            // Add to admin queue asynchronously (non-blocking)
            // Pass the embedding we already generated for duplicate detection
            addToAdminQueue(question, queryEmbedding);
            console.log('   📬 Checking for duplicates and adding to admin queue...');
            
            for await (const chunk of generateWebSearchAnswer(question)) {
              controller.enqueue(encoder.encode(chunk));
            }
            console.log('   ✅ Step 3B complete - answer streamed from web search');
          }
          console.log('');
          console.log('='.repeat(80));
          console.log('=== END TIERED RAG CHATBOT ===');
          console.log('='.repeat(80));
          console.log('');
          
          controller.close();
        } catch (error) {
          console.error('❌ Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('❌ Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
