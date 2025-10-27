import React, { useState, useEffect, useRef } from 'react';
import { generateVideo, checkVideoOperation } from '../services/geminiService';
import Spinner from './Spinner';
import { VideosOperation } from '@google/genai';

const LOADING_MESSAGES = [
    "Warming up the digital director's chair...",
    "Assembling pixels into a masterpiece...",
    "Teaching electrons to dance...",
    "This is taking a moment, great art needs patience!",
    "Finalizing the cinematic universe...",
];

const VideoStudio: React.FC = () => {
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [prompt, setPrompt] = useState('A futuristic car flying through a neon-lit city');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [sourceImage, setSourceImage] = useState<{ file: File, preview: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const pollingInterval = useRef<number | null>(null);

    const checkApiKey = async () => {
        if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
            setApiKeySelected(true);
        } else {
            setApiKeySelected(false);
        }
    };
    useEffect(() => { checkApiKey(); }, []);

    const handleSelectKey = async () => {
        if(window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success to improve UX, error handling will catch failures.
            setApiKeySelected(true);
        }
    };
    
    const pollOperation = (operation: VideosOperation) => {
        pollingInterval.current = window.setInterval(async () => {
            try {
                const updatedOp = await checkVideoOperation(operation);
                if (updatedOp.done) {
                    if (pollingInterval.current) clearInterval(pollingInterval.current);
                    setIsLoading(false);
                    const uri = updatedOp.response?.generatedVideos?.[0]?.video?.uri;
                    if (uri) {
                        // Append API key for access
                        const finalUrl = `${uri}&key=${process.env.API_KEY}`;
                        setVideoUrl(finalUrl);
                    } else {
                        setError("Video generation finished but no video URL was found.");
                    }
                }
            } catch (e: any) {
                if (pollingInterval.current) clearInterval(pollingInterval.current);
                setError(`Polling failed: ${e.message}`);
                setIsLoading(false);
            }
        }, 15000); // Poll every 15 seconds
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError(null);
        setVideoUrl(null);
        if (pollingInterval.current) clearInterval(pollingInterval.current);

        // Loading messages cycle
        let messageIndex = 0;
        setLoadingMessage(LOADING_MESSAGES[messageIndex]);
        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
            setLoadingMessage(LOADING_MESSAGES[messageIndex]);
        }, 5000);

        try {
            let imagePayload: { data: string, mimeType: string } | undefined = undefined;
            if (sourceImage) {
                const base64data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(sourceImage.file);
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = error => reject(error);
                });
                imagePayload = { data: base64data, mimeType: sourceImage.file.type };
            }
            const initialOperation = await generateVideo(prompt, aspectRatio, imagePayload);
            pollOperation(initialOperation);
        } catch (e: any) {
            if (e.message?.includes("Requested entity was not found")) {
                setError("API Key error. Please re-select your API key.");
                setApiKeySelected(false); // Force re-selection
            } else {
                setError(`Generation failed: ${e.message}`);
            }
            setIsLoading(false);
        } finally {
            clearInterval(messageInterval);
        }
    };
    
    useEffect(() => () => { // Cleanup on unmount
        if (pollingInterval.current) clearInterval(pollingInterval.current);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSourceImage({ file: e.target.files[0], preview: URL.createObjectURL(e.target.files[0]) });
        }
    };
    
    if (!apiKeySelected) {
        return (
            <div className="text-center p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
                 <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">API Key Required</h2>
                 <p className="text-gray-500 dark:text-gray-400 mb-4">The Veo video generation model requires you to select an API key from a project with billing enabled.</p>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-500 dark:text-cyan-400 hover:underline mb-4 block">Learn more about billing</a>
                 <button onClick={handleSelectKey} className="bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg">Select API Key</button>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
            <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">Video Studio</h2>
            <div className="space-y-4">
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Enter video prompt..." className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Source Image (Optional)</label>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 dark:file:bg-cyan-700/20 file:text-cyan-700 dark:file:text-cyan-300 hover:file:bg-cyan-100 dark:hover:file:bg-cyan-700/40"/>
                    {sourceImage && <img src={sourceImage.preview} alt="source" className="mt-2 rounded-lg max-h-40"/>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none">
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                    </select>
                </div>
                <button onClick={handleGenerate} disabled={isLoading} className="w-full bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                    {isLoading ? <><Spinner /> <span className="ml-2">Generating...</span></> : 'Generate Video'}
                </button>
            </div>
            {error && <p className="text-red-500 dark:text-red-400 mt-4 text-center">{error}</p>}
            {isLoading && <div className="text-center mt-4"><Spinner /><p className="mt-2 text-gray-600 dark:text-gray-300">{loadingMessage}</p></div>}
            {videoUrl && <video src={videoUrl} controls className="mt-6 w-full rounded-lg" />}
        </div>
    );
};

export default VideoStudio;