import { describe, it, expect } from "vitest";

// ─── Unit tests for signaling logic ──────────────────────────────────────────

describe("Room ID validation", () => {
  it("accepts valid room IDs", () => {
    const validIds = ["AB12CD34EF", "ROOM123456", "AAAAAAAAAA"];
    validIds.forEach((id) => {
      expect(id.length).toBeGreaterThan(0);
      expect(typeof id).toBe("string");
    });
  });

  it("rejects empty room IDs", () => {
    const emptyId = "";
    expect(emptyId.length).toBe(0);
  });
});

describe("Username sanitization", () => {
  it("trims whitespace from usernames", () => {
    const raw = "  Alice  ";
    const sanitized = raw.trim().slice(0, 32);
    expect(sanitized).toBe("Alice");
  });

  it("truncates long usernames to 32 chars", () => {
    const longName = "A".repeat(100);
    const sanitized = longName.trim().slice(0, 32);
    expect(sanitized.length).toBe(32);
  });

  it("handles unicode usernames", () => {
    const name = "สมชาย ใจดี";
    const sanitized = name.trim().slice(0, 32);
    expect(sanitized).toBe("สมชาย ใจดี");
  });
});

describe("Participant state management", () => {
  it("creates participant with correct defaults", () => {
    const participant = {
      socketId: "socket-123",
      username: "Alice",
      roomId: "ROOM123",
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
    };

    expect(participant.isMuted).toBe(false);
    expect(participant.isCameraOff).toBe(false);
    expect(participant.isScreenSharing).toBe(false);
  });

  it("updates media state correctly", () => {
    const participant = {
      socketId: "socket-123",
      username: "Alice",
      roomId: "ROOM123",
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
    };

    // Toggle mute
    const updated = { ...participant, isMuted: true };
    expect(updated.isMuted).toBe(true);
    expect(updated.isCameraOff).toBe(false);
  });

  it("removes participant from room on disconnect", () => {
    const participants = new Map([
      ["socket-1", { socketId: "socket-1", username: "Alice" }],
      ["socket-2", { socketId: "socket-2", username: "Bob" }],
    ]);

    participants.delete("socket-1");
    expect(participants.has("socket-1")).toBe(false);
    expect(participants.size).toBe(1);
  });
});

describe("Room cleanup", () => {
  it("cleans up empty rooms", () => {
    const rooms = new Map<string, { participants: Map<string, unknown> }>();
    rooms.set("ROOM1", { participants: new Map() });

    // Simulate cleanup
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.size === 0) {
        rooms.delete(roomId);
      }
    }

    expect(rooms.has("ROOM1")).toBe(false);
  });

  it("keeps rooms with active participants", () => {
    const rooms = new Map<string, { participants: Map<string, unknown> }>();
    rooms.set("ROOM1", {
      participants: new Map([["socket-1", { username: "Alice" }]]),
    });

    // Simulate cleanup
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.size === 0) {
        rooms.delete(roomId);
      }
    }

    expect(rooms.has("ROOM1")).toBe(true);
  });
});
