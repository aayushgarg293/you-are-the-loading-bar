import { PROBLEMS } from './data/problems';

// A development-only menu for jumping straight to any part of the game. It is
// plain HTML laid over the page (not part of Phaser), built from the PROBLEMS
// list, so a new minigame appears here as soon as it is added there.
// Open it with the DEV tab in the bottom-right corner or the ` key.
export function addDevMenu() {
  const menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;bottom:0;right:0;z-index:10;display:flex;flex-direction:column-reverse;align-items:flex-end;font:13px/1.5 monospace;color:#f6ecd2';

  const tab = document.createElement('button');
  tab.textContent = 'DEV';
  tab.style.cssText = 'font:inherit;color:inherit;background:#161e3c;border:2px solid #f6ecd2;padding:2px 8px;cursor:pointer;opacity:0.7';

  const list = document.createElement('div');
  list.style.cssText = 'display:none;background:#161e3c;border:2px solid #f6ecd2;padding:8px 12px;min-width:330px';

  const link = (label: string, query: string) => `<a href="./${query}" style="color:#4ade80">${label}</a>`;
  const rows = PROBLEMS.filter((problem) => problem.scene).map((problem, i) => {
    const before = Math.max(0, problem.stallAt - 2); // close enough to reach the stall in a second or two
    return `<div>${i + 1}. ${problem.error?.title ?? problem.id} — ${link('play', `?scene=${problem.scene}`)} · ${link('from the main screen', `?progress=${before}`)}</div>`;
  });
  list.innerHTML = [`<div>${link('Whole game from the start', '')}</div>`, ...rows, `<div>${link('Worker test bench', '?scene=workshop')}</div>`, `<div>${link('Title screen', '?scene=title')} · ${link('Intro cutscene', '?scene=intro')}</div>`, `<div>${link('Ending cutscene', '?scene=ending')} · ${link('without the clip', '?scene=ending&novideo=1')} · ${link('end screen', '?scene=end')}</div>`, `<div>${link('Stick figure room test', '?scene=room')}</div>`].join('');

  const toggle = () => (list.style.display = list.style.display === 'none' ? 'block' : 'none');
  tab.addEventListener('click', toggle);
  window.addEventListener('keydown', (event) => {
    if (event.key === '`') toggle();
  });

  menu.append(tab, list);
  document.body.append(menu);
}
