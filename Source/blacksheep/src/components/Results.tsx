'use client';

import { useState, useEffect } from 'react';
import { Room, Player } from '@/types/game';
import { updateRoom, resetRoomForNewGame, clearChatMessages } from '@/utils/firebaseUtils';
import { calculateVotingResults, processElimination, prepareNextRound } from '@/utils/gameLogic';
import { Trophy, Skull, RefreshCw, Home } from 'lucide-react';

interface ResultsProps {
  room: Room;
  currentPlayer: Player;
}

export default function Results({ room, currentPlayer }: ResultsProps) {
  const [results, setResults] = useState<any>(null);
  const [processedResults, setProcessedResults] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    if (room.gameState === 'results' && isProcessing) {
      processResults();
    } else if (room.gameState === 'finished' && isProcessing) {
      // Game ended without voting (e.g., due to players quitting)
      setProcessedResults({
        updatedPlayers: room.players,
        gameEnded: true,
        winner: room.winner || null,
        reason: room.gameEndReason || 'Game ended.'
      });
      setIsProcessing(false);
    }
  }, [room, isProcessing]);

  const processResults = async () => {
    try {
      // Calculate voting results
      const votingResults = calculateVotingResults(room);
      setResults(votingResults);

      // Wait a moment to show voting results
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (votingResults.isTie) {
        // Handle tie - continue to next round
        const { updatedPlayers, newRound } = prepareNextRound(room);
        
        await updateRoom(room.id, {
          players: updatedPlayers,
          gameState: 'clue',
          currentRound: newRound,
          votes: {}
        });
      } else {
        // Process elimination
        const eliminatedPlayerId = votingResults.playersWithMaxVotes[0];
        const elimination = processElimination(room, eliminatedPlayerId);
        setProcessedResults(elimination);

        // Wait to show elimination results
        await new Promise(resolve => setTimeout(resolve, 4000));

        if (elimination.gameEnded) {
          await updateRoom(room.id, {
            players: elimination.updatedPlayers,
            gameState: 'finished',
            winner: elimination.winner,
            gameEndReason: elimination.reason
          });
        } else {
          // Continue to next round
          const { updatedPlayers, newRound } = prepareNextRound({
            ...room,
            players: elimination.updatedPlayers
          });
          
          await updateRoom(room.id, {
            players: updatedPlayers,
            gameState: 'clue',
            currentRound: newRound,
            votes: {}
          });
        }
      }
    } catch (error) {
      console.error('Error processing results:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const goHome = () => {
    window.location.href = '/';
  };

  const playAgain = async () => {
    if (!currentPlayer.isHost) return;
    
    try {
      // Clear chat messages
      await clearChatMessages(room.id);
      
      const resetPlayers = room.players.map(player => ({
        ...player,
        isAlive: true,
        hasVoted: false,
        word: '',
        isImposter: false
      }));
      
      await resetRoomForNewGame(room.id, {
        players: resetPlayers,
        gameState: 'waiting',
        currentRound: 0,
        votes: {},
        usedWordPairs: [] // Reset used word pairs for new game
      });
    } catch (error) {
      console.error('Error restarting game:', error);
    }
  };

  if (!results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Calculating results...</p>
        </div>
      </div>
    );
  }

  const eliminatedPlayer = processedResults && room.players.find(p => p.id === results.playersWithMaxVotes[0]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Voting Results */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-6 border border-white/20">
          <h1 className="text-3xl font-bold text-white text-center mb-8">📊 Voting Results</h1>
          
          <div className="grid gap-4 max-w-2xl mx-auto">
            {Object.entries(results.voteCounts)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .map(([playerId, votes]) => {
                const player = room.players.find(p => p.id === playerId);
                const isEliminated = results.playersWithMaxVotes.includes(playerId) && !results.isTie;
                
                return (
                  <div
                    key={playerId}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      isEliminated 
                        ? 'bg-red-500/20 border border-red-400/30' 
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isEliminated ? 'bg-red-500/40' : 'bg-blue-500/40'
                      }`}>
                        {isEliminated ? <Skull className="w-5 h-5 text-red-300" /> : 
                         <span className="text-white font-medium">{player?.name.charAt(0).toUpperCase()}</span>}
                      </div>
                      <span className={`font-medium ${isEliminated ? 'text-red-300' : 'text-white'}`}>
                        {player?.name}
                      </span>
                    </div>
                    <div className={`font-bold text-lg ${isEliminated ? 'text-red-300' : 'text-white'}`}>
                      {votes as number} vote{(votes as number) !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
          </div>

          {results.isTie && (
            <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-400/30 rounded-lg text-center">
              <p className="text-yellow-300 font-medium">
                It's a tie! No one is eliminated this round.
              </p>
            </div>
          )}
        </div>

        {/* Elimination Results */}
        {processedResults && !results.isTie && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-6 border border-white/20">
            <div className="text-center">
              {eliminatedPlayer && (
                <div className="mb-6">
                  <div className="w-20 h-20 bg-red-500/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Skull className="w-8 h-8 text-red-300" />
                  </div>
                  <h2 className="text-2xl font-bold text-red-300 mb-2">
                    {eliminatedPlayer.name} has been eliminated!
                  </h2>
                  <p className="text-white/80 mb-4">
                    They were {eliminatedPlayer.isImposter ? 'the IMPOSTER' : 'a CIVILIAN'}
                  </p>
                  {eliminatedPlayer.isImposter && (
                    <div className="bg-white/5 rounded-lg p-3 inline-block">
                      <span className="text-white/60">Their word was: </span>
                      <span className="text-white font-medium">{eliminatedPlayer.word}</span>
                    </div>
                  )}
                  {!eliminatedPlayer.isImposter && (
                    <div className="bg-blue-500/20 rounded-lg p-3 inline-block">
                      <span className="text-blue-300 text-sm">Word hidden - civilian eliminated</span>
                    </div>
                  )}
                </div>
              )}

              {processedResults.gameEnded ? (
                <div className="mt-8">
                  <div className="w-20 h-20 bg-yellow-500/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-yellow-300" />
                  </div>
                  <h2 className="text-3xl font-bold text-yellow-300 mb-2">
                    {processedResults.winner === 'imposters' ? 'IMPOSTERS WIN!' : 
                     processedResults.winner === 'civilians' ? 'CIVILIANS WIN!' : 'GAME OVER!'}
                  </h2>
                  <p className="text-white/80 mb-6">{processedResults.reason}</p>
                  
                  {/* Show all player roles */}
                  <div className="bg-white/5 rounded-lg p-4 max-w-md mx-auto">
                    <h3 className="text-white font-semibold mb-3">Final Reveal:</h3>
                    {room.players.map(player => (
                      <div key={player.id} className="flex justify-between items-center py-1">
                        <span className="text-white">{player.name}</span>
                        <span className={`font-medium ${player.isImposter ? 'text-red-300' : 'text-blue-300'}`}>
                          {player.isImposter ? `IMPOSTER (${player.word})` : 'CIVILIAN'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 p-4 bg-blue-500/20 border border-blue-400/30 rounded-lg">
                  <p className="text-blue-300 font-medium">
                    The game continues! Starting next round...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {processedResults?.gameEnded && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center">
            <div className="flex gap-4 justify-center">
              <button
                onClick={goHome}
                className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              
              {currentPlayer.isHost && (
                <button
                  onClick={playAgain}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Play Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}