import React, { useState } from 'react';
import { generateInspiration } from '../services/geminiService';
import Spinner from './Spinner';

const DailyInspiration: React.FC = () => {
    const [inspiration, setInspiration] = useState<{ story: string; imageUrl: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setInspiration(null);
        try {
            const result = await generateInspiration();
            setInspiration(result);
        } catch (e: any) {
            console.error(e);
            setError('Failed to generate daily inspiration. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
            <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4 text-center">Daily Inspiration</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center">
                Generate a unique, AI-created story and image to brighten your day.
            </p>
            
            <div className="text-center mb-8">
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                >
                    {isLoading ? 'Generating...' : "Get Today's Inspiration"}
                </button>
            </div>

            {isLoading && (
                <div className="flex flex-col items-center justify-center p-8">
                    <Spinner />
                    <p className="mt-4 text-gray-600 dark:text-gray-300">Creating your moment of inspiration...</p>
                </div>
            )}
            
            {error && <p className="text-red-500 dark:text-red-400 mt-4 text-center">{error}</p>}
            
            {inspiration && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="rounded-lg shadow-md overflow-hidden">
                        <img src={inspiration.imageUrl} alt="Inspirational scene" className="w-full h-auto object-cover" />
                    </div>
                    <div className="p-6 bg-gray-100 dark:bg-gray-900 rounded-lg">
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-serif text-lg leading-relaxed">{inspiration.story}</p>
                    </div>
                </div>
            )}
            
            {!isLoading && !inspiration && (
                 <div className="text-center text-gray-500 dark:text-gray-400 pt-8">
                    Click the button to start.
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default DailyInspiration;
