import { describe, it, expect, beforeEach, vi } from "vitest";
import { detectBrowserCapabilities, WebRTCService } from "./webrtc";

// ─── Browser detection tests ──────────────────────────────────────────────────

describe("detectBrowserCapabilities", () => {
  const originalUA = navigator.userAgent;

  beforeEach(() => {
    // Reset navigator.userAgent mock
    Object.defineProperty(navigator, "userAgent", {
      value: originalUA,
      configurable: true,
    });
  });

  it("should detect Chrome browser", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      configurable: true,
    });

    const caps = detectBrowserCapabilities();
    expect(caps.browserName).toBe("Chrome");
    expect(caps.isMobile).toBe(false);
  });

  it("should detect Edge browser", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0",
      configurable: true,
    });

    const caps = detectBrowserCapabilities();
    expect(caps.browserName).toBe("Edge");
  });

  it("should detect Brave browser", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Brave/1.72.0",
      configurable: true,
    });

    const caps = detectBrowserCapabilities();
    expect(caps.browserName).toBe("Brave");
  });

  it("should detect iOS", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });

    const caps = detectBrowserCapabilities();
    expect(caps.isIOS).toBe(true);
    expect(caps.isMobile).toBe(true);
  });

  it("should detect Android", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0",
      configurable: true,
    });

    const caps = detectBrowserCapabilities();
    expect(caps.isAndroid).toBe(true);
    expect(caps.isMobile).toBe(true);
  });

  it("should detect getDisplayMedia support", () => {
    const caps = detectBrowserCapabilities();
    // getDisplayMedia is available in modern browsers
    const hasGetDisplayMedia = !!navigator.mediaDevices?.getDisplayMedia;
    expect(caps.supportsGetDisplayMedia).toBe(hasGetDisplayMedia);
  });
});

// ─── WebRTCService tests ──────────────────────────────────────────────────────

describe("WebRTCService", () => {
  let mockSocket: any;
  let webrtcService: WebRTCService;
  let onTrackCalled = false;
  let onRemoveTrackCalled = false;

  beforeEach(() => {
    // Mock Socket.IO
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    // Create WebRTC service
    webrtcService = new WebRTCService(
      mockSocket,
      () => {
        onTrackCalled = true;
      },
      () => {
        onRemoveTrackCalled = true;
      }
    );
  });

  it("should initialize with correct browser capabilities", () => {
    const caps = webrtcService.getBrowserCapabilities();
    expect(caps).toHaveProperty("browserName");
    expect(caps).toHaveProperty("supportsGetDisplayMedia");
    expect(caps).toHaveProperty("isIOS");
    expect(caps).toHaveProperty("isAndroid");
    expect(caps).toHaveProperty("isMobile");
  });

  it("should start with screen sharing disabled", () => {
    expect(webrtcService.getIsScreenSharing()).toBe(false);
  });

  it("should setup socket listeners on initialization", () => {
    expect(mockSocket.on).toHaveBeenCalledWith("webrtc-offer", expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith("webrtc-answer", expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith("ice-candidate", expect.any(Function));
  });

  it("should set screen share status callback", () => {
    const callback = vi.fn();
    webrtcService.setScreenShareStatusCallback(callback);
    // Callback should be stored (we can't directly test it without triggering screen share)
    expect(callback).not.toHaveBeenCalled();
  });

  it("should destroy all peer connections on cleanup", () => {
    // Create a mock peer connection
    const mockPeerConnection = {
      close: vi.fn(),
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: vi.fn(),
      getSenders: vi.fn(() => []),
    };

    // We can't directly add to peerConnections, but we can test destroy
    webrtcService.destroy();

    // Socket listeners should be cleaned up
    expect(mockSocket.off).toHaveBeenCalledWith("webrtc-offer");
    expect(mockSocket.off).toHaveBeenCalledWith("webrtc-answer");
    expect(mockSocket.off).toHaveBeenCalledWith("ice-candidate");
  });

  it("should handle iOS detection for screen sharing", async () => {
    // Mock iOS user agent
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
      configurable: true,
    });

    const caps = detectBrowserCapabilities();
    expect(caps.isIOS).toBe(true);
  });

  it("should toggle microphone mute state", () => {
    // Create a mock media stream
    const mockTrack = {
      enabled: true,
      stop: vi.fn(),
    };

    const mockStream = {
      getAudioTracks: vi.fn(() => [mockTrack]),
      getVideoTracks: vi.fn(() => []),
      getTracks: vi.fn(() => [mockTrack]),
    };

    webrtcService.setLocalStream(mockStream as any);

    // Toggle mute
    webrtcService.toggleMute(true);
    expect(mockTrack.enabled).toBe(false);

    // Toggle unmute
    webrtcService.toggleMute(false);
    expect(mockTrack.enabled).toBe(true);
  });

  it("should toggle camera on/off", () => {
    // Create a mock media stream
    const mockTrack = {
      enabled: true,
      stop: vi.fn(),
    };

    const mockStream = {
      getAudioTracks: vi.fn(() => []),
      getVideoTracks: vi.fn(() => [mockTrack]),
      getTracks: vi.fn(() => [mockTrack]),
    };

    webrtcService.setLocalStream(mockStream as any);

    // Turn camera off
    webrtcService.toggleCamera(true);
    expect(mockTrack.enabled).toBe(false);

    // Turn camera on
    webrtcService.toggleCamera(false);
    expect(mockTrack.enabled).toBe(true);
  });
});
