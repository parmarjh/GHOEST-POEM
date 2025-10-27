import React, { useState } from 'react';
import { performWebSearch, performMapsSearch } from '../services/geminiService';
import Spinner from './Spinner';
import { GroundingChunk } from '../types';

type SearchType = 'web' | 'maps';

const GroundedSearch: React.FC = () => {
    const [query, setQuery] = useState('What are some good cafes near me?');
    const [searchType, setSearchType] = useState<SearchType>('maps');
    const [result, setResult] = useState<{ text: string; sources: GroundingChunk[] } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!query.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            let response;
            if (searchType === 'maps') {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });
                const { latitude, longitude } = position.coords;
                response = await performMapsSearch(query, latitude, longitude);
            } else {
                response = await performWebSearch(query);
            }
            setResult(response);
        } catch (e: any) {
            setError(`Failed to perform search: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
            <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">Grounded Search</h2>
            <div className="flex justify-center space-x-4 mb-4">
                {(['web', 'maps'] as SearchType[]).map(type => (
                    <button
                        key={type}
                        onClick={() => setSearchType(type)}
                        className={`px-4 py-2 rounded-md font-semibold transition-colors ${searchType === type ? 'bg-cyan-500 dark:bg-cyan-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                        {type === 'web' ? 'Web Search' : 'Maps Search'}
                    </button>
                ))}
            </div>
            
            <div className="flex items-center space-x-2 mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={searchType === 'maps' ? 'e.g., pizza places nearby' : 'e.g., latest tech news'}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button onClick={handleSearch} disabled={isLoading} className="bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">
                    {isLoading ? <Spinner /> : 'Search'}
                </button>
            </div>
            
            {error && <p className="text-red-500 dark:text-red-400 text-center">{error}</p>}

            {isLoading && !result && <div className="text-center mt-4"><Spinner /></div>}

            {result && (
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{result.text}</p>
                    {result.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="font-semibold text-cyan-600 dark:text-cyan-300 mb-2">Sources:</h4>
                            <ul className="list-disc list-inside space-y-1">
                                {result.sources.map((source, index) => {
                                    if (source.web) {
                                        return <li key={index}><a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-500 dark:text-cyan-400 hover:underline">{source.web.title || source.web.uri}</a></li>
                                    }
                                    if (source.maps) {
                                        return <li key={index}><a href={source.maps.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-500 dark:text-cyan-400 hover:underline">{source.maps.title || 'View on Google Maps'}</a></li>
                                    }
                                    return null;
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GroundedSearch;