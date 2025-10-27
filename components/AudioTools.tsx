import React, { useState, useRef } from 'react';
import { generateSpeech, transcribeAudio } from '../services/geminiService';
import Spinner from './Spinner';

// --- Audio Decoding/Encoding Helpers ---
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

const AudioTools: React.FC = () => {
    // --- State for Text-to-Speech ---
    const [ttsText, setTtsText] = useState('Hello, Gemini! This is a test of your text-to-speech capabilities.');
    const [isTtsLoading, setIsTtsLoading] = useState(false);
    const [ttsError, setTtsError] = useState<string | null>(null);
    const [ttsAudioBuffer, setTtsAudioBuffer] = useState<AudioBuffer | null>(null);
    const [ttsAudioSource, setTtsAudioSource] = useState<AudioBufferSourceNode | null>(null);
    const [isTtsPlaying, setIsTtsPlaying] = useState(false);
    
    // --- State for Speech-to-Text (formerly Transcription) ---
    const [isSttRecording, setIsSttRecording] = useState(false);
    const [isSttTranscribing, setIsSttTranscribing] = useState(false);
    const [sttTranscribedText, setSttTranscribedText] = useState('');
    const [sttTranscriptionError, setSttTranscriptionError] = useState<string | null>(null);
    const sttMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const sttAudioChunksRef = useRef<Blob[]>([]);

    // --- State for Speech-to-Speech ---
    const [isS2sRecording, setIsS2sRecording] = useState(false);
    const [isS2sProcessing, setIsS2sProcessing] = useState(false); // Combined loading state
    const [s2sTranscribedText, setS2sTranscribedText] = useState('');
    const [s2sError, setS2sError] = useState<string | null>(null);
    const [s2sAudioBuffer, setS2sAudioBuffer] = useState<AudioBuffer | null>(null);
    const [s2sAudioSource, setS2sAudioSource] = useState<AudioBufferSourceNode | null>(null);
    const [isS2sPlaying, setIsS2sPlaying] = useState(false);
    const s2sMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const s2sAudioChunksRef = useRef<Blob[]>([]);


    const audioContextRef = useRef(new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }));

    // --- Text-to-Speech Handlers ---
    const handleGenerateSpeech = async () => {
        if (!ttsText.trim() || isTtsLoading) return;
        if (ttsAudioSource) ttsAudioSource.stop();

        setIsTtsLoading(true);
        setTtsError(null);
        setTtsAudioBuffer(null);
        try {
            const base64Audio = await generateSpeech(ttsText);
            const audioBytes = decode(base64Audio);
            const newAudioBuffer = await decodeAudioData(audioBytes, audioContextRef.current);
            setTtsAudioBuffer(newAudioBuffer);
        } catch (e: any) {
            setTtsError(`Failed to generate speech: ${e.message}`);
        } finally {
            setIsTtsLoading(false);
        }
    };

    const handleTtsPlayPause = () => {
        if (isTtsPlaying) {
            ttsAudioSource?.stop();
            setIsTtsPlaying(false);
        } else if (ttsAudioBuffer) {
            const source = audioContextRef.current.createBufferSource();
            source.buffer = ttsAudioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsTtsPlaying(false);
            source.start();
            setTtsAudioSource(source);
            setIsTtsPlaying(true);
        }
    };
    
    // --- Speech-to-Text Handlers ---
    const handleSttToggleRecording = async () => {
        if (isSttRecording) {
            sttMediaRecorderRef.current?.stop();
            setIsSttRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                sttMediaRecorderRef.current = new MediaRecorder(stream);
                sttAudioChunksRef.current = [];
                
                sttMediaRecorderRef.current.ondataavailable = event => {
                    sttAudioChunksRef.current.push(event.data);
                };
                
                sttMediaRecorderRef.current.onstop = handleSttTranscribe;
                
                sttMediaRecorderRef.current.start();
                setIsSttRecording(true);
                setSttTranscribedText('');
                setSttTranscriptionError(null);
            } catch (err: any) {
                setSttTranscriptionError(`Error accessing microphone: ${err.message}`);
            }
        }
    };

    const handleSttTranscribe = async () => {
        setIsSttTranscribing(true);
        setSttTranscriptionError(null);
        const audioBlob = new Blob(sttAudioChunksRef.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            try {
                const result = await transcribeAudio({ data: base64data, mimeType: 'audio/webm' });
                setSttTranscribedText(result);
            } catch(e: any) {
                setSttTranscriptionError(`Transcription failed: ${e.message}`);
            } finally {
                setIsSttTranscribing(false);
            }
        };
    };

    // --- Speech-to-Speech Handlers ---
    const handleS2sToggleRecording = async () => {
        if (isS2sRecording) {
            s2sMediaRecorderRef.current?.stop();
            setIsS2sRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                s2sMediaRecorderRef.current = new MediaRecorder(stream);
                s2sAudioChunksRef.current = [];
                s2sMediaRecorderRef.current.ondataavailable = event => {
                    s2sAudioChunksRef.current.push(event.data);
                };
                s2sMediaRecorderRef.current.onstop = handleS2sProcess;
                s2sMediaRecorderRef.current.start();
                setIsS2sRecording(true);
                setS2sTranscribedText('');
                setS2sAudioBuffer(null);
                setS2sError(null);
            } catch (err: any) {
                setS2sError(`Error accessing microphone: ${err.message}`);
            }
        }
    };
    
    const handleS2sProcess = async () => {
        setIsS2sProcessing(true);
        setS2sError(null);
        const audioBlob = new Blob(s2sAudioChunksRef.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            try {
                // Step 1: Transcribe
                const transcribed = await transcribeAudio({ data: base64data, mimeType: 'audio/webm' });
                setS2sTranscribedText(transcribed);
                
                // Step 2: Generate Speech from transcription
                if(transcribed) {
                    const base64Audio = await generateSpeech(transcribed);
                    const audioBytes = decode(base64Audio);
                    const newAudioBuffer = await decodeAudioData(audioBytes, audioContextRef.current);
                    setS2sAudioBuffer(newAudioBuffer);
                } else {
                    setS2sError("Could not transcribe audio, so no speech was generated.");
                }

            } catch(e: any) {
                setS2sError(`Processing failed: ${e.message}`);
            } finally {
                setIsS2sProcessing(false);
            }
        };
    };
    
    const handleS2sPlayPause = () => {
        if (isS2sPlaying) {
            s2sAudioSource?.stop();
            setIsS2sPlaying(false);
        } else if (s2sAudioBuffer) {
            const source = audioContextRef.current.createBufferSource();
            source.buffer = s2sAudioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsS2sPlaying(false);
            source.start();
            setS2sAudioSource(source);
            setIsS2sPlaying(true);
        }
    };


    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
            {/* Text-to-Speech Section */}
            <div className="p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">Text-to-Speech</h2>
                <textarea
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    rows={5}
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={isTtsLoading}
                />
                <button
                    onClick={handleGenerateSpeech}
                    disabled={isTtsLoading || !ttsText.trim()}
                    className="mt-4 w-full bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center"
                >
                    {isTtsLoading ? <><Spinner /> <span className="ml-2">Generating...</span></> : 'Generate Speech'}
                </button>
                {ttsError && <p className="text-red-500 dark:text-red-400 mt-2">{ttsError}</p>}
                {ttsAudioBuffer && (
                    <button
                        onClick={handleTtsPlayPause}
                        className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg"
                    >
                        {isTtsPlaying ? 'Pause' : 'Play Audio'}
                    </button>
                )}
            </div>

            {/* Speech-to-Text Section */}
            <div className="p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">Speech-to-Text</h2>
                <button
                    onClick={handleSttToggleRecording}
                    disabled={isSttTranscribing}
                    className={`w-full font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors ${
                        isSttRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700'
                    } disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white`}
                >
                    {isSttRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
                {isSttTranscribing && <div className="flex items-center justify-center mt-4"><Spinner /><p className="ml-2 text-gray-600 dark:text-gray-300">Transcribing...</p></div>}
                {sttTranscriptionError && <p className="text-red-500 dark:text-red-400 mt-2">{sttTranscriptionError}</p>}
                {sttTranscribedText && (
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg">
                        <h3 className="font-semibold text-cyan-700 dark:text-cyan-200 mb-2">Transcription:</h3>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sttTranscribedText}</p>
                    </div>
                )}
            </div>

            {/* Speech-to-Speech Section */}
            <div className="p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">Speech-to-Speech</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Record your voice, and we'll transcribe it and generate new speech from the text.</p>
                <button
                    onClick={handleS2sToggleRecording}
                    disabled={isS2sProcessing}
                    className={`w-full font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors ${
                        isS2sRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700'
                    } disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white`}
                >
                    {isS2sRecording ? 'Stop Recording & Process' : 'Start Recording'}
                </button>

                {isS2sProcessing && (
                    <div className="flex items-center justify-center mt-4">
                        <Spinner />
                        <p className="ml-2 text-gray-600 dark:text-gray-300">Processing...</p>
                    </div>
                )}
                {s2sError && <p className="text-red-500 dark:text-red-400 mt-2">{s2sError}</p>}
                
                {s2sTranscribedText && (
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg">
                        <h3 className="font-semibold text-cyan-700 dark:text-cyan-200 mb-2">Intermediate Text:</h3>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap italic">"{s2sTranscribedText}"</p>
                    </div>
                )}
                
                {s2sAudioBuffer && (
                    <div className="mt-4">
                        <h3 className="font-semibold text-cyan-700 dark:text-cyan-200 mb-2">Generated Speech:</h3>
                        <button
                            onClick={handleS2sPlayPause}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg"
                        >
                            {isS2sPlaying ? 'Pause' : 'Play Generated Audio'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioTools;