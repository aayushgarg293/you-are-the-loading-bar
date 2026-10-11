import * as Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

// Shows a real YouTube video on top of the game, through YouTube's own
// embedded player. The video is streamed by YouTube inside their player; none
// of it is part of this game's files.
//
// The player is an ordinary web-page element laid over the canvas (Phaser
// cannot draw a video from another site), lined up with a rectangle given in
// game coordinates.

const WAIT_FOR_PLAYBACK = 4500; // milliseconds before giving up (no internet, blocked, or an advert first)

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoHandle {
  hide(): void; // keeps the sound, hides the picture
  destroy(): void;
}

declare global {
  interface Window {
    YT?: any;
  }
}

// Fetches YouTube's player code ahead of time, so the video starts sooner.
export function preloadYouTube() {
  if (document.getElementById('youtube-api')) return;
  const script = document.createElement('script');
  script.id = 'youtube-api';
  script.src = 'https://www.youtube.com/iframe_api';
  document.head.append(script);
}

// Starts the video. Exactly one of `onPlaying` or `onFailed` is called:
// `onPlaying` once the video itself is running, `onFailed` if that has not
// happened in time. This must be called from a click, or browsers mute it.
export function playYouTube(scene: Phaser.Scene, rect: Rect, videoId: string, onPlaying: () => void, onFailed: () => void): VideoHandle {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;z-index:5;background:#000;overflow:hidden';
  const target = document.createElement('div');
  holder.append(target);
  document.body.append(holder);

  // Keep the player lined up with the game, whatever size the window is.
  const place = () => {
    const canvas = scene.game.canvas.getBoundingClientRect();
    const scale = canvas.width / GAME_WIDTH;
    holder.style.left = `${canvas.left + rect.x * scale}px`;
    holder.style.top = `${canvas.top + rect.y * scale}px`;
    holder.style.width = `${rect.width * scale}px`;
    holder.style.height = `${rect.height * scale}px`;
  };
  place();
  window.addEventListener('resize', place);

  let settled = false;
  const settle = (outcome: () => void) => {
    if (settled) return;
    settled = true;
    outcome();
  };
  const giveUp = window.setTimeout(() => settle(onFailed), WAIT_FOR_PLAYBACK);

  let player: any;
  const start = () => {
    if (settled) return;
    player = new window.YT.Player(target, {
      width: '100%',
      height: '100%',
      videoId,
      host: 'https://www.youtube-nocookie.com', // YouTube's reduced-tracking address
      playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
      events: {
        onStateChange: (event: { data: number }) => {
          if (event.data === window.YT.PlayerState.PLAYING) settle(onPlaying);
        },
        onError: () => settle(onFailed),
      },
    });
  };
  // The player code may still be on its way; check back until it has arrived.
  const waitForApi = window.setInterval(() => {
    if (!window.YT?.Player) return;
    window.clearInterval(waitForApi);
    start();
  }, 100);

  return {
    hide: () => {
      holder.style.opacity = '0';
      holder.style.pointerEvents = 'none';
    },
    destroy: () => {
      settled = true;
      window.clearTimeout(giveUp);
      window.clearInterval(waitForApi);
      window.removeEventListener('resize', place);
      player?.destroy?.();
      holder.remove();
    },
  };
}
