import { NextResponse } from 'next/server';
import { Translate } from '@google-cloud/translate/build/src/v2';

export async function POST(request: Request) {
  try {
    const { text, from, to } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('Translation request:', { text, from, to });
    console.log('Environment variables:', {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      hasCredentials: !!process.env.GOOGLE_CREDENTIALS,
    });

    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
      console.log('Credentials parsed successfully');
      
      const translate = new Translate({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials,
      });

      console.log('Translate client created, attempting translation...');
      const [translation] = await translate.translate(text, {
        from: from || 'zh',
        to: to || 'en',
      });
      console.log('Translation successful:', translation);

      return NextResponse.json({ translation });
    } catch (parseError: any) {
      console.error('Error parsing credentials or translating:', parseError);
      return NextResponse.json(
        { error: 'Configuration error', details: parseError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Failed to translate text', details: error.message },
      { status: 500 }
    );
  }
} 