import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('OpenAI translation request for:', text);

    // Check if the text contains any Chinese characters
    const containsChinese = /[\u4e00-\u9fa5]/.test(text);
    
    if (!containsChinese) {
      // If no Chinese characters, return the text as is
      return NextResponse.json({
        translation: text,
        pinyin: '[English text]'
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a Chinese language expert. You will be given text that may contain Chinese characters, English words, or a mix of both. Provide: 1) The text with spaces between each Chinese word (proper word segmentation), 2) English translation, and 3) Pinyin romanization."
        },
        {
          role: "user",
          content: text
        }
      ],
      functions: [
        {
          name: "process_chinese_text",
          description: "Process Chinese text with segmentation, translation, and pinyin",
          parameters: {
            type: "object",
            properties: {
              segmented: {
                type: "string",
                description: "The original text with spaces added between each Chinese word"
              },
              translation: {
                type: "string",
                description: "English translation of the text"
              },
              pinyin: {
                type: "string",
                description: "Pinyin romanization of the Chinese characters"
              }
            },
            required: ["segmented", "translation", "pinyin"]
          }
        }
      ],
      function_call: { name: "process_chinese_text" },
      temperature: 0.3,
    });

    const functionArgs = JSON.parse(response.choices[0].message.function_call?.arguments || '{}');
    
    return NextResponse.json({
      segmented: functionArgs.segmented,
      translation: functionArgs.translation,
      pinyin: functionArgs.pinyin
    });
  } catch (error: any) {
    console.error('OpenAI translation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 