import * as Phaser from 'phaser';
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
    // ?scene=hamster (a short name) or ?scene=FeedHamster (the scene's own key)
    // jumps straight to that scene for testing.
    const shortcuts: Record<string, string> = { workshop: 'Workshop', hamster: 'FeedHamster', wake: 'WakeWorkers', circuit: 'Circuit', blocks: 'CorruptedBlocks', packets: 'PacketDelivery', cpu: 'CpuCooling', zip: 'ZipFile' };
    const wanted = debugText('scene') ?? '';
    const key = shortcuts[wanted] ?? wanted;
    this.scene.start(this.scene.manager.keys[key] ? key : 'Factory');
  }
}
