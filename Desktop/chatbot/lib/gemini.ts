import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Step 2: The Judge - Verify if dbChunks answer the question
 * Returns 'YES' or 'NO'
 */
export async function judgeContextRelevance(
  question: string,
  dbChunks: string[]
): Promise<'YES' | 'NO'> {
  console.log('   🔍 Judge: Starting evaluation...');
  console.log(`   📊 Input: ${dbChunks.length} chunk(s), question: "${question}"`);
  
  if (dbChunks.length === 0) {
    console.log('   ⚠️  No chunks provided, returning NO');
    return 'NO';
  }
  
  const context = dbChunks.join('\n\n');
  const contextLength = context.length;
  console.log(`   📏 Total context length: ${contextLength} characters`);
  
  const judgePrompt = `You are evaluating if the provided context answers the question.

Context:
${context}

Question: ${question}

Does the context provide a CLEAR and COMPLETE answer to this specific question?
Reply ONLY with 'YES' or 'NO'.`;
  
  console.log(`   📝 Judge prompt length: ${judgePrompt.length} characters`);
  console.log('   🤖 Calling Gemini 2.0 Flash for judgment...');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: judgePrompt }] }],
      generationConfig: {
        temperature: 0.1, // Very low temperature for deterministic YES/NO
      },
    });

    const rawResponse = result.response.text();
    const response = rawResponse.trim().toUpperCase();
    const isRelevant = response.includes('YES') && !response.includes('NO');
    
    console.log(`   📥 Raw judge response: "${rawResponse}"`);
    console.log(`   🔄 Normalized response: "${response}"`);
    console.log(`   ✅ Contains YES: ${response.includes('YES')}`);
    console.log(`   ❌ Contains NO: ${response.includes('NO')}`);
    console.log(`   🎯 Final decision: ${isRelevant ? 'YES ✅' : 'NO ❌'}`);
    
    return isRelevant ? 'YES' : 'NO';
  } catch (error) {
    console.error('❌ Judge error:', error);
    return 'NO'; // Default to NO if judge fails
  }
}

/**
 * Step 3A: Internal Answer Generation
 * Answer using ONLY the provided context
 */
export async function* generateInternalAnswer(
  question: string,
  dbChunks: string[]
): AsyncGenerator<string, void, unknown> {
  console.log('   📚 Step 3A: Generating internal answer from context...');
  console.log(`   📊 Using ${dbChunks.length} chunk(s) from database`);
  
  const context = dbChunks.join('\n\n');
  const systemPrompt = 'You are the Pirani AI. Answer using ONLY the context provided. Do not use outside knowledge.';
  
  const userPrompt = `Context:
${context}

Question: ${question}

Answer the question using ONLY the information from the context above.`;
  
  console.log(`   📏 Context length: ${context.length} characters`);
  console.log(`   🤖 Calling Gemini 2.0 Flash with context...`);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
      },
    });

    let chunkCount = 0;
    let totalLength = 0;
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        chunkCount++;
        totalLength += text.length;
        if (chunkCount <= 3) {
          console.log(`   📤 Chunk ${chunkCount}: ${text.substring(0, 60)}...`);
        }
        yield text;
      }
    }
    
    console.log(`   ✅ Generated ${chunkCount} chunks, total length: ${totalLength} characters`);

    // Append footer
    console.log('   📝 Appending database source footer...');
    yield '\n\n---\n**Source:** Database (Internal Knowledge Base)';
  } catch (error) {
    console.error('❌ Internal answer generation error:', error);
    yield "I encountered an error generating the answer.";
  }
}

/**
 * Step 3B: Web Search Fallback
 * Use Google Search to find the answer
 */
export async function* generateWebSearchAnswer(
  question: string
): AsyncGenerator<string, void, unknown> {
  console.log('   🌐 Step 3B: Generating answer via web search...');
  console.log(`   🔍 Question: "${question}"`);
  console.log(`   🤖 Calling Gemini 2.0 Flash with Google Search enabled...`);
  
  const systemPrompt = 'You are the Pirani AI. Search for the answer. Context: Pirani Life (sustainable tumblers). Verify facts before answering.';

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash', // Using 2.0 Flash for web search (gemini-1.5-pro not available)
      systemInstruction: systemPrompt,
      tools: [{ googleSearch: {} }] as any,
    });

    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: {
        temperature: 0.2,
      },
    });

    // Collect sources for citations
    let sources: { title: string; url: string }[] = [];
    let fullAnswer = '';
    let chunkCount = 0;

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        chunkCount++;
        fullAnswer += text;
        if (chunkCount <= 3) {
          console.log(`   📤 Chunk ${chunkCount}: ${text.substring(0, 60)}...`);
        }
        yield text;
      }

      // Capture Citations (Grounding Metadata)
      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        chunk.candidates[0].groundingMetadata.groundingChunks.forEach((c: any) => {
          if (c.web?.uri && c.web?.title) {
            const newSource = { title: c.web.title, url: c.web.uri };
            if (!sources.find(s => s.url === newSource.url)) {
              sources.push(newSource);
              console.log(`   📎 Found source: ${newSource.title} - ${newSource.url}`);
            }
          }
        });
      }
    }
    
    console.log(`   ✅ Generated ${chunkCount} chunks, total length: ${fullAnswer.length} characters`);
    console.log(`   📚 Found ${sources.length} unique source(s)`);

    // Append Sources if available, otherwise just Source footer
    if (sources.length > 0) {
      const uniqueSources = Array.from(new Map(sources.map(s => [s.url, s])).values());
      console.log(`   📝 Appending ${uniqueSources.length} source(s) to footer...`);
      yield "\n\n---\n**Sources:**\n";
      for (let i = 0; i < uniqueSources.length; i++) {
        const s = uniqueSources[i];
        yield `${i + 1}. [${s.title}](${s.url})\n`;
      }
    } else {
      console.log('   📝 Appending generic "Google Search" footer...');
      yield '\n\n---\n**Source:** Google Search';
    }
  } catch (error) {
    console.error('❌ Web search answer generation error:', error);
    yield "I encountered an error searching for the answer.";
  }
}

