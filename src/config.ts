// The game is designed at this size; Phaser scales it to fit the browser window.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Palette taken from the title concept art.
export const COLORS = {
  cream: 0xf6ecd2,
  navy: 0x161e3c,
  green: 0x4ade80,
  yellow: 0xf7c81e,
  red: 0xe5483a,
  skin: 0xfcd0b0,
};

// What he thinks he is downloading. (A parody name, on purpose.)
export const DOWNLOAD_FILE = 'taylor_drift_new_single.mp3';

export const PIXEL_FONT = '"Press Start 2P"';

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
