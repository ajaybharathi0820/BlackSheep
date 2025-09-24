import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs,
  onSnapshot, 
  query, 
  where, 
  orderBy,
  Timestamp,
  deleteField,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Room, Player, ChatMessage } from '@/types/game';

// Room operations
export async function createRoom(roomCode: string, room: Omit<Room, 'id' | 'createdAt'>): Promise<string> {
  const roomRef = doc(db, 'rooms', roomCode);
  await setDoc(roomRef, {
    ...room,
    createdAt: Timestamp.now()
  });
  return roomCode;
}

export async function updateRoom(roomId: string, updates: Partial<Room>): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, updates);
}

export async function resetRoomForNewGame(roomId: string, updates: Partial<Room>): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    ...updates,
    startedAt: deleteField() // This will remove the startedAt field entirely
  });
}

export async function deleteRoom(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  await deleteDoc(roomRef);
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const roomRef = doc(db, 'rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  
  if (roomSnap.exists()) {
    return { id: roomSnap.id, ...roomSnap.data() } as Room;
  }
  return null;
}

export function subscribeToRoom(roomId: string, callback: (room: Room | null) => void): () => void {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(roomRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Room);
    } else {
      callback(null);
    }
  });
}

// Chat operations
export async function sendChatMessage(
  roomId: string, 
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<void> {
  await addDoc(collection(db, 'rooms', roomId, 'messages'), {
    ...message,
    timestamp: Timestamp.now()
  });
}

export function subscribeToChatMessages(
  roomId: string, 
  callback: (messages: ChatMessage[]) => void
): () => void {
  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
    });
    callback(messages);
  });
}

export async function clearChatMessages(roomId: string): Promise<void> {
  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  const q = query(messagesRef);
  const snapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  snapshot.docs.forEach((docRef) => {
    batch.delete(docRef.ref);
  });
  
  await batch.commit();
}