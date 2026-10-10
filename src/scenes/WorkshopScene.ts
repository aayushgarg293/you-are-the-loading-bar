import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { debugText } from '../debug';
import { MOODS, Mood, Worker } from '../objects/Worker';

// A test bench, not part of the final game: shows the worker rig up close so we
// can check every mood, plus a row of small workers at roughly in-game size.
export class WorkshopScene extends Phaser.Scene {
  private star!: Worker;
  private label!: Phaser.GameObjects.Text;

  constructor() {
    super('Workshop');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.cream);
    const navy = Phaser.Display.Color.IntegerToColor(COLORS.navy).rgba;
    const text = { fontFamily: 'monospace', color: navy };

    this.add.text(GAME_WIDTH / 2, 36, 'WORKER RIG TEST', { ...text, fontSize: '32px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 76, 'press 1-9 or click a small worker', { ...text, fontSize: '18px' }).setOrigin(0.5);

    // Floor line.
    this.add.rectangle(GAME_WIDTH / 2, 520, GAME_WIDTH - 160, 4, COLORS.navy);

    // The big worker.
    const look = Object.fromEntries((debugText('look') ?? '').split(',').filter(Boolean).map((key) => [key, true]));
    this.star = new Worker(this, 330, 520, look);
    if (debugText('carry')) this.star.pickUp('ui', 'blockGreen');
    this.star.setScale(0.95);
    this.label = this.add.text(330, 560, '', { ...text, fontSize: '26px', fontStyle: 'bold' }).setOrigin(0.5);

    // One small worker per mood. Same rig, different hat colour and size.
    const hatTints = [0xffffff, 0xff9a9a, 0x9ad7ff, 0xb6ffb0, 0xffc48a, 0xd9b8ff, 0xffffff, 0xffffff, 0xffc48a];
    const looks = [{}, { moustache: true }, { glasses: true }, { toolBelt: true }, { longHair: true }, {}, { moustache: true, glasses: true }, { toolBelt: true }, {}];
    MOODS.forEach((mood, i) => {
      const x = 600 + i * 76;
      const small = new Worker(this, x, 520, { mood, hatTint: hatTints[i], ...looks[i] });
      small.setScale(0.3 + (i % 3) * 0.03);
      this.add.text(x, 548, `${i + 1} ${mood}`, { ...text, fontSize: '12px' }).setOrigin(0.5);

      const hitArea = this.add.zone(x, 470, 72, 130).setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => this.showMood(mood));
      this.input.keyboard?.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'][i]}`, () => this.showMood(mood));
    });

    // Lets a URL like ?mood=panic open straight on that mood (handy for checking).
    const requested = debugText('mood') as Mood | null;
    this.showMood(requested && MOODS.includes(requested) ? requested : 'idle');
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'one rig, every mood (add ?look=glasses,moustache,toolBelt,longHair or ?carry=1)', { ...text, fontSize: '16px' }).setOrigin(0.5);
  }

  private showMood(mood: Mood) {
    this.star.setMood(mood);
    this.label.setText(mood.toUpperCase());
  }
}
