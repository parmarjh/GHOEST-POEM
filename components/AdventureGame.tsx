// Fix: Implement the AdventureGame component, which was previously a placeholder.
import React, { useState, useEffect } from 'react';
import { continueStory, generateStoryImage } from '../services/geminiService';
import { GameState } from '../types';
import Sidebar from './Sidebar';
import Spinner from './Spinner';

const AdventureGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    story: '',
    inventory: [],
    quest: '',
    imageUrl: null,
    choices: [],
    isLoading: true,
    error: null,
  });

  const initialPrompt = `
    You are a Dungeon Master for a text-based RPG. Start a new fantasy adventure for the player.
    The first part of the story should set the scene and present the player with their first set of choices.
    The story should be mysterious and engaging.
    The quest should be something simple to start, like "Find the missing artifact."
    The player starts with a "Rusty Sword" and a "Health Potion" in their inventory.
    Generate the initial story state in the required JSON format.
  `;

  useEffect(() => {
    const startGame = async () => {
      try {
        setGameState(prev => ({ ...prev, isLoading: true, error: null }));
        const newState = await continueStory(initialPrompt);
        const imageUrl = await generateStoryImage(newState.imagePrompt);
        setGameState({
          story: newState.storyContinuation,
          inventory: newState.inventory,
          quest: newState.currentQuest,
          imageUrl,
          choices: newState.choices,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error(error);
        setGameState(prev => ({ ...prev, isLoading: false, error: 'Failed to start the adventure. Please try again.' }));
      }
    };
    startGame();
  }, []);

  const handleChoice = async (choice: string) => {
    try {
      const currentStory = gameState.story;
      setGameState(prev => ({ ...prev, isLoading: true, error: null, choices: [], story: prev.story + `\n\n> ${choice}` }));

      const prompt = `
        The player's current state is:
        Story so far: "${currentStory}"
        Inventory: ${JSON.stringify(gameState.inventory)}
        Current Quest: "${gameState.quest}"

        The player chose: "${choice}".

        Continue the story based on this choice. Update the inventory and quest if necessary.
        Provide three new choices. Generate a new image prompt.
        Return the result in the required JSON format.
      `;

      const newState = await continueStory(prompt);
      const imageUrl = await generateStoryImage(newState.imagePrompt);
      setGameState({
        story: currentStory + `\n\n> ${choice}\n\n` + newState.storyContinuation,
        inventory: newState.inventory,
        quest: newState.currentQuest,
        imageUrl,
        choices: newState.choices,
        isLoading: false,
        error: null,
      });

    } catch (error) {
      console.error(error);
      setGameState(prev => ({ ...prev, isLoading: false, error: 'The story hit a snag. Please try making a choice again.' }));
    }
  };

  const { story, inventory, quest, imageUrl, choices, isLoading, error } = gameState;

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-grow md:w-2/3">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl dark:shadow-lg overflow-hidden">
          <div className="relative h-64 sm:h-80 md:h-96 w-full">
            {isLoading && !imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-900">
                <Spinner />
                <p className="ml-4 text-gray-600 dark:text-gray-300">Generating your adventure...</p>
              </div>
            )}
            {imageUrl && <img src={imageUrl} alt="Adventure scene" className="w-full h-full object-cover" />}
            {isLoading && imageUrl && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Spinner />
                </div>
            )}
          </div>
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-cyan-600 dark:text-cyan-200">Story</h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{story}</p>
            {error && <p className="text-red-500 dark:text-red-400 mt-4">{error}</p>}
          </div>
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
             <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-300 mb-3">What do you do next?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {choices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => handleChoice(choice)}
                  disabled={isLoading}
                  className="bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-600 dark:hover:bg-cyan-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Sidebar inventory={inventory} quest={quest} />
    </div>
  );
};

export default AdventureGame;