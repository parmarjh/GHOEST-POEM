import React, { useState, useRef, useEffect } from 'react';
import { LiveServerMessage, Blob } from '@google/genai';
import { liveConnect } from '../services/geminiService';
import Spinner from './Spinner';
import { GroundingChunk } from '../types';

// --- Audio Encoding/Decoding Helpers ---
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
}

// --- Content Filtering Helper ---
const SFW_PROFANITY_LIST = ['darn', 'heck', 'gosh', 'shoot'];

const filterProfanity = (text: string): string => {
    let filteredText = text;
    SFW_PROFANITY_LIST.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        filteredText = filteredText.replace(regex, '*'.repeat(word.length));
    });
    return filteredText;
};


// --- Helper Icon Components ---
const UserIcon = () => (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-600 dark:bg-cyan-700 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    </div>
);

const ModelIcon = () => (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-600 dark:text-cyan-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V3m0 18v-3M5.636 5.636l-1.414-1.414m15.556 15.556l-1.414-1.414M18.364 5.636l-1.414 1.414m-12.728 12.728l-1.414 1.414M9 9a3 3 0 013-3h0a3 3 0 013 3v6a3 3 0 01-3 3h0a3 3 0 01-3-3V9z" />
        </svg>
    </div>
);

interface TranscriptEntry {
    speaker: 'user' | 'model';
    text: string;
    sources?: GroundingChunk[];
}

type Language = 'en' | 'hi' | 'gu';

const systemInstructions: Record<Language, string> = {
    en: "You are a friendly and helpful conversational AI. You must converse *only* in English. You can search the web for up-to-date information.",
    hi: "आप एक मैत्रीपूर्ण और सहायक संवादी एआई हैं। आपको *केवल* हिंदी में बातचीत करनी चाहिए। आप नवीनतम जानकारी के लिए वेब पर खोज कर सकते हैं।",
    gu: "તમે એક મૈત્રીપૂર્ણ અને મદદરૂપ વાર્તાલાપ AI છો. તમારે *ફક્ત* ગુજરાતીમાં જ વાતચીત કરવી જોઈએ. તમે નવીનતમ માહિતી માટે વેબ પર શોધી શકો છો."
};


const LiveConversation: React.FC = () => {
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [currentTurn, setCurrentTurn] = useState({ user: '', model: '', modelSources: [] as GroundingChunk[] });
    const [language, setLanguage] = useState<Language>('en');
    
    // State for playback controls
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isPaused, setIsPaused] = useState(false);

    const sessionPromiseRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef(new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }));
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const playbackRateRef = useRef(1.0);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript, currentTurn]);

    useEffect(() => {
        playbackRateRef.current = playbackRate;
        sourcesRef.current.forEach(source => {
            source.playbackRate.setValueAtTime(playbackRate, outputAudioContextRef.current.currentTime);
        });
    }, [playbackRate]);
    
    const handlePauseResume = () => {
        const ctx = outputAudioContextRef.current;
        if (ctx.state === 'running') {
            ctx.suspend().then(() => setIsPaused(true));
        } else if (ctx.state === 'suspended') {
            ctx.resume().then(() => setIsPaused(false));
        }
    };

    const handleStopPlayback = () => {
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        if (outputAudioContextRef.current.state === 'suspended') {
            outputAudioContextRef.current.resume().then(() => setIsPaused(false));
        } else {
             setIsPaused(false);
        }
    };

    const startConversation = async () => {
        setError(null);
        setTranscript([]);
        setCurrentTurn({ user: '', model: '', modelSources: [] });
        setIsConnecting(true);
        setIsPaused(false);
        setPlaybackRate(1.0);

        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            sessionPromiseRef.current = liveConnect({
                onopen: () => {
                    setIsConnecting(false);
                    setIsActive(true);
                    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current!);
                    scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current.onaudioprocess = (event) => {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                        const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                        sessionPromiseRef.current?.then((session: any) => session.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    const hasInput = !!message.serverContent?.inputTranscription;
                    const hasOutput = !!message.serverContent?.outputTranscription;
                    const isTurnComplete = !!message.serverContent?.turnComplete;
                    const newSources = message.serverContent?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;

                    setCurrentTurn(prevTurn => {
                        let newTurn = { ...prevTurn };
                        const transcriptUpdates: TranscriptEntry[] = [];

                        if (newSources) {
                            newTurn.modelSources = [...newTurn.modelSources, ...newSources];
                        }

                        if (hasOutput && newTurn.user) {
                             const userText = newTurn.user.trim();
                             if (userText) { // Validation: Not empty
                                transcriptUpdates.push({ speaker: 'user', text: filterProfanity(userText) });
                             }
                            newTurn.user = '';
                        }
                        
                        if (hasInput) newTurn.user += message.serverContent!.inputTranscription!.text;
                        if (hasOutput) newTurn.model += message.serverContent!.outputTranscription!.text;

                        if (isTurnComplete) {
                            const userText = newTurn.user.trim();
                            if (userText) { // Validation: Not empty
                                transcriptUpdates.push({ speaker: 'user', text: filterProfanity(userText) });
                            }
                            if (newTurn.model) {
                                transcriptUpdates.push({ speaker: 'model', text: newTurn.model, sources: newTurn.modelSources });
                            }
                            newTurn = { user: '', model: '', modelSources: [] };
                        }

                        if (transcriptUpdates.length > 0) {
                            setTranscript(prev => [...prev, ...transcriptUpdates]);
                        }
                        return newTurn;
                    });

                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                    if (base64Audio) {
                        const ctx = outputAudioContextRef.current;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx);
                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.playbackRate.value = playbackRateRef.current;
                        source.connect(ctx.destination);
                        source.addEventListener('ended', () => sourcesRef.current.delete(source));
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration / playbackRateRef.current;
                        sourcesRef.current.add(source);
                    }
                    
                    if (message.serverContent?.interrupted) {
                        handleStopPlayback();
                    }
                },
                onerror: (e: ErrorEvent) => setError(`An error occurred: ${e.message}`),
                onclose: () => stopConversation(false),
            }, systemInstructions[language]);
             await sessionPromiseRef.current;
        } catch (err: any) {
            setError(`Failed to start: ${err.message}`);
            setIsActive(false);
            setIsConnecting(false);
        }
    };
    
    const stopConversation = (shouldCloseSession = true) => {
        if(shouldCloseSession) sessionPromiseRef.current?.then((s: any) => s.close());
        
        streamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        if (inputAudioContextRef.current?.state !== 'closed') {
            inputAudioContextRef.current?.close();
        }
        
        handleStopPlayback();
        
        setIsActive(false);
        setIsConnecting(false);
    };

    useEffect(() => () => { if(isActive || isConnecting) stopConversation(); }, [isActive, isConnecting]);

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
            <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">Live Conversation</h2>
            
            {!isActive && !isConnecting && (
                <div className="mb-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Language</h3>
                    <div className="flex justify-center flex-wrap gap-3">
                        {(Object.keys(systemInstructions) as Language[]).map(lang => (
                            <label key={lang} className={`px-4 py-2 rounded-md font-semibold cursor-pointer transition-colors ${language === lang ? 'bg-cyan-500 dark:bg-cyan-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                                <input
                                    type="radio"
                                    name="language"
                                    value={lang}
                                    checked={language === lang}
                                    onChange={() => setLanguage(lang)}
                                    className="sr-only"
                                />
                                {lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी (Hindi)' : 'ગુજરાતી (Gujarati)'}
                            </label>
                        ))}
                    </div>
                </div>
            )}
            
            <button
                onClick={isActive ? () => stopConversation() : startConversation}
                disabled={isConnecting}
                className={`w-full font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors ${
                    isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700'
                } disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white`}
            >
                {isConnecting ? <><Spinner /><span className="ml-2">Connecting...</span></> : (isActive ? 'End Conversation' : 'Start Conversation')}
            </button>

            {isActive && (
                <div className="mt-4 p-4 bg-gray-100/50 dark:bg-gray-900/50 rounded-lg">
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                        <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[280px]">
                            <label htmlFor="playbackRate" className="text-sm text-gray-600 dark:text-gray-300">Speed:</label>
                            <input
                                id="playbackRate" type="range" min="0.5" max="2" step="0.1" value={playbackRate}
                                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} className="w-full"
                            />
                            <span className="text-sm font-mono text-cyan-600 dark:text-cyan-300 w-12 text-center">{playbackRate.toFixed(1)}x</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={handlePauseResume} className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                                {isPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button onClick={handleStopPlayback} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                                Stop
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && <p className="text-red-500 dark:text-red-400 mt-4 text-center">{error}</p>}
            <div className="mt-6 h-96 overflow-y-auto p-4 bg-gray-100 dark:bg-gray-900 rounded-lg space-y-4">
                {transcript.map((entry, index) => (
                    <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'flex-row-reverse' : 'flex-row'} message-bubble-animate`}>
                         {entry.speaker === 'user' ? <UserIcon /> : <ModelIcon />}
                         <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${entry.speaker === 'user' ? 'bg-cyan-600 dark:bg-cyan-700 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                            <p>{entry.text}</p>
                            {entry.sources && entry.sources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                                    <h4 className="font-semibold text-xs text-cyan-700 dark:text-cyan-200 mb-1">Sources:</h4>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                    {entry.sources.map((source, idx) => (
                                        source.web && (
                                        <li key={idx}>
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
                    </div>
                ))}
                {currentTurn.user && (
                    <div className="flex items-start gap-3 flex-row-reverse">
                        <UserIcon />
                        <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg bg-cyan-600/70 dark:bg-cyan-700/70 text-white italic"><p>{filterProfanity(currentTurn.user)}</p></div>
                    </div>
                )}
                {currentTurn.model && (
                    <div className="flex items-start gap-3 flex-row">
                        <ModelIcon />
                        <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg bg-gray-200/70 dark:bg-gray-700/70 text-gray-700 dark:text-gray-300 italic"><p>{currentTurn.model}</p></div>
                    </div>
                )}
                 {!isConnecting && !isActive && transcript.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center">Select a language and click "Start Conversation" to begin.</p>}
                 <div ref={transcriptEndRef} />
            </div>
        </div>
    );
};

export default LiveConversation;