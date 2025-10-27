// Fix: Implement the ComplexQuery component, which was previously a placeholder.
import React, { useState } from 'react';
import { performComplexQuery } from '../services/geminiService';
import Spinner from './Spinner';
import { GroundingChunk } from '../types';

const ComplexQuery: React.FC = () => {
    const [query, setQuery] = useState('Who won the most recent F1 world championship and what were the key moments of the season?');
    const [result, setResult] = useState<{ text: string; sources: GroundingChunk[] } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleQuery = async () => {
        if (!query.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await performComplexQuery(query);
            setResult(response);
        } catch (e) {
            console.error(e);
            setError("Failed to perform query. The model might be busy, please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
            <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">Complex Query with Grounding</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Ask a question that may require up-to-date information. Gemini will use Google Search to ground its response.</p>
            
            <div className="flex items-center space-x-2 mb-4">
                 <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
                    placeholder="Enter your complex query..."
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={isLoading}
                />
                <button
                    onClick={handleQuery}
                    disabled={isLoading || !query.trim()}
                    className="bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                >
                    {isLoading ? <Spinner /> : 'Ask'}
                </button>
            </div>
            
            {error && <p className="text-red-500 dark:text-red-400 mt-4 text-center">{error}</p>}
            
            {isLoading && !result && (
                <div className="mt-6 p-4 text-center">
                    <Spinner />
                    <p className="text-gray-600 dark:text-gray-300 mt-2">Searching and generating response...</p>
                </div>
            )}

            {result && (
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                    <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-200 mb-2">Response</h3>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{result.text}</p>
                    
                    {result.sources && result.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="font-semibold text-cyan-600 dark:text-cyan-300 mb-2">Sources:</h4>
                            <ul className="list-disc list-inside space-y-1">
                                {result.sources.map((source, index) => (
                                    source.web && (
                                        <li key={index}>
                                            <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-500 dark:text-cyan-400 hover:underline">
                                                {source.web.title || source.web.uri}
                                            </a>
                                        </li>
                                    )
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ComplexQuery;