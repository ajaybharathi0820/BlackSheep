'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Room } from '@/types/game';
import { subscribeToRoom, updateRoom } from '@/utils/firebaseUtils';
import Lobby from '@/components/Lobby';
import GameBoard from '@/components/GameBoard';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get player ID from localStorage
    const storedPlayerId = localStorage.getItem('playerId');
    const storedPlayerName = localStorage.getItem('playerName');
    
    if (!storedPlayerId || !storedPlayerName) {
      router.push('/');
      return;
    }
    
    setPlayerId(storedPlayerId);

    // Subscribe to room updates
    const unsubscribe = subscribeToRoom(roomId, (updatedRoom) => {
      setRoom(updatedRoom);
      setLoading(false);
      
      if (!updatedRoom) {
        // Room was deleted or doesn't exist
        router.push('/');
        return;
      }
      
      // Check if current player is still in the room
      const currentPlayer = updatedRoom.players.find(p => p.id === storedPlayerId);
      if (!currentPlayer) {
        router.push('/');
        return;
      }
      
      // Auto-end game if too few players remain during active gameplay
      if (updatedRoom.gameState !== 'waiting' && updatedRoom.gameState !== 'finished') {
        const alivePlayers = updatedRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
          updateRoom(roomId, { gameState: 'finished' }).catch(console.error);
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span className="text-white text-lg">Loading room...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!room || !playerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center">
          <p className="text-white text-lg">Room not found</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const currentPlayer = room.players.find(p => p.id === playerId);
  if (!currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center">
          <p className="text-white text-lg">You are not in this room</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Render appropriate component based on game state
  if (room.gameState === 'waiting') {
    return <Lobby room={room} currentPlayer={currentPlayer} />;
  } else {
    return <GameBoard room={room} currentPlayer={currentPlayer} />;
  }
}