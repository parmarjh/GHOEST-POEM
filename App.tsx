import React, { useState, useEffect } from 'react';
import ImageStudio from './components/ImageStudio';
import VideoStudio from './components/VideoStudio';
import LiveConversation from './components/LiveConversation';
import GroundedSearch from './components/GroundedSearch';
import AudioTools from './components/AudioTools';
import AdventureGame from './components/AdventureGame';
import ChatBot from './components/ChatBot';
import NeuralCello from './components/NeuralCello';
import VideoAnalyzer from './components/VideoAnalyzer';
import ComplexReasoning from './components/ComplexReasoning';
import DailyInspiration from './components/DailyInspiration';


type Tab = 'Adventure' | 'ChatBot' | 'Inspiration' | 'Image' | 'Video' | 'VideoAnalyzer' | 'Live' | 'Audio' | 'Search' | 'Reasoning' | 'Cello';

// --- Icon Components for Theme Toggle ---
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('Adventure');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Adventure':
        return <AdventureGame />;
      case 'ChatBot':
        return <ChatBot />;
      case 'Inspiration':
        return <DailyInspiration />;
      case 'Image':
        return <ImageStudio />;
      case 'Video':
        return <VideoStudio />;
      case 'VideoAnalyzer':
        return <VideoAnalyzer />;
      case 'Live':
        return <LiveConversation />;
      case 'Search':
        return <GroundedSearch />;
      case 'Reasoning':
        return <ComplexReasoning />;
      case 'Audio':
        return <AudioTools />;
      case 'Cello':
        return <NeuralCello />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tabName: Tab; currentTab: Tab; setTab: (tab: Tab) => void; children: React.ReactNode }> = ({ tabName, currentTab, setTab, children }) => (
    <button
      onClick={() => setTab(tabName)}
      className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 ${
        currentTab === tabName
          ? 'bg-cyan-500 dark:bg-cyan-600 text-white'
          : 'bg-gray-200 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
      }`}
      aria-current={currentTab === tabName ? 'page' : undefined}
    >
      {children}
    </button>
  );

  return (
    <div className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white min-h-screen font-sans transition-colors duration-300">
      <div className="container mx-auto px-2 sm:px-4 py-8">
        <header className="text-center mb-8 relative">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-600 dark:text-cyan-300 tracking-tight">
            Ghoest Poem
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            A demonstration of the versatile capabilities of the Google Gemini API.
          </p>
          <button
            onClick={toggleTheme}
            className="absolute top-0 right-0 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-cyan-500 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
        </header>
        
        <nav className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8" role="tablist">
          <TabButton tabName="Adventure" currentTab={activeTab} setTab={setActiveTab}>Adventure Game</TabButton>
          <TabButton tabName="ChatBot" currentTab={activeTab} setTab={setActiveTab}>Chat Bot</TabButton>
          <TabButton tabName="Inspiration" currentTab={activeTab} setTab={setActiveTab}>Daily Inspiration</TabButton>
          <TabButton tabName="Image" currentTab={activeTab} setTab={setActiveTab}>Image Studio</TabButton>
          <TabButton tabName="Video" currentTab={activeTab} setTab={setActiveTab}>Video Studio</TabButton>
          <TabButton tabName="VideoAnalyzer" currentTab={activeTab} setTab={setActiveTab}>Video Analyzer</TabButton>
          <TabButton tabName="Live" currentTab={activeTab} setTab={setActiveTab}>Live Conversation</TabButton>
          <TabButton tabName="Audio" currentTab={activeTab} setTab={setActiveTab}>Audio Tools</TabButton>
          <TabButton tabName="Search" currentTab={activeTab} setTab={setActiveTab}>Grounded Search</TabButton>
          <TabButton tabName="Reasoning" currentTab={activeTab} setTab={setActiveTab}>Complex Reasoning</TabButton>
          <TabButton tabName="Cello" currentTab={activeTab} setTab={setActiveTab}>Neural Cello</TabButton>
        </nav>
        
        <main role="tabpanel">
          {renderContent()}
        </main>

        <footer className="text-center mt-12 text-gray-500 text-sm">
            <p>Powered by Google Gemini. UI designed for Jatin parmar Research & Development Uf  Shiva ai llp  .</p>
        </footer>
      </div>
    </div>
  );
};

export default App;