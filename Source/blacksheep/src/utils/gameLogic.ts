import { Room, Player } from '@/types/game';

export function calculateVotingResults(room: Room) {
  const votes = room.votes;
  const voteCounts: { [playerId: string]: number } = {};
  
  // Count votes
  Object.values(votes).forEach(votedPlayerId => {
    voteCounts[votedPlayerId] = (voteCounts[votedPlayerId] || 0) + 1;
  });
  
  // Find player(s) with most votes
  const maxVotes = Math.max(...Object.values(voteCounts));
  const playersWithMaxVotes = Object.keys(voteCounts).filter(
    playerId => voteCounts[playerId] === maxVotes
  );
  
  return {
    voteCounts,
    maxVotes,
    playersWithMaxVotes,
    isTie: playersWithMaxVotes.length > 1
  };
}

export function processElimination(room: Room, eliminatedPlayerId: string): {
  updatedPlayers: Player[];
  gameEnded: boolean;
  winner: 'imposters' | 'civilians' | null;
  reason: string;
} {
  const eliminatedPlayer = room.players.find(p => p.id === eliminatedPlayerId);
  if (!eliminatedPlayer) {
    throw new Error('Player to eliminate not found');
  }
  
  // Mark player as eliminated
  const updatedPlayers = room.players.map(player => 
    player.id === eliminatedPlayerId 
      ? { ...player, isAlive: false }
      : player
  );
  
  const alivePlayers = updatedPlayers.filter(p => p.isAlive);
  const aliveImposters = alivePlayers.filter(p => p.isImposter);
  
  // Check win conditions
  if (eliminatedPlayer.isImposter && aliveImposters.length === 0) {
    // All imposters eliminated - civilians win
    return {
      updatedPlayers,
      gameEnded: true,
      winner: 'civilians',
      reason: 'All imposters have been eliminated!'
    };
  }
  
  if (alivePlayers.length <= 2 && aliveImposters.length > 0) {
    // Imposter survived to final 2 - imposters win
    return {
      updatedPlayers,
      gameEnded: true,
      winner: 'imposters',
      reason: 'The imposter survived to the final 2!'
    };
  }
  
  if (alivePlayers.length < 2) {
    // Not enough players to continue - game ends in draw
    return {
      updatedPlayers,
      gameEnded: true,
      winner: null,
      reason: 'Not enough players remaining to continue.'
    };
  }
  
  // Game continues
  return {
    updatedPlayers,
    gameEnded: false,
    winner: null,
    reason: ''
  };
}

export function prepareNextRound(room: Room): {
  updatedPlayers: Player[];
  newRound: number;
} {
  // Reset only voting state for next round - keep clues from previous rounds
  const updatedPlayers = room.players.map(player => ({
    ...player,
    hasVoted: false,
    hasGivenClue: false // Reset flag to allow new clue, but keep existing clues
  }));
  
  return {
    updatedPlayers,
    newRound: room.currentRound + 1
  };
}

export function resetGameForNewRound(room: Room): Partial<Room> {
  // Reset players voting state
  const resetPlayers = room.players.map(player => ({
    ...player,
    hasVoted: false,
    word: '', // Will be reassigned
    isImposter: false // Will be reassigned
  }));
  
  return {
    players: resetPlayers,
    gameState: 'waiting',
    currentRound: 0,
    votes: {}
  };
}