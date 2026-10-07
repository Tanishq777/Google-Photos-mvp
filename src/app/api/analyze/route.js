import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key is missing. Please add it to .env.local' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // or gpt-4o-mini
      messages: [
        {
          role: "system",
          content: "You are an expert AI photo tagger. Your job is to analyze images and return a JSON object containing a descriptive 'caption' and a 'tags' array of 10-15 highly accurate keywords (objects, colors, mood, setting, context). Return ONLY valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: image, 
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    // Create a semantic embedding of the caption and tags for intelligent search
    const textToEmbed = `${parsed.caption} ${parsed.tags.join(' ')}`;
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed,
    });
    
    parsed.embedding = embeddingResponse.data[0].embedding;

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to analyze image' }, { status: 500 });
  }
}
