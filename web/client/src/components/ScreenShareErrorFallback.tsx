import { AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ScreenShareErrorFallbackProps {
  isOpen: boolean;
  onClose: () => void;
  errorType: "not_supported" | "permission_denied" | "not_found" | "generic";
  browserName: string;
}

export function ScreenShareErrorFallback({
  isOpen,
  onClose,
  errorType,
  browserName,
}: ScreenShareErrorFallbackProps) {
  const getErrorContent = () => {
    switch (errorType) {
      case "not_supported":
        return {
          title: "Screen Sharing Not Supported",
          description:
            "Your browser or operating system doesn't support screen sharing in this context.",
          suggestions: [
            `Try using a different browser (Chrome, Edge, Brave, or Firefox)`,
            "Ensure you're using the latest version of your browser",
            "Check that you're accessing this page over HTTPS (required for screen sharing)",
          ],
        };

      case "permission_denied":
        return {
          title: "Screen Sharing Cancelled",
          description: "You cancelled the screen sharing request.",
          suggestions: [
            "Click 'Share Screen' again to try again",
            "Check your browser permissions if you want to allow screen sharing",
            "Some browsers require you to grant permission each time",
          ],
        };

      case "not_found":
        return {
          title: "No Screen Available",
          description: "No screen or window was available to share.",
          suggestions: [
            "Ensure you have at least one monitor or window open",
            "Try closing and reopening your browser",
            "Restart your computer if the issue persists",
          ],
        };

      case "generic":
      default:
        return {
          title: "Screen Sharing Failed",
          description: "An unexpected error occurred while trying to share your screen.",
          suggestions: [
            "Check your internet connection",
            "Try refreshing the page and joining the meeting again",
            "If the problem persists, try a different browser",
          ],
        };
    }
  };

  const content = getErrorContent();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-orange-500/20 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-400">
            <AlertCircle className="w-5 h-5" />
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-slate-300">{content.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-slate-800/50 border-slate-700/50">
            <HelpCircle className="h-4 w-4 text-slate-400" />
            <AlertDescription className="text-slate-300">
              <strong>What you can try:</strong>
            </AlertDescription>
          </Alert>

          <ul className="space-y-2 text-sm text-slate-300">
            {content.suggestions.map((suggestion, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-orange-400 font-semibold">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>

          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-xs text-slate-400">
            <p>
              <strong>Browser:</strong> {browserName}
            </p>
            <p className="mt-1">
              <strong>Note:</strong> Screen sharing requires HTTPS and appropriate browser permissions.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Close
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
          >
            Try Again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
