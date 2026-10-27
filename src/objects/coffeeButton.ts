import * as Phaser from 'phaser';
import { sfx } from '../audio/sound';

const COFFEE = 'https://www.buymeacoffee.com/aayushgarg';

// Buy Me a Coffee's own button picture, as a real link laid over the canvas.
// Phaser keeps it lined up and scaled with the game, and removes it when the
// scene ends. Sizes are in game pixels, like everything else; the full-size
// button is 217 x 60. Needs `dom: { createContainer: true }` in the game config.
export function addCoffeeButton(scene: Phaser.Scene, x: number, y: number, scale = 1) {
  const link = document.createElement('a');
  link.href = COFFEE;
  link.target = '_blank';
  link.rel = 'noopener';
  const image = document.createElement('img');
  image.src = 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png';
  image.alt = 'Buy Me a Coffee';
  image.style.cssText = `height: ${60 * scale}px; width: ${217 * scale}px; display: block;`;
  link.append(image);
  link.addEventListener('click', () => sfx.click());
  return scene.add.dom(x, y, link);
}
