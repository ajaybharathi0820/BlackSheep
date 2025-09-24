'use client';

import { useState } from 'react';
import { Copy, Users, Play, LogOut } from 'lucide-react';
import { Room, Player } from '@/types/game';
import { updateRoom } from '@/utils/firebaseUtils';
import { selectRandomImposter } from '@/utils/gameUtils';
import { getUnusedWordPair } from '@/data/words';

interface LobbyProps {
  room: Room;
  currentPlayer: Player;
}

export default function Lobby({ room, currentPlayer }: LobbyProps) {
  const [isStarting, setIsStarting] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.id);
    // You could add a toast notification here
  };

  const startGame = async () => {
    if (!currentPlayer.isHost || room.players.length < 4) return;

    setIsStarting(true);
    try {
      // Select random imposter
      const alivePlayers = room.players.filter(p => p.isAlive);
      const imposterPlayer = selectRandomImposter(alivePlayers.map(p => p.id));
      
      // Get unused word pair
      const wordPair = getUnusedWordPair(room.usedWordPairs || []);
      
      // Assign words to players
      const updatedPlayers = room.players.map(player => ({
        ...player,
        isImposter: player.id === imposterPlayer,
        word: player.id === imposterPlayer ? wordPair.imposter : wordPair.main,
        hasVoted: false
      }));

      // Add used word pair to the list
      const updatedUsedWordPairs = [...(room.usedWordPairs || []), wordPair.category];

      await updateRoom(room.id, {
        gameState: 'clue',
        players: updatedPlayers,
        currentRound: 1,
        votes: {},
        startedAt: new Date(),
        usedWordPairs: updatedUsedWordPairs
      });
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const leaveRoom = () => {
    if (currentPlayer.isHost) {
      if (confirm('Are you sure you want to leave? This will close the room for everyone.')) {
        // Host leaving - could implement room deletion here
        window.location.href = '/';
      }
    } else {
      if (confirm('Are you sure you want to leave the room?')) {
        // Non-host leaving - could implement player removal here
        window.location.href = '/';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Room Lobby</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/80">Room Code:</span>
                <code className="bg-white/20 px-3 py-1 rounded text-white font-mono text-lg">
                  {room.id}
                </code>
                <button
                  onClick={copyRoomCode}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Copy room code"
                >
                  <Copy className="w-4 h-4 text-white/80" />
                </button>
              </div>
            </div>
            <button
              onClick={leaveRoom}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-300 hover:text-red-200"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/80">
              <Users className="w-4 h-4" />
              <span>{room.players.length}/{room.maxPlayers} players</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/60">Imposter Role</div>
              <div className={`text-xs font-medium ${room.showImposterRole ? 'text-red-300' : 'text-blue-300'}`}>
                {room.showImposterRole ? 'Revealed' : 'Hidden'}
              </div>
            </div>
          </div>
        </div>

        {/* Players List */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">Players</h2>
          <div className="grid gap-3">
            {room.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  player.isHost 
                    ? 'bg-yellow-500/20 border border-yellow-400/30' 
                    : 'bg-white/5'
                } ${
                  player.id === currentPlayer.id ? 'ring-2 ring-white/30' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {player.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {player.name}
                      {player.id === currentPlayer.id && (
                        <span className="text-blue-300 text-sm ml-1">(You)</span>
                      )}
                    </div>
                  </div>
                </div>
                {player.isHost && (
                  <span className="text-yellow-300 text-sm font-medium px-2 py-1 bg-yellow-500/20 rounded">
                    Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game Rules */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">How to Play</h2>
          <div className="text-white/80 space-y-2 text-sm">
            <p>• One player will be secretly assigned as the <span className="text-red-300 font-medium">imposter</span></p>
            <p>• Everyone else gets the same word, the imposter gets a different but related word</p>
            <p>• Give clues about your word without saying it directly</p>
            <p>• Vote to eliminate who you think is the imposter</p>
            <p>• Imposter wins if they survive until only 2 players remain</p>
            {!room.showImposterRole && (
              <p className="text-yellow-300">• <strong>Hidden Mode:</strong> Imposters don't know they are imposters!</p>
            )}
            <p className="text-blue-300">• <strong>No Repeats:</strong> Word pairs won't repeat until all 290+ are used!</p>
          </div>
        </div>

        {/* Start Game Button */}
        {currentPlayer.isHost && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <button
              onClick={startGame}
              disabled={room.players.length < 4 || isStarting}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-4 px-6 rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  {room.players.length < 4 
                    ? `Need ${4 - room.players.length} more players` 
                    : 'Start Game'
                  }
                </>
              )}
            </button>
          </div>
        )}

        {!currentPlayer.isHost && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center">
            <p className="text-white/80">Waiting for the host to start the game...</p>
          </div>
        )}
      </div>
    </div>
  );
}