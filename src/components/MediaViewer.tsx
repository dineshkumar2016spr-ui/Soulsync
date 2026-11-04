// Full-screen media viewer: images (zoom/close) and video player (no sound autoplay)
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Message } from '../lib/types'
import { Icon } from './ui'

export function MediaViewer({ message, chatId, onClose }: { message: Message; chatId: string; onClose: () => void }) {
  const isVideo = message.kind.startsWith('video')
  const [zoom, setZoom] = useState(1)
  const [failed] = useState(false)
  const [videoState, setVideoState] = useState<{ playing: boolean; progress: number; duration: number; muted: boolean }>({ playing: false, progress: 0, duration: 0, muted: true })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const url = api.mediaUrl(chatId, message.id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
        .then(() => setVideoState((s) => ({ ...s, playing: true })))
        .catch(() => setVideoState((s) => ({ ...s, playing: false })))
    } else {
      v.pause()
      setVideoState((s) => ({ ...s, playing: false }))
    }
  }

  return (
    <div className="media-viewer-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="media-viewer" onClick={(e) => e.stopPropagation()}>
        <header className="mv-head">
          <span className="mv-title">{isVideo ? 'Video' : 'Photo'}{message.caption ? ' · with caption' : ''}</span>
          <div className="mv-actions">
            {!isVideo && (
              <>
                <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.6, z - 0.25))} aria-label="Zoom out">−</button>
                <button className="icon-btn" onClick={() => setZoom((z) => Math.min(3.5, z + 0.25))} aria-label="Zoom in">+</button>
                <span className="mv-zoom">{Math.round(zoom * 100)}%</span>
              </>
            )}
            {!failed && (
              <a className="icon-btn" href={url} download aria-label="Download"><Icon name="download" size={16} /></a>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close viewer"><Icon name="close" /></button>
          </div>
        </header>

        <div className="mv-stage" onDoubleClick={() => !isVideo && setZoom(1)}>
          {failed ? (
            <p className="mv-failed">
              <Icon name="alert" size={18} />
              This media isn’t available in the current session. SOULSYNC keeps media in memory only —
              reconnect WhatsApp to sync it again.
            </p>
          ) : isVideo ? (
            <video
              ref={videoRef}
              src={url}
              muted={videoState.muted}
              playsInline
              onLoadedMetadata={(e) => setVideoState((s) => ({ ...s, duration: e.currentTarget.duration || 0 }))}
              onTimeUpdate={(e) => setVideoState((s) => ({ ...s, progress: e.currentTarget.currentTime }))}
              onEnded={() => setVideoState((s) => ({ ...s, playing: false }))}
            />
          ) : (
            <img src={url} alt={message.caption || 'Photo'} style={{ transform: `scale(${zoom})`, transition: 'transform 160ms ease' }} />
          )}
        </div>

        {isVideo && !failed && (
          <footer className="mv-video-controls" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" onClick={togglePlay} aria-label={videoState.playing ? 'Pause' : 'Play'}>
              <Icon name={videoState.playing ? 'pause' : 'play'} size={16} />
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0.1, videoState.duration)}
              step={0.1}
              value={videoState.progress}
              onChange={(e) => {
                const v = videoRef.current
                if (v) v.currentTime = Number(e.target.value)
              }}
              aria-label="Seek"
            />
            <span className="mv-time">{fmt(videoState.progress)} / {fmt(videoState.duration)}</span>
            <button className="icon-btn" onClick={() => {
              const v = videoRef.current
              if (!v) return
              v.muted = !v.muted
              setVideoState((s) => ({ ...s, muted: v.muted }))
            }} aria-label={videoState.muted ? 'Unmute' : 'Mute'}>
              <Icon name="mic" size={15} />
            </button>
            <button className="icon-btn" onClick={() => videoRef.current?.requestFullscreen?.()} aria-label="Fullscreen">
              <Icon name="fullscreen" size={15} />
            </button>
          </footer>
        )}

        {!isVideo && message.caption && <p className="mv-caption">{message.caption}</p>}
      </div>
    </div>
  )
}

function fmt(t: number): string {
  if (!Number.isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = `${Math.floor(t % 60)}`.padStart(2, '0')
  return `${m}:${s}`
}
