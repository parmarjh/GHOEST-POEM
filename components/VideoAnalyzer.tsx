import React, { useState, useRef } from 'react';
import { analyzeVideoFrames } from '../services/geminiService';
import Spinner from './Spinner';

const MAX_FRAMES = 10;

const VideoAnalyzer: React.FC = () => {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('What is happening in this video?');
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const processFile = (file: File) => {
        if (file && file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setAnalysis('');
            setError(null);
            setProgress('');
        } else {
            setError('Please upload a valid video file.');
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processFile(file);
        }
        // Allow re-uploading the same file
        if(event.target) {
            event.target.value = '';
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleAnalyze = async () => {
        if (!videoRef.current || !canvasRef.current || !videoSrc) return;

        setIsLoading(true);
        setError(null);
        setAnalysis('');
        setProgress('Initializing analysis...');

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) throw new Error("Could not get canvas context");
            
            const frames: string[] = [];
            const duration = video.duration;
            if (isNaN(duration) || duration === 0) {
                 throw new Error("Video duration is invalid or zero. Cannot extract frames.");
            }
            const interval = duration / MAX_FRAMES;

            for (let i = 0; i < MAX_FRAMES; i++) {
                setProgress(`Extracting frame ${i + 1}/${MAX_FRAMES}...`);
                video.currentTime = i * interval;
                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error("Seek operation timed out.")), 3000);
                    const onSeeked = () => {
                        clearTimeout(timer);
                        video.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    video.addEventListener('seeked', onSeeked);
                });

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                frames.push(frameDataUrl);
            }
            
            setProgress('Sending frames to Gemini for analysis...');
            const result = await analyzeVideoFrames(prompt, frames);
            setAnalysis(result);
        } catch (e: any) {
            setError(`Failed to analyze video: ${e.message}`);
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    return (
        <div>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Upload a short video and ask Gemini a question about it. We'll analyze up to {MAX_FRAMES} frames.</p>
            
            {!videoSrc ? (
                <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors duration-200 ${
                        isDragging 
                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30' 
                            : 'border-gray-300 dark:border-gray-600 hover:border-cyan-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                    <input 
                        ref={fileInputRef}
                        id="video-upload"
                        type="file" 
                        accept="video/*" 
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <p className="text-gray-500 dark:text-gray-400">Drag & drop your video here</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">or click to select a file</p>
                </div>
            ) : (
                <div className="mb-6">
                    <video ref={videoRef} src={videoSrc} controls className="w-full rounded-lg" muted onLoadedMetadata={() => {if(videoRef.current) videoRef.current.currentTime = 0.1}} />
                    <canvas ref={canvasRef} className="hidden" />
                     <button 
                        onClick={() => setVideoSrc(null)} 
                        className="mt-2 text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                        Upload a different video
                    </button>
                </div>
            )}

            <div className="mt-4">
                <label htmlFor="video-prompt" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Analysis Prompt</label>
                <textarea
                    id="video-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={isLoading || !videoSrc}
                />
                <button onClick={handleAnalyze} disabled={isLoading || !videoSrc} className="mt-4 w-full bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                    {isLoading ? <><Spinner /> <span className="ml-2">Analyzing...</span></> : 'Analyze Video'}
                </button>
            </div>

            {isLoading && progress && <p className="text-gray-500 dark:text-gray-400 text-center mt-2 text-sm">{progress}</p>}
            
            {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                    <p className="text-red-600 dark:text-red-300 mb-3">{error}</p>
                    <button 
                        onClick={handleAnalyze} 
                        disabled={isLoading || !videoSrc}
                        className="bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-semibold py-2 px-5 rounded-lg transition-colors duration-200 text-sm"
                    >
                        Retry Analysis
                    </button>
                </div>
            )}
            
            {analysis && (
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                    <h3 className="font-semibold text-cyan-700 dark:text-cyan-200 mb-2">Analysis Result:</h3>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{analysis}</p>
                </div>
            )}
        </div>
    );
};

export default VideoAnalyzer;