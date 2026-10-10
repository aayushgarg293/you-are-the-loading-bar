import * as Phaser from 'phaser';
import { COLORS, PIXEL_FONT, hex } from '../config';

const SLOTS = 15;
const SLOT_SPACING = 56;
const BLOCK_SCALE = 0.5;
const FIRST_SLOT_X = -458; // measured from the middle of the frame picture

// The big bar across the top of the factory: a metal frame, 15 slots that turn
// from grey to green, and the percentage in pixel type. Origin is its centre.
export class LoadingBar extends Phaser.GameObjects.Container {
  private blocks: Phaser.GameObjects.Image[] = [];
  private label: Phaser.GameObjects.Text;
  private filled = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.add(scene.add.image(0, 0, 'ui', 'barFrame'));
    for (let i = 0; i < SLOTS; i++) {
      const block = scene.add.image(FIRST_SLOT_X + i * SLOT_SPACING, 0, 'ui', 'blockGrey').setScale(BLOCK_SCALE);
      this.blocks.push(block);
      this.add(block);
    }
    this.label = scene.add
      .text(488, 2, '0%', { fontFamily: PIXEL_FONT, fontSize: '28px', color: hex(COLORS.green) })
      .setOrigin(1, 0.5);
    this.add(this.label);
    scene.add.existing(this);
  }

  // How many slots a percentage lights up: 99% is 14 of 15, only 100% fills the last.
  static slotsFor(percent: number) {
    return Math.floor((percent / 100) * SLOTS);
  }

  get filledSlots() {
    return this.filled;
  }

  setPercent(percent: number) {
    this.label.setText(`${Math.floor(percent)}%`);
    return this;
  }

  // Turns the next slot green with a little pop.
  fillNextSlot() {
    if (this.filled >= SLOTS) return;
    const block = this.blocks[this.filled++];
    block.setFrame('blockGreen').setScale(BLOCK_SCALE * 1.5);
    this.scene.tweens.add({ targets: block, scale: BLOCK_SCALE, duration: 260, ease: 'Back.easeOut' });
  }

  // Scene position of a slot, so a block can fly from the conveyor into it.
  slotPosition(index: number) {
    const block = this.blocks[Math.min(index, SLOTS - 1)];
    return { x: this.x + block.x * this.scaleX, y: this.y + block.y * this.scaleY };
  }
}
