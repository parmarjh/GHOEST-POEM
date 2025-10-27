import React, { useState, useRef, useEffect } from 'react';
import { sendMessageToChat, startChat } from '../services/geminiService';
import { ChatMessage, GroundingChunk } from '../types';
import Spinner from './Spinner';

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useGrounding, setUseGrounding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initializeChat = () => {
    startChat(useGrounding);
    const greeting = useGrounding 
      ? "Hello! Web search is enabled. How can I help you find up-to-date information?"
      : "Hello! How can I help you today?";
    setMessages([{ role: 'model', text: greeting }]);
  };

  useEffect(() => {
    initializeChat();
  }, [useGrounding]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage, { role: 'model', text: '', sources: [] }]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const stream = await sendMessageToChat(userMessage.text);
      let modelResponse = '';
      let sources: GroundingChunk[] = [];

      for await (const chunk of stream) {
        modelResponse += chunk.text;
        const newSources = (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
        if (newSources.length > 0) {
          sources = [...sources, ...newSources];
        }
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { 
            role: 'model', 
            text: modelResponse, 
            sources: sources 
          };
          return newMessages;
        });
      }
    } catch (e) {
      setError('Sorry, something went wrong. Please try again.');
      console.error(e);
      setMessages(prev => prev.slice(0, -1)); // Remove the empty model message on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-cyan-500 dark:bg-cyan-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                    <h4 className="font-semibold text-xs text-cyan-600 dark:text-cyan-200 mb-1">Sources:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {msg.sources.map((source, idx) => (
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
          {isLoading && messages[messages.length-1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg flex items-center">
                 <Spinner />
                 <span className="ml-2">Thinking...</span>
              </div>
            </div>
          )}
          {error && <p className="text-red-500 dark:text-red-400 text-center">{error}</p>}
        </div>
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Send
          </button>
        </div>
        <div className="flex items-center justify-center mt-3">
            <label htmlFor="grounding-toggle" className="flex items-center cursor-pointer">
                <div className="relative">
                    <input type="checkbox" id="grounding-toggle" className="sr-only" checked={useGrounding} onChange={() => setUseGrounding(!useGrounding)} />
                    <div className="block bg-gray-300 dark:bg-gray-600 w-10 h-6 rounded-full"></div>
                    <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition"></div>
                </div>
                <div className="ml-3 text-gray-600 dark:text-gray-300 text-sm">Web Search</div>
            </label>
            <style>{`
                input:checked ~ .dot {
                    transform: translateX(100%);
                    background-color: #0891b2; /* cyan-600 */
                }
            `}</style>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;