const slides = [...document.querySelectorAll('.slides')];
const counter = document.querySelector('#slide-count');
const playback = document.querySelector('#playback');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let current = 0;
let paused = reducedMotion.matches;
let timer;
let ready = false;
let navigating = false;

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
    playback.setAttribute('aria-pressed', String(paused));
    playback.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
    playback.textContent = paused ? 'Play' : 'Pause';
}

function schedule() {
    clearTimeout(timer);
    if (ready && !paused && !document.hidden) timer = setTimeout(advance, 6000);
}

function advance() {
    return moveSlide(1);
}

async function moveSlide(direction, manual = false) {
    if (!ready || navigating) return;
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
    slides.forEach(slide => slide.classList.remove('is-previous'));
    slides[current].classList.add('is-previous');
    slides[current].classList.remove('is-active');
    slides[current].setAttribute('aria-hidden', 'true');
    slides[next].classList.add('is-active');
    slides[next].setAttribute('aria-hidden', 'false');
    current = next;
    navigating = false;
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
    schedule();
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
