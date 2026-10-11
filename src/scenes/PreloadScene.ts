import * as Phaser from 'phaser';
import { setAudioContext } from '../audio/sound';
import { debugText } from '../debug';

// Loads every image the game needs, then hands over to the first real scene.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    for (const atlas of ['worker', 'faces', 'extras', 'hands', 'hamster', 'wheel', 'feeding', 'props', 'ui', 'fan', 'antivirus', 'connection', 'zip', 'side', 'faces-side', 'packets', 'cpu']) {
      this.load.atlas(atlas, `assets/${atlas}.webp`, `assets/${atlas}.json`);
    }
    this.load.image('factory-bg', 'assets/factory-bg.webp');
  }

  create() {
    // Hand Phaser's audio context to our sound module (see src/audio/sound.ts).
    if ('context' in this.sound) setAudioContext(this.sound.context);

    // ?scene=hamster (a short name) or ?scene=FeedHamster (the scene's own key)
    // jumps straight to that scene for testing.
    const shortcuts: Record<string, string> = { workshop: 'Workshop', hamster: 'FeedHamster', wake: 'WakeWorkers', circuit: 'Circuit', blocks: 'CorruptedBlocks', packets: 'PacketDelivery', cpu: 'CpuCooling', zip: 'ZipFile', crash: 'Crash', room: 'Room', intro: 'Intro', ending: 'Ending', end: 'EndScreen', title: 'Title' };
    const wanted = debugText('scene') ?? '';
    const key = shortcuts[wanted] ?? wanted;
    if (this.scene.manager.keys[key]) this.scene.start(key);
    // ?progress=N is for testing the main screen, so it skips the title and opening cutscene.
    else this.scene.start(debugText('progress') !== null ? 'Factory' : 'Title');
  }
}
