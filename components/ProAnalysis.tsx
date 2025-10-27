import React, { useState } from 'react';
import VideoAnalyzer from './VideoAnalyzer';
import Spinner from './Spinner';
import { performThinkingQuery } from '../services/geminiService';

type Mode = 'video' | 'thinking';

const ThinkingMode: React.FC = () => {
    const [prompt, setPrompt] = useState('Explain the theory of general relativity as if I were a curious high school student. Use analogies and avoid complex math.');
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleQuery = async () => {
        if (!prompt.trim() || isLoading) return;
        setIsLoading(true);
        setError(null);
        setResult('');
        try {
            const response = await performThinkingQuery(prompt);
            setResult(response);
        } catch (e: any) {
            setError(`Query failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Ask a complex question that requires deep reasoning. Gemini will use its maximum "thinking budget" to provide a detailed response.</p>
            <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={5}
                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button onClick={handleQuery} disabled={isLoading} className="mt-4 w-full bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                {isLoading ? <><Spinner /><span className="ml-2">Thinking...</span></> : 'Submit Query'}
            </button>
            {error && <p className="text-red-500 dark:text-red-400 mt-4 text-center">{error}</p>}
            {isLoading && !result && <div className="text-center mt-4"><Spinner /></div>}
            {result && (
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{result}</p>
                </div>
            )}
        </div>
    );
};

const ProAnalysis: React.FC = () => {
    const [mode, setMode] = useState<Mode>('video');

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
            <div className="flex justify-center space-x-4 mb-6">
                {(['video', 'thinking'] as Mode[]).map(m => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`px-6 py-2 rounded-md font-semibold transition-colors ${mode === m ? 'bg-cyan-500 dark:bg-cyan-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                        {m === 'video' ? 'Video Analyzer' : 'Thinking Mode'}
                    </button>
                ))}
            </div>
            {mode === 'video' ? <VideoAnalyzer /> : <ThinkingMode />}
        </div>
    );
};

export default ProAnalysis;