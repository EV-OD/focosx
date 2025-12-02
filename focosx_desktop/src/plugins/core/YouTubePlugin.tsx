
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PluginDefinition, PluginFrameProps } from '../api/types';
import { Youtube, Play, Pause, RotateCcw, FastForward, Bookmark, Plus, Trash2, Repeat, Clock, MoreHorizontal } from 'lucide-react';

// --- Types ---
interface BookmarkItem {
  id: string;
  time: number;
  label: string;
}

interface YouTubeContent {
  videoId: string;
  bookmarks: BookmarkItem[];
  lastTime: number;
}

interface YouTubeFrameProps extends PluginFrameProps {
  // Add specific props if needed
}

// --- Helper: Parse Video ID ---
const getVideoId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// --- Helper: Load YouTube API ---
const loadYouTubeAPI = () => {
  return new Promise<void>((resolve) => {
    if ((window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    (window as any).onYouTubeIframeAPIReady = () => resolve();
  });
};

// --- Helper: Format Time ---
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const YouTubeFrame: React.FC<YouTubeFrameProps> = ({ frame, onUpdate, isResizing }) => {
  // Parse Content
  let content: YouTubeContent = { videoId: '', bookmarks: [], lastTime: 0 };
  try {
    if (typeof frame.content === 'string' && frame.content.startsWith('{')) {
      content = JSON.parse(frame.content);
    } else if (typeof frame.content === 'string' && frame.content.length > 0) {
      // Legacy or direct ID support
      const possibleId = getVideoId(frame.content) || frame.content;
      content = { videoId: possibleId, bookmarks: [], lastTime: 0 };
    }
  } catch (e) {
    console.error("Failed to parse YouTube content", e);
  }

  // State
  const [inputValue, setInputValue] = useState('');
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(content.bookmarks || []);
  
  // Looping State
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Persist Data
  const updateContent = useCallback((updates: Partial<YouTubeContent>) => {
    const newContent = { ...content, ...updates };
    onUpdate({ content: JSON.stringify(newContent) });
  }, [content, onUpdate]);

  // Load Player
  useEffect(() => {
    if (!content.videoId) return;

    let interval: any;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      
      if (!playerRef.current) return;

      // Determine ID for iframe to avoid collisions
      const domId = `yt-player-${frame.id}`;
      playerRef.current.id = domId;

      const newPlayer = new (window as any).YT.Player(domId, {
        height: '100%',
        width: '100%',
        videoId: content.videoId,
        playerVars: {
          playsinline: 1,
          controls: 0, // We build our own advanced controls
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: (event: any) => {
            setDuration(event.target.getDuration());
            // Restore last time if exists
            if (content.lastTime > 5) {
                event.target.seekTo(content.lastTime, true);
            }
          },
          onStateChange: (event: any) => {
            setIsPlaying(event.data === (window as any).YT.PlayerState.PLAYING);
          }
        }
      });
      setPlayer(newPlayer);
    };

    if (!player) {
      initPlayer();
    }

    // Polling for time & loop logic
    interval = setInterval(() => {
      if (player && player.getCurrentTime) {
        const time = player.getCurrentTime();
        setCurrentTime(time);
        
        // Loop Logic
        if (isLooping && loopStart !== null && loopEnd !== null) {
            if (time >= loopEnd || time < loopStart) {
                player.seekTo(loopStart, true);
            }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [content.videoId]);

  // Handle Input Submit
  const handleLoadVideo = () => {
    const id = getVideoId(inputValue);
    if (id) {
      updateContent({ videoId: id, bookmarks: [], lastTime: 0 });
    } else {
        alert("Invalid YouTube URL");
    }
  };

  // --- Controls ---

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value);
      if(player) player.seekTo(time, true);
      setCurrentTime(time);
  };

  const changeSpeed = () => {
      if (!player) return;
      const speeds = [0.5, 1, 1.25, 1.5, 2];
      const currentIndex = speeds.indexOf(playbackRate);
      const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
      player.setPlaybackRate(nextSpeed);
      setPlaybackRate(nextSpeed);
  };

  const addBookmark = () => {
      const newBookmark: BookmarkItem = {
          id: crypto.randomUUID(),
          time: currentTime,
          label: `Note at ${formatTime(currentTime)}`
      };
      const newBookmarks = [...bookmarks, newBookmark].sort((a,b) => a.time - b.time);
      setBookmarks(newBookmarks);
      updateContent({ bookmarks: newBookmarks });
  };

  const removeBookmark = (id: string) => {
      const newBookmarks = bookmarks.filter(b => b.id !== id);
      setBookmarks(newBookmarks);
      updateContent({ bookmarks: newBookmarks });
  };

  const jumpTo = (time: number) => {
      if(player) {
          player.seekTo(time, true);
          player.playVideo();
      }
  };

  // AB Loop Controls
  const setALoop = () => setLoopStart(currentTime);
  const setBLoop = () => setLoopEnd(currentTime);
  const toggleLoop = () => {
      if (isLooping) {
          setIsLooping(false);
      } else {
          if (loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
              setIsLooping(true);
              player.seekTo(loopStart, true);
          } else {
              alert("Set valid A (Start) and B (End) points first.");
          }
      }
  };

  // --- Render ---

  if (!content.videoId) {
    return (
      <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center mb-4 text-red-500 shadow-[0_0_20px_rgba(220,38,38,0.2)]">
            <Youtube className="w-8 h-8" />
        </div>
        <h3 className="text-zinc-200 font-medium mb-2">Embed YouTube Video</h3>
        <div className="flex w-full max-w-xs gap-2">
            <input 
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-red-500/50"
                placeholder="Paste YouTube URL..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadVideo()}
            />
            <button 
                onClick={handleLoadVideo}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-medium transition-colors"
            >
                Load
            </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950 flex flex-col overflow-hidden">
      {/* Video Area */}
      <div className={`relative w-full ${bookmarks.length > 0 ? 'h-[60%]' : 'flex-1'} bg-black group transition-all duration-300`}>
          <div ref={playerRef} className="w-full h-full" />
          
          {/* Custom Overlay Controls (Visible on Hover) */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 pointer-events-none">
              {/* Seeker */}
              <input 
                  type="range" 
                  min={0} 
                  max={duration} 
                  value={currentTime} 
                  onChange={handleSeek}
                  className="w-full h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer accent-red-500 pointer-events-auto"
              />
              
              <div className="flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-3">
                      <button onClick={togglePlay} className="text-white hover:text-red-400 transition-colors">
                          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                      </button>
                      <span className="text-xs font-mono text-zinc-300">
                          {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <button 
                          onClick={changeSpeed}
                          className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-[10px] font-bold text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 min-w-[32px]"
                          title="Playback Speed"
                      >
                          {playbackRate}x
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* Advanced Toolbar & Bookmarks */}
      <div className="flex-1 bg-zinc-900 border-t border-zinc-800 flex flex-col min-h-0">
          
          {/* Action Bar */}
          <div className="h-10 border-b border-zinc-800 flex items-center px-2 gap-2 bg-zinc-800/30 shrink-0 overflow-x-auto no-scrollbar">
               {/* Loop Controls */}
               <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded border border-zinc-700/50 mr-2">
                   <button 
                        onClick={setALoop}
                        className={`text-[10px] px-1.5 rounded ${loopStart !== null ? 'text-blue-400 bg-blue-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Set Loop Start (A)"
                   >
                       A {loopStart !== null && '•'}
                   </button>
                   <button 
                        onClick={setBLoop}
                        className={`text-[10px] px-1.5 rounded ${loopEnd !== null ? 'text-blue-400 bg-blue-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Set Loop End (B)"
                   >
                       B {loopEnd !== null && '•'}
                   </button>
                   <div className="w-px h-3 bg-zinc-700" />
                   <button 
                        onClick={toggleLoop}
                        className={`p-1 rounded ${isLooping ? 'text-green-400 bg-green-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Toggle Loop"
                   >
                       <Repeat className="w-3 h-3" />
                   </button>
               </div>

               <div className="w-px h-4 bg-zinc-700" />

               {/* Bookmark Action */}
               <button 
                  onClick={addBookmark}
                  className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
               >
                   <Bookmark className="w-3 h-3" />
                   <span className="text-xs">Bookmark Time</span>
               </button>
               
               <div className="flex-1" />
               <a 
                   href={`https://youtube.com/watch?v=${content.videoId}`} 
                   target="_blank" 
                   rel="noreferrer"
                   className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1"
               >
                   Open YT <FastForward className="w-3 h-3" />
               </a>
          </div>

          {/* Bookmarks List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {bookmarks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-2">
                      <Clock className="w-8 h-8 opacity-20" />
                      <p className="text-xs">No timestamps saved.</p>
                  </div>
              ) : (
                  bookmarks.map(b => (
                      <div 
                        key={b.id} 
                        className="group flex items-center gap-2 p-2 rounded hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors cursor-pointer"
                        onClick={() => jumpTo(b.time)}
                      >
                          <div className="shrink-0 font-mono text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded border border-blue-900/50">
                              {formatTime(b.time)}
                          </div>
                          <input 
                              className="flex-1 bg-transparent outline-none text-xs text-zinc-300 placeholder-zinc-600 truncate"
                              value={b.label}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                  const newArr = bookmarks.map(x => x.id === b.id ? { ...x, label: e.target.value } : x);
                                  setBookmarks(newArr);
                                  updateContent({ bookmarks: newArr });
                              }}
                          />
                          <button 
                             onClick={(e) => { e.stopPropagation(); removeBookmark(b.id); }}
                             className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-1"
                          >
                              <Trash2 className="w-3 h-3" />
                          </button>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
};

export const YouTubePlugin: PluginDefinition = {
  id: 'youtube-player',
  name: 'YouTube Studio',
  version: '1.0.0',
  description: 'Advanced YouTube player with A-B looping and timestamps.',
  frameTypes: {
    'youtube-player': {
      label: 'YouTube',
      icon: <Youtube className="w-4 h-4" />,
      component: YouTubeFrame,
      defaultDimensions: { width: 480, height: 600 }, // Vertical layout preferred for studying
      interaction: {
          dragHandle: 'header'
      }
    }
  }
};
