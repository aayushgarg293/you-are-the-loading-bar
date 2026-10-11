import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_FONT, hex } from '../config';
import { Worker } from '../objects/Worker';
import { MinigameScene } from './MinigameScene';
import { sfx } from '../audio/sound';

const PRESS_GAIN = 0.034; // how much each good key press squashes the file
const SPRING_BACK = 0.05; // how much it swells back per second when nearly empty ...
const SPRING_BACK_FULL = 0.12; // ... and when nearly zipped
const SECONDS_BEFORE_REFRESH = 40;

const FLOOR_Y = 640;
const FOLDER = { x: 640, scale: 1.4 };
const STAND_OFFSET = 86; // how far left and right of centre the two workers stand
const JUMP_HEIGHT = 80;
const SIZE_START = 4.7e9; // bytes: 4.7 GB
const SIZE_END = 12e3; // bytes: 12 KB
const BAR = { x: GAME_WIDTH / 2 - 260, y: 112, width: 520, height: 26 };

type Side = 'left' | 'right';

interface Jumper {
  worker: Worker;
  lift: number; // how far above the folder they are right now (tweened)
  key: Phaser.GameObjects.Container; // their key cap on screen
}

// Minigame "zip.exe": the file is too large to send, so two workers jump on
// the folder to zip it shut. Tap the Left and Right arrow keys in turn; each
// press makes that side's worker jump. Pressing the same key twice does
// nothing, and the folder slowly swells back, so keep the rhythm going.
export class ZipFileScene extends MinigameScene {
  private folder!: Phaser.GameObjects.Image;
  private jumpers!: Record<Side, Jumper>;
  private barFill!: Phaser.GameObjects.Rectangle;
  private barText!: Phaser.GameObjects.Text;
  private sizeText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private nextSide: Side = 'left';
  private compression = 0; // 0 = bulging, 1 = zipped
  private squash = 0; // a short extra dip each time someone lands

  constructor() {
    super('ZipFile');
  }

  create() {
    this.nextSide = 'left';
    this.compression = 0;
    this.squash = 0;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'factory-bg').setScale(1.5).setOrigin(0.36, 0.56);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.62).setOrigin(0);

    const text = (size: number, colour: number) => ({ fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: hex(colour), stroke: hex(COLORS.navy), strokeThickness: 8 });

    // Progress bar, the kind a real zip program shows.
    this.add.rectangle(BAR.x - 6, BAR.y, BAR.width + 12, BAR.height + 12, COLORS.navy).setOrigin(0, 0.5);
    this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, COLORS.cream).setOrigin(0, 0.5);
    this.barFill = this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, COLORS.green).setOrigin(0, 0.5).setScale(0, 1);
    this.barText = this.add.text(GAME_WIDTH / 2, BAR.y + 1, '', { fontFamily: PIXEL_FONT, fontSize: '12px', color: hex(COLORS.navy) }).setOrigin(0.5);

    // The workers are added before the folder, so their feet sink into it.
    const hire = (side: Side, look: object) => {
      const sign = side === 'left' ? -1 : 1;
      const worker = new Worker(this, FOLDER.x + sign * STAND_OFFSET, 0, { ...look, mood: 'work' }).setScale(0.45);
      return { worker, lift: 0, key: this.buildKey(FOLDER.x + sign * 330, 560, sign) };
    };
    this.jumpers = {
      left: hire('left', { moustache: true, hatTint: 0x9cc9ff }),
      right: hire('right', { glasses: true, hatTint: 0xff9d8a }),
    };
    this.folder = this.add.image(FOLDER.x, FLOOR_Y, 'zip', 'folderFull').setOrigin(0.5, 1).setScale(FOLDER.scale);

    this.nameText = this.add.text(FOLDER.x, FLOOR_Y + 22, 'cat_video.mp4', text(14, COLORS.cream)).setOrigin(0.5);
    this.sizeText = this.add.text(210, 330, '', { ...text(34, COLORS.red), align: 'center' }).setOrigin(0.5);
    this.add.text(210, 280, 'FILE SIZE', text(12, COLORS.cream)).setOrigin(0.5);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-LEFT', () => this.press('left'));
    keyboard.on('keydown-A', () => this.press('left'));
    keyboard.on('keydown-RIGHT', () => this.press('right'));
    keyboard.on('keydown-D', () => this.press('right'));

    this.openWindow('zip.exe', 'Tap the Left and Right arrow keys in turn to jump on the file and zip it');
    this.startFrustration(SECONDS_BEFORE_REFRESH);
    this.cameras.main.fadeIn(250, 22, 30, 60);
    this.highlightNextKey();
    this.draw();
  }

  // A key cap with an arrow on it. `sign` is -1 for left, 1 for right.
  private buildKey(x: number, y: number, sign: number) {
    const cap = this.add.graphics();
    cap.fillStyle(COLORS.navy).fillRoundedRect(-36, -36, 72, 72, 12);
    cap.fillStyle(COLORS.cream).fillRoundedRect(-30, -32, 60, 58, 8);
    cap.fillStyle(COLORS.navy).fillTriangle(sign * 14, 0, -sign * 10, -15, -sign * 10, 15);
    return this.add.container(x, y, [cap]);
  }

  // The key to press next is bright and pulsing; the other one is dimmed.
  private highlightNextKey() {
    for (const side of ['left', 'right'] as Side[]) {
      const { key } = this.jumpers[side];
      this.tweens.killTweensOf(key);
      key.setScale(1).setAlpha(side === this.nextSide ? 1 : 0.35);
      if (side === this.nextSide && !this.finished) this.tweens.add({ targets: key, scale: 1.15, duration: 180, yoyo: true, repeat: -1 });
    }
  }

  private press(side: Side) {
    if (this.finished || side !== this.nextSide) return; // same key twice in a row: ignored
    this.nextSide = side === 'left' ? 'right' : 'left';
    sfx.thump();
    this.highlightNextKey();
    this.compression = Math.min(1, this.compression + PRESS_GAIN);

    // The worker hops up and comes down; the landing dents the folder.
    const jumper = this.jumpers[side];
    this.tweens.killTweensOf(jumper);
    jumper.lift = 0;
    this.tweens.add({
      targets: jumper,
      lift: JUMP_HEIGHT,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.squash = 1;
        if (Math.random() < 0.18) this.meow();
      },
    });

    if (this.compression >= 1) this.celebrate();
  }

  // It is a cat video, after all.
  private meow() {
    sfx.meow();
    const cry = this.add
      .text(FOLDER.x + Phaser.Math.Between(-120, 120), this.folderTop - 30, 'meow!', { fontFamily: PIXEL_FONT, fontSize: '14px', color: hex(COLORS.yellow), stroke: hex(COLORS.navy), strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(50)
      .setAngle(Phaser.Math.Between(-14, 14));
    this.tweens.add({ targets: cry, y: cry.y - 70, alpha: 0, duration: 700, onComplete: () => cry.destroy() });
  }

  // How tall the folder is drawn: it flattens as it is zipped, and dips a
  // little more for a moment after each landing.
  private get folderHeightScale() {
    return Phaser.Math.Linear(1, 0.62, this.compression) - this.squash * 0.06;
  }

  private get folderTop() {
    return FLOOR_Y - this.folder.height * FOLDER.scale * this.folderHeightScale;
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (this.finished) return;
    const seconds = delta / 1000;

    // The file springs back by itself, harder the more it has been squashed.
    this.compression = Math.max(0, this.compression - Phaser.Math.Linear(SPRING_BACK, SPRING_BACK_FULL, this.compression) * seconds);
    this.squash = Math.max(0, this.squash - seconds * 7);
    this.draw();
  }

  private draw() {
    // Wider as it gets flatter, like anything being sat on.
    this.folder.setScale(FOLDER.scale * (1 + (1 - this.folderHeightScale) * 0.25), FOLDER.scale * this.folderHeightScale);
    for (const { worker, lift } of Object.values(this.jumpers)) worker.setY(this.folderTop + 44 - lift);

    this.barFill.setScale(this.compression, 1);
    this.barText.setText(`ZIPPING ${Math.floor(this.compression * 100)}%`);
    this.sizeText.setText(this.sizeLabel()).setColor(hex(this.compression > 0.66 ? COLORS.green : this.compression > 0.33 ? COLORS.yellow : COLORS.red));
  }

  // The size shrinks by the same proportion for each step of progress, so it
  // sweeps smoothly from gigabytes through megabytes down to kilobytes.
  private sizeLabel() {
    const bytes = SIZE_START * Math.pow(SIZE_END / SIZE_START, this.compression);
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
    return `${Math.round(bytes / 1e3)} KB`;
  }

  private celebrate() {
    this.compression = 1;
    this.squash = 0;
    this.draw();
    // Swap in the neatly zipped folder; the workers hop down beside it and cheer.
    this.folder.setTexture('zip', 'folderZipped').setScale(FOLDER.scale * 1.05);
    this.nameText.setText('cat_video.zip');
    this.win(); // marks the round finished, so the keys below stop pulsing
    this.highlightNextKey();
    (['left', 'right'] as Side[]).forEach((side, i) => {
      const { worker, key } = this.jumpers[side];
      key.setAlpha(0.35);
      this.tweens.killTweensOf(this.jumpers[side]);
      worker.setDepth(5).setMood('cheer');
      this.tweens.add({ targets: worker, x: FOLDER.x + (i ? 250 : -250), y: FLOOR_Y + 10, duration: 260, ease: 'Quad.easeOut' });
    });
  }
}
