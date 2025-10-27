import React, { useState } from 'react';
import { generateImageWithImagen, editImage } from '../services/geminiService';
import Spinner from './Spinner';

type Mode = 'generate' | 'edit';

const ImageStudio: React.FC = () => {
    const [mode, setMode] = useState<Mode>('generate');
    const [prompt, setPrompt] = useState('A majestic lion with a cosmic mane, in a field of glowing flowers');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [sourceImage, setSourceImage] = useState<{ file: File, preview: string } | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError(null);
        setResultImage(null);
        try {
            const imageUrl = await generateImageWithImagen(prompt, aspectRatio);
            setResultImage(imageUrl);
        } catch (e: any) {
            setError(`Image generation failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEdit = async () => {
        if (!prompt.trim() || !sourceImage) return;
        setIsLoading(true);
        setError(null);
        setResultImage(null);
        
        const reader = new FileReader();
        reader.readAsDataURL(sourceImage.file);
        reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            try {
                const imageUrl = await editImage(prompt, base64data, sourceImage.file.type);
                setResultImage(imageUrl);
            } catch(e: any) {
                setError(`Image editing failed: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError("Failed to read the image file.");
            setIsLoading(false);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSourceImage({ file, preview: URL.createObjectURL(file) });
            setResultImage(null);
        }
    };

    const handleSubmit = () => {
        if (mode === 'generate') handleGenerate();
        else handleEdit();
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
            <div className="flex justify-center space-x-4 mb-6">
                {(['generate', 'edit'] as Mode[]).map(m => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`px-6 py-2 rounded-md font-semibold transition-colors ${mode === m ? 'bg-cyan-500 dark:bg-cyan-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                        {m === 'generate' ? 'Generate' : 'Edit'}
                    </button>
                ))}
            </div>

            {mode === 'edit' && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Upload Image to Edit</label>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 dark:file:bg-cyan-700/20 file:text-cyan-700 dark:file:text-cyan-300 hover:file:bg-cyan-100 dark:hover:file:bg-cyan-700/40"/>
                </div>
            )}
            
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">{mode === 'generate' ? 'Prompt' : 'Edit Instruction'}</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>

            {mode === 'generate' && (
                 <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none">
                        {['1:1', '16:9', '9:16', '4:3', '3:4'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            )}

            <button onClick={handleSubmit} disabled={isLoading || (mode === 'edit' && !sourceImage)} className="w-full bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                {isLoading ? <><Spinner /> <span className="ml-2">{mode === 'generate' ? 'Generating...' : 'Editing...'}</span></> : (mode === 'generate' ? 'Generate Image' : 'Edit Image')}
            </button>
            
            {error && <p className="text-red-500 dark:text-red-400 mt-4 text-center">{error}</p>}
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-items-center">
                {mode === 'edit' && sourceImage && (
                    <div>
                        <h3 className="text-center font-semibold text-gray-500 dark:text-gray-400 mb-2">Original</h3>
                        <img src={sourceImage.preview} alt="Source for editing" className="rounded-lg shadow-md max-h-96" />
                    </div>
                )}
                {(isLoading || resultImage) && (
                     <div className={mode === 'edit' && sourceImage ? '' : 'md:col-span-2'}>
                        <h3 className="text-center font-semibold text-gray-500 dark:text-gray-400 mb-2">Result</h3>
                        {isLoading ? <div className="w-full h-96 flex items-center justify-center bg-gray-200 dark:bg-gray-900 rounded-lg"><Spinner /></div> : <img src={resultImage!} alt="Generated result" className="rounded-lg shadow-md max-h-96" />}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageStudio;