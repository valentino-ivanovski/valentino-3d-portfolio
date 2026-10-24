const slides = [...document.querySelectorAll('.slides')];
const counter = document.querySelector('#slide-count');
const playback = document.querySelector('#playback');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let current = 0;
let paused = reducedMotion.matches;
let timer;
let ready = false;
let navigating = false;
const pendingMoves = [];

// Decode before a frame can become visible; keep the current frame on failure.
const frames = slides.map(async (slide) => {
    try {
        await slide.querySelector('img').decode();
        return true;
    } catch {
        return false;
    }
});

function updatePlayback() {
    const state = String(paused);
    if (playback.dataset.paused === state) return;
    const animateChange = playback.dataset.paused !== undefined && !reducedMotion.matches;
    const oldWidth = playback.getBoundingClientRect().width;
    const labelWindow = playback.querySelector('.button-label');
    playback.getAnimations().forEach(animation => animation.cancel());
    labelWindow.getAnimations().forEach(animation => animation.cancel());
    playback.dataset.paused = state;
    playback.setAttribute('aria-pressed', state);
    playback.setAttribute('aria-label', paused ? 'Unpause slideshow' : 'Pause slideshow');
    playback.querySelectorAll('.button-stack span').forEach(label => {
        label.textContent = paused ? 'Unpause' : 'Pause';
    });
    if (animateChange) {
        const newWidth = playback.getBoundingClientRect().width;
        const timing = { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' };
        playback.animate([
            { width: `${oldWidth}px` },
            { width: `${newWidth}px` }
        ], timing);
    }
}

function schedule() {
    clearTimeout(timer);
    if (ready && !paused && !document.hidden) timer = setTimeout(advance, 6000);
}

function advance() {
    return moveSlide(1);
}

async function moveSlide(direction, manual = false) {
    if (manual) {
        paused = true;
        updatePlayback();
        clearTimeout(timer);
    }
    if (!ready) return;
    if (navigating) {
        if (manual) pendingMoves.push(direction);
        return;
    }
    navigating = true;
    clearTimeout(timer);
    let next = (current + direction + slides.length) % slides.length;
    // Skip unavailable files without flashing an empty frame.
    for (let tried = 0; tried < slides.length; tried++) {
        if (await frames[next]) break;
        next = (next + direction + slides.length) % slides.length;
    }
    if (!manual && (paused || document.hidden)) {
        navigating = false;
        schedule();
        return;
    }
    if (next === current) {
        navigating = false;
        schedule();
        return;
    }
    const duration = reducedMotion.matches ? 0 : manual ? 350 : 1200;
    document.querySelector('.gallery').style.setProperty('--slide-duration', `${duration}ms`);
    slides.forEach(slide => slide.classList.remove('is-previous'));
    // Reset the incoming frame below the outgoing image before fading it in.
    // This also resets a previous frame when navigating in reverse.
    void slides[next].offsetWidth;
    slides[current].classList.add('is-previous');
    slides[current].classList.remove('is-active');
    slides[current].setAttribute('aria-hidden', 'true');
    slides[next].classList.add('is-active');
    slides[next].setAttribute('aria-hidden', 'false');
    current = next;
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
    await new Promise(resolve => setTimeout(resolve, duration));
    slides.forEach(slide => slide.classList.remove('is-previous'));
    navigating = false;
    if (pendingMoves.length) {
        moveSlide(pendingMoves.shift(), true);
    } else {
        schedule();
    }
}

document.querySelector('#previous-slide').addEventListener('click', () => moveSlide(-1, true));
document.querySelector('#next-slide').addEventListener('click', () => moveSlide(1, true));

slides.forEach((slide, index) => slide.setAttribute('aria-hidden', String(index !== 0)));
playback.addEventListener('click', () => {
    paused = !paused;
    updatePlayback();
    schedule();
});
document.addEventListener('visibilitychange', schedule);
reducedMotion.addEventListener('change', (event) => {
    paused = event.matches;
    updatePlayback();
    schedule();
});

async function start() {
    const firstReady = await frames[0];
    if (!firstReady) {
        const available = await Promise.all(frames);
        const first = available.indexOf(true);
        if (first < 0) return;
        slides[current].classList.remove('is-active');
        slides[current].setAttribute('aria-hidden', 'true');
        current = first;
        slides[current].classList.add('is-active');
        slides[current].setAttribute('aria-hidden', 'false');
        counter.textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
    }
    // Give the opening image its full viewing time, even on a cold load.
    ready = true;
    schedule();
}
updatePlayback();
start();
