import '@fontsource/press-start-2p';
import * as Phaser from 'phaser';
import { toggleMute } from './audio/sound';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT } from './config';
import { CircuitScene } from './scenes/CircuitScene';
import { PacketDeliveryScene } from './scenes/PacketDeliveryScene';
import { CrashScene } from './scenes/CrashScene';
import { CpuCoolingScene } from './scenes/CpuCoolingScene';
import { CorruptedBlocksScene } from './scenes/CorruptedBlocksScene';
import { EndingScene } from './scenes/EndingScene';
import { EndScreenScene } from './scenes/EndScreenScene';
import { FactoryScene } from './scenes/FactoryScene';
import { FeedHamsterScene } from './scenes/FeedHamsterScene';
import { IntroScene } from './scenes/IntroScene';
import { TitleScene } from './scenes/TitleScene';
import { PreloadScene } from './scenes/PreloadScene';
import { RoomScene } from './scenes/RoomScene';
import { WakeWorkersScene } from './scenes/WakeWorkersScene';
import { WorkshopScene } from './scenes/WorkshopScene';
import { ZipFileScene } from './scenes/ZipFileScene';

// Wait for the pixel font before starting, otherwise the first text drawn
// would use a fallback font.
document.fonts.load(`16px ${PIXEL_FONT}`).finally(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: COLORS.navy,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Lets a scene put real HTML on top of the canvas (the end screen's Buy Me a Coffee link).
    dom: { createContainer: true },
    // The first scene in the list starts automatically.
    scene: [PreloadScene, TitleScene, FactoryScene, FeedHamsterScene, WakeWorkersScene, CircuitScene, CorruptedBlocksScene, PacketDeliveryScene, CpuCoolingScene, ZipFileScene, CrashScene, RoomScene, IntroScene, EndingScene, EndScreenScene, WorkshopScene],
  });
  // M mutes and unmutes everything, on any screen.
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'm') toggleMute();
  });

  // While developing, expose the game in the browser console as `game`, and
  // add a menu for jumping straight to any minigame.
  // The dev menu is loaded only here, so none of it ends up in the real build.
  if (import.meta.env.DEV) {
    Object.assign(window, { game });
    import('./devMenu').then(({ addDevMenu }) => addDevMenu());
  }
});
