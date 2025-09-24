'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Users } from 'lucide-react';
import { generateRoomCode, generatePlayerId } from '@/utils/gameUtils';
import { createRoom } from '@/utils/firebaseUtils';
import { Player } from '@/types/game';

interface CreateRoomModalProps {
  onClose: () => void;
}

export default function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const [playerName, setPlayerName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [showImposterRole, setShowImposterRole] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreateRoom = async () => {
    if (!playerName.trim()) return;

    setIsCreating(true);
    try {
      const roomCode = generateRoomCode();
      const hostId = generatePlayerId();

      const hostPlayer: Player = {
        id: hostId,
        name: playerName.trim(),
        isHost: true,
        isAlive: true,
        isImposter: false,
        word: '',
        hasVoted: false
      };

      const roomId = await createRoom(roomCode, {
        hostId,
        players: [hostPlayer],
        maxPlayers,
        gameState: 'waiting',
        currentRound: 0,
        votes: {},
        showImposterRole,
        usedWordPairs: []
      });

      // Store player info in localStorage
      localStorage.setItem('playerId', hostId);
      localStorage.setItem('playerName', playerName.trim());

      router.push(`/room/${roomCode}`);
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create Room</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Players
            </label>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {[4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num}>
                  {num} players
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showImposterRole}
                onChange={(e) => setShowImposterRole(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Show Imposter Role
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  If enabled, imposters will know they are imposters. If disabled, imposters won&apos;t know their role.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateRoom}
            disabled={!playerName.trim() || isCreating}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Users className="w-4 h-4" />
                Create Room
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}