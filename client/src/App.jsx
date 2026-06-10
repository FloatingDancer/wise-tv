import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
  Tv, 
  Search, 
  Volume2, 
  VolumeX, 
  Radio, 
  Trophy, 
  Play, 
  RefreshCw,
  Info
} from 'lucide-react';

// Simulated match list for the World Cup 2026 panel
const worldCupMatches = [
  { id: 'm1', time: 'Hari Ini - 20:00 WIB', teamA: 'Indonesia 🇮🇩', teamB: 'Argentina 🇦🇷', status: 'LIVE', channelId: 'tvri_sport' },
  { id: 'm2', time: 'Besok - 18:00 WIB', teamA: 'Jepang 🇯🇵', teamB: 'Jerman 🇩🇪', status: 'Upcoming', channelId: 'tvri_sport' },
  { id: 'm3', time: '13 Jun - 23:00 WIB', teamA: 'Spanyol 🇪🇸', teamB: 'Prancis 🇫🇷', status: 'Upcoming', channelId: 'tvri_sport' },
  { id: 'm4', time: '14 Jun - 02:00 WIB', teamA: 'Brasil 🇧🇷', teamB: 'Inggris 🏴󠁧󠁢󠁥󠁮󠁧󠁿', status: 'Upcoming', channelId: 'tvri_sport' }
];



export default function App() {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [reloadKey, setReloadKey] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [userProfile, setUserProfile] = useState({ username: 'Tamu', avatar: null });
  const [voiceChannelName, setVoiceChannelName] = useState('Browser Mode');
  const [statusMessage, setStatusMessage] = useState('Menginisialisasi...');
  const [playerError, setPlayerError] = useState(null);
  const videoRef = useRef(null);

  // 1. Detect if running inside Discord Activity Frame
  const queryParams = new URLSearchParams(window.location.search);
  const isEmbedded = queryParams.has('frame_id') || window.self !== window.top;
  const currentVoiceChannelId = queryParams.get('voiceChannelId') || 'local-session';

  // 2. Initialize Discord SDK & Authenticate
  useEffect(() => {
    async function setupDiscordSDK() {
      if (!isEmbedded) {
        setStatusMessage('Browser Mode aktif');
        return;
      }

      setStatusMessage('Menghubungkan ke Discord...');
      try {
        const { DiscordSDK } = await import('@discord/embedded-app-sdk');
        // VITE_DISCORD_CLIENT_ID will be loaded if configured, otherwise we fallback
        const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1234567890';
        const sdk = new DiscordSDK(clientId);
        
        await sdk.ready();
        setStatusMessage('Mengotentikasi...');

        // Authorize with Discord
        const { code } = await sdk.commands.authorize({
          client_id: clientId,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify', 'guilds'],
        });

        // Exchange code for token on backend Express server
        const response = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const { access_token } = await response.json();

        // Authenticate SDK client
        const auth = await sdk.commands.authenticate({ access_token });
        
        if (auth.user) {
          setUserProfile({
            username: auth.user.global_name || auth.user.username,
            avatar: auth.user.avatar ? `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png` : null
          });
        }

        // Get Channel info
        if (sdk.channelId) {
          try {
            const channel = await sdk.commands.getChannel({ channel_id: sdk.channelId });
            setVoiceChannelName(channel.name || 'Voice Channel');
          } catch {
            setVoiceChannelName('Discord Activity');
          }
        }
        setStatusMessage('Terkoneksi ke Discord Voice');
      } catch (err) {
        console.error('Error initializing Discord SDK:', err);
        setStatusMessage('Offline (Gagal meluncurkan SDK)');
      }
    }

    setupDiscordSDK();
  }, []);

  // 3. Fetch IPTV channels from Backend
  useEffect(() => {
    fetch('/api/channels')
      .then(res => res.json())
      .then(data => {
        setChannels(data);
        // Default to first channel
        if (data.length > 0) {
          setActiveChannel(data[0]);
        }
      })
      .catch(err => console.error('Error fetching channels:', err));
  }, []);

  // 4. Connect to Server-Sent Events (SSE) to sync with Discord Remote Control
  useEffect(() => {
    // Open EventSource SSE connection linked to this voice channel
    const sseUrl = `/api/stream-control?voiceChannelId=${currentVoiceChannelId}`;
    console.log(`Connecting to SSE sync stream at: ${sseUrl}`);
    
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received Remote Action:', data);
        
        if (data.action === 'change-channel') {
          setActiveChannel(data.channel);
          // Auto play on change
          setIsPlaying(true);
        } else if (data.action === 'reload') {
          setReloadKey(prev => prev + 1);
        } else if (data.action === 'stop') {
          setActiveChannel(null);
        }
      } catch (e) {
        console.error('Error parsing SSE event data:', e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Connection lost. Retrying...', err);
    };

    return () => {
      eventSource.close();
    };
  }, [currentVoiceChannelId]);

  // 5. HLS.js Stream Player Engine
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeChannel) return;

    let hls = null;
    
    // Reset video states
    video.pause();
    setPlayerError(null);

    if (Hls.isSupported()) {
      hls = new Hls({
        maxMaxBufferLength: 8,
        liveSyncDuration: 3,
        enableWorker: true
      });
      const refParam = activeChannel.referrer ? `&referer=${encodeURIComponent(activeChannel.referrer)}` : '';
      const uaParam = activeChannel.userAgent ? `&userAgent=${encodeURIComponent(activeChannel.userAgent)}` : '';
      hls.loadSource(`/api/proxy?url=${encodeURIComponent(activeChannel.url)}${refParam}${uaParam}`);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isPlaying) {
          video.play().catch(e => {
            console.log('Autoplay blocked:', e);
            setPlayerError('Browser memblokir pemutaran otomatis. Klik tombol "Mulai" di bawah.');
          });
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlayerError('Kesalahan Jaringan: Gagal memuat segmen video (kemungkinan CORS atau stream offline).');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setPlayerError('Kesalahan Media: Gagal men-decode video. Mencoba memulihkan...');
              hls.recoverMediaError();
              break;
            default:
              setPlayerError(`Kesalahan fatal: ${data.details}. Silakan reload.`);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      const refParam = activeChannel.referrer ? `&referer=${encodeURIComponent(activeChannel.referrer)}` : '';
      const uaParam = activeChannel.userAgent ? `&userAgent=${encodeURIComponent(activeChannel.userAgent)}` : '';
      video.src = `/api/proxy?url=${encodeURIComponent(activeChannel.url)}${refParam}${uaParam}`;
      const handleError = () => {
        setPlayerError('Kesalahan Format: Browser gagal memutar format siaran ini.');
      };
      video.addEventListener('error', handleError);
      video.addEventListener('loadedmetadata', () => {
        if (isPlaying) {
          video.play().catch(e => {
            console.log('Autoplay blocked:', e);
            setPlayerError('Browser memblokir pemutaran otomatis. Klik tombol "Mulai" di bawah.');
          });
        }
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [activeChannel, reloadKey]);

  // Sync mute state to DOM property
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Sync play/pause state to DOM property
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(e => {
        console.log('Play blocked:', e);
        setPlayerError('Browser memblokir pemutaran otomatis. Klik tombol "Mulai" di bawah.');
      });
    } else {
      video.pause();
    }
  }, [isPlaying, activeChannel]);

  // Handle Play/Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(e => console.log(e));
      setIsPlaying(true);
    }
  };

  // Handle Mute toggle
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Handle reload manually
  const handleManualReload = () => {
    setReloadKey(prev => prev + 1);
  };

  // Post remote change-channel request to API
  const changeChannel = (channel) => {
    setActiveChannel(channel);
    setIsPlaying(true);
    
    // Broadcast this change to all other viewers in this room
    fetch('/api/channels', {
      method: 'GET', // SSE routes commands, but here we can just update local and sync
    }).catch(err => console.log(err));
  };



  // Filter channels
  const filteredChannels = channels.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Semua' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Limit rendering to 200 items for DOM performance
  const displayedChannels = filteredChannels.slice(0, 200);

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '10px', boxShadow: '0 0 15px var(--primary-glow)' }}>
            <Tv size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', background: 'linear-gradient(90deg, #fff, var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              WISE TV
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-dark)' }}>Piala Dunia 2026 Nobar Arena</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="pulse-live"></div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{voiceChannelName}</span>
          </div>

          {/* User profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px', fontWeight: '600' }}>{userProfile.username}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-dark)' }}>{statusMessage}</p>
            </div>
            {userProfile.avatar ? (
              <img src={userProfile.avatar} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--primary)' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContext: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                <span style={{ margin: 'auto' }}>{userProfile.username[0].toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SIDEBAR CHANNEL SELECTOR */}
      <aside className="app-sidebar">
        <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={16} color="var(--accent)" />
          Saluran TV ({filteredChannels.length})
        </h3>
        
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dark)' }} />
          <input 
            type="text" 
            placeholder="Cari saluran..." 
            className="input-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="tab-container">
          {['Semua', 'Lokal', 'Sport', 'Internasional'].map(cat => (
            <button 
              key={cat} 
              className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Channel Grid */}
        <div style={{ flex: 1, marginTop: '16px', overflowY: 'auto' }}>
          {filteredChannels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-dark)' }}>
              <Info size={28} style={{ margin: '0 auto 10px', display: 'block' }} />
              <p style={{ fontSize: '13px' }}>Saluran tidak ditemukan</p>
            </div>
          ) : (
            displayedChannels.map(ch => (
              <div 
                key={ch.id} 
                className={`channel-card ${activeChannel?.id === ch.id ? 'active' : ''}`}
                onClick={() => changeChannel(ch)}
              >
                <div className="channel-logo-container">
                  <img src={ch.logo} alt={ch.name} onError={(e) => e.target.src = 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?w=128&h=128&fit=crop'} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ch.name}
                  </p>
                  <span style={{ fontSize: '10px', color: 'var(--text-dark)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                    {ch.category}
                  </span>
                </div>
                {activeChannel?.id === ch.id && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }}></span>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* MAIN SCREEN AREA */}
      <main className="app-main">
        {/* PLAYER & INFO */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '20px' }}>
          {activeChannel ? (
            <>
              {/* VIDEO WINDOW */}
              <div className="player-container glow-card" style={{ marginBottom: '20px', position: 'relative' }}>
                <video 
                  ref={videoRef}
                  className="player-video"
                  autoPlay={isPlaying}
                  playsInline
                  muted={isMuted}
                  controls={false}
                  onClick={togglePlay}
                  style={{ cursor: 'pointer' }}
                />
                
                {/* Visual Error Overlay */}
                {playerError && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10, 11, 20, 0.95)', padding: '24px', zIndex: 10, textAlign: 'center' }}>
                    <Info size={40} color="var(--live-red)" style={{ marginBottom: '12px' }} />
                    <p style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold', fontFamily: 'Outfit' }}>Info Pemutar Video</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px', maxWidth: '300px' }}>{playerError}</p>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                      <button className="btn-neon" style={{ padding: '6px 14px', fontSize: '11px' }} onClick={() => { setPlayerError(null); setIsPlaying(true); if (videoRef.current) videoRef.current.play().catch(() => {}); }}>
                        ▶️ Mulai
                      </button>
                      <button className="tab-btn" style={{ padding: '6px 14px', fontSize: '11px', background: 'rgba(255,255,255,0.05)' }} onClick={handleManualReload}>
                        🔄 Reload
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Control Overlay */}
                <div className="player-overlay">
                  <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center', width: '100%', color: '#fff' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={togglePlay} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
                        {isPlaying ? <span style={{ fontWeight: 'bold' }}>⏸ Pause</span> : <Play size={18} fill="#fff" />}
                      </button>
                      <button onClick={toggleMute} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                      <button onClick={handleManualReload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <RefreshCw size={14} /> Reload
                      </button>
                    </div>
                    <span style={{ fontSize: '11px', background: 'var(--live-red)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="pulse-live" style={{ background: '#fff', boxShadow: 'none' }}></span> LIVE
                    </span>
                  </div>
                </div>
              </div>

              {/* CHANNEL DETAILS */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: 50, height: 50, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContext: 'center', overflow: 'hidden' }}>
                    <img src={activeChannel.logo} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} onError={(e) => e.target.src = 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?w=128&h=128&fit=crop'} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>{activeChannel.name}</h2>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--accent)', border: '1px solid var(--accent-glow)', background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: '20px' }}>
                        {activeChannel.category}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
                        Streaming HLS • 1080p
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-neon" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={handleManualReload}>
                    <RefreshCw size={14} /> Refresh Stream
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContext: 'center', padding: '40px', textAlign: 'center' }}>
              <Tv size={64} color="var(--primary)" style={{ marginBottom: '20px' }} />
              <h2 style={{ marginBottom: '8px' }}>Wise TV Nobar Arena Nonaktif</h2>
              <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
                Silakan ketik `/nonton` di server Discord untuk mengaktifkan sesi TV atau pilih salah satu saluran di sidebar untuk memutar streaming.
              </p>
            </div>
          )}

          {/* WORLD CUP SCHEDULE HUB */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} color="var(--accent)" />
              Jadwal Pertandingan Piala Dunia 2026
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {worldCupMatches.map(match => (
                <div key={match.id} className="match-card">
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>{match.time}</span>
                    <p style={{ fontSize: '13px', fontWeight: '600', marginTop: '4px' }}>
                      {match.teamA} vs {match.teamB}
                    </p>
                  </div>
                  {match.status === 'LIVE' ? (
                    <button 
                      onClick={() => {
                        const found = channels.find(c => c.id === match.channelId);
                        if (found) changeChannel(found);
                      }}
                      className="btn-neon" 
                      style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--live-red)', boxShadow: '0 0 10px var(--live-red-glow)' }}
                    >
                      <Play size={10} fill="#fff" /> Tonton Live
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-dark)', border: '1px solid rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '6px' }}>
                      Menunggu
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
