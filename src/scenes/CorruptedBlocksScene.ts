import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Worker } from '../objects/Worker';
import { MinigameScene } from './MinigameScene';
import { sfx } from '../audio/sound';

const BELT_TOP = 357; // top of the data bus in the zoomed backdrop
const EXIT_X = 1190;
const BLOCK_SIZE = 66;
const BLOCKS_TO_WIN = 16;
const BAD_CHANCE = 0.36;
const TROJAN_CHANCE = 0.35; // share of bad items that arrive disguised as a clean block
const WRONG_CLICK_PENALTY = 0.06;
const ESCAPED_PENALTY = 0.1;
const SECONDS_BEFORE_REFRESH = 50;
const BIN = { x: 640, y: 672 };

type Kind = 'clean' | 'virus' | 'trojan';

interface Block {
  view: Phaser.GameObjects.Container; // the thing that moves; origin is where it rests on the belt
  picture: Phaser.GameObjects.Image;
  emblem?: Phaser.GameObjects.Image; // the wooden horse on a Trojan
  kind: Kind;
  unmasked: boolean; // a Trojan that has dropped its disguise
}

// Minigame "antivirus.exe": viruses have got into the download. Click them and
// they are thrown in the Recycle Bin; let the clean green blocks through. Some
// viruses are Trojan horses: they look like a clean block, apart from the
// wooden horse stamped on the front.
export class CorruptedBlocksScene extends MinigameScene {
  private blocks: Block[] = [];
  private goalSlots: Phaser.GameObjects.Image[] = [];
  private bin!: Phaser.GameObjects.Image;
  private workers: Worker[] = [];
  private hint?: Phaser.GameObjects.Image;
  private hintBlock?: Block;
  private clock = 0;
  private nextSpawn = 0;
  private delivered = 0;

  constructor() {
    super('CorruptedBlocks');
  }

  create() {
    this.blocks = [];
    this.goalSlots = [];
    this.workers = [];
    this.hint = undefined;
    this.hintBlock = undefined;
    this.clock = 0;
    this.nextSpawn = 400;
    this.delivered = 0;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'factory-bg').setScale(1.5).setOrigin(0.36, 0.56);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.35).setOrigin(0);

    const slotsLeft = GAME_WIDTH / 2 - ((BLOCKS_TO_WIN - 1) * 40) / 2;
    for (let i = 0; i < BLOCKS_TO_WIN; i++) {
      this.goalSlots.push(this.add.image(slotsLeft + i * 40, 112, 'ui', 'blockGrey').setScale(0.36));
    }

    this.bin = this.add.image(BIN.x, BIN.y, 'antivirus', 'recycleBin').setOrigin(0.5, 1).setScale(0.8).setDepth(40);
    this.workers = [
      new Worker(this, 470, 660, { mood: 'panic', moustache: true }).setScale(0.5),
      new Worker(this, 812, 660, { mood: 'panic', longHair: true, hatTint: 0xff9d8a }).setScale(0.5),
    ];

    this.openWindow('antivirus.exe', 'Click viruses and Trojan horses into the Recycle Bin. Let clean blocks pass');
    this.startFrustration(SECONDS_BEFORE_REFRESH);
    this.cameras.main.fadeIn(250, 22, 30, 60);
  }

  // The round speeds up as more good blocks get through.
  private get pace() {
    return this.delivered / BLOCKS_TO_WIN;
  }

  private spawn() {
    let kind: Kind = 'clean';
    if (Math.random() < BAD_CHANCE) kind = this.delivered >= 4 && Math.random() < TROJAN_CHANCE ? 'trojan' : 'virus';
    if (this.clock < 1000) kind = 'virus'; // the very first item is always a virus, to teach the rule

    // A container, so a Trojan's block and its horse emblem move as one.
    const picture = this.add.image(0, 0, 'ui', 'blockGreen').setOrigin(0.5, 1);
    const view = this.add.container(-40, BELT_TOP, [picture]);
    const block: Block = { view, picture, kind, unmasked: false };
    if (kind === 'virus') this.showVirus(block);
    else picture.setDisplaySize(BLOCK_SIZE, BLOCK_SIZE);
    if (kind === 'trojan') {
      block.emblem = this.add.image(0, -BLOCK_SIZE / 2, 'antivirus', 'horse').setScale(0.36);
      view.add(block.emblem);
    }

    // A generous click target: moving things are hard to hit exactly.
    view.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-BLOCK_SIZE / 2 - 26, -BLOCK_SIZE - 30, BLOCK_SIZE + 52, BLOCK_SIZE + 56),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    view.on('pointerdown', () => this.clicked(block));
    this.blocks.push(block);

    // A pointing hand rides above the first virus.
    if (kind === 'virus' && !this.hint && this.delivered === 0 && this.clock < 1000) {
      this.hintBlock = block;
      this.hint = this.add.image(view.x, BELT_TOP - 160, 'hands', 'pointL').setScale(0.55).setAngle(90).setDepth(60);
      this.tweens.add({ targets: this.hint, y: this.hint.y + 22, duration: 280, yoyo: true, repeat: -1 });
    }
  }

  // Swaps the picture for the virus bug, scuttling along on its legs.
  private showVirus(block: Block) {
    block.emblem?.destroy();
    block.emblem = undefined;
    block.unmasked = true;
    block.picture.setTexture('antivirus', 'virus').setDisplaySize(BLOCK_SIZE + 22, BLOCK_SIZE + 20);
    this.tweens.add({ targets: block.picture, angle: { from: -7, to: 7 }, duration: 130, yoyo: true, repeat: -1 });
  }

  private clicked(block: Block) {
    if (this.finished) return;
    this.removeHint(block);
    this.blocks = this.blocks.filter((other) => other !== block);

    if (block.kind === 'clean') {
      // Oops: a perfectly good block goes in the bin.
      this.addFrustration(WRONG_CLICK_PENALTY);
      this.cameras.main.shake(100, 0.004);
    } else if (!block.unmasked) {
      this.showVirus(block); // caught: the Trojan shows what it really is
    }
    this.throwInBin(block);
  }

  private throwInBin(block: Block) {
    sfx.zap();
    const view = block.view.disableInteractive().setDepth(30);
    const binTop = BIN.y - 170;
    this.tweens.add({ targets: view, x: BIN.x, duration: 380, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: view, angle: 300, scale: 0.7, duration: 380 });
    this.tweens.add({
      targets: view,
      y: binTop,
      duration: 380,
      ease: 'Back.easeIn',
      onComplete: () => {
        view.destroy();
        this.tweens.add({ targets: this.bin, scaleY: 0.7, duration: 70, yoyo: true });
        if (block.kind !== 'clean') this.showShield();
      },
    });
  }

  // "Threat removed": a shield pops up out of the bin.
  private showShield() {
    const shield = this.add.image(BIN.x, BIN.y - 190, 'antivirus', 'shield').setScale(0.1).setDepth(45);
    this.tweens.add({ targets: shield, scale: 0.36, y: shield.y - 40, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: shield, alpha: 0, delay: 380, duration: 200, onComplete: () => shield.destroy() });
  }

  private removeHint(block: Block) {
    if (block !== this.hintBlock) return;
    this.hint?.destroy();
    this.hint = undefined;
    this.hintBlock = undefined;
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (this.finished) return;
    this.clock += delta;

    if (this.clock >= this.nextSpawn) {
      this.nextSpawn = this.clock + Phaser.Math.Linear(880, 520, this.pace);
      this.spawn();
    }

    const speed = Phaser.Math.Linear(170, 265, this.pace);
    for (const block of this.blocks) {
      block.view.x += (speed * delta) / 1000;
      // A Trojan drops its disguise shortly before the end of the belt.
      if (block.kind === 'trojan' && !block.unmasked && block.view.x > EXIT_X * 0.72) this.showVirus(block);
    }
    if (this.hint && this.hintBlock) this.hint.x = this.hintBlock.view.x;

    const arrived = this.blocks.filter((block) => block.view.x >= EXIT_X);
    if (arrived.length) this.blocks = this.blocks.filter((block) => block.view.x < EXIT_X);
    for (const block of arrived) {
      this.removeHint(block);
      if (block.kind === 'clean') this.deliver(block);
      else this.escaped(block);
    }
  }

  private deliver(block: Block) {
    if (this.delivered >= BLOCKS_TO_WIN) return block.view.destroy();
    const slot = this.goalSlots[this.delivered++];
    block.view.disableInteractive().setDepth(50);
    this.tweens.add({
      targets: block.view,
      x: slot.x,
      y: slot.y + 19,
      scale: 0.6,
      duration: 360,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        block.view.destroy();
        slot.setFrame('blockGreen').setScale(0.5);
        this.tweens.add({ targets: slot, scale: 0.36, duration: 220, ease: 'Back.easeOut' });
      },
    });
    if (this.delivered >= BLOCKS_TO_WIN) this.celebrate();
  }

  // A virus got through: it bursts and costs a chunk of patience.
  private escaped(block: Block) {
    this.addFrustration(ESCAPED_PENALTY);
    this.cameras.main.shake(180, 0.008);
    this.cameras.main.flash(120, 229, 72, 58);
    const burst = this.add.image(block.view.x, BELT_TOP - 30, 'props', 'zap').setScale(0.3).setTint(0xff8a7a).setDepth(60);
    this.tweens.add({ targets: burst, scale: 0.9, alpha: 0, duration: 350, onComplete: () => burst.destroy() });
    block.view.destroy();
  }

  private celebrate() {
    for (const block of this.blocks) block.view.disableInteractive();
    for (const worker of this.workers) worker.setMood('cheer');
    this.win();
  }
}
