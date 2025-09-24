export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isAlive: boolean;
  isImposter: boolean;
  word: string;
  hasVoted: boolean;
}

export interface Room {
  id: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  gameState: GameState;
  currentRound: number;
  votes: { [playerId: string]: string }; // playerId -> votedForPlayerId
  createdAt: Date;
  startedAt?: Date;
  showImposterRole: boolean; // Whether imposters know they are imposters
  usedWordPairs: string[]; // Array of used word pair categories to prevent repetition
  winner?: 'imposters' | 'civilians' | null; // Winner when game ends due to quitting
  gameEndReason?: string; // Reason why game ended
}

export type GameState = 
  | 'waiting'    // Waiting for players to join
  | 'starting'   // Host clicked start, assigning words
  | 'clue'       // Players giving clues
  | 'voting'     // Players voting
  | 'results'    // Showing round results
  | 'finished';  // Game over

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: Date;
  round: number;
}

export interface WordPair {
  main: string;
  imposter: string;
  category: string;
}

export interface GameResult {
  winner: 'imposters' | 'civilians';
  imposterIds: string[];
  reason: string;
}