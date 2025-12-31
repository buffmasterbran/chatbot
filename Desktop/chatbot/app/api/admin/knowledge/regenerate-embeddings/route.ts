import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';

/**
 * POST /api/admin/knowledge/regenerate-embeddings
 * Regenerates embeddings for all knowledge base entries
 * This fixes the mismatch where old entries have question+answer embeddings
 * but we now search with question-only embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Regenerating embeddings for all knowledge base entries...');
    
    // Fetch all entries
    const { data: entries, error: fetchError } = await supabaseAdmin
      .from('knowledge_base')
      .select('id, question, answer');

    if (fetchError) {
      console.error('❌ Error fetching entries:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch entries' },
        { status: 500 }
      );
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No entries found',
        regenerated: 0 
      });
    }

    console.log(`📊 Found ${entries.length} entries to regenerate`);

    let successCount = 0;
    let errorCount = 0;

    // Regenerate embeddings for each entry
    for (const entry of entries) {
      try {
        // Generate new embedding from question only
        const embedding = await generateEmbedding(entry.question);
        
        // Update the entry
        const { error: updateError } = await supabaseAdmin
          .from('knowledge_base')
          .update({ 
            embedding,
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`❌ Error updating entry ${entry.id}:`, updateError);
          errorCount++;
        } else {
          successCount++;
          console.log(`✅ Regenerated embedding for: "${entry.question}"`);
        }
      } catch (error: any) {
        console.error(`❌ Error processing entry ${entry.id}:`, error);
        errorCount++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Done! Success: ${successCount}, Errors: ${errorCount}`);

    return NextResponse.json({ 
      success: true,
      regenerated: successCount,
      errors: errorCount,
      total: entries.length
    });
  } catch (error) {
    console.error('❌ Regenerate embeddings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

