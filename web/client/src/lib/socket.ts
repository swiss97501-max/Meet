import { io, Socket } from "socket.io-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Participant {
  socketId: string;
  username: string;
  roomId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

export interface RoomJoinedPayload {
  roomId: string;
  participants: Participant[];
}

export interface MediaStateChange {
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
}

// ─── Singleton socket instance ────────────────────────────────────────────────

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}
