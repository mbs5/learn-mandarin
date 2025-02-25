"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Volume2 } from 'lucide-react';

interface WordSet {
  mandarin: string;
  english: string;
  pinyin: string;
}

export default function MandarinLearner() {
  const [phrase, setPhrase] = useState('');
  const [wordCount, setWordCount] = useState<string>('2');
  const [wordSets, setWordSets] = useState<WordSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(0.7);
  const [isPinyinVoice, setIsPinyinVoice] = useState(false);
  // Force initial state to match SSR
  const [mounted, setMounted] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceRepetitions, setPracticeRepetitions] = useState<number>(5);
  const [practiceInterval, setPracticeInterval] = useState<number>(2);
  const [currentSpeakingIndex, setCurrentSpeakingIndex] = useState<number | null>(null);
  const [currentRepetition, setCurrentRepetition] = useState<number>(0);
  const practiceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Set mounted to true once component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load available voices - only run on client side
  useEffect(() => {
    if (!mounted) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Try to set Tingting voice as default when voices load
      const tingtingVoice = availableVoices.find(
        voice => voice.name.includes('Tingting') || voice.name.includes('Ting-Ting')
      );
      
      // Fallback to any Chinese voice
      const pinyinVoice = availableVoices.find(
        voice => voice.name.includes('Pinyin') || 
                (voice.name.includes('Chinese') && voice.name.includes('Simplified'))
      );
      
      if (tingtingVoice && !selectedVoice) {
        console.log('Setting default Tingting voice:', tingtingVoice.name);
        setSelectedVoice(tingtingVoice.name);
        setIsPinyinVoice(true);
      } else if (pinyinVoice && !selectedVoice) {
        console.log('Setting default Pinyin voice:', pinyinVoice.name);
        setSelectedVoice(pinyinVoice.name);
        setIsPinyinVoice(true);
      }
    };

    // Load voices right away
    loadVoices();

    // Chrome loads voices asynchronously, so we need this event
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice, mounted]);

  // Update isPinyinVoice when selectedVoice changes
  useEffect(() => {
    if (!mounted || !selectedVoice) {
      setIsPinyinVoice(false);
      return;
    }
    
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) {
      const isPinyin = voice.name.includes('Tingting') || 
                      voice.name.includes('Ting-Ting') ||
                      voice.name.includes('Pinyin') || 
                      (voice.name.includes('Chinese') && voice.name.includes('Simplified'));
      setIsPinyinVoice(isPinyin);
    }
  }, [selectedVoice, voices, mounted]);

  const samplePhrases = [
    '你好 我 很 高兴 认识 你',
    '我 喜欢 学习 中文',
    '今天 天气 很 好',
    '我 想 吃 中国 菜',
    '谢谢 你 的 帮助'
  ];

  const selectSamplePhrase = (phrase: string) => {
    setPhrase(phrase);
  };

  const breakAndTranslate = async () => {
    if (!phrase.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Preprocess the phrase to add spaces between Chinese and non-Chinese text
      const processedPhrase = addSpacesToMixedText(phrase);
      
      console.log('---------- DEBUG OUTPUT ----------');
      console.log('Original phrase:', phrase);
      console.log('Processed phrase:', processedPhrase);
      
      // First, get a complete translation of the entire phrase
      const completeTranslation = await getTranslation(processedPhrase);
      console.log('Complete translation:', completeTranslation);
      
      // Use the segmented text from OpenAI's response for proper word splitting
      const segmentedPhrase = completeTranslation.segmented || processedPhrase;
      console.log('Segmented phrase with proper word boundaries:', segmentedPhrase);
      
      // Split by spaces to get individual words properly
      const words = segmentedPhrase.trim().split(/\s+/);
      console.log('Words identified after segmentation:', words);
      
      const count = parseInt(wordCount);
      console.log('Word count setting:', count);
      
      // Then, break down the phrase in chunks based on word count and translate each chunk
      const sets: WordSet[] = [];
      
      // Process the words in groups of the selected count
      for (let i = 0; i < words.length; i += count) {
        const subset = words.slice(i, Math.min(i + count, words.length));
        const groupText = subset.join(' ');
        
        if (!groupText.trim()) continue;
        
        console.log(`Group ${Math.floor(i / count) + 1}: "${groupText}" (${subset.length} words)`);
        
        try {
          const translationResult = await getTranslation(groupText);
          console.log(`Group ${Math.floor(i / count) + 1} translation:`, translationResult);
          sets.push(translationResult);
        } catch (error) {
          console.error(`Error translating group "${groupText}":`, error);
          sets.push({
            mandarin: groupText,
            english: '[Translation failed]',
            pinyin: '[Translation failed]'
          });
        }
      }
      
      console.log('Final sets for UI:', [completeTranslation, ...sets]);
      console.log('--------------------------------');
      
      // Set the complete translation first, then the broken-down sets
      if (sets.length > 0) {
        setWordSets([completeTranslation, ...sets]);
      } else {
        setWordSets([completeTranslation]);
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Translation error: ${error.message}`);
      
      // Fallback to the alternative translation API if OpenAI fails
      try {
        await breakAndTranslateWithFallback();
      } catch (fallbackError) {
        console.error('Fallback translation also failed:', fallbackError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get translation for a piece of text
  const getTranslation = async (text: string): Promise<WordSet & { segmented?: string }> => {
    // Check if the text contains only English words
    const isOnlyEnglish = !/[\u4e00-\u9fa5]/.test(text);
    
    if (isOnlyEnglish) {
      return {
        mandarin: text,
        english: text,
        pinyin: '[English text]',
        segmented: text // No segmentation needed for English-only text
      };
    }
    
    // Process mixed or Chinese text with OpenAI
    const response = await fetch('/api/translate-openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Translation API error:', data);
      throw new Error(`Translation failed: ${data.error} - ${data.details || ''}`);
    }
    
    console.log('Translation response:', data);
    
    return {
      mandarin: text,
      english: data.translation,
      pinyin: data.pinyin || '[No pinyin available]',
      segmented: data.segmented || text // Use the segmented text from OpenAI
    };
  };

  // Fallback translation method using our dictionary
  const breakAndTranslateWithFallback = async () => {
    if (!phrase.trim()) return;
    
    try {
      const processedPhrase = addSpacesToMixedText(phrase);
      
      console.log('---------- FALLBACK DEBUG OUTPUT ----------');
      console.log('Original phrase:', phrase);
      console.log('Processed phrase:', processedPhrase);
      
      // First, get a complete translation of the entire phrase
      const completeTranslation = await getFallbackTranslation(processedPhrase);
      console.log('Complete fallback translation:', completeTranslation);
      
      // Use basic space-based splitting for fallback
      // Note: This won't segment Chinese words properly, but it's a fallback
      const words = processedPhrase.trim().split(/\s+/);
      console.log('Words identified in fallback:', words);
      
      const count = parseInt(wordCount);
      console.log('Word count setting:', count);
      
      // Then break down and translate in chunks
      const sets: WordSet[] = [];
      
      // Process the words in groups of the selected count
      for (let i = 0; i < words.length; i += count) {
        const subset = words.slice(i, Math.min(i + count, words.length));
        const groupText = subset.join(' ');
        
        if (!groupText.trim()) continue;
        
        console.log(`Fallback Group ${Math.floor(i / count) + 1}: "${groupText}" (${subset.length} words)`);
        
        try {
          const translationResult = await getFallbackTranslation(groupText);
          console.log(`Fallback Group ${Math.floor(i / count) + 1} translation:`, translationResult);
          sets.push(translationResult);
        } catch (error) {
          console.error(`Error in fallback translation for group "${groupText}":`, error);
          sets.push({
            mandarin: groupText,
            english: '[Translation failed]',
            pinyin: '[Translation failed]'
          });
        }
      }
      
      console.log('Final fallback sets for UI:', [completeTranslation, ...sets]);
      console.log('---------------------------------------------');
      
      // Set the complete translation first, then the broken-down sets
      if (sets.length > 0) {
        setWordSets([completeTranslation, ...sets]);
      } else {
        setWordSets([completeTranslation]);
      }
    } catch (error) {
      console.error('Fallback translation error:', error);
      throw error;
    }
  };

  // Helper function for fallback translation
  const getFallbackTranslation = async (text: string): Promise<WordSet> => {
    // Check if the group contains only English words
    const isOnlyEnglish = !/[\u4e00-\u9fa5]/.test(text);
    
    if (isOnlyEnglish) {
      return {
        mandarin: text,
        english: text,
        pinyin: '[English text]'
      };
    }
    
    const response = await fetch('/api/translate-alt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        from: 'zh',
        to: 'en',
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Fallback translation failed: ${data.error}`);
    }
    
    return {
      mandarin: text,
      english: data.translation,
      pinyin: data.pinyin || '[No pinyin available]'
    };
  };

  // Filter for Chinese voices
  const chineseVoices = voices.filter(voice => voice.lang.includes('zh'));

  // Helper function to add spaces between Chinese characters and non-Chinese text
  const addSpacesToMixedText = (text: string): string => {
    // First, normalize existing spaces and trim
    let normalized = text.replace(/\s+/g, ' ').trim();
    
    // Debug the input text
    console.log('Tokenizing text:', normalized);
    
    // If the text is already well-formed with spaces, just return it
    if (/^[a-zA-Z0-9]+(\s+[a-zA-Z0-9\u4e00-\u9fa5]+)*$/.test(normalized)) {
      console.log('Text is already well-formed with spaces');
      return normalized;
    }

    // Enhanced approach to handle Chinese character tokenization
    // 1. First identify and protect English words
    const englishWords: { word: string; start: number; end: number }[] = [];
    let match;
    const englishWordPattern = /[a-zA-Z0-9]+/g;
    
    while ((match = englishWordPattern.exec(normalized)) !== null) {
      englishWords.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    console.log('English words found:', englishWords);
    
    // 2. Process the string character by character
    let result = '';
    
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      const isChineseChar = /[\u4e00-\u9fa5]/.test(char);
      const isInEnglishWord = englishWords.some(w => i >= w.start && i < w.end);
      const isSpace = /\s/.test(char);
      
      // If it's a space, always add it
      if (isSpace) {
        result += ' ';
        continue;
      }
      
      // If we're at the start of the string, just add the character
      if (i === 0) {
        result += char;
        continue;
      }
      
      // Get the previous character and its type
      const prevChar = normalized[i - 1];
      const isPrevChineseChar = /[\u4e00-\u9fa5]/.test(prevChar);
      const isPrevSpace = /\s/.test(prevChar);
      
      // Add a space in the following cases:
      // 1. Current is Chinese, previous is not Chinese and not a space
      // 2. Current is not Chinese, previous is Chinese
      // 3. We're at the boundary of an English word and a Chinese character
      if (
        (isChineseChar && !isPrevChineseChar && !isPrevSpace && !isInEnglishWord) ||
        (!isChineseChar && !isSpace && isPrevChineseChar && !isInEnglishWord) ||
        (i > 0 && englishWords.some(w => i === w.end) && isChineseChar)
      ) {
        result += ' ' + char;
      } else {
        result += char;
      }
    }
    
    // Clean up any double spaces and trim
    result = result.replace(/\s+/g, ' ').trim();
    
    console.log('Tokenized result:', result);
    return result;
  };

  // Play audio with more robust handling of browser quirks
  const playAudio = (text: string, index?: number): Promise<void> => {
    if (!mounted) return Promise.resolve();
    
    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();
    
    // For visual feedback in practice mode
    if (index !== undefined) {
      setCurrentSpeakingIndex(index);
    }
    
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = speechRate;
      
      // Add event listener to resolve promise when speech ends
      utterance.onend = () => {
        console.log('Speech finished:', text);
        resolve();
      };
      
      // Handle errors in speech synthesis
      utterance.onerror = (event) => {
        console.error('Speech error:', event);
        resolve(); // Resolve anyway to continue the sequence
      };
      
      if (selectedVoice) {
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) {
          utterance.voice = voice;
          console.log(`Using selected voice: ${voice.name} (${voice.lang})`);
        }
      } else {
        // Find appropriate voice with fallbacks
        const tingtingVoice = voices.find(
          voice => voice.name.includes('Tingting') || voice.name.includes('Ting-Ting')
        );
        
        const pinyinVoice = voices.find(
          voice => voice.name.includes('Pinyin') || 
                  (voice.name.includes('Chinese') && voice.name.includes('Simplified'))
        );
        
        const femaleChineseVoice = voices.find(
          voice => voice.lang.includes('zh') && 
                  (voice.name.includes('Female') || voice.name.includes('Girl'))
        );
        
        const chineseVoice = voices.find(voice => voice.lang.includes('zh'));
        
        if (tingtingVoice) {
          utterance.voice = tingtingVoice;
        } else if (pinyinVoice) {
          utterance.voice = pinyinVoice;
        } else if (femaleChineseVoice) {
          utterance.voice = femaleChineseVoice;
        } else if (chineseVoice) {
          utterance.voice = chineseVoice;
        }
      }
      
      // Force browser to play the speech
      window.speechSynthesis.speak(utterance);
    });
  };

  // Fix the wait promise to use our ref instead of window.practiceTimer
  const startPractice = async () => {
    if (!mounted || wordSets.length <= 1 || isPracticing) return;
    
    try {
      // First, we need to trigger speech once based on user interaction
      // This helps bypass browser restrictions on auto-playing speech
      window.speechSynthesis.cancel();
      
      // Set practice state
      setIsPracticing(true);
      setCurrentRepetition(1);
      
      // Get only the breakdown sets (skip the complete translation)
      const breakdownSets = wordSets.slice(1);
      console.log(`Starting practice with ${practiceRepetitions} repetitions at ${practiceInterval}s intervals`);
      
      // Use a more reliable approach with manual iteration
      let currentRep = 1;
      
      while (currentRep <= practiceRepetitions && isPracticing) {
        setCurrentRepetition(currentRep);
        console.log(`Practice repetition ${currentRep} of ${practiceRepetitions}`);
        
        for (let i = 0; i < breakdownSets.length; i++) {
          // Check if practice was stopped
          if (!isPracticing) {
            console.log('Practice stopped by user');
            setCurrentSpeakingIndex(null);
            return;
          }
          
          const set = breakdownSets[i];
          console.log(`Speaking part ${i + 1}: ${set.mandarin}`);
          
          // Play this part and wait for it to finish
          await playAudio(set.mandarin, i);
          
          // Wait for the specified interval if this isn't the last part
          if (isPracticing && i < breakdownSets.length - 1) {
            await new Promise<void>(resolve => {
              const timer = setTimeout(() => {
                resolve();
              }, practiceInterval * 1000);
              
              // Store the timer so we can clear it if practice is stopped
              practiceTimerRef.current = timer;
            });
          }
        }
        
        // Add a longer pause between repetitions
        if (isPracticing && currentRep < practiceRepetitions) {
          await new Promise<void>(resolve => {
            const timer = setTimeout(() => {
              resolve();
            }, practiceInterval * 2 * 1000);
            
            // Store the timer so we can clear it if practice is stopped
            practiceTimerRef.current = timer;
          });
        }
        
        // Move to next repetition
        currentRep++;
      }
      
      console.log('Practice completed successfully');
      
    } catch (error) {
      console.error('Error during practice:', error);
    } finally {
      // Reset states
      setIsPracticing(false);
      setCurrentSpeakingIndex(null);
      setCurrentRepetition(0);
    }
  };

  const stopPractice = () => {
    // Clear any ongoing timers
    if (practiceTimerRef.current) {
      clearTimeout(practiceTimerRef.current);
      practiceTimerRef.current = null;
    }
    
    // Cancel speech and reset states
    window.speechSynthesis.cancel();
    setIsPracticing(false);
    setCurrentSpeakingIndex(null);
    setCurrentRepetition(0);
    
    console.log('Practice stopped by user');
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 bg-zinc-900 text-zinc-100 rounded-lg shadow-xl">
      <div className="grid gap-4 sm:gap-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <input
            type="text"
            placeholder="Enter Mandarin phrase..."
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="border border-zinc-700 p-3 rounded-md bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 text-sm sm:text-base"
          />
          <div className="text-xs text-zinc-400 mb-1 sm:mb-2">
            Sample phrases:
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1">
              {samplePhrases.map((sample, index) => (
                <button
                  key={index}
                  onClick={() => selectSamplePhrase(sample)}
                  className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 text-xs"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-300 text-sm">Break in</span>
            <Select value={wordCount} onValueChange={setWordCount}>
              <SelectTrigger className="w-[90px] sm:w-[100px] h-8 sm:h-10 bg-zinc-800 border-zinc-700 text-zinc-100 text-sm">
                <SelectValue placeholder="Select words" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
                {[1, 2, 3, 4, 5].map((num) => (
                  <SelectItem key={num} value={num.toString()} className="hover:bg-zinc-700">
                    {num} word{num !== 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Only render voice controls after component is mounted */}
          {mounted && (
            <div className="flex flex-col gap-2 mt-1 sm:mt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-zinc-300 text-sm">Voice</span>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className={`w-[180px] sm:w-[200px] h-8 sm:h-10 bg-zinc-800 border-zinc-700 text-zinc-100 text-sm ${isPinyinVoice ? 'border-[#7D3EF1]' : ''}`}>
                    <SelectValue placeholder="Auto-select voice" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100 max-h-60">
                    {chineseVoices.length > 0 ? (
                      chineseVoices.map((voice) => {
                        const isTingting = voice.name.includes('Tingting') || voice.name.includes('Ting-Ting');
                        const isPinyin = isTingting || 
                                        voice.name.includes('Pinyin') || 
                                        (voice.name.includes('Chinese') && voice.name.includes('Simplified'));
                        
                        // Simplify voice name for display
                        let displayName = voice.name;
                        
                        // Extract first name or meaningful part
                        if (voice.name.includes('Tingting') || voice.name.includes('Ting-Ting')) {
                          displayName = 'Tingting';
                        } else if (voice.name.includes('Google')) {
                          displayName = voice.name.replace('Google', '').trim();
                        } else if (voice.name.includes('Chinese')) {
                          displayName = 'Chinese' + (voice.name.includes('Female') ? ' (F)' : voice.name.includes('Male') ? ' (M)' : '');
                        }
                        
                        return (
                          <SelectItem 
                            key={voice.name} 
                            value={voice.name} 
                            className={`hover:bg-zinc-700 ${isTingting ? 'text-[#7D3EF1]' : isPinyin ? 'text-emerald-400' : ''}`}
                          >
                            {displayName}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled className="text-zinc-500">
                        No Chinese voices
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-zinc-300 text-sm">Speed</span>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.1"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-[150px] sm:w-[200px] accent-[#7D3EF1]"
                />
                <span className="text-zinc-400 text-xs">{speechRate}x</span>
              </div>
            </div>
          )}
          <Button 
            onClick={breakAndTranslate} 
            disabled={isLoading}
            className="bg-[#7D3EF1] hover:bg-[#6930D0] text-white h-10 mt-1"
          >
            {isLoading ? 'Translating...' : 'Break Down'}
          </Button>
        </div>
        <div className="space-y-3 sm:space-y-4">
          {wordSets.length > 0 && (
            <div className="border border-zinc-700 p-3 sm:p-4 rounded-lg bg-zinc-800 mb-4 sm:mb-6">
              <h3 className="text-xs font-medium uppercase text-zinc-400 mb-2 sm:mb-3">Complete Translation</h3>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg text-zinc-100">{wordSets[0].mandarin}</span>
                    {mounted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-zinc-300 hover:bg-zinc-700 hover:text-[#7D3EF1]"
                        onClick={() => playAudio(wordSets[0].mandarin)}
                      >
                        <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-amber-400 font-medium mt-1">{wordSets[0].pinyin}</div>
                </div>
                <div className="flex items-center border-t md:border-t-0 md:border-l border-zinc-700 pt-2 md:pt-0 md:pl-4 mt-2 md:mt-0">
                  <span className="text-sm sm:text-base text-zinc-100">{wordSets[0].english}</span>
                </div>
              </div>
            </div>
          )}
          
          {wordSets.length > 1 && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-6 sm:mt-8">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-medium uppercase text-zinc-400">Breakdown by {wordCount} word{parseInt(wordCount) !== 1 ? 's' : ''}</h3>
                  <div className="flex-grow h-px bg-zinc-700"></div>
                </div>
                {mounted && wordSets.length > 1 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full sm:w-auto">
                      <div className="flex flex-col">
                        <label className="text-xs text-zinc-400 mb-1">Repetitions</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={practiceRepetitions}
                          onChange={(e) => setPracticeRepetitions(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2 py-1 text-xs sm:text-sm border border-zinc-700 rounded bg-zinc-800 text-zinc-100"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs text-zinc-400 mb-1">Interval (s)</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="0.5"
                          value={practiceInterval}
                          onChange={(e) => setPracticeInterval(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                          className="w-full px-2 py-1 text-xs sm:text-sm border border-zinc-700 rounded bg-zinc-800 text-zinc-100"
                        />
                      </div>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={isPracticing ? stopPractice : startPractice}
                      className={`${isPracticing 
                        ? "bg-red-600 hover:bg-red-700 text-white" 
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"} w-full sm:w-auto mt-1 sm:mt-0 h-8`}
                    >
                      {isPracticing ? 'Stop Practice' : 'Practice'}
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 mt-3 sm:mt-4">
                {wordSets.slice(1).map((set, index) => (
                  <div 
                    key={index} 
                    className={`border ${currentSpeakingIndex === index && isPracticing 
                      ? 'border-emerald-500 ring-1 ring-emerald-500' 
                      : 'border-zinc-700'} p-3 sm:p-4 rounded-lg bg-zinc-800`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs text-zinc-500 font-medium">Part {index + 1}</span>
                      {currentSpeakingIndex === index && isPracticing && (
                        <span className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">
                          {currentRepetition}/{practiceRepetitions}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base sm:text-lg text-zinc-100">{set.mandarin}</span>
                      {mounted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-zinc-300 hover:bg-zinc-700 hover:text-[#7D3EF1]"
                          onClick={() => playAudio(set.mandarin)}
                        >
                          <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-amber-400 font-medium mt-1">{set.pinyin}</div>
                    <div className="text-xs sm:text-sm text-zinc-400 mt-1 flex items-center">
                      <span className="inline-block">{set.english}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 