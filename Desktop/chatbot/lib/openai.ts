import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Generate embedding using OpenAI text-embedding-3-small
 * Combines question and answer for better context
 */
export async function generateEmbedding(question: string, answer?: string): Promise<number[]> {
  // Combine question and answer for embedding generation
  const text = answer ? `${question}\n\n${answer}` : question;
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// 1. MINIMAL PROMPT (The "Pro" model infers the rest)
const SYSTEM_INSTRUCTION = `You are the AI assistant for Pirani Life (sustainable insulated tumblers, est. 2018).
Identity: Friendly, Eco-conscious, Fact-based.
Context: If you don't know a specific fact about the company, use Google Search to find it.`;

export async function* streamAnswer(question: string) {
  console.log('\n=== STREAM ANSWER ===');
  console.log('📥 Question:', question);
  console.log('📝 API Key present:', !!process.env.GEMINI_API_KEY);

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found');
    yield "Error: No API Key found.";
    return;
  }

  try {
    console.log('⚙️  Settings:', {
      model: 'gemini-3-pro-preview',
      thinkingLevel: 'low',
      temperature: 0.2,
      googleSearch: 'enabled',
    });
    console.log('🔄 Starting stream...');

    // 2. MODEL CONFIGURATION (Gemini 3 Pro)
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview', // The smart reasoning model
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }] as any,
    });

    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: { 
        temperature: 0.2,
        // 3. THINKING MODE (Unique to Gemini 3)
        // 'low' is faster and perfect for customer service. 
        // 'high' is for complex math/coding.
        // @ts-ignore (Types might not be updated yet)
        thinking_config: { thinking_level: "low" } 
      } as any
    });

    // 4. STREAMING & SOURCE EXTRACTION
    let sources: { title: string; url: string }[] = [];
    let chunkCount = 0;
    let fullAnswer = '';

    for await (const chunk of result.stream) {
      // Yield text
      const text = chunk.text();
      if (text) {
        chunkCount++;
        fullAnswer += text;
        if (chunkCount <= 3) {
          console.log(`  Chunk ${chunkCount}:`, text.substring(0, 100));
        }
        yield text;
      }

      // Capture Citations (Grounding)
      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const chunks = chunk.candidates[0].groundingMetadata.groundingChunks;
        chunks.forEach((c: any) => {
          if (c.web?.uri && c.web?.title) {
            sources.push({ title: c.web.title, url: c.web.uri });
            console.log(`  📎 Found source: ${c.web.title} - ${c.web.uri}`);
          }
        });
      }
    }

    console.log(`✅ Stream complete. Total chunks: ${chunkCount}`);
    console.log('\n📝 FULL AI ANSWER:');
    console.log('─'.repeat(80));
    console.log(fullAnswer);
    console.log('─'.repeat(80));
    console.log(`📊 Answer length: ${fullAnswer.length} characters`);

    // Append Sources at the end
    if (sources.length > 0) {
      const uniqueSources = Array.from(new Map(sources.map(s => [s.url, s])).values());
      console.log(`\n📚 Sources found: ${uniqueSources.length}`);
      uniqueSources.forEach((s, i) => {
        console.log(`  ${i + 1}. [${s.title}](${s.url})`);
      });
      
      yield "\n\n**Sources:**\n";
      for (let i = 0; i < uniqueSources.length; i++) {
        const s = uniqueSources[i];
        yield `${i + 1}. [${s.title}](${s.url})\n`;
      }
    } else {
      console.log('ℹ️  No sources found (likely answered from system instruction)');
    }

    console.log('=== END STREAM ANSWER ===\n');

  } catch (error: any) {
    console.error('❌ API Error:', error.message || error);
    console.error('❌ Error status:', error.status || 'unknown');
    console.error('❌ Error statusText:', error.statusText || 'unknown');
    console.error('❌ Full error:', JSON.stringify(error, null, 2));
    yield "I encountered an error. Please try again.";
  }
}