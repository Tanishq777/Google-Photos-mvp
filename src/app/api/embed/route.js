import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'No query provided' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key is missing. Please add it to .env.local' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    return NextResponse.json({ embedding: response.data[0].embedding });
  } catch (error) {
    console.error("OpenAI Embedding Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to embed query' }, { status: 500 });
  }
}
