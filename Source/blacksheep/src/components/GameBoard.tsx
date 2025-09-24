'use client';

import { useState, useEffect } from 'react';
import { Room, Player, ChatMessage } from '@/types/game';
import { updateRoom, sendChatMessage, subscribeToChatMessages, clearChatMessages } from '@/utils/firebaseUtils';
import { deleteField } from 'firebase/firestore';
import { MessageCircle, Vote, RefreshCw, LogOut, Trophy, Home } from 'lucide-react';
import Results from './Results';

interface GameBoardProps {
  room: Room;
  currentPlayer: Player;
}

export default function GameBoard({ room, currentPlayer }: GameBoardProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showWord, setShowWord] = useState(false); // Changed to false by default
  const [selectedVote, setSelectedVote] = useState<string>('');
  const [isVoting, setIsVoting] = useState(false);
  const [isStartingVoting, setIsStartingVoting] = useState(false);

  useEffect(() => {
    // Subscribe to chat messages
    const unsubscribe = subscribeToChatMessages(room.id, setChatMessages);
    return () => unsubscribe();
  }, [room.id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || room.gameState !== 'clue') return;

    try {
      await sendChatMessage(room.id, {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        message: newMessage.trim(),
        round: room.currentRound
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
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
        
        // Assign new words to players
        const updatedPlayers = room.players.map(player => ({
          ...player,
          isImposter: player.id === imposterPlayer,
          word: player.id === imposterPlayer ? wordPair.imposter : wordPair.main,
          hasVoted: false
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
    if (confirm('Are you sure you want to quit the game? You will return to the home page.')) {
      try {
        // Remove player from the room
        const updatedPlayers = room.players.filter(p => p.id !== currentPlayer.id);
        
        if (updatedPlayers.length === 0) {
          // If no players left, we could delete the room
          // For now, just update with empty players array
          await updateRoom(room.id, {
            players: updatedPlayers
          });
        } else {
          // If current player was the host, transfer host to another player
          const needNewHost = currentPlayer.isHost;
          const finalPlayers = needNewHost && updatedPlayers.length > 0
            ? updatedPlayers.map((player, index) => 
                index === 0 ? { ...player, isHost: true } : player
              )
            : updatedPlayers;
          
          // Check if there are 2 or fewer players left after quitting
          const alivePlayers = finalPlayers.filter(p => p.isAlive);
          
          if (alivePlayers.length <= 2) {
            // Determine winner based on who's left
            const aliveImposters = alivePlayers.filter(p => p.isImposter);
            let winner: 'imposters' | 'civilians' | null = null;
            let reason = '';
            
            if (aliveImposters.length > 0) {
              winner = 'imposters';
              reason = 'The imposter survived - imposters win!';
            } else if (alivePlayers.length === 0) {
              winner = null;
              reason = 'All players left the game.';
            } else {
              winner = 'civilians';
              reason = 'All imposters eliminated - civilians win!';
            }
            
            // End the game with proper winner determination
            await updateRoom(room.id, {
              players: finalPlayers,
              gameState: 'finished',
              winner: winner,
              gameEndReason: reason
            });
          } else {
            await updateRoom(room.id, {
              players: finalPlayers
            });
          }
        }
        
        // Clear localStorage and go home
        localStorage.removeItem('playerId');
        localStorage.removeItem('playerName');
        window.location.href = '/';
      } catch (error) {
        console.error('Error quitting game:', error);
        // Still go home even if there's an error
        window.location.href = '/';
      }
    }
  };

  const submitVote = async () => {
    if (!selectedVote || room.gameState !== 'voting') return;

    setIsVoting(true);
    try {
      const updatedVotes = { ...room.votes, [currentPlayer.id]: selectedVote };
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

  const alivePlayers = room.players.filter(p => p.isAlive);
  const votableePlayers = alivePlayers.filter(p => p.id !== currentPlayer.id);

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
          isImposter: false
        }));
        
        await updateRoom(room.id, {
          players: resetPlayers,
          gameState: 'waiting',
          currentRound: 0,
          votes: {},
          usedWordPairs: [],
          winner: deleteField(),
          gameEndReason: deleteField()
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
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center border border-white/20">
            <h1 className="text-2xl font-bold text-white mb-4">You've been eliminated!</h1>
            <p className="text-white/80 mb-6">Watch the remaining players continue the game.</p>
            
            {/* Show spectator view */}
            <div className="mt-6 bg-white/5 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">Remaining Players</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {alivePlayers.map(player => (
                  <div key={player.id} className="bg-white/10 px-3 py-1 rounded-full">
                    <span className="text-white text-sm">{player.name}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Quit Button for Eliminated Players */}
            <div className="mt-6">
              <button
                onClick={quitGame}
                className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300 hover:text-red-200 rounded-lg transition-colors mx-auto"
              >
                <LogOut className="w-4 h-4" />
                Quit Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Quit Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">BlackSheep Game</h1>
          <button
            onClick={quitGame}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300 hover:text-red-200 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Quit Game
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Panel - Game Info */}
        <div className="space-y-4">
          {/* Your Word */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <h2 className="text-lg font-semibold text-white mb-3">Your Word</h2>
            <div className="text-center">
              <div 
                className={`text-2xl font-bold p-4 rounded-lg min-h-[80px] flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                  currentPlayer.isImposter && room.showImposterRole
                    ? 'bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30' 
                    : 'bg-blue-500/20 text-blue-300 border border-blue-400/30 hover:bg-blue-500/30'
                } ${showWord ? 'scale-105 ring-2 ring-white/30' : ''}`}
                onMouseDown={() => setShowWord(true)}
                onMouseUp={() => setShowWord(false)}
                onMouseLeave={() => setShowWord(false)}
                onTouchStart={() => setShowWord(true)}
                onTouchEnd={() => setShowWord(false)}
                title="Hold to reveal your word"
              >
                {showWord ? currentPlayer.word : (
                  <div className="flex flex-col items-center gap-2 text-white/50">
                    <span className="text-4xl">👁️</span>
                    <span className="text-sm">Hold to reveal</span>
                  </div>
                )}
              </div>
              {currentPlayer.isImposter && room.showImposterRole && (
                <p className="text-red-300 text-sm mt-2 font-medium">🎭 You are the imposter!</p>
              )}
              {!showWord && (
                <p className="text-white/50 text-xs mt-2">
                  Hold the area above to see your word
                </p>
              )}
            </div>
          </div>

          {/* Players */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <h2 className="text-lg font-semibold text-white mb-3">
              Players ({alivePlayers.length})
            </h2>
            <div className="space-y-2">
              {room.players.map(player => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    !player.isAlive 
                      ? 'opacity-50 bg-gray-500/20' 
                      : player.hasVoted && room.gameState === 'voting'
                        ? 'bg-green-500/20'
                        : 'bg-white/5'
                  }`}
                >
                  <span className={`${
                    player.id === currentPlayer.id ? 'text-yellow-300 font-medium' : 'text-white'
                  }`}>
                    {player.name}
                    {player.id === currentPlayer.id && ' (You)'}
                    {!player.isAlive && ' ❌'}
                  </span>
                  {player.hasVoted && room.gameState === 'voting' && (
                    <span className="text-green-300 text-sm">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Voting Panel */}
          {room.gameState === 'voting' && !currentPlayer.hasVoted && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <h2 className="text-lg font-semibold text-white mb-3">Cast Your Vote</h2>
              <div className="space-y-2 mb-4">
                {votableePlayers.map(player => (
                  <label
                    key={player.id}
                    className="flex items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="vote"
                      value={player.id}
                      checked={selectedVote === player.id}
                      onChange={(e) => setSelectedVote(e.target.value)}
                      className="mr-3 accent-red-500"
                    />
                    <span className="text-white">{player.name}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={submitVote}
                disabled={!selectedVote || isVoting}
                className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:cursor-not-allowed"
              >
                {isVoting ? 'Voting...' : 'Submit Vote'}
              </button>
            </div>
          )}

          {/* Reset Words Button (Host Only) */}
          {room.gameState === 'clue' && currentPlayer.isHost && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <button
                onClick={resetWords}
                disabled={isStartingVoting}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {isStartingVoting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Reset Words
                  </>
                )}
              </button>
              <p className="text-white/60 text-xs mt-2 text-center">
                Get new words if current ones are confusing
              </p>
            </div>
          )}

          {/* Start Voting Button */}
          {room.gameState === 'clue' && (() => {
            const originalHost = room.players.find(p => p.isHost);
            const canStartVoting = currentPlayer.isHost || (originalHost && !originalHost.isAlive);
            return canStartVoting;
          })() && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <button
                onClick={startVotingPhase}
                disabled={isStartingVoting}
                className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {isStartingVoting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Vote className="w-4 h-4" />
                    Start Voting Phase
                  </>
                )}
              </button>
              <p className="text-white/60 text-xs mt-2 text-center">
                {(() => {
                  const originalHost = room.players.find(p => p.isHost);
                  const isHostEliminated = originalHost && !originalHost.isAlive;
                  return isHostEliminated && !currentPlayer.isHost 
                    ? "Host eliminated - any player can start voting"
                    : "Click when discussion is complete";
                })()}
              </p>
            </div>
          )}
        </div>

        {/* Right Panel - Chat */}
        <div className="lg:col-span-2">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 h-[600px] flex flex-col">
            
            {/* Game State Header */}
            <div className="p-4 border-b border-white/20">
              {renderGameState()}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Game Chat
                </h2>
                <span className="text-white/60 text-sm">Round {room.currentRound}</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages
                .map(message => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.playerId === currentPlayer.id
                      ? 'bg-blue-500/20 ml-8'
                      : 'bg-white/5 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white text-sm">
                      {message.playerName}
                      {message.playerId === currentPlayer.id && ' (You)'}
                    </span>
                    <span className="text-white/50 text-xs">
                      {message.timestamp instanceof Date 
                        ? message.timestamp.toLocaleTimeString()
                        : new Date((message.timestamp as any).seconds * 1000).toLocaleTimeString()
                      }
                    </span>
                  </div>
                  <p className="text-white/90">{message.message}</p>
                </div>
              ))}
            </div>

            {/* Message Input */}
            {room.gameState === 'clue' && (
              <div className="p-4 border-t border-white/20">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Give a clue about your word..."
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    maxLength={100}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-medium rounded-lg transition duration-200 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}