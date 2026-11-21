const viewer = document.querySelector('#viewer');
const player = viewer.querySelector('video');
const scrubber = document.querySelector('.track');
// Matched first and return frame indices in the 24 fps website videos.
const filmFrames = {
  'assets/lumiere-revisit.mp4': [172, 706],

};
const jumpControls = viewer.querySelector('.film-jumps');
let requestedTime = 0;
let playOnOpen = false;
let returnFocus;

function showRequestedFrame() {
  if (!playOnOpen) player.pause();
  player.currentTime = requestedTime;
  if (playOnOpen) player.play().catch(() => { /* Playback can also start from native controls. */ });
}

function openVideo(time, trigger, play = false) {
  explainer.pause();
  requestedTime = time;
  playOnOpen = play;
  returnFocus = trigger;
  const source = trigger.getAttribute('href')?.split('#')[0] || 'assets/lumiere-revisit.mp4';
  jumpControls.hidden = !filmFrames[source];
  jumpControls.querySelector('output').textContent = '';
  viewer.querySelector('#film-title').textContent = trigger.dataset.title || 'Lumière revisit';
  const description = trigger.dataset.scene || 'Lumière · Paintress';
  viewer.querySelector('.film-foot span').textContent = description;
  player.setAttribute('aria-label', description);
  if (typeof viewer.showModal !== 'function') {
    location.href = source + '#t=' + time;
    return;
  }
  viewer.showModal();
  if (player.getAttribute('src') !== source) {
    player.src = source;
    player.load();
  } else if (player.readyState >= 1) {
    showRequestedFrame();
  }
}

player.addEventListener('loadedmetadata', () => {
  if (viewer.open) showRequestedFrame();
});
for (const jump of jumpControls.querySelectorAll('button')) {
  jump.addEventListener('click', () => {
    const frame = filmFrames[player.getAttribute('src')][Number(jump.dataset.jump)];
    requestedTime = frame / 24;
    playOnOpen = false;
    if (player.readyState >= 1) showRequestedFrame();
    jumpControls.querySelector('output').textContent = jump.textContent;
  });
}
player.addEventListener('play', () => { jumpControls.querySelector('output').textContent = ''; });
for (const link of document.querySelectorAll('[data-video]')) {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const time = Number(link.dataset.video);
    openVideo(time, link, time === 0);
  });
}
function updateScrubber() {
  const time = scrubber.valueAsNumber;
  const clock = scrubber.closest('.route-clock');
  clock.style.setProperty('--clock-position', (100 * time / Number(scrubber.max)) + '%');
  clock.querySelector('.clock-readout').textContent = '0:' + time.toFixed(1).padStart(4, '0');
  scrubber.setAttribute('aria-valuetext', time.toFixed(1) + ' seconds');
}
updateScrubber();
const routeClock = scrubber.closest('.route-clock');
for (const eventName of ['pointerenter', 'focusin', 'animationend']) {
  routeClock.addEventListener(eventName, () => routeClock.classList.add('route-ready'), { once:true });
}
scrubber.addEventListener('input', updateScrubber);
scrubber.addEventListener('pointerup', () => openVideo(scrubber.valueAsNumber, scrubber));
scrubber.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openVideo(scrubber.valueAsNumber, scrubber);
  }
});
viewer.addEventListener('close', () => {
  player.pause();
  returnFocus?.focus({ preventScroll: true });
});
viewer.addEventListener('click', event => {
  if (event.target !== viewer) return;
  const box = viewer.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom) viewer.close();
});

// Reveal the two recorded frames at the same camera coordinates.
const matchedFrames = document.querySelector('#matched-frames');
const wipeSlider = matchedFrames.querySelector('.wipe-slider');
const wipeLayer = matchedFrames.querySelector('.wipe-layer');
const wipeActions = document.querySelector('.wipe-actions');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeSweep = null;

function setSplit(percent) {
  wipeSlider.value = String(Math.round(percent));
  matchedFrames.style.setProperty('--split', wipeSlider.value + '%');
  wipeSlider.setAttribute('aria-valuetext', wipeSlider.value + '% first visit visible');
}

function stopSweep() {
  if (!activeSweep) return;
  const visible = parseFloat(getComputedStyle(matchedFrames).getPropertyValue('--split'));
  activeSweep.cancel();
  activeSweep = null;
  setSplit(visible);
}

function sweepTo(target) {
  stopSweep();
  const start = wipeSlider.valueAsNumber;
  setSplit(target);
  if (reducedMotion.matches || start === target || !('registerProperty' in CSS)) return;
  const animation = matchedFrames.animate(
    [{ '--split': start + '%' }, { '--split': target + '%' }],
    { duration: 180 + 2.8 * Math.abs(target - start), easing: 'cubic-bezier(.16,1,.3,1)' }
  );
  activeSweep = animation;
  animation.onfinish = () => {
    if (activeSweep === animation) activeSweep = null;
  };
}
for (const button of wipeActions.querySelectorAll('[data-split]')) {
  button.addEventListener('click', () => sweepTo(Number(button.dataset.split)));
}
for (const eventName of ['pointerdown','keydown']) {
  wipeSlider.addEventListener(eventName, stopSweep);
}
wipeSlider.addEventListener('input', () => {
  const next = wipeSlider.valueAsNumber;
  stopSweep();
  setSplit(next);
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && activeSweep) activeSweep.finish();
});
function setFrameView() {
  stopSweep();
  const wipe = document.querySelector('[name="compare-view"]:checked').value === 'wipe';
  matchedFrames.classList.toggle('wipe-view', wipe);
  wipeLayer.hidden = !wipe;
  wipeActions.hidden = !wipe;
}
for (const option of document.querySelectorAll('[name="compare-view"]')) {
  option.addEventListener('change', setFrameView);
}
setSplit(wipeSlider.valueAsNumber);
setFrameView();
document.querySelector('.view-controls').hidden = false;

// A scroll cue is useful only when some columns are off screen.
if ('ResizeObserver' in window) {
  const tableSize = new ResizeObserver(entries => {
    for (const {target} of entries) {
      const hint = target.previousElementSibling;
      const overflows = target.scrollWidth > target.clientWidth + 1;
      hint.hidden = !overflows;
      if (overflows) target.setAttribute('aria-describedby', hint.id);
      else target.removeAttribute('aria-describedby');
    }
  });
  for (const region of document.querySelectorAll('.result-block .table-scroll')) {
    tableSize.observe(region);
  }
}

const explainer = document.querySelector('#paper-player');
const chapters = document.querySelector('.film-chapters');
for (const chapter of chapters.querySelectorAll('button')) {
  chapter.addEventListener('click', () => {
    explainer.currentTime = Number(chapter.dataset.start);
    explainer.play().catch(() => { /* Native controls also allow starting playback. */ });
  });
}
chapters.hidden = false;
explainer.addEventListener('play', () => player.pause());

const modelRoute = document.querySelector('.model-route');
const modelTiles = document.querySelectorAll('.model-tile');
const modelViewer = document.querySelector('#model-viewer');
function updateModelGrid() {
  const route = modelRoute.querySelector(':checked');
  document.querySelector('.model-cue').textContent = route.dataset.cue;
  for (const tile of modelTiles) {
    const base = 'assets/' + route.value + '-' + tile.dataset.model;
    const article = tile.closest('article');
    const name = article.querySelector('h3').textContent;
    const scene = route.parentElement.textContent.trim();
    const link = article.querySelector('.model-film');
    const source = base + '-route.mp4';
    link.href = source;
    filmFrames[source] = [Number(route.dataset.firstFrame), Number(route.dataset.returnFrame)];
    link.dataset.scene = scene + ' · 15 seconds away';
    link.setAttribute('aria-label', 'Play ' + name + ' route in ' + scene);
    const [first, revisit] = tile.querySelectorAll('img');
    first.src = base + '-first.webp';
    revisit.src = base + '-return.webp';
  }
}
modelRoute.addEventListener('change', updateModelGrid);
updateModelGrid();
modelRoute.hidden = false;
for (const tile of modelTiles) {
  tile.disabled = false;
  tile.addEventListener('click', () => {
    const name = tile.closest('article').querySelector('h3').textContent;
    const route = modelRoute.querySelector(':checked');
    const scene = route.parentElement.textContent.trim();
    document.querySelector('#model-title').textContent = name;
    document.querySelector('#model-scene').textContent = scene + ' · 15 seconds away';
    const pair = tile.querySelectorAll('img');
    for (const [i, img] of modelViewer.querySelectorAll('img').entries()) {
      img.src = pair[i].src;
      img.alt = name + ', ' + scene + ', ' + img.previousElementSibling.textContent.toLowerCase();
    }
    modelViewer.showModal();
  });
}

// One video holds all ten views of each pose. Every pane draws from that same decoded frame.
function setupRouteWall() {
  const wall = document.querySelector('.route-wall');
  const video = wall.querySelector('video');
  const grid = wall.querySelector('.wall-panes');
  const count = wall.querySelector('.wall-count');
  const phone = window.matchMedia('(max-width: 700px)');
  const desktopCount = count.value;
  function setDefaultCount() {
    count.value = phone.matches ? '2' : desktopCount;
    layout();
  }
  const play = wall.querySelector('.wall-play');
  const seek = wall.querySelector('.wall-seek');
  const time = wall.querySelector('.wall-time');
  const message = wall.querySelector('.wall-message');
  const fps = 24;
  const width = 480;
  const height = 270;
  const models = ['paintress','cwm','streaming-cwm','agentgarten','gen3c','spmem','alaya-evoke','hy-worldplay','lyra-2-0','matrix-game-4'];
  const names = new Map(Array.from(modelTiles, tile => [tile.dataset.model, tile.closest('article').querySelector('h3').textContent]));
  const order = ['paintress','cwm','agentgarten','lyra-2-0', ...models.filter(m => !['paintress','cwm','agentgarten','lyra-2-0'].includes(m))];
  let route, poster, pendingFrame;
  let animation = 0;
  let paintedFrame = -1;
  let panes = [];

  function clock(frame) {
    const seconds = frame / fps;
    return Math.floor(seconds / 60) + ':' + (seconds % 60).toFixed(1).padStart(4, '0');
  }

  function displayFrame(frame) {
    seek.value = String(frame);
    time.value = clock(frame) + ' / ' + clock(Number(seek.max));
    seek.setAttribute('aria-valuetext', clock(frame));
  }

  function paint() {
    const source = video.readyState >= 2 && video.getAttribute('src') && !video.seeking ? video : poster;
    if (!source || (source === poster && !poster?.naturalWidth)) return;
    for (const pane of panes) {
      const index = models.indexOf(pane.select.value);
      pane.ctx.drawImage(source, (index % 4) * width, Math.floor(index / 4) * height,
        width, height, 0, 0, width, height);
    }
  }

  function layout() {
    grid.replaceChildren();
    panes = [];
    grid.dataset.count = count.value;
    for (let i = 0; i < Number(count.value); i++) {
      const figure = document.createElement('figure');
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Model in view ' + (i + 1));
      for (const id of models) select.add(new Option(names.get(id), id));
      select.value = order[i];
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.setAttribute('role', 'img');
      figure.append(select, canvas);
      grid.append(figure);
      panes.push({select, canvas, ctx: canvas.getContext('2d')});
      select.addEventListener('change', () => {
        const other = order.indexOf(select.value);
        [order[other], order[i]] = [order[i], order[other]];
        panes.forEach((pane, j) => { pane.select.value = order[j]; });
        labelPanes();
        paint();
      });
    }
    labelPanes();
    paint();
  }

  function labelPanes() {
    panes.forEach(pane => pane.canvas.setAttribute('aria-label', names.get(pane.select.value) + ' · ' + route.parentElement.textContent.trim()));
  }

  function tick() {
    if (!video.paused && !video.ended) animation = requestAnimationFrame(tick);
    if (!video.seeking && video.readyState >= 2 && pendingFrame === null) {
      const frame = Math.min(Number(seek.max), Math.floor(video.currentTime * fps));
      if (frame !== paintedFrame) {
        paint();
        displayFrame(frame);
        paintedFrame = frame;
      }
    }
  }

  function load() {
    if (!video.getAttribute('src')) {
      video.preload = 'auto';
      video.src = 'assets/' + route.value + '-multi.mp4';
    }
  }

  function applySeek() {
    if (pendingFrame === null || video.readyState < 1) return;
    // Seek inside the frame so browsers do not round the boundary to the previous pose.
    video.currentTime = (pendingFrame + 0.5) / fps;
    pendingFrame = null;
  }

  function jump(frame) {
    video.pause();
    pendingFrame = frame;
    displayFrame(frame);
    load();
    applySeek();
  }

  function changeScene() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    route = modelRoute.querySelector(':checked');
    seek.max = route.dataset.lastFrame;
    pendingFrame = Number(route.dataset.firstFrame);
    message.textContent = '';
    poster = new Image();
    poster.onload = paint;
    poster.src = 'assets/' + route.value + '-multi.jpg';
    for (const pane of panes) pane.ctx.clearRect(0, 0, width, height);
    labelPanes();
    displayFrame(pendingFrame);
  }

  play.addEventListener('click', () => {
    if (!video.paused) { video.pause(); return; }
    explainer.pause();
    if (video.error) video.load();
    load();
    if (video.ended || seek.value === seek.max) jump(0);
    message.textContent = '';
    video.play().catch(e => {
      if (e.name !== 'AbortError') message.textContent = 'Playback could not start. Try Play together again.';
    });
  });
  video.addEventListener('play', () => {
    paintedFrame = -1;
    play.textContent = 'Pause together';
    cancelAnimationFrame(animation);
    tick();
  });
  video.addEventListener('pause', () => {
    cancelAnimationFrame(animation);
    play.textContent = 'Play together';
  });
  video.addEventListener('ended', () => { displayFrame(Number(seek.max)); paint(); });
  video.addEventListener('loadedmetadata', applySeek);
  video.addEventListener('loadeddata', paint);
  video.addEventListener('seeked', paint);
  video.addEventListener('error', () => { message.textContent = 'The shared video could not load. Try again or use Play route below.'; });
  seek.addEventListener('input', () => jump(seek.valueAsNumber));
  for (const button of wall.querySelectorAll('[data-frame]')) {
    button.addEventListener('click', () => jump(Number(route.dataset[button.dataset.frame])));
  }
  phone.addEventListener('change', setDefaultCount);
  count.addEventListener('change', () => {
    phone.removeEventListener('change', setDefaultCount);
    layout();
  });
  modelRoute.addEventListener('change', changeScene);
  explainer.addEventListener('play', () => video.pause());
  document.addEventListener('click', e => {
    if (e.target.closest('[data-video], .model-tile')) video.pause();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  changeScene();
  setDefaultCount();
  wall.hidden = false;
}
setupRouteWall();
