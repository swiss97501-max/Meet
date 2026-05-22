import { useEffect, useState } from "react";
import { AlertCircle, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BrowserCapabilities } from "@/lib/webrtc";

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  browserCapabilities: BrowserCapabilities;
  isLoading?: boolean;
}

export function ScreenShareModal({
  isOpen,
  onClose,
  onConfirm,
  browserCapabilities,
  isLoading = false,
}: ScreenShareModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  // iOS fallback UI
  if (browserCapabilities.isIOS) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-cyan-500/20 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              <Smartphone className="w-5 h-5" />
              Screen Sharing on iOS
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              iOS doesn't support web-based screen sharing through this app
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-200">
                Use native iOS Screen Broadcast (ReplayKit) instead
              </AlertDescription>
            </Alert>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 space-y-3">
              <p className="text-sm font-semibold text-slate-200">How to share your screen:</p>
              <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
                <li>Swipe down from the top-right corner to open Control Center</li>
                <li>Long-press the Screen Recording button</li>
                <li>Tap "Meeting Swiss" to start broadcasting</li>
                <li>Tap "Start Broadcast" to confirm</li>
              </ol>
            </div>

            <p className="text-xs text-slate-400">
              Your screen will be shared with all participants in the meeting. Tap the red status bar to stop.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop confirmation UI
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-cyan-500/20 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-400">
            <Monitor className="w-5 h-5" />
            Share Your Screen
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Your entire screen will be visible to all participants
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-orange-500/10 border-orange-500/30">
            <AlertCircle className="h-4 w-4 text-orange-400" />
            <AlertDescription className="text-orange-200">
              Be careful not to share sensitive information like passwords or personal data
            </AlertDescription>
          </Alert>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 space-y-2">
            <p className="text-sm font-semibold text-slate-200">Browser: {browserCapabilities.browserName}</p>
            <p className="text-xs text-slate-400">
              You'll be able to choose which screen, window, or tab to share in the next step
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
          >
            {isLoading ? "Starting..." : "Share Screen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
