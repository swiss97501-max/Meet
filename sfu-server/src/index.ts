import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import * as mediasoup from "mediasoup";
import pino from "pino";
import dotenv from "dotenv";

dotenv.config();

const logger = pino(
  process.env.NODE_ENV === "production"
    ? undefined
    : { transport: { target: "pino-pretty" } }
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Room {
  router: mediasoup.types.Router;
  peers: Map<string, Peer>;
}

interface Peer {
  socketId: string;
  producerTransport?: mediasoup.types.Transport;
  consumerTransport?: mediasoup.types.Transport;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
}

// ─── Global state ─────────────────────────────────────────────────────────────

let mediasoupWorker: mediasoup.types.Worker;
const rooms = new Map<string, Room>();

// ─── Initialize mediasoup ─────────────────────────────────────────────────────

async function initializeMediasoup() {
  const { createWorker } = mediasoup;

  mediasoupWorker = await createWorker({
    logLevel: "warn",
    logTags: ["rtp", "rtcp", "rtx", "bwe"],
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  mediasoupWorker.on("died", () => {
    logger.error("mediasoup worker died, exiting in 2 seconds");
    setTimeout(() => process.exit(1), 2000);
  });

  logger.info("mediasoup worker initialized");
}

// ─── Get or create room ───────────────────────────────────────────────────────

async function getOrCreateRoom(roomId: string): Promise<Room> {
  if (rooms.has(roomId)) {
    return rooms.get(roomId)!;
  }

  const router = await mediasoupWorker.createRouter({
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/VP9",
        clockRate: 90000,
        parameters: {
          "profile-id": 0,
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
          "level-asymmetry-allowed": 1,
          "packetization-mode": 1,
          "profile-level-id": "4d0032",
          "x-google-start-bitrate": 1000,
        },
      },
    ],
  });

  const room: Room = {
    router,
    peers: new Map(),
  };

  rooms.set(roomId, room);
  logger.info({ roomId }, "room created");

  return room;
}

// ─── Express & Socket.IO setup ────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Socket.IO handlers ───────────────────────────────────────────────────────

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "client connected");

  socket.on("join-room", async (data: { roomId: string; username: string }) => {
    const { roomId, username } = data;

    socket.join(roomId);

    const room = await getOrCreateRoom(roomId);
    const peer: Peer = {
      socketId: socket.id,
      producers: new Map(),
      consumers: new Map(),
    };

    room.peers.set(socket.id, peer);

    // Notify others
    socket.to(roomId).emit("peer-joined", {
      peerId: socket.id,
      username,
    });

    // Send existing peers to new user
    const existingPeers = Array.from(room.peers.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id]) => id);

    socket.emit("existing-peers", { peers: existingPeers });

    logger.info({ roomId, socketId: socket.id, username }, "peer joined room");
  });

  socket.on("create-producer-transport", async (data: { roomId: string }) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    const peer = room.peers.get(socket.id);
    if (!peer) {
      socket.emit("error", "Peer not found");
      return;
    }

    try {
      const transport = await room.router.createWebRtcTransport({
        listenIps: [{ ip: process.env.MEDIASOUP_LISTEN_IP || "127.0.0.1" }],
        enableUdp: true,
        enableTcp: true,
      });

      peer.producerTransport = transport;

      transport.on("dtlsstatechange", (dtlsState) => {
        if (dtlsState === "failed") {
          logger.warn({ socketId: socket.id }, "producer transport dtls failed");
          transport.close();
        }
      });

      socket.emit("producer-transport-created", {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (error) {
      logger.error({ error }, "failed to create producer transport");
      socket.emit("error", "Failed to create producer transport");
    }
  });

  socket.on("connect-producer-transport", async (data: { roomId: string; dtlsParameters: any }) => {
    const { roomId, dtlsParameters } = data;
    const room = rooms.get(roomId);
    const peer = room?.peers.get(socket.id);

    if (!peer?.producerTransport) {
      socket.emit("error", "Producer transport not found");
      return;
    }

    try {
      await peer.producerTransport.connect({ dtlsParameters });
      socket.emit("producer-transport-connected");
    } catch (error) {
      logger.error({ error }, "failed to connect producer transport");
      socket.emit("error", "Failed to connect producer transport");
    }
  });

  socket.on("produce", async (data: { roomId: string; kind: string; rtpParameters: any }) => {
    const { roomId, kind, rtpParameters } = data;
    const room = rooms.get(roomId);
    const peer = room?.peers.get(socket.id);

    if (!peer?.producerTransport) {
      socket.emit("error", "Producer transport not found");
      return;
    }

    try {
      const producer = await peer.producerTransport.produce({
        kind: kind as "audio" | "video",
        rtpParameters,
      });

      peer.producers.set(producer.id, producer);

      socket.emit("producer-created", { producerId: producer.id });

      // Notify others about new producer
      socket.to(roomId).emit("new-producer", {
        peerId: socket.id,
        producerId: producer.id,
        kind,
      });

      logger.info({ socketId: socket.id, producerId: producer.id, kind }, "producer created");
    } catch (error) {
      logger.error({ error }, "failed to produce");
      socket.emit("error", "Failed to produce");
    }
  });

  socket.on("disconnect", () => {
    // Clean up peer from all rooms
    rooms.forEach((room, roomId) => {
      const peer = room.peers.get(socket.id);
      if (peer) {
        // Close all producers and consumers
        peer.producers.forEach((producer) => producer.close());
        peer.consumers.forEach((consumer) => consumer.close());

        // Close transports
        peer.producerTransport?.close();
        peer.consumerTransport?.close();

        room.peers.delete(socket.id);

        // Notify others
        io.to(roomId).emit("peer-left", { peerId: socket.id });

        // Clean up empty rooms
        if (room.peers.size === 0) {
          room.router.close();
          rooms.delete(roomId);
          logger.info({ roomId }, "room closed");
        }
      }
    });

    logger.info({ socketId: socket.id }, "client disconnected");
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────

async function start() {
  await initializeMediasoup();

  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, "SFU server listening");
  });
}

start().catch((error) => {
  logger.error({ error }, "failed to start server");
  process.exit(1);
});
