'use client';

import { useState, useEffect } from 'react';
import { Room, Player } from '@/types/game';
import { updateRoom, addPlayerClue, checkAllPlayersGaveClues, resetPlayersForNewRound, clearChatMessages } from '@/utils/firebaseUtils';
import { deleteField } from 'firebase/firestore';
import { RefreshCw, LogOut, Trophy, Home, Users, Clock, Vote } from 'lucide-react';
import Results from './Results';
import PlayerCard from './PlayerCard';

interface GameBoardProps {
  room: Room;
  currentPlayer: Player;
}

export default function GameBoard({ room, currentPlayer }: GameBoardProps) {
  const [showWord, setShowWord] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string>('');
  const [isVoting, setIsVoting] = useState(false);
  const [isStartingVoting, setIsStartingVoting] = useState(false);

  const handleAddClue = async (clue: string) => {
    if (!clue.trim() || room.gameState !== 'clue' || currentPlayer.hasGivenClue) return;

    try {
      await addPlayerClue(room.id, currentPlayer.id, clue, room.players);
      
      // Check if all players have given clues and auto-start voting if so
      const updatedPlayers = room.players.map(player => 
        player.id === currentPlayer.id 
          ? { ...player, clues: [...(player.clues || []), clue], hasGivenClue: true }
          : player
      );
      
      if (checkAllPlayersGaveClues(updatedPlayers)) {
        // Auto-start voting phase when everyone has given clues
        setTimeout(async () => {
          await updateRoom(room.id, { gameState: 'voting' });
        }, 1000);
      }
    } catch (error) {
      console.error('Error adding clue:', error);
      throw error;
    }
  };

  const startVotingPhase = async () => {
    const originalHost = room.players.find(p => p.isHost);
    const canStartVoting = currentPlayer.isHost || (originalHost && !originalHost.isAlive);
    
    if (!canStartVoting || room.gameState !== 'clue') return;
    
    setIsStartingVoting(true);
    try {
      await updateRoom(room.id, {
        gameState: 'voting'
      });
    } catch (error) {
      console.error('Error starting voting phase:', error);
    } finally {
      setIsStartingVoting(false);
    }
  };

  const resetWords = async () => {
    if (!currentPlayer.isHost || room.gameState !== 'clue') return;
    
    if (confirm('Are you sure you want to reset the words? This will assign new words to all players and clear the current round chat.')) {
      setIsStartingVoting(true);
      try {
        // Import word selection functions
        const { getUnusedWordPair } = await import('@/data/words');
        const { selectRandomImposter } = await import('@/utils/gameUtils');
        
        // Select new imposter and words
        const alivePlayers = room.players.filter(p => p.isAlive);
        const imposterPlayer = selectRandomImposter(alivePlayers.map(p => p.id));
        
        // Get new word pair (excluding current used pairs)
        const wordPair = getUnusedWordPair(room.usedWordPairs || []);
        
        // Assign new words to players and reset clue tracking
        const updatedPlayers = room.players.map(player => ({
          ...player,
          isImposter: player.id === imposterPlayer,
          word: player.id === imposterPlayer ? wordPair.imposter : wordPair.main,
          hasVoted: false,
          clues: [],
          hasGivenClue: false,
          hasLeft: false
        }));

        // Add new word pair to used list
        const updatedUsedWordPairs = [...(room.usedWordPairs || []), wordPair.category];

        await updateRoom(room.id, {
          players: updatedPlayers,
          usedWordPairs: updatedUsedWordPairs,
          votes: {}
        });
      } catch (error) {
        console.error('Error resetting words:', error);
        alert('Failed to reset words. Please try again.');
      } finally {
        setIsStartingVoting(false);
      }
    }
  };

  const quitGame = async () => {
    // Different behavior based on game state
    const isGameActive = room.gameState !== 'waiting' && room.gameState !== 'starting';
    const confirmMessage = isGameActive 
      ? 'Are you sure you want to quit the game? You will be marked as left but can still spectate.'
      : 'Are you sure you want to leave the room?';
    
    if (confirm(confirmMessage)) {
      try {
        if (isGameActive) {
          // During active game - mark player as left instead of removing them
          const updatedPlayers = room.players.map(player => 
            player.id === currentPlayer.id 
              ? { ...player, hasLeft: true, isAlive: false } // Mark as left and not alive for game logic
              : player
          );
          
          // If current player was the host, transfer host to another active player
          const needNewHost = currentPlayer.isHost;
          let finalPlayers = updatedPlayers;
          
          if (needNewHost) {
            const activePlayer = updatedPlayers.find(p => !p.hasLeft);
            if (activePlayer) {
              finalPlayers = updatedPlayers.map(player => 
                player.id === activePlayer.id 
                  ? { ...player, isHost: true }
                  : { ...player, isHost: false }
              );
            }
          }
          
          // Check if there are enough active players left to continue the game
          const activePlayers = finalPlayers.filter(p => !p.hasLeft);
          const aliveActivePlayers = activePlayers.filter(p => p.isAlive);
          
          if (activePlayers.length === 0) {
            // All players left - end the game
            await updateRoom(room.id, {
              players: finalPlayers,
              gameState: 'finished',
              winner: null,
              gameEndReason: 'All players left the game.'
            });
          } else if (aliveActivePlayers.length <= 2) {
            // Not enough active players to continue - determine winner
            const aliveImposters = aliveActivePlayers.filter(p => p.isImposter);
            let winner: 'imposters' | 'civilians' | null = null;
            let reason = '';
            
            if (aliveImposters.length > 0) {
              winner = 'imposters';
              reason = 'The imposter survived - imposters win!';
            } else if (aliveActivePlayers.length === 0) {
              winner = null;
              reason = 'All remaining players left the game.';
            } else {
              winner = 'civilians';
              reason = 'All imposters eliminated - civilians win!';
            }
            
            await updateRoom(room.id, {
              players: finalPlayers,
              gameState: 'finished',
              winner: winner,
              gameEndReason: reason
            });
          } else {
            // Game can continue with remaining players
            await updateRoom(room.id, {
              players: finalPlayers
            });
          }
        } else {
          // Before game starts (waiting/starting) - completely remove player
          const updatedPlayers = room.players.filter(p => p.id !== currentPlayer.id);
          
          // If current player was the host, transfer host to another player
          const needNewHost = currentPlayer.isHost;
          let finalPlayers = updatedPlayers;
          
          if (needNewHost && updatedPlayers.length > 0) {
            finalPlayers = updatedPlayers.map((player, index) => 
              index === 0 ? { ...player, isHost: true } : player
            );
          }
          
          await updateRoom(room.id, {
            players: finalPlayers
          });
        }
        
        // Clear localStorage and go home
        localStorage.removeItem('playerId');
        localStorage.removeItem('playerName');
        window.location.href = '/';
      } catch (error) {
        console.error('Error quitting game:', error);
        // Still go home even if there's an error
        localStorage.removeItem('playerId');
        localStorage.removeItem('playerName');
        window.location.href = '/';
      }
    }
  };

  const handleVote = async (votedPlayerId: string) => {
    if (room.gameState !== 'voting' || currentPlayer.hasVoted) return;

    setIsVoting(true);
    setSelectedVote(votedPlayerId);
    
    try {
      const updatedVotes = { ...room.votes, [currentPlayer.id]: votedPlayerId };
      const updatedPlayers = room.players.map(player => 
        player.id === currentPlayer.id 
          ? { ...player, hasVoted: true }
          : player
      );

      await updateRoom(room.id, {
        votes: updatedVotes,
        players: updatedPlayers
      });

      // Check if everyone has voted
      const alivePlayers = room.players.filter(p => p.isAlive);
      if (Object.keys(updatedVotes).length === alivePlayers.length) {
        // Move to results phase
        await updateRoom(room.id, { gameState: 'results' });
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const alivePlayers = room.players.filter(p => p.isAlive && !p.hasLeft);
  const allActivePlayers = room.players.filter(p => !p.hasLeft);
  const allPlayersGaveClues = checkAllPlayersGaveClues(room.players);

  // Show results component for results state
  if (room.gameState === 'results') {
    return <Results room={room} currentPlayer={currentPlayer} />;
  }

  // Show direct game ended message for finished state (when players quit)
  if (room.gameState === 'finished') {
    const goHome = () => {
      window.location.href = '/';
    };

    const playAgain = async () => {
      if (!currentPlayer.isHost) return;
      
      try {
        // Clear chat messages when starting a new game
        await clearChatMessages(room.id);
        
        const resetPlayers = room.players.map(player => ({
          ...player,
          isAlive: true,
          hasVoted: false,
          word: '',
          isImposter: false,
          clues: [],
          hasGivenClue: false,
          hasLeft: false
        }));
        
        await updateRoom(room.id, {
          players: resetPlayers,
          gameState: 'waiting',
          currentRound: 0,
          votes: {},
          usedWordPairs: [],
          winner: null,
          gameEndReason: ''
        });
      } catch (error) {
        console.error('Error restarting game:', error);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center max-w-md w-full border border-white/20">
          <div className="w-20 h-20 bg-yellow-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-8 h-8 text-yellow-300" />
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-4">Game Ended</h1>
          
          {room.winner && (
            <h2 className="text-2xl font-semibold text-yellow-300 mb-4">
              {room.winner === 'imposters' ? 'IMPOSTERS WIN!' : 
               room.winner === 'civilians' ? 'CIVILIANS WIN!' : ''}
            </h2>
          )}
          
          <p className="text-white/80 mb-6">
            {room.gameEndReason || 'The game has ended.'}
          </p>

          {/* Show player roles */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-3">Final Roles:</h3>
            {room.players.map(player => (
              <div key={player.id} className="flex justify-between items-center py-1 text-sm">
                <span className="text-white">{player.name}</span>
                <span className={`font-medium ${player.isImposter ? 'text-red-300' : 'text-blue-300'}`}>
                  {player.isImposter ? `IMPOSTER (${player.word})` : 'CIVILIAN'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
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
      </div>
    );
  }

  const renderGameState = () => {
    switch (room.gameState) {
      case 'clue':
        return (
          <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-4 mb-4">
            <h3 className="text-green-300 font-semibold mb-2">💡 Clue Phase</h3>
            <p className="text-white/80 text-sm">
              Give clues about your word without saying it directly. Try to sound convincing!
            </p>
          </div>
        );
      
      case 'voting':
        return (
          <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 mb-4">
            <h3 className="text-red-300 font-semibold mb-2">🗳️ Voting Phase</h3>
            <p className="text-white/80 text-sm">
              Vote for who you think is the imposter. Choose carefully!
            </p>
          </div>
        );
      
      case 'results':
        return (
          <div className="bg-purple-500/20 border border-purple-400/30 rounded-lg p-4 mb-4">
            <h3 className="text-purple-300 font-semibold mb-2">📊 Results</h3>
            <p className="text-white/80 text-sm">
              Revealing the votes and the imposter...
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (!currentPlayer.isAlive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Spectator Header */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <span className="text-red-400">👻</span> Spectator Mode
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-white/70 text-sm">Round {room.currentRound}</div>
                <div className="text-white/70 text-sm flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {alivePlayers.length} players remaining
                </div>
                {room.gameState === 'clue' && (
                  <div className="text-white/70 text-sm flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {alivePlayers.filter(p => (p.clues?.length || 0) > 0).length}/{alivePlayers.length} clues given
                  </div>
                )}
              </div>
            </div>

            {/* Spectator Progress Status - Middle */}
            <div className="flex-1 flex justify-center">
              {room.gameState === 'clue' && !allPlayersGaveClues && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg">
                  <Clock className="w-4 h-4" />
                  Waiting for remaining players to give clues...
                  <span className="font-semibold">
                    {alivePlayers.filter(p => (p.clues?.length || 0) > 0).length}/{alivePlayers.length}
                  </span>
                </div>
              )}

              {room.gameState === 'clue' && allPlayersGaveClues && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-300 rounded-lg">
                  ✓ All clues given! Voting phase starting...
                </div>
              )}

              {room.gameState === 'voting' && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg">
                  🗳️ Players are voting... Watch the cards for real-time updates!
                </div>
              )}
            </div>

            <button
              onClick={quitGame}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300 hover:text-red-200 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Leave Game
            </button>
          </div>

          {/* Spectator Info Banner */}
          <div className="bg-red-500/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-red-400/20">
            <div className="flex items-center justify-center gap-3">
              <span className="text-red-400 text-xl">💀</span>
              <div className="text-center">
                <h2 className="text-red-300 font-semibold">You've been eliminated!</h2>
                <p className="text-white/70 text-sm">Watch the remaining players and see how the game unfolds.</p>
              </div>
            </div>
          </div>

          {/* Game State for Spectators */}
          <div className="mb-6">
            {renderGameState()}
          </div>

          {/* Live Player Cards for Spectating */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {(() => {
              // Sort players to put current player first
              const sortedPlayers = [...room.players].sort((a, b) => {
                if (a.id === currentPlayer.id) return -1;
                if (b.id === currentPlayer.id) return 1;
                return 0;
              });
              return sortedPlayers.map(player => (
                <div key={player.id} className={`relative ${
                  !player.isAlive ? 'opacity-40' : ''
                }`}>
                  {player.id === currentPlayer.id && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-10">
                      You
                    </div>
                  )}
                  <PlayerCard
                    player={player}
                    currentPlayer={currentPlayer}
                    room={room}
                    onVote={() => {}} // Spectators can't vote
                    onAddClue={() => {}} // Spectators can't add clues
                    isVotingEnabled={false}
                    selectedVote={""}
                  />
                </div>
              ));
            })()}
          </div>


        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">BlackSheep Game</h1>
            <div className="flex items-center gap-4 mt-2">
              <div className="text-white/70 text-sm">Round {room.currentRound}</div>
              <div className="text-white/70 text-sm flex items-center gap-1">
                <Users className="w-4 h-4" />
                {alivePlayers.length} active players
              </div>
              {room.gameState === 'clue' && (
                <div className="text-white/70 text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {alivePlayers.filter(p => (p.clues?.length || 0) > 0).length}/{alivePlayers.length} clues given
                </div>
              )}
            </div>
          </div>

          {/* Game Progress Status - Middle */}
          <div className="flex-1 flex justify-center">
            {/* Progress Info */}
            {room.gameState === 'clue' && !allPlayersGaveClues && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg">
                <Clock className="w-4 h-4" />
                Waiting for all players to give clues...
                <span className="font-semibold">
                  {alivePlayers.filter(p => (p.clues?.length || 0) > 0).length}/{alivePlayers.length}
                </span>
              </div>
            )}

            {room.gameState === 'clue' && allPlayersGaveClues && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-300 rounded-lg">
                ✓ All clues given! Voting will start automatically...
              </div>
            )}

            {room.gameState === 'voting' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg">
                🗳️ Voting Phase - Select who you think is the imposter
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Reset Words Button (Host Only) */}
            {room.gameState === 'clue' && currentPlayer.isHost && (
              <button
                onClick={resetWords}
                disabled={isStartingVoting}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-300 hover:text-yellow-200 rounded-lg transition-colors disabled:cursor-not-allowed"
                title="Reset words if current ones are confusing"
              >
                {isStartingVoting ? (
                  <div className="w-4 h-4 border-2 border-yellow-300/30 border-t-yellow-300 rounded-full animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Reset Words
                  </>
                )}
              </button>
            )}
            <button
              onClick={quitGame}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300 hover:text-red-200 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Quit Game
            </button>
          </div>
        </div>

        {/* Word Section and Game State Row */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            {/* Player Word Section - Compact */}
            <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-lg md:w-64 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎯</span>
                <h2 className="text-sm font-semibold text-white">Your Word</h2>
              </div>
              <div 
                className={`relative text-lg font-bold p-2 rounded-lg min-h-[45px] flex items-center justify-center transition-all duration-300 cursor-pointer select-none group ${
                  currentPlayer.isImposter && room.showImposterRole
                    ? 'bg-gradient-to-br from-red-500/30 to-red-600/20 text-red-200 border border-red-400/40 hover:from-red-500/40 hover:to-red-600/30' 
                    : 'bg-gradient-to-br from-blue-500/30 to-cyan-600/20 text-blue-200 border border-blue-400/40 hover:from-blue-500/40 hover:to-cyan-600/30'
                } ${showWord ? 'scale-105 shadow-lg ring-2 ring-white/40' : 'hover:scale-102'}`}
                onMouseDown={() => setShowWord(true)}
                onMouseUp={() => setShowWord(false)}
                onMouseLeave={() => setShowWord(false)}
                onTouchStart={() => setShowWord(true)}
                onTouchEnd={() => setShowWord(false)}
                title="Hold to reveal your word"
              >
                {showWord ? (
                  <span className="font-black tracking-wide">{currentPlayer.word}</span>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-2xl opacity-60 group-hover:opacity-80 transition-opacity">👁️</div>
                    <span className="text-xs font-medium opacity-60 group-hover:opacity-80 transition-opacity">Hold to reveal</span>
                  </div>
                )}
                {currentPlayer.isImposter && room.showImposterRole && showWord && (
                  <div className="absolute -bottom-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                    🎭 IMPOSTER
                  </div>
                )}
              </div>
            </div>

            {/* Game State Banner - Expanded */}
            <div className="flex-1 min-w-0">
              {renderGameState()}
            </div>
          </div>
        </div>

        {/* Player Cards Grid */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(() => {
              // Sort players to put current player first
              const sortedPlayers = [...room.players].sort((a, b) => {
                if (a.id === currentPlayer.id) return -1;
                if (b.id === currentPlayer.id) return 1;
                return 0;
              });
              return sortedPlayers.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  currentPlayer={currentPlayer}
                  room={room}
                  onVote={handleVote}
                  onAddClue={handleAddClue}
                  isVotingEnabled={allPlayersGaveClues}
                  selectedVote={selectedVote}
                />
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}