'use client';

import { useState } from 'react';

export default function TestOpenAI() {
  const [input, setInput] = useState('你好');
  const [result, setResult] = useState<{ translation?: string; pinyin?: string; error?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/translate-openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: input }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Unknown error');
      }
      
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">OpenAI Translation Test</h1>
      
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex flex-col mb-4">
          <label htmlFor="input" className="mb-2">Chinese Text:</label>
          <input
            id="input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
        
        <button 
          type="submit" 
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={isLoading}
        >
          {isLoading ? 'Translating...' : 'Translate'}
        </button>
      </form>
      
      {result && (
        <div className="mt-4 p-4 border rounded">
          {result.error ? (
            <div className="text-red-500">Error: {result.error}</div>
          ) : (
            <>
              <div className="mb-2">
                <strong>Translation:</strong> {result.translation}
              </div>
              <div>
                <strong>Pinyin:</strong> {result.pinyin}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
} 