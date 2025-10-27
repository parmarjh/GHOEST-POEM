import React, { useState, useRef } from 'react';
import { generateAudioFromMidi } from '../services/geminiService';
import Spinner from './Spinner';

// --- Audio Decoding Helpers (similar to other components) ---
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

const NeuralCello: React.FC = () => {
    const [isTraining, setIsTraining] = useState(false);
    const [trainingComplete, setTrainingComplete] = useState(false);
    
    const [midiFile, setMidiFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedAudioBuffer, setGeneratedAudioBuffer] = useState<AudioBuffer | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionComplete, setSubmissionComplete] = useState(false);
    
    const [error, setError] = useState<string | null>(null);
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const handleTrain = () => {
        setIsTraining(true);
        setError(null);
        // Simulate training time
        setTimeout(() => {
            setIsTraining(false);
            setTrainingComplete(true);
        }, 3000); // 3-second mock training
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setMidiFile(file);
            setGeneratedAudioBuffer(null);
            setSubmissionComplete(false);
            setError(null);
        }
    };

    const handleGenerate = async () => {
        if (!midiFile) return;
        
        setIsGenerating(true);
        setError(null);
        setGeneratedAudioBuffer(null);
        setSubmissionComplete(false);

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            // This is a mock. The service function doesn't actually use the file.
            const base64Audio = await generateAudioFromMidi(midiFile);
            const audioBytes = decode(base64Audio);
            const buffer = await decodeAudioData(audioBytes, audioContextRef.current!);
            setGeneratedAudioBuffer(buffer);
        } catch (e: any) {
            setError(`Failed to generate audio: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = () => {
        setIsSubmitting(true);
        setError(null);
        // Simulate submission
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmissionComplete(true);
        }, 1500); // 1.5-second mock submission
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            audioSourceRef.current?.stop();
            // onended callback will handle cleanup
        } else if (generatedAudioBuffer && audioContextRef.current) {
            const source = audioContextRef.current.createBufferSource();
            source.buffer = generatedAudioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => {
                setIsPlaying(false);
                audioSourceRef.current = null;
            };
            source.start();
            audioSourceRef.current = source;
            setIsPlaying(true);
        }
    };
    
    const renderStep = (title: string, stepNumber: number, isEnabled: boolean, content: React.ReactNode) => (
        <div className={`p-4 bg-gray-100/50 dark:bg-gray-900/50 rounded-lg transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-200 mb-3">
                <span className="bg-cyan-500 dark:bg-cyan-600 text-white rounded-full h-6 w-6 inline-flex items-center justify-center mr-2 text-sm">{stepNumber}</span>
                {title}
            </h3>
            {content}
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
            <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mb-4">Neural Cello: Model Testing</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Follow the steps below to train the model, generate audio from a MIDI file, and submit it for evaluation.</p>
            
            <div className="space-y-4">
                {/* Step 1: Training */}
                <div className="p-4 bg-gray-100/50 dark:bg-gray-900/50 rounded-lg">
                    <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-200 mb-3">
                        <span className="bg-cyan-500 dark:bg-cyan-600 text-white rounded-full h-6 w-6 inline-flex items-center justify-center mr-2 text-sm">1</span>
                        Train Model
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">Train the neural cello model on the provided 1,277 audio samples.</p>
                    <button onClick={handleTrain} disabled={isTraining || trainingComplete} className="w-full bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center">
                       {isTraining ? <><Spinner /><span className="ml-2">Training...</span></> : (trainingComplete ? 'Training Complete ✔' : 'Start Training')}
                    </button>
                </div>

                {/* Step 2: Inference */}
                {renderStep("Generate Audio", 2, trainingComplete, (
                    <>
                         <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">Run inference on a supplied test MIDI file to generate audio.</p>
                         <div className="flex flex-col sm:flex-row items-center sm:space-x-2">
                             <input type="file" accept=".mid,.midi" onChange={handleFileChange} disabled={!trainingComplete || isGenerating} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-200 dark:file:bg-gray-700 file:text-cyan-700 dark:file:text-cyan-200 hover:file:bg-gray-300 dark:hover:file:bg-gray-600 disabled:opacity-50 mb-2 sm:mb-0"/>
                             <button onClick={handleGenerate} disabled={!midiFile || isGenerating || !trainingComplete} className="bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg flex-shrink-0 w-full sm:w-auto">
                                 {isGenerating ? <Spinner/> : 'Generate'}
                             </button>
                         </div>
                         {isGenerating && (
                            <div className="flex items-center justify-center mt-4"><Spinner /><p className="ml-2 text-gray-600 dark:text-gray-300">Generating audio...</p></div>
                         )}
                         {generatedAudioBuffer && (
                             <div className="mt-4">
                                 <h4 className="text-md font-semibold text-cyan-600 dark:text-cyan-300 mb-2">Generated Audio:</h4>
                                 <button onClick={handlePlayPause} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg">
                                    {isPlaying ? 'Pause' : 'Play'}
                                 </button>
                             </div>
                         )}
                    </>
                ))}

                {/* Step 3: Submission */}
                {renderStep("Submit for Evaluation", 3, !!generatedAudioBuffer, (
                     <>
                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">Submit the generated audio files for evaluation.</p>
                        <button onClick={handleSubmit} disabled={!generatedAudioBuffer || isSubmitting || submissionComplete} className="w-full bg-teal-500 dark:bg-teal-600 hover:bg-teal-600 dark:hover:bg-teal-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center">
                           {isSubmitting ? <><Spinner /><span className="ml-2">Submitting...</span></> : (submissionComplete ? 'Submitted Successfully ✔' : 'Submit')}
                        </button>
                     </>
                ))}
            </div>
            {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                    <p className="text-red-600 dark:text-red-300">{error}</p>
                </div>
            )}
        </div>
    );
};

export default NeuralCello;