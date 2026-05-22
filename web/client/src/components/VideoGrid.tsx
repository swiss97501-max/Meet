import type { RoomParticipant } from "@/hooks/useRoom";
import ParticipantTile from "./ParticipantTile";

interface VideoGridProps {
  participants: RoomParticipant[];
  localParticipant: RoomParticipant;
  localStream: MediaStream | null;
  activeSpeakerId?: string;
}

// ─── Grid layout calculator ───────────────────────────────────────────────────

function getGridLayout(count: number): { cols: string; rows: string } {
  if (count === 1) return { cols: "grid-cols-1", rows: "grid-rows-1" };
  if (count === 2) return { cols: "grid-cols-2", rows: "grid-rows-1" };
  if (count <= 4) return { cols: "grid-cols-2", rows: "grid-rows-2" };
  if (count <= 6) return { cols: "grid-cols-3", rows: "grid-rows-2" };
  if (count <= 9) return { cols: "grid-cols-3", rows: "grid-rows-3" };
  return { cols: "grid-cols-4", rows: "grid-rows-[auto]" };
}

export default function VideoGrid({
  participants,
  localParticipant,
  localStream,
  activeSpeakerId,
}: VideoGridProps) {
  const allParticipants = [localParticipant, ...participants];
  const total = allParticipants.length;
  const { cols, rows } = getGridLayout(total);

  // Single participant: fullscreen
  if (total === 1) {
    return (
      <div className="w-full h-full p-4">
        <div className="w-full h-full animate-scale-in">
          <ParticipantTile
            participant={localParticipant}
            isLocal
            localStream={localStream}
            isActiveSpeaker={activeSpeakerId === localParticipant.socketId}
          />
        </div>
      </div>
    );
  }

  // 2 participants: side by side
  if (total === 2) {
    return (
      <div className="w-full h-full p-4 grid grid-cols-2 gap-3">
        {allParticipants.map((p, i) => (
          <div key={p.socketId} className="animate-scale-in" style={{ animationDelay: `${i * 80}ms` }}>
            <ParticipantTile
              participant={p}
              isLocal={i === 0}
              localStream={i === 0 ? localStream : undefined}
              isActiveSpeaker={activeSpeakerId === p.socketId}
            />
          </div>
        ))}
      </div>
    );
  }

  // 3–4 participants: 2x2 grid
  if (total <= 4) {
    return (
      <div className="w-full h-full p-4 grid grid-cols-2 grid-rows-2 gap-3">
        {allParticipants.map((p, i) => (
          <div key={p.socketId} className="animate-scale-in" style={{ animationDelay: `${i * 60}ms` }}>
            <ParticipantTile
              participant={p}
              isLocal={i === 0}
              localStream={i === 0 ? localStream : undefined}
              isActiveSpeaker={activeSpeakerId === p.socketId}
            />
          </div>
        ))}
      </div>
    );
  }

  // 5+ participants: adaptive grid
  return (
    <div className={`w-full h-full p-4 grid ${cols} ${rows} gap-3 auto-rows-fr`}>
      {allParticipants.map((p, i) => (
        <div key={p.socketId} className="animate-scale-in" style={{ animationDelay: `${i * 40}ms` }}>
          <ParticipantTile
            participant={p}
            isLocal={i === 0}
            localStream={i === 0 ? localStream : undefined}
            isActiveSpeaker={activeSpeakerId === p.socketId}
          />
        </div>
      ))}
    </div>
  );
}
