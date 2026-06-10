import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { initBot } from './bot.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory cache for IPTV channels
let channelCache = [];

// TV Session state (key: voiceChannelId, value: { channelId, name, url, logo })
const tvSessions = new Map();

// SSE connections (key: voiceChannelId, value: Set<res>)
const sseClients = new Map();

// Curated featured channels for quick access (100% verified working)
const featuredChannels = [
  // 1. TV Lokal Utama & Populer
  {
    id: "trans_tv",
    name: "Trans TV (Lokal)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Trans_TV_2013.svg",
    url: "https://video.detik.com/transtv/smil:transtv.smil/index.m3u8",
    category: "Lokal"
  },
  {
    id: "trans7",
    name: "Trans 7 (Lokal)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/f6/Trans7_2013.svg",
    url: "https://video.detik.com/trans7/smil:trans7.smil/index.m3u8",
    category: "Lokal"
  },
  {
    id: "tvone_indo",
    name: "tvOne (Lokal)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/91/TvOne_2023.svg",
    url: "https://op-group1-swiftservehd-1.dens.tv/h/h40/index.m3u8",
    category: "Lokal"
  },
  {
    id: "metro_tv",
    name: "Metro TV (Lokal)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/36/Metro_TV_logo.svg",
    url: "https://edge.medcom.id/live-edge/smil:metro.smil/playlist.m3u8",
    category: "Lokal"
  },
  {
    id: "tvri_nasional",
    name: "TVRI Nasional (Lokal)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/TVRILogo2019.svg/960px-TVRILogo2019.svg.png",
    url: "https://ott-balancer.tvri.go.id/live/eds/DKI/hls/DKI.m3u8",
    category: "Lokal"
  },
  {
    id: "cnbc_indonesia",
    name: "CNBC Indonesia (Lokal)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/e1/CNBC_Indonesia.svg",
    url: "https://live.cnbcindonesia.com/livecnbc/smil:cnbctv.smil/master.m3u8",
    category: "Lokal"
  },
  {
    id: "btv_indo",
    name: "BTV (Lokal)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/82/BTV_Logo_Indonesia.svg",
    url: "https://xtdslboppkkv-pull.bpmedialive.com/live/btv/abr.m3u8",
    category: "Lokal"
  },
  {
    id: "garuda_tv",
    name: "Garuda TV (Lokal)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Garuda_TV_logo.png",
    url: "https://hgmtv.com:19360/garudatvlivestreaming/garudatvlivestreaming.m3u8",
    category: "Lokal"
  },

  // 2. Berita Internasional Utama (Berita)
  {
    id: "dw_english_intl",
    name: "DW English (Berita)",
    logo: "https://i.imgur.com/0uB0rD1.png",
    url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8",
    category: "Internasional"
  },
  {
    id: "france24_intl",
    name: "France 24 English (Berita)",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_FRANCE_24/images/LOGO_HD/image.png",
    url: "https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_5000.m3u8",
    category: "Internasional"
  },
  {
    id: "aljazeera_intl",
    name: "Al Jazeera English (Berita)",
    logo: "https://i.imgur.com/7bRVpnu.png",
    url: "https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8",
    category: "Internasional"
  },
  {
    id: "nhk_world_intl",
    name: "NHK World-Japan (Berita)",
    logo: "https://jiotvimages.cdn.jio.com/dare_images/images/NHK_World_Japan.png",
    url: "https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8",
    category: "Internasional"
  },
  {
    id: "trt_world_intl",
    name: "TRT World (Berita)",
    logo: "https://i.imgur.com/3YpS7oT.png",
    url: "https://trt-trtworld.live.trt.com.tr/hls/trtworld.m3u8",
    category: "Internasional"
  },
  {
    id: "cna_intl",
    name: "CNA English (Berita)",
    logo: "https://i.imgur.com/awIDugE.png",
    url: "https://live1.mediadesk.al/cnatvlive.m3u8",
    category: "Internasional"
  },
  {
    id: "newsmax_intl",
    name: "Newsmax (Berita)",
    logo: "https://i.imgur.com/8Qh1mXJ.png",
    url: "https://newsmax-fast.sinclairstoryline.com/playlist.m3u8",
    category: "Internasional"
  },

  // 3. Olahraga Utama (Sport)
  {
    id: "tvri_sport",
    name: "TVRI Sport (Sport)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/TVRILogo2019.svg/960px-TVRILogo2019.svg.png",
    url: "https://ott-balancer.tvri.go.id/live/eds/SportHD/hls/SportHD.m3u8",
    category: "Sport"
  },
  {
    id: "redbull_tv_intl",
    name: "Red Bull TV (Sport)",
    logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Red_Bull_TV.png",
    url: "https://0b73ace69ebb45eaa249bb87837cb958.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-644-WORBUSENFAST-LG_US/644/lgtv/hls/master/playlist.m3u8",
    category: "Sport"
  },
  {
    id: "extreme_sports_intl",
    name: "Extreme Sports Channel (Sport)",
    logo: "https://i.imgur.com/4q3kCj7.png",
    url: "https://49da9799cd7b.entrypoint.cloud.ottera.tv/playlist.m3u8",
    category: "Sport"
  },
  {
    id: "fuel_tv_intl",
    name: "FUEL TV (Sport)",
    logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Fuel_TV.png",
    url: "https://fueltv-fueltv-1-us.samsung.wurl.com/manifest/playlist.m3u8",
    category: "Sport"
  },
  {
    id: "accdn_sports_intl",
    name: "ACCDN - College Sports (Sport)",
    logo: "https://i.imgur.com/V6Kaqha.png",
    url: "https://raycom-accdn-firetv.amagi.tv/playlist.m3u8",
    category: "Sport"
  },
  {
    id: "mavtv_sports_intl",
    name: "MavTV - Motorsports (Sport)",
    logo: "https://i.imgur.com/3eJ9gX3.png",
    url: "https://mavtv-fast.sinclairstoryline.com/playlist.m3u8",
    category: "Sport"
  },
  {
    id: "horizon_sports_intl",
    name: "Horizon Sports (Sport)",
    logo: "https://i.imgur.com/X4y1n2b.png",
    url: "https://horizonsports-horizon-1-us.wurl.com/manifest/playlist.m3u8",
    category: "Sport"
  },

  // 4. Film Terpopuler (Film)
  {
    id: "filmrise_free_movies_intl",
    name: "FilmRise Free Movies (Film)",
    logo: "https://i.imgur.com/8Qh1mXJ.png",
    url: "https://filmrise-free-movies-1-us.wurl.com/manifest/playlist.m3u8",
    category: "Internasional"
  },
  {
    id: "filmrise_action_intl",
    name: "FilmRise Action (Film)",
    logo: "https://i.imgur.com/0uB0rD1.png",
    url: "https://filmrise-action-1-us.wurl.com/manifest/playlist.m3u8",
    category: "Internasional"
  },
  {
    id: "cinehouse_movies_intl",
    name: "Cinehouse (Film)",
    logo: "https://i.imgur.com/awIDugE.png",
    url: "https://cinehouse-cinehouse-1-us.wurl.com/manifest/playlist.m3u8",
    category: "Internasional"
  },
  {
    id: "movies_24h_free",
    name: "24 Hour Free Movies (Film)",
    logo: "https://i.imgur.com/iSVnzR1.png",
    url: "https://d1b5mlajbmvkjv.cloudfront.net/v1/master/9d062541f2ff39b5c0f48b743c6411d25f62fc25/UDU-DistroTV/145.m3u8?ads.vf=7FhdsxqVxOi",
    category: "Internasional"
  },
  {
    id: "movies_30a_classic",
    name: "30A TV Classic Movies (Film)",
    logo: "https://babaktv.com/wp-content/uploads/2023/09/30A-Classi-Movies.jpeg",
    url: "https://30a-tv.com/feeds/pzaz/30atvmovies.m3u8",
    category: "Internasional"
  },
  {
    id: "filmrise_scifi_intl",
    name: "FilmRise Sci-Fi (Film)",
    logo: "https://i.imgur.com/3YpS7oT.png",
    url: "https://filmrise-scifi-1-us.wurl.com/manifest/playlist.m3u8",
    category: "Internasional"
  },
  {
    id: "alien_nation_dust_intl",
    name: "Alien Nation by DUST (Film)",
    logo: "https://i.imgur.com/FxYhME9.png",
    url: "https://dqi7ayt2o24fn.cloudfront.net/playlist.m3u8",
    category: "Internasional"
  },

  // 5. Anime & Kartun Utama (Anime)
  {
    id: "anime_vision",
    name: "Anime Vision (Anime)",
    logo: "https://i.imgur.com/pUpKznl.png",
    url: "https://d1ujfw1zyymzyd.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-a6fukwkbxmex8/live/fast-channel-animevision-64527ec0/fast-channel-animevision-64527ec0.m3u8",
    category: "Internasional"
  },
  {
    id: "anime_vision_classics",
    name: "Anime Vision Classics (Anime)",
    logo: "https://i.imgur.com/mTaiEE1.png",
    url: "https://d82pyvmcw2kdc.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-swfivzrzwamaq/live/fast-channel-animevisionclassics-efc8dc6d/fast-channel-animevisionclassics-efc8dc6d.m3u8",
    category: "Internasional"
  },
  {
    id: "cartoon_classics",
    name: "Cartoon Classics (Kartun)",
    logo: "https://images-3.rakuten.tv/storage/global-live-channel/translation/artwork/3227c06e-333b-4b1b-b657-3e3ab99ebd06-width200-quality90.jpeg",
    url: "https://d3s7x6kmqcnb6b.cloudfront.net/d/distro001a/D6NOXKW7TYP8TG7YMYZH/hls3/now,-1m/m.m3u8?ads.vf=yqk-v2F2pNi",
    category: "Internasional"
  },

  // 6. Niche / Keagamaan / Uji Coba
  {
    id: "aliman_tv",
    name: "Al-Iman TV (Lokal)",
    logo: "https://i.imgur.com/Qj1EFf1.png",
    url: "https://tv.aliman.id/aliman/live.m3u8",
    category: "Lokal"
  },
  {
    id: "test_mux",
    name: "Tes Pemutar Video (MUX)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Fifa_world_cup_logo.png",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    category: "Test"
  }
];

// M3U Playlist Parser
function parseM3U(m3uContent, defaultCategory) {
  if (!m3uContent) return [];
  const lines = m3uContent.split('\n');
  const channels = [];
  let currentInfo = null;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const idMatch = line.match(/tvg-id="([^"]+)"/);
      const nameParts = line.split(',');
      const displayName = nameParts[nameParts.length - 1].trim();

      currentInfo = {
        id: idMatch ? idMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '_') : displayName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: displayName,
        logo: logoMatch ? logoMatch[1] : 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?w=128&h=128&fit=crop',
        category: defaultCategory
      };

      // Extract inline referrers and user-agents
      const refMatch = line.match(/http-referrer="([^"]+)"/);
      if (refMatch) currentInfo.referrer = refMatch[1];
      const uaMatch = line.match(/http-user-agent="([^"]+)"/);
      if (uaMatch) currentInfo.userAgent = uaMatch[1];

    } else if (line.startsWith('#EXTVLCOPT:')) {
      if (currentInfo) {
        const refOptMatch = line.match(/http-referrer=(.+)/);
        if (refOptMatch) currentInfo.referrer = refOptMatch[1].trim();
        const uaOptMatch = line.match(/http-user-agent=(.+)/);
        if (uaOptMatch) currentInfo.userAgent = uaOptMatch[1].trim();
      }
    } else if (line.startsWith('http') && currentInfo) {
      currentInfo.url = line;
      
      // Filter out known dead or unauthorized domains/streams
      const isDead = line.includes('indihuy.streamized.net') || 
                     line.includes('103.58.160.157:8278') ||
                     line.includes('Nasional/hls/Nasional.m3u8') ||
                     line.includes('/h/h217/') || // SCTV (Dead segments returning 404)
                     line.includes('/h/h235/');   // Indosiar (Dead segments returning 404)
                     
      if (!isDead) {
        channels.push(currentInfo);
      }
      currentInfo = null;
    }
  }
  return channels;
}

// Fetch channels from iptv-org
async function loadIPTVChannels() {
  console.log('Loading channels from iptv-org playlists...');
  try {
    const [indRes, sportsRes, newsRes] = await Promise.all([
      axios.get('https://iptv-org.github.io/iptv/languages/ind.m3u').catch(() => ({ data: '' })),
      axios.get('https://iptv-org.github.io/iptv/categories/sports.m3u').catch(() => ({ data: '' })),
      axios.get('https://iptv-org.github.io/iptv/categories/news.m3u').catch(() => ({ data: '' }))
    ]);

    const indChannels = parseM3U(indRes.data, 'Lokal');
    const sportsChannels = parseM3U(sportsRes.data, 'Sport');
    const newsChannels = parseM3U(newsRes.data, 'Internasional');

    const merged = [...featuredChannels, ...indChannels, ...sportsChannels, ...newsChannels];
    
    // De-duplicate by stream URL
    const seenUrls = new Set();
    const uniqueChannels = [];
    for (const channel of merged) {
      if (!seenUrls.has(channel.url)) {
        seenUrls.add(channel.url);
        uniqueChannels.push(channel);
      }
    }

    channelCache = uniqueChannels;
    console.log(`Successfully cached ${channelCache.length} channels.`);
  } catch (error) {
    console.error('Failed to load online playlists, using featured channels fallback.', error);
    channelCache = [...featuredChannels];
  }
}

// Serve static client files (built output)
app.use(express.static(path.join(__dirname, '../client/dist')));

// API: Get channel lists
app.get('/api/channels', (req, res) => {
  const { category, search, limit } = req.query;
  let channels = [...channelCache];

  if (category) {
    channels = channels.filter(c => c.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    channels = channels.filter(c => c.name.toLowerCase().includes(q));
  }

  if (limit) {
    const parsedLimit = parseInt(limit, 10);
    if (!isNaN(parsedLimit)) {
      channels = channels.slice(0, parsedLimit);
    }
  }

  res.json(channels);
});

// API: Get curated featured channels
app.get('/api/channels/featured', (req, res) => {
  res.json(featuredChannels);
});

// API: OAuth2 token exchange for Discord Embedded App SDK
app.post('/api/token', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code parameter is required' });
  }

  try {
    const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || '',
      client_secret: process.env.DISCORD_CLIENT_SECRET || '',
      grant_type: 'authorization_code',
      code: code,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('OAuth2 token exchange error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange authorization token with Discord' });
  }
});

// API: CORS Stream Proxy (Jumper) to bypass CORS and Referrer Blocks
app.get('/api/proxy', async (req, res) => {
  const { url, referer, userAgent } = req.query;
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    const isPlaylist = url.includes('.m3u8') || url.includes('manifest');
    
    // Fallback headers
    const requestReferer = referer || new URL(url).origin;
    const requestUserAgent = userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    if (isPlaylist) {
      const response = await axios.get(url, {
        responseType: 'text',
        headers: {
          'User-Agent': requestUserAgent,
          'Referer': requestReferer
        }
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const refererParam = referer ? `&referer=${encodeURIComponent(referer)}` : '';
      const uaParam = userAgent ? `&userAgent=${encodeURIComponent(userAgent)}` : '';

      // Rewrite relative URLs in the playlist file
      const lines = response.data.split('\n');
      const parsedLines = lines.map(line => {
        line = line.trim();
        if (line.startsWith('#') || line === '') {
          // Check if line contains a URI="link" attribute (like #EXT-X-MEDIA or #EXT-X-KEY)
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch) {
            const relativeUri = uriMatch[1];
            let absoluteUri = relativeUri;
            try {
              absoluteUri = new URL(relativeUri, url).toString();
            } catch (e) {
              // ignore
            }
            const proxiedUri = `/api/proxy?url=${encodeURIComponent(absoluteUri)}${refererParam}${uaParam}`;
            return line.replace(`URI="${relativeUri}"`, `URI="${proxiedUri}"`);
          }
          return line;
        }
        
        let absoluteUrl = line;
        try {
          absoluteUrl = new URL(line, url).toString();
        } catch (e) {
          // Keep line as-is if parsing fails
        }
        
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}${refererParam}${uaParam}`;
      });

      res.send(parsedLines.join('\n'));
    } else {
      // For .ts video segments and other binary files, stream directly from source
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        headers: {
          'User-Agent': requestUserAgent,
          'Referer': requestReferer
        }
      });

      res.setHeader('Access-Control-Allow-Origin', '*');
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      
      response.data.pipe(res);
    }
  } catch (error) {
    console.error(`Proxy failed for: ${url} - Error: ${error.message}`);
    res.status(500).send('Proxy stream loading failed');
  }
});

// GET: Server-Sent Events (SSE) for TV Remote Sync
app.get('/api/stream-control', (req, res) => {
  const { voiceChannelId } = req.query;
  if (!voiceChannelId) {
    return res.status(400).json({ error: 'voiceChannelId parameter is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Add client to the mapping
  if (!sseClients.has(voiceChannelId)) {
    sseClients.set(voiceChannelId, new Set());
  }
  sseClients.get(voiceChannelId).add(res);

  console.log(`Client connected to TV sync for Voice Channel: ${voiceChannelId} (Total: ${sseClients.get(voiceChannelId).size})`);

  // Send initial state if already playing something in this channel
  const currentState = tvSessions.get(voiceChannelId);
  if (currentState) {
    res.write(`data: ${JSON.stringify({ action: 'change-channel', channel: currentState })}\n\n`);
  } else {
    // Default fallback to first featured channel if nothing active
    res.write(`data: ${JSON.stringify({ action: 'change-channel', channel: featuredChannels[0] })}\n\n`);
  }

  // Handle client disconnect
  req.on('close', () => {
    console.log(`Client disconnected from TV sync for Voice Channel: ${voiceChannelId}`);
    const clients = sseClients.get(voiceChannelId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(voiceChannelId);
      }
    }
  });
});

// SSE Trigger function (to be called by Discord bot logic)
export function triggerRemoteAction(voiceChannelId, actionData) {
  // Update state in session store
  if (actionData.action === 'change-channel') {
    tvSessions.set(voiceChannelId, actionData.channel);
  } else if (actionData.action === 'stop') {
    tvSessions.delete(voiceChannelId);
  }

  const clients = sseClients.get(voiceChannelId);
  if (!clients || clients.size === 0) {
    console.log(`No active SSE players for voice channel ${voiceChannelId} to receive action: ${actionData.action}`);
    return false;
  }

  console.log(`Pushing remote action ${actionData.action} to ${clients.size} players in Voice Channel ${voiceChannelId}`);
  for (const client of clients) {
    try {
      client.write(`data: ${JSON.stringify(actionData)}\n\n`);
    } catch (e) {
      console.error('Error writing to SSE client:', e);
    }
  }
  return true;
}

// Serve the index.html for all other routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Start backend
app.listen(PORT, async () => {
  console.log(`=== Wise TV Server started on Port ${PORT} ===`);
  await loadIPTVChannels();
  
  // Start Discord Bot
  if (process.env.DISCORD_TOKEN) {
    initBot(triggerRemoteAction, tvSessions, featuredChannels, channelCache);
  } else {
    console.warn('WARNING: DISCORD_TOKEN is missing in environment. Discord Bot is disabled.');
  }
});
