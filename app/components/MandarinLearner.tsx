import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Translate } from '@google-cloud/translate/build/src/v2';
import { Speaker } from 'lucide-react';

interface WordSet {
  mandarin: string;
  english: string;
}

export default function MandarinLearner() {
  const [phrase, setPhrase] = useState('');
  const [wordCount, setWordCount] = useState<string>('2');
  const [wordSets, setWordSets] = useState<WordSet[]>([]);

  const translate = new Translate({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  });

  const breakAndTranslate = async () => {
    const words = phrase.trim().split(' ');
    const count = parseInt(wordCount);
    const sets: WordSet[] = [];
    
    for (let i = 0; i < words.length; i += count) {
      const subset = words.slice(i, i + count).join(' ');
      try {
        const [translation] = await translate.translate(subset, {
          from: 'zh',
          to: 'en',
        });
        sets.push({
          mandarin: subset,
          english: translation,
        });
      } catch (error) {
        console.error('Translation error:', error);
      }
    }
    
    setWordSets(sets);
  };

  const playAudio = async (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Learn Mandarin</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mandarin Phrase Breakdown</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Enter Mandarin phrase..."
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="border p-2 rounded-md"
            />
            <div className="flex items-center gap-2">
              <span>Break in</span>
              <Select value={wordCount} onValueChange={setWordCount}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Select words" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} words
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={breakAndTranslate}>Break Down</Button>
          </div>
          <div className="space-y-4">
            {wordSets.map((set, index) => (
              <div key={index} className="border p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-lg">{set.mandarin}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => playAudio(set.mandarin)}
                  >
                    <Speaker className="h-4 w-4" />
                  </Button>
                </div>
                <span className="text-sm text-gray-500">{set.english}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 