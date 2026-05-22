import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { nanoid } from "nanoid";
import {
  Video,
  Users,
  Shield,
  Zap,
  Globe,
  ChevronRight,
  Plus,
  LogIn,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663687101946/JTiiZBmYaPmTTYwZ4JcutS/hero-bg-CUGhNYSmXNdCRZrQKsJosU.webp";
const LOGO_ICON = "https://d2xsxph8kpxj0f.cloudfront.net/310519663687101946/JTiiZBmYaPmTTYwZ4JcutS/logo-icon-CoEQhxiMT7RFSacxJUmzHr.webp";

// ─── Feature cards data ───────────────────────────────────────────────────────

const features = [
  {
    icon: Video,
    title: "Crystal-Clear Video",
    description: "WebRTC-powered HD video with adaptive bitrate for smooth calls on any connection.",
    color: "oklch(0.82 0.18 195)",
  },
  {
    icon: Users,
    title: "Multi-Participant Rooms",
    description: "Host meetings with unlimited participants. Smart adaptive grid layout adjusts automatically.",
    color: "oklch(0.65 0.22 290)",
  },
  {
    icon: Shield,
    title: "Peer-to-Peer Encrypted",
    description: "Direct WebRTC connections mean your video never touches our servers. Truly private.",
    color: "oklch(0.75 0.18 170)",
  },
  {
    icon: Zap,
    title: "Ultra-Low Latency",
    description: "Sub-100ms latency with ICE/STUN optimization. Real conversations, not delayed echoes.",
    color: "oklch(0.82 0.18 60)",
  },
  {
    icon: Globe,
    title: "Screen Sharing",
    description: "Share your entire screen, a specific window, or just a browser tab with one click.",
    color: "oklch(0.7 0.2 310)",
  },
  {
    icon: ChevronRight,
    title: "Instant Rooms",
    description: "No sign-up required. Generate a unique room ID and share the link in seconds.",
    color: "oklch(0.78 0.18 240)",
  },
];

// ─── Animated background grid ─────────────────────────────────────────────────

function BackgroundGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Hero background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${HERO_BG})` }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[oklch(0.08_0.015_260)]" />
      {/* Radial glows */}
      <div
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
        style={{ background: "oklch(0.65 0.22 290)" }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
        style={{ background: "oklch(0.82 0.18 195)" }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Home() {
  const [, navigate] = useLocation();

  // Create room state
  const [createUsername, setCreateUsername] = useState("");
  const [generatedRoomId, setGeneratedRoomId] = useState("");
  const [copied, setCopied] = useState(false);

  // Join room state
  const [joinUsername, setJoinUsername] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Generate a new room ID
  const handleGenerateRoom = () => {
    const id = nanoid(10).toUpperCase();
    setGeneratedRoomId(id);
  };

  // Copy room ID to clipboard
  const handleCopy = async () => {
    if (!generatedRoomId) return;
    await navigator.clipboard.writeText(generatedRoomId);
    setCopied(true);
    toast.success("Room ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Enter a created room
  const handleCreateRoom = () => {
    if (!createUsername.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!generatedRoomId) {
      toast.error("Please generate a Room ID first");
      return;
    }
    navigate(`/room/${generatedRoomId}?username=${encodeURIComponent(createUsername.trim())}`);
  };

  // Join an existing room
  const handleJoinRoom = () => {
    if (!joinUsername.trim()) {
      toast.error("Please enter your name");
      return;
    }
    const roomId = joinRoomId.trim().toUpperCase();
    if (!roomId) {
      toast.error("Please enter a Room ID");
      return;
    }
    navigate(`/room/${roomId}?username=${encodeURIComponent(joinUsername.trim())}`);
  };

  return (
    <div className="min-h-screen bg-void text-foreground overflow-x-hidden">
      <BackgroundGrid />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <img src={LOGO_ICON} alt="Meeting Swiss" className="w-9 h-9 rounded-xl" />
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.008 260)" }}
          >
            Meeting <span className="text-gradient-neon">Swiss</span>
          </span>
        </div>

      </header>

      {/* ── Hero section ────────────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24">
        {/* Hero text */}
        <div
          className="text-center mb-16"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(40px)",
            transition: "opacity 600ms var(--ease-out), transform 600ms var(--ease-out)",
          }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-6 text-sm">
            <Zap className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-muted-foreground">WebRTC-Powered · Zero Latency</span>
          </div>

          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="text-foreground">Premium Video</span>
            <br />
            <span className="text-gradient-neon">Meetings</span>
            <br />
            <span className="text-foreground">Made Simple</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Crystal-clear video calls with end-to-end WebRTC encryption. No downloads, no accounts —
            just create a room and share the link.
          </p>
        </div>

        {/* ── Action cards ──────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6 max-w-4xl mx-auto mb-24">

          {/* Create Room card */}
          <div
            className="glass-card p-8"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(40px)",
              transition: "opacity 600ms 100ms var(--ease-out), transform 600ms 100ms var(--ease-out)",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.82 0.18 195 / 15%)", border: "1px solid oklch(0.82 0.18 195 / 30%)" }}
              >
                <Plus className="w-5 h-5 text-neon-cyan" />
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  Create Room
                </h2>
                <p className="text-xs text-muted-foreground">Start a new meeting instantly</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Your Name
                </label>
                <Input
                  placeholder="e.g. Alex Chen"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  className="bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/12%)] text-foreground placeholder:text-muted-foreground focus:border-[oklch(0.82_0.18_195/60%)] focus:ring-[oklch(0.82_0.18_195/20%)]"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Room ID
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      readOnly
                      value={generatedRoomId}
                      placeholder="Click Generate →"
                      className="bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/12%)] text-foreground placeholder:text-muted-foreground font-mono tracking-widest pr-10"
                    />
                    {generatedRoomId && (
                      <button
                        onClick={handleCopy}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-neon-cyan transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleGenerateRoom}
                    className="shrink-0 bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/15%)] text-muted-foreground hover:text-foreground hover:border-[oklch(0.82_0.18_195/40%)]"
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                className="w-full py-3 rounded-xl btn-neon font-semibold text-sm flex items-center justify-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <Video className="w-4 h-4" />
                Start Meeting
              </button>
            </div>
          </div>

          {/* Join Room card */}
          <div
            className="glass-card p-8"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(40px)",
              transition: "opacity 600ms 200ms var(--ease-out), transform 600ms 200ms var(--ease-out)",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.65 0.22 290 / 15%)", border: "1px solid oklch(0.65 0.22 290 / 30%)" }}
              >
                <LogIn className="w-5 h-5 text-neon-violet" />
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  Join Room
                </h2>
                <p className="text-xs text-muted-foreground">Enter an existing meeting</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Your Name
                </label>
                <Input
                  placeholder="e.g. Jordan Kim"
                  value={joinUsername}
                  onChange={(e) => setJoinUsername(e.target.value)}
                  className="bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/12%)] text-foreground placeholder:text-muted-foreground focus:border-[oklch(0.65_0.22_290/60%)] focus:ring-[oklch(0.65_0.22_290/20%)]"
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Room ID
                </label>
                <Input
                  placeholder="e.g. AB12CD34EF"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  className="bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/12%)] text-foreground placeholder:text-muted-foreground font-mono tracking-widest focus:border-[oklch(0.65_0.22_290/60%)]"
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                />
              </div>

              {/* Spacer to align with create card */}
              <div className="h-[0px]" />

              <button
                onClick={handleJoinRoom}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150"
                style={{
                  fontFamily: "var(--font-display)",
                  background: "linear-gradient(135deg, oklch(0.65 0.22 290 / 20%), oklch(0.82 0.18 195 / 20%))",
                  border: "1px solid oklch(0.65 0.22 290 / 50%)",
                  color: "oklch(0.75 0.2 290)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 24px oklch(0.65 0.22 290 / 30%)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(0.65 0.22 290 / 80%)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(0.65 0.22 290 / 50%)";
                }}
              >
                <Users className="w-4 h-4" />
                Join Meeting
              </button>
            </div>
          </div>
        </div>

        {/* ── Feature grid ──────────────────────────────────────────────────── */}
        <div
          className="text-center mb-12"
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 600ms 400ms var(--ease-out)",
          }}
        >
          <h2
            className="text-3xl font-bold mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Everything you need for{" "}
            <span className="text-gradient-neon">great meetings</span>
          </h2>
          <p className="text-muted-foreground">
            Built on open web standards. No plugins, no downloads, no compromises.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="glass-card p-6 group"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 500ms ${400 + i * 60}ms var(--ease-out), transform 500ms ${400 + i * 60}ms var(--ease-out)`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-200 group-hover:scale-110"
                  style={{
                    background: `${feature.color.replace(")", " / 15%)")}`,
                    border: `1px solid ${feature.color.replace(")", " / 30%)")}`,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <h3
                  className="text-base font-semibold mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[oklch(1_0_0/8%)] py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src={LOGO_ICON} alt="" className="w-5 h-5 rounded-md opacity-60" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>Meeting Swiss</span>
        </div>
        <p>Secure peer-to-peer video meetings powered by WebRTC</p>
      </footer>
    </div>
  );
}
