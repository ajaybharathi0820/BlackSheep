'use client';

import { useState } from 'react';
import { Player, Room } from '@/types/game';
import { Vote, MessageSquare, Clock, CheckCircle, User, Send } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  currentPlayer: Player;
  room: Room;
  onVote: (votedPlayerId: string) => void;
  onAddClue: (clue: string) => void;
  isVotingEnabled: boolean;
  selectedVote: string;
}

export default function PlayerCard({
  player,
  currentPlayer,
  room,
  onVote,
  onAddClue,
  isVotingEnabled,
  selectedVote
}: PlayerCardProps) {
  const [newClue, setNewClue] = useState('');
  const [isAddingClue, setIsAddingClue] = useState(false);

  const isCurrentPlayer = player.id === currentPlayer.id;
  // Allow clue if it's current player, clue phase, player is alive, hasn't left, and hasn't given clue this round
  const canGiveClue = isCurrentPlayer && room.gameState === 'clue' && player.isAlive && !player.hasLeft && !player.hasGivenClue;
  const canVote = !isCurrentPlayer && player.isAlive && !player.hasLeft && room.gameState === 'voting' && isVotingEnabled && !currentPlayer.hasVoted;
  const isSelectedForVote = selectedVote === player.id;

  const handleAddClue = async () => {
    if (!newClue.trim() || !canGiveClue) return;
    
    setIsAddingClue(true);
    try {
      await onAddClue(newClue.trim());
      setNewClue('');
    } catch (error) {
      console.error('Error adding clue:', error);
    } finally {
      setIsAddingClue(false);
    }
  };

  const getCardBorderColor = () => {
    if (player.hasLeft) return 'border-orange-500/50 bg-orange-500/10 opacity-50';
    if (!player.isAlive) return 'border-gray-500/50 bg-gray-500/10 opacity-60';
    if (isCurrentPlayer) return 'border-blue-400/50 bg-blue-500/10';
    if (player.hasVoted && room.gameState === 'voting') return 'border-green-400/50 bg-green-500/10';
    if (isSelectedForVote) return 'border-red-400/50 bg-red-500/10';
    return 'border-white/20 bg-white/5';
  };

  const getPlayerStatus = () => {
    if (player.hasLeft) return { text: 'Left Game', color: 'text-orange-400', icon: '🚪' };
    if (!player.isAlive) return { text: 'Eliminated', color: 'text-red-400', icon: '❌' };
    if (room.gameState === 'voting' && player.hasVoted) return { text: 'Voted', color: 'text-green-400', icon: '✓' };
    if (room.gameState === 'clue' && player.isAlive && (player.clues?.length || 0) > 0) return { text: 'Clue Given', color: 'text-blue-400', icon: '💡' };
    if (room.gameState === 'clue' && player.isAlive && (player.clues?.length || 0) === 0) return { text: 'Thinking...', color: 'text-yellow-400', icon: '🤔' };
    return { text: 'Ready', color: 'text-white/60', icon: '👤' };
  };

  const status = getPlayerStatus();

  return (
    <div className={`rounded-2xl border-2 transition-all duration-200 ${getCardBorderColor()}`}>
      {/* Player Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">
                {player.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-white font-semibold">
                {player.name}
                {isCurrentPlayer && <span className="text-blue-300 text-sm ml-1">(You)</span>}
              </h3>
              <div className="flex items-center gap-1">
                <span className="text-xs">{status.icon}</span>
                <span className={`text-xs ${status.color}`}>{status.text}</span>
              </div>
            </div>
          </div>
          
          {/* Vote Button */}
          {canVote && (
            <button
              onClick={() => onVote(player.id)}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                isSelectedForVote
                  ? 'bg-red-500 hover:bg-red-600 text-white scale-105'
                  : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200'
              }`}
            >
              <Vote className="w-4 h-4" />
              {isSelectedForVote ? 'Selected' : 'Vote'}
            </button>
          )}

          {/* Vote Status for Others */}
          {room.gameState === 'voting' && player.hasVoted && !canVote && (
            <div className="px-3 py-2 bg-green-500/20 text-green-300 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Voted
            </div>
          )}
        </div>
      </div>

      {/* Clues Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white/80 text-sm font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Clues ({player.clues?.length || 0})
            {room.currentRound > 1 && (
              <span className="text-xs text-white/50">• Round {room.currentRound}</span>
            )}
          </h4>
          {player.clues?.length > 0 && (
            <div className="text-xs text-white/50">
              {player.clues.length === room.currentRound ? 'Complete' : 'Incomplete'}
            </div>
          )}
        </div>

        {/* Clues List */}
        <div className="space-y-2 mb-3 min-h-[80px]">
          {player.clues && player.clues.length > 0 ? (
            [...player.clues].reverse().map((clue, reverseIndex) => {
              const originalIndex = player.clues.length - 1 - reverseIndex;
              const isLatestClue = originalIndex === player.clues.length - 1;
              const roundNumber = originalIndex + 1;
              return (
                <div
                  key={originalIndex}
                  className={`p-2 rounded-lg text-sm transition-all duration-200 ${
                    isLatestClue && room.currentRound === roundNumber
                      ? 'bg-blue-500/20 border border-blue-400/30 text-blue-200 font-medium' // Current round clue
                      : isLatestClue
                      ? 'bg-green-500/20 border border-green-400/30 text-green-200 font-medium' // Latest from previous round
                      : 'bg-white/5 text-white/70 border-l-2 border-white/20' // Older clues
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{clue}</span>
                    <span className="text-xs opacity-60 ml-2">
                      R{roundNumber}
                      {isLatestClue && room.currentRound === roundNumber && ' (Current)'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-white/40 py-6 text-sm">
              {isCurrentPlayer ? 'Add your clue below' : 'No clues yet'}
            </div>
          )}
        </div>

        {/* Add Clue Input (for current player only) */}
        {canGiveClue && (
          <div className="relative">
            <input
              type="text"
              value={newClue}
              onChange={(e) => setNewClue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddClue()}
              placeholder="Give a clue about your word..."
              className="w-full px-3 py-2 pr-12 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              maxLength={100}
              disabled={isAddingClue}
            />
            <button
              onClick={handleAddClue}
              disabled={!newClue.trim() || isAddingClue}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:from-gray-500 disabled:to-gray-600 text-white transition duration-200 disabled:cursor-not-allowed"
            >
              {isAddingClue ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        )}


      </div>
    </div>
  );
}