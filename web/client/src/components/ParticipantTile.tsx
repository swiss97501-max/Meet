import { useEffect, useRef } from "react";
import { MicOff, VideoOff, Monitor } from "lucide-react";
import type { RoomParticipant } from "@/hooks/useRoom";

interface ParticipantTileProps {
  participant: RoomParticipant;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
  localStream?: MediaStream | null;
}

// Avatar initials helper
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Color from name (deterministic)
function getAvatarColor(name: string): string {
  const colors = [
    "oklch(0.82 0.18 195)",  // cyan
    "oklch(0.65 0.22 290)",  // violet
    "oklch(0.75 0.18 170)",  // green
    "oklch(0.82 0.18 60)",   // yellow
    "oklch(0.7 0.2 310)",    // pink
    "oklch(0.78 0.18 240)",  // blue
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ParticipantTile({
  participant,
  isLocal = false,
  isActiveSpeaker = false,
  localStream,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = isLocal ? localStream : participant.stream;
  const hasVideo = stream && stream.getVideoTracks().length > 0;
  const showVideo = hasVideo && !participant.isCameraOff;
  const avatarColor = getAvatarColor(participant.username);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={`video-tile relative w-full h-full ${isActiveSpeaker ? "active-speaker animate-pulse-ring" : ""}`}
      style={{
        animation: isActiveSpeaker ? "pulse-ring 2s ease-in-out infinite" : undefined,
      }}
    >
      {/* Video element */}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
          style={{ transform: isLocal ? "scaleX(-1)" : undefined }}
        />
      ) : (
        /* Avatar fallback */
        <div className="w-full h-full flex items-center justify-center bg-[oklch(0.1_0.015_260)]">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold select-none"
            style={{
              fontFamily: "var(--font-display)",
              background: `${avatarColor.replace(")", " / 20%)")}`,
              border: `2px solid ${avatarColor.replace(")", " / 50%)")}`,
              color: avatarColor,
              boxShadow: `0 0 24px ${avatarColor.replace(")", " / 20%)")}`,
            }}
          >
            {getInitials(participant.username)}
          </div>
        </div>
      )}

      {/* Screen share indicator */}
      {participant.isScreenSharing && (
        <div
          className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
          style={{
            background: "oklch(0.82 0.18 195 / 20%)",
            border: "1px solid oklch(0.82 0.18 195 / 40%)",
            color: "oklch(0.82 0.18 195)",
          }}
        >
          <Monitor className="w-3 h-3" />
          <span>Sharing</span>
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-t from-[oklch(0_0_0/70%)] to-transparent">
        <span
          className="text-sm font-medium text-white truncate max-w-[70%]"
          style={{ fontFamily: "var(--font-display)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
        >
          {participant.username}
          {isLocal && (
            <span className="ml-1 text-xs opacity-60">(You)</span>
          )}
        </span>

        {/* Media state icons */}
        <div className="flex items-center gap-1.5">
          {participant.isMuted && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "oklch(0.65 0.22 25 / 80%)" }}
            >
              <MicOff className="w-3 h-3 text-white" />
            </div>
          )}
          {participant.isCameraOff && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "oklch(0.5 0.1 260 / 80%)" }}
            >
              <VideoOff className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Active speaker glow overlay */}
      {isActiveSpeaker && (
        <div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{
            boxShadow: "inset 0 0 0 2px oklch(0.82 0.18 195 / 70%)",
          }}
        />
      )}
    </div>
  );
}
