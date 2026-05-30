import { useRef, useEffect } from 'react';
import { useCallStore } from '@/stores/call.store';

export default function CallWindow() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const {
    status,
    peer,
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    endCall,
    toggleMic,
    toggleCamera,
  } = useCallStore();

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (status !== 'calling' && status !== 'connected' && status !== 'ringing') {
    return null;
  }

  const isCalling = status === 'calling';
  const isConnected = status === 'connected';
  const showLocalVideo = isConnected || isCalling;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Remote video (full background) */}
      {isConnected && remoteStream ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="flex-1 w-full h-full object-contain bg-gray-900"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            {/* Peer avatar */}
            <div className="w-24 h-24 mx-auto rounded-full bg-gray-700 flex items-center justify-center text-4xl mb-4 overflow-hidden">
              {peer?.avatarUrl ? (
                <img src={peer.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold">
                  {peer?.username?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <h3 className="text-white text-xl font-semibold">{peer?.username || 'Connecting...'}</h3>
            <p className="text-gray-400 text-sm mt-2">
              {isCalling ? 'Calling...' : 'Connecting...'}
            </p>
          </div>
        </div>
      )}

      {/* Local video PIP */}
      {showLocalVideo && (
        <div className="absolute top-4 right-4 w-40 h-28 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg bg-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraOff ? 'opacity-0' : ''}`}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white text-lg font-bold">
                {peer?.username?.[0]?.toUpperCase() || '?'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call duration / status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <span className="px-3 py-1 rounded-full bg-black/50 text-white text-xs">
          {isConnected && peer?.username ? `Connected with ${peer.username}` : ''}
        </span>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6">
        {/* Mute */}
        <button
          onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isMicMuted
              ? 'bg-red-500 text-white'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title={isMicMuted ? 'Unmute' : 'Mute'}
        >
          {isMicMuted ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* Camera toggle (only in video calls) */}
        {useCallStore.getState().callType === 'video' && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isCameraOff
                ? 'bg-red-500 text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isCameraOff ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}

        {/* Hang up */}
        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
          title="End call"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l-4 4m0 0l-4 4m4-4l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
