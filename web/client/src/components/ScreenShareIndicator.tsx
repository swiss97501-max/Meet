import { useEffect, useState } from "react";
import { Monitor, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScreenShareIndicatorProps {
  isSharing: boolean;
  onStop: () => void;
}

export function ScreenShareIndicator({ isSharing, onStop }: ScreenShareIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isSharing) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isSharing]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-full px-4 py-2 shadow-lg border border-red-400/50 backdrop-blur-sm flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 bg-red-300 rounded-full animate-pulse" />
            <div className="absolute inset-0 bg-red-400 rounded-full" />
          </div>
          <Monitor className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Sharing Screen</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onStop}
          className="h-6 w-6 p-0 hover:bg-red-700/50 text-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
