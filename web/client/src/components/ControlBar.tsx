import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff, Copy, Users } from "lucide-react";
import { toast } from "sonner";

interface ControlBarProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  participantCount: number;
  roomId: string;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
  screenShareError?: string;
  isScreenShareLoading?: boolean;
}

interface ControlButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "active" | "danger";
  disabled?: boolean;
}

function ControlButton({ icon, label, onClick, variant = "default", disabled }: ControlButtonProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`control-btn ${variant === "active" ? "active" : ""} ${variant === "danger" ? "danger" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{
          width: variant === "danger" ? "3.5rem" : "3rem",
          height: variant === "danger" ? "3.5rem" : "3rem",
        }}
      >
        {icon}
      </button>
      <span className="text-[10px] text-muted-foreground font-medium select-none">{label}</span>
    </div>
  );
}

export default function ControlBar({
  isMuted,
  isCameraOff,
  isScreenSharing,
  participantCount,
  roomId,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  screenShareError,
  isScreenShareLoading = false,
}: ControlBarProps) {
  // Show error toast if screen share fails
  if (screenShareError) {
    toast.error("Screen sharing failed", {
      description: screenShareError,
    });
  }
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Meeting link copied!", {
      description: "Share this link to invite others",
    });
  };

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-float-up"
      style={{ animationDelay: "300ms" }}
    >
      <div
        className="control-bar px-6 py-4 flex items-end gap-4"
        style={{
          boxShadow: "0 8px 32px oklch(0 0 0 / 40%), 0 0 0 1px oklch(1 0 0 / 8%)",
        }}
      >
        {/* Participant count badge */}
        <div className="flex flex-col items-center gap-1.5 mr-2">
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium"
            style={{
              background: "oklch(1 0 0 / 8%)",
              border: "1px solid oklch(1 0 0 / 12%)",
              color: "oklch(0.75 0.01 260)",
              fontFamily: "var(--font-display)",
            }}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{participantCount}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">People</span>
        </div>

        {/* Separator */}
        <div className="w-px h-8 self-center bg-[oklch(1_0_0/10%)] mx-1" />

        {/* Mute */}
        <ControlButton
          icon={isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          label={isMuted ? "Unmute" : "Mute"}
          onClick={onToggleMute}
          variant={isMuted ? "active" : "default"}
        />

        {/* Camera */}
        <ControlButton
          icon={isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          label={isCameraOff ? "Start Video" : "Stop Video"}
          onClick={onToggleCamera}
          variant={isCameraOff ? "active" : "default"}
        />

        {/* Screen Share */}
        <ControlButton
          icon={isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          label={isScreenSharing ? "Stop Share" : "Share Screen"}
          onClick={onToggleScreenShare}
          variant={isScreenSharing ? "active" : "default"}
          disabled={isScreenShareLoading}
        />

        {/* Copy link */}
        <ControlButton
          icon={<Copy className="w-4.5 h-4.5" />}
          label="Copy Link"
          onClick={handleCopyLink}
        />

        {/* Separator */}
        <div className="w-px h-8 self-center bg-[oklch(1_0_0/10%)] mx-1" />

        {/* Leave */}
        <ControlButton
          icon={<PhoneOff className="w-5 h-5" />}
          label="Leave"
          onClick={onLeave}
          variant="danger"
        />
      </div>

      {/* Room ID display */}
      <div className="flex justify-center mt-2">
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
          style={{
            background: "oklch(0.1 0.015 260 / 80%)",
            border: "1px solid oklch(1 0 0 / 8%)",
            color: "oklch(0.5 0.01 260)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>Room:</span>
          <span style={{ color: "oklch(0.82 0.18 195)" }}>{roomId}</span>
        </div>
      </div>
    </div>
  );
}
