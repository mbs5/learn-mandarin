"use client";

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VoiceControlsProps {
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  isPinyinVoice: boolean;
}

export default function VoiceControls({ 
  selectedVoice,
  setSelectedVoice,
  speechRate,
  setSpeechRate,
  isPinyinVoice
}: VoiceControlsProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    // Load voices right away
    loadVoices();

    // Chrome loads voices asynchronously, so we need this event
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Filter for Chinese voices
  const chineseVoices = voices.filter(voice => voice.lang.includes('zh'));

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-2">
        <span className="text-zinc-300">Voice</span>
        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
          <SelectTrigger className={`w-[200px] bg-zinc-800 border-zinc-700 text-zinc-100 ${isPinyinVoice ? 'border-[#7D3EF1]' : ''}`}>
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
        <span className="text-zinc-300">Speed</span>
        <input
          type="range"
          min="0.5"
          max="1"
          step="0.1"
          value={speechRate}
          onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
          className="w-[200px] accent-[#7D3EF1]"
        />
        <span className="text-zinc-400 text-xs">{speechRate}x</span>
      </div>
    </div>
  );
} 