import { NextResponse } from 'next/server';

// Simple mock translation for testing
const mockTranslations: Record<string, {english: string, pinyin: string}> = {
  '你好': {english: 'Hello', pinyin: 'nǐ hǎo'},
  '我': {english: 'I', pinyin: 'wǒ'},
  '很': {english: 'very', pinyin: 'hěn'},
  '高兴': {english: 'happy', pinyin: 'gāo xìng'},
  '认识': {english: 'to meet', pinyin: 'rèn shi'},
  '你': {english: 'you', pinyin: 'nǐ'},
  '喜欢': {english: 'like', pinyin: 'xǐ huān'},
  '学习': {english: 'study', pinyin: 'xué xí'},
  '中文': {english: 'Chinese language', pinyin: 'zhōng wén'},
  '今天': {english: 'today', pinyin: 'jīn tiān'},
  '天气': {english: 'weather', pinyin: 'tiān qì'},
  '好': {english: 'good', pinyin: 'hǎo'},
  '想': {english: 'want', pinyin: 'xiǎng'},
  '吃': {english: 'eat', pinyin: 'chī'},
  '中国': {english: 'Chinese', pinyin: 'zhōng guó'},
  '菜': {english: 'food', pinyin: 'cài'},
  '谢谢': {english: 'thank you', pinyin: 'xiè xiè'},
  '的': {english: 'of', pinyin: 'de'},
  '帮助': {english: 'help', pinyin: 'bāng zhù'},
  '英文': {english: 'English language', pinyin: 'yīng wén'},
  '早上好': {english: 'Good morning', pinyin: 'zǎo shàng hǎo'},
  '晚上好': {english: 'Good evening', pinyin: 'wǎn shàng hǎo'},
  '我爱你': {english: 'I love you', pinyin: 'wǒ ài nǐ'},
  '再见': {english: 'Goodbye', pinyin: 'zài jiàn'},
  '工作': {english: 'Work', pinyin: 'gōng zuò'},
  '玩': {english: 'Play', pinyin: 'wán'},
  '读书': {english: 'Read books', pinyin: 'dú shū'},
  '写字': {english: 'Write', pinyin: 'xiě zì'},
  '说话': {english: 'Speak', pinyin: 'shuō huà'},
  '听': {english: 'Listen', pinyin: 'tīng'},
  '看': {english: 'Look/See', pinyin: 'kàn'},
  '天空': {english: 'sky', pinyin: 'tiān kōng'},
  '美': {english: 'beautiful', pinyin: 'měi'},
};

export async function POST(request: Request) {
  try {
    const { text, from, to } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('Alternative translation request:', { text, from, to });
    
    // Check if we have a direct mock translation
    if (mockTranslations[text]) {
      return NextResponse.json({ 
        translation: mockTranslations[text].english,
        pinyin: mockTranslations[text].pinyin
      });
    }
    
    // Check if the text contains any Chinese characters
    const containsChinese = /[\u4e00-\u9fa5]/.test(text);
    
    if (!containsChinese) {
      // If no Chinese characters, return the text as is
      return NextResponse.json({
        translation: text,
        pinyin: '[English text]'
      });
    }
    
    // Split the text into Chinese and non-Chinese segments
    const segments = text.split(/(?=[\u4e00-\u9fa5])|(?<=[\u4e00-\u9fa5])(?=[^\u4e00-\u9fa5])/);
    
    // Process each segment
    const translationParts: string[] = [];
    const pinyinParts: string[] = [];
    
    for (const segment of segments) {
      // Skip empty segments
      if (!segment.trim()) continue;
      
      // Check if segment is Chinese
      const isChinese = /[\u4e00-\u9fa5]/.test(segment);
      
      if (isChinese) {
        // Try to translate Chinese words
        const words = segment.split('');
        const translations = words.map((word: string) => mockTranslations[word]?.english || `[${word}]`);
        const pinyins = words.map((word: string) => mockTranslations[word]?.pinyin || `[${word}]`);
        
        translationParts.push(translations.join(' '));
        pinyinParts.push(pinyins.join(' '));
      } else {
        // Keep non-Chinese text as is
        translationParts.push(segment);
        pinyinParts.push('[English]');
      }
    }
    
    const translation = translationParts.join(' ').replace(/\s+/g, ' ').trim();
    const pinyin = pinyinParts.join(' ').replace(/\s+/g, ' ').trim();
    
    return NextResponse.json({ 
      translation,
      pinyin,
      note: 'Using fallback translation'
    });
    
  } catch (error: any) {
    console.error('Alternative translation API error:', error);
    return NextResponse.json(
      { error: 'Failed to translate text', details: error.message },
      { status: 500 }
    );
  }
} 