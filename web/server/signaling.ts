import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Participant {
  socketId: string;
  username: string;
  roomId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

interface Room {
  id: string;
  participants: Map<string, Participant>;
  createdAt: number;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      participants: new Map(),
      createdAt: Date.now(),
    });
  }
  return rooms.get(roomId)!;
}

function cleanupRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (room && room.participants.size === 0) {
    rooms.delete(roomId);
  }
}

// ─── Signaling server setup ───────────────────────────────────────────────────

export function setupSignalingServer(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ── Join Room ──────────────────────────────────────────────────────────
    socket.on("join-room", ({ roomId, username }: { roomId: string; username: string }) => {
      if (!roomId || !username) return;

      const room = getOrCreateRoom(roomId);

      const participant: Participant = {
        socketId: socket.id,
        username: username.trim().slice(0, 32),
        roomId,
        isMuted: false,
        isCameraOff: false,
        isScreenSharing: false,
      };

      room.participants.set(socket.id, participant);
      socket.join(roomId);

      // Tell the new participant who is already in the room
      const existingParticipants = Array.from(room.participants.values()).filter(
        (p) => p.socketId !== socket.id
      );

      socket.emit("room-joined", {
        roomId,
        participants: existingParticipants,
      });

      // Tell everyone else that a new participant joined
      socket.to(roomId).emit("participant-joined", participant);

      console.log(`[Room ${roomId}] ${username} joined (${room.participants.size} total)`);
    });

    // ── WebRTC Signaling ───────────────────────────────────────────────────

    // Forward offer to target peer
    socket.on(
      "webrtc-offer",
      ({ targetSocketId, offer }: { targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
        socket.to(targetSocketId).emit("webrtc-offer", {
          fromSocketId: socket.id,
          offer,
        });
      }
    );

    // Forward answer to target peer
    socket.on(
      "webrtc-answer",
      ({
        targetSocketId,
        answer,
      }: {
        targetSocketId: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        socket.to(targetSocketId).emit("webrtc-answer", {
          fromSocketId: socket.id,
          answer,
        });
      }
    );

    // Forward ICE candidate to target peer
    socket.on(
      "ice-candidate",
      ({
        targetSocketId,
        candidate,
      }: {
        targetSocketId: string;
        candidate: RTCIceCandidateInit;
      }) => {
        socket.to(targetSocketId).emit("ice-candidate", {
          fromSocketId: socket.id,
          candidate,
        });
      }
    );

    // ── Media State Changes ────────────────────────────────────────────────

    socket.on(
      "media-state-change",
      ({
        isMuted,
        isCameraOff,
        isScreenSharing,
      }: {
        isMuted?: boolean;
        isCameraOff?: boolean;
        isScreenSharing?: boolean;
      }) => {
        // Find participant's room
        let participantRoomId: string | null = null;
        for (const [rid, room] of Array.from(rooms.entries())) {
          if (room.participants.has(socket.id)) {
            participantRoomId = rid;
            const p = room.participants.get(socket.id)!;
            if (isMuted !== undefined) p.isMuted = isMuted;
            if (isCameraOff !== undefined) p.isCameraOff = isCameraOff;
            if (isScreenSharing !== undefined) p.isScreenSharing = isScreenSharing;
            break;
          }
        }

        if (participantRoomId) {
          socket.to(participantRoomId).emit("participant-media-changed", {
            socketId: socket.id,
            isMuted,
            isCameraOff,
            isScreenSharing,
          });
        }
      }
    );

    // ── Disconnect ─────────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      for (const [roomId, room] of Array.from(rooms.entries())) {
        if (room.participants.has(socket.id)) {
          const participant = room.participants.get(socket.id)!;
          room.participants.delete(socket.id);

          // Notify remaining participants
          io.to(roomId).emit("participant-left", { socketId: socket.id });

          console.log(
            `[Room ${roomId}] ${participant.username} left (${room.participants.size} remaining)`
          );

          cleanupRoom(roomId);
          break;
        }
      }

      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });

    // ── Leave Room (explicit) ──────────────────────────────────────────────

    socket.on("leave-room", () => {
      for (const [roomId, room] of Array.from(rooms.entries())) {
        if (room.participants.has(socket.id)) {
          const participant = room.participants.get(socket.id)!;
          room.participants.delete(socket.id);
          socket.leave(roomId);

          io.to(roomId).emit("participant-left", { socketId: socket.id });

          console.log(`[Room ${roomId}] ${participant.username} left explicitly`);

          cleanupRoom(roomId);
          break;
        }
      }
    });
  });

  console.log("[Signaling] Socket.IO server initialized at /api/socket.io");
  return io;
}
