export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets: {
            uri: string;
            text: string;
        }[]
    }
  };
}

// Fix: Add GameState type for the AdventureGame component.
export interface GameState {
  story: string;
  inventory: string[];
  quest: string;
  imageUrl: string | null;
  choices: string[];
  isLoading: boolean;
  error: string | null;
}

// Update ChatMessage to include optional sources for grounding.
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: GroundingChunk[];
}