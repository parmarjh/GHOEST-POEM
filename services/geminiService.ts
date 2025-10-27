import { GoogleGenAI, GenerateContentResponse, Modality, VideosOperation, Blob, Type, Chat, ModelConfig } from "@google/genai";
import { GroundingChunk } from '../types';

// This is a placeholder check. In a real AI Studio environment, the key is injected.
if (!process.env.API_KEY) {
  // In a real scenario, this might be handled by the execution environment.
  // For local dev, you'd use a .env file.
  console.warn("API_KEY is not set. The application may not function correctly.");
}

// Helper to create a new AI client. Crucial for Veo to pick up the selected API key.
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- API Retry Helper ---
const withRetry = async <T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> => {
    let retries = 0;
    while (true) {
        try {
            return await apiCall();
        } catch (error: any) {
            // Check if the error is a 429 (rate limit) or 5xx (server error)
            const isRetryable = error.toString().includes('429') || error.toString().includes('500');
            
            if (isRetryable && retries < maxRetries) {
                retries++;
                const delay = initialDelay * Math.pow(2, retries - 1) + Math.random() * 1000; // Exponential backoff with jitter
                console.warn(`API call failed with retryable error, retrying in ${Math.round(delay / 1000)}s... (Attempt ${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error("API call failed after multiple retries or with a non-retryable error.", error);
                throw error;
            }
        }
    }
};


// --- Image Studio Services ---
export const generateImageWithImagen = async (prompt: string, aspectRatio: string): Promise<string> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
    });

    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
});

export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: imageBase64, mimeType: mimeType } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("Image editing failed to produce an image.");
});

// --- Daily Inspiration Service ---
const inspirationSchema = {
    type: Type.OBJECT,
    properties: {
        story: { type: Type.STRING, description: "A short, uplifting, and inspiring story or poem." },
        imagePrompt: { type: Type.STRING, description: "A detailed, vivid prompt for an image generation model, based on the story." }
    },
    required: ["story", "imagePrompt"],
};

export const generateInspiration = async (): Promise<{ story: string; imageUrl: string; }> => {
    const ai = getAIClient();
    const prompt = "Generate a short, uplifting, and inspiring story or poem about the beauty of nature and new beginnings. Also, create a detailed and vivid image prompt based on the story for an AI image generator.";
    // Fix: Explicitly type the response from the API call to resolve type inference issues.
    const storyResponse: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: inspirationSchema,
        },
    }));

    const inspiration = JSON.parse(storyResponse.text.trim());
    const { story, imagePrompt } = inspiration;

    const imageUrl = await generateImageWithImagen(imagePrompt, '16:9');

    return { story, imageUrl };
};


// --- Adventure Game Services ---
// Fix: Implement continueStory for the adventure game.
const storySchema = {
    type: Type.OBJECT,
    properties: {
        storyContinuation: { type: Type.STRING, description: "The next part of the story." },
        inventory: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Player's current inventory." },
        currentQuest: { type: Type.STRING, description: "The player's current quest objective." },
        choices: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Three new choices for the player." },
        imagePrompt: { type: Type.STRING, description: "A detailed prompt for generating an image for this scene." }
    },
    required: ["storyContinuation", "inventory", "currentQuest", "choices", "imagePrompt"],
};

export const continueStory = async (prompt: string): Promise<{ storyContinuation: string; inventory: string[]; currentQuest: string; choices: string[]; imagePrompt: string; }> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: storySchema,
        },
    });
    
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
});

// Fix: Implement generateStoryImage for the adventure game.
export const generateStoryImage = async (prompt: string): Promise<string> => {
    // This function already calls generateImageWithImagen, which has retry logic.
    // However, for consistency and clarity, we can wrap its precursor.
    // Re-implementing to call the base function directly to avoid double-wrapping if structure changes.
    return withRetry(async () => {
        const ai = getAIClient();
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    });
};

// --- ChatBot Services ---
let chat: Chat | null = null;

export const startChat = (useGrounding: boolean = false) => {
    const ai = getAIClient();
    const config: ModelConfig = {
        systemInstruction: 'You are a helpful and friendly chatbot.'
    };

    if (useGrounding) {
        config.tools = [{ googleSearch: {} }];
    }

    chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: config
    });
};

// Fix: Add explicit return type to ensure the correct async iterable type is inferred.
export const sendMessageToChat = async (message: string): Promise<AsyncGenerator<GenerateContentResponse>> => {
    if (!chat) {
        throw new Error("Chat not initialized. Call startChat first.");
    }
    return withRetry(() => chat!.sendMessageStream({ message }));
};


// --- Video Studio Services ---
export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16', image?: { data: string, mimeType: string }): Promise<VideosOperation> => withRetry(async () => {
    const ai = getAIClient();
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: image ? { imageBytes: image.data, mimeType: image.mimeType } : undefined,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    });
    return operation;
});

export const checkVideoOperation = async (operation: VideosOperation): Promise<VideosOperation> => withRetry(async () => {
    const ai = getAIClient();
    return await ai.operations.getVideosOperation({ operation: operation });
});

// --- Live Conversation Services ---
export const liveConnect = (callbacks: any, systemInstruction: string) => {
    // Retrying the initial connection is best handled by the component logic.
    const ai = getAIClient();
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            systemInstruction: systemInstruction,
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [{ googleSearch: {} }],
        },
    });
};

// --- Audio Tools Services ---
export const transcribeAudio = async (audioBlob: { data: string, mimeType: string }): Promise<string> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [{ inlineData: audioBlob }]
        },
    });
    return response.text;
});

export const generateSpeech = async (text: string): Promise<string> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say with a clear and pleasant voice: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Failed to generate audio.");
    return base64Audio;
});

// --- Neural Cello Services ---
// Mock function for MIDI-to-Audio generation.
export const generateAudioFromMidi = async (midiFile: File): Promise<string> => withRetry(async () => {
    console.log(`Generating mock audio for ${midiFile.name}`);
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Play a short, pleasant cello melody.` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Failed to generate audio.");
    return base64Audio;
});


// --- Grounded Search Services ---
export const performWebSearch = async (query: string): Promise<{ text: string; sources: GroundingChunk[] }> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: { tools: [{ googleSearch: {} }] },
    });
    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
    return { text: response.text, sources };
});

export const performMapsSearch = async (query: string, lat: number, lng: number): Promise<{ text: string; sources: GroundingChunk[] }> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: { latitude: lat, longitude: lng }
                }
            }
        },
    });
    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
    return { text: response.text, sources };
});

// Fix: Implement performComplexQuery for the ComplexQuery component.
export const performComplexQuery = async (query: string): Promise<{ text: string; sources: GroundingChunk[] }> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: { tools: [{ googleSearch: {} }] },
    });
    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
    return { text: response.text, sources };
});

// --- Pro Analysis / Reasoning Services ---
export const analyzeVideoFrames = async (prompt: string, frames: string[]): Promise<string> => withRetry(async () => {
    const ai = getAIClient();
    const imageParts = frames.map(frame => ({
        inlineData: {
            mimeType: 'image/jpeg',
            data: frame.split(',')[1],
        },
    }));
    const textPart = { text: prompt };
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [textPart, ...imageParts] },
    });
    return response.text;
});

export const performThinkingQuery = async (query: string): Promise<string> => withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: query,
        config: {
            thinkingConfig: { thinkingBudget: 32768 }
        },
    });
    return response.text;
});