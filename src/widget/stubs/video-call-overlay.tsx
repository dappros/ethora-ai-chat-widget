// Stub for chat-component's VideoCalls/VideoCallOverlay. The single-bot
// assistant never makes WebRTC video/audio CALLS (config.videoCalls is never
// enabled), but ChatWrapper statically imports VideoCallOverlay, which pulls
// in VideoCallSession -> livekit-client + @livekit/components-react (~200KB
// gzipped). Replacing the overlay with a null component makes that whole
// subtree (and LiveKit) unreachable, so Vite tree-shakes it out.
// NOTE: this removes video/audio *calls*, not voice *messages* (wavesurfer),
// which the assistant keeps.
export const VideoCallOverlay = () => null;
