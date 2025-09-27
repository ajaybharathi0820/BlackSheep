'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, LogIn } from 'lucide-react';
import { getRoom, updateRoom } from '@/utils/firebaseUtils';
import { generatePlayerId } from '@/utils/gameUtils';
import { Player } from '@/types/game';

interface JoinRoomModalProps {
  onClose: () => void;
}

export default function JoinRoomModal({ onClose }: JoinRoomModalProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return;

    setIsJoining(true);
    setError('');

    try {
      const room = await getRoom(roomCode.toUpperCase());
      
      if (!room) {
        setError('Room not found. Please check the room code.');
        return;
      }

      if (room.gameState !== 'waiting') {
        setError('Game has already started. Cannot join now.');
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        setError('Room is full. Cannot join.');
        return;
      }

      // Check if name is already taken
      const nameExists = room.players.some(
        player => player.name.toLowerCase() === playerName.trim().toLowerCase()
      );

      if (nameExists) {
        setError('Name is already taken. Please choose a different name.');
        return;
      }

      const playerId = generatePlayerId();
      const newPlayer: Player = {
        id: playerId,
        name: playerName.trim(),
        isHost: false,
        isAlive: true,
        isImposter: false,
        word: '',
        hasVoted: false,
        clues: [],
        hasGivenClue: false,
        hasLeft: false
      };

      // Add player to room
      await updateRoom(room.id, {
        players: [...room.players, newPlayer]
      });

      // Store player info in localStorage
      localStorage.setItem('playerId', playerId);
      localStorage.setItem('playerName', playerName.trim());

      router.push(`/room/${roomCode.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      setError('Failed to join room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Join Room</h2>
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
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center font-mono text-lg tracking-widest"
              placeholder="ABCD12"
              maxLength={6}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleJoinRoom}
            disabled={!playerName.trim() || !roomCode.trim() || isJoining}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isJoining ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Join Room
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}