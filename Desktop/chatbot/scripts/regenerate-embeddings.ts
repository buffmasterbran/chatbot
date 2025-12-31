/**
 * Script to regenerate embeddings for all existing knowledge base entries
 * This fixes the mismatch where old entries have question+answer embeddings
 * but we now search with question-only embeddings
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function generateEmbedding(question: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  });
  return response.data[0].embedding;
}

async function regenerateAllEmbeddings() {
  console.log('🔄 Fetching all knowledge base entries...');
  
  const { data: entries, error: fetchError } = await supabase
    .from('knowledge_base')
    .select('id, question, answer');

  if (fetchError) {
    console.error('❌ Error fetching entries:', fetchError);
    return;
  }

  if (!entries || entries.length === 0) {
    console.log('ℹ️  No entries found');
    return;
  }

  console.log(`📊 Found ${entries.length} entries to regenerate`);
  console.log('');

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    console.log(`[${i + 1}/${entries.length}] Processing: "${entry.question}"`);
    
    try {
      // Generate new embedding from question only
      const embedding = await generateEmbedding(entry.question);
      
      // Update the entry
      const { error: updateError } = await supabase
        .from('knowledge_base')
        .update({ 
          embedding,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`   ❌ Error updating: ${updateError.message}`);
      } else {
        console.log(`   ✅ Embedding regenerated`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('✅ Done! All embeddings have been regenerated.');
}

regenerateAllEmbeddings().catch(console.error);

