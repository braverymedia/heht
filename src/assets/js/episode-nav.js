/**
 * Episode Navigation + Seamless Slot-Machine Transitions
 *
 * Fetches the next/prev episode page, stacks the incoming content below
 * (or above) the current content, then slides both as one continuous reel.
 * Video panel leads, detail panel follows at 50%.
 *
 * Uses Web Animations API (Motion Pro integration deferred to later).
 */

export function initEpisodeNav() {
  const shell = document.getElementById('shell');
  const detail = document.querySelector('.detail');
  const videoPanel = document.getElementById('video-panel');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  if (!shell || !detail || !videoPanel || !prevBtn || !nextBtn) return;

  let animating = false;

  // Build episode index from the episode list panel links
  const episodeLinks = Array.from(
    document.querySelectorAll('.episode-list-panel__item')
  ).map(a => a.getAttribute('href')).reverse(); // reverse: list is newest-first, we want oldest-first

  const currentPath = window.location.pathname;
  let currentIndex = episodeLinks.indexOf(currentPath);

  // Home page shows latest episode — match it
  if (currentIndex === -1 && currentPath === '/') {
    currentIndex = episodeLinks.length - 1;
  }

  updateButtons();

  function updateButtons() {
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= episodeLinks.length - 1;
  }

  async function fetchEpisodePage(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const html = await res.text();
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  function extractDetailContent(doc) {
    const content = doc.querySelector('.detail__content');
    return content ? content.innerHTML : '';
  }

  function extractVideoSlide(doc) {
    const slide = doc.querySelector('.video-panel__slide');
    return slide ? slide.innerHTML : '';
  }

  function extractEpisodeNumber(doc) {
    const odo = doc.querySelector('#episode-odometer');
    if (!odo) return null;
    const n = parseInt(odo.dataset.episodeNumber, 10);
    return Number.isFinite(n) ? n : null;
  }

  function updateOdometer(number) {
    const odo = document.getElementById('episode-odometer');
    if (!odo || number == null) return;
    const padded = String(number).padStart(3, '0');
    const strips = odo.querySelectorAll('.odo-strip');
    padded.split('').forEach((d, i) => {
      const digit = parseInt(d, 10);
      if (strips[i]) {
        strips[i].style.transform = `translateY(-${digit * 0.82}em)`;
      }
    });
    odo.dataset.episodeNumber = String(number);
  }

  async function navigate(direction) {
    if (animating) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= episodeLinks.length) return;

    const targetUrl = episodeLinks[targetIndex];
    animating = true;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      // Fetch target episode
      const doc = await fetchEpisodePage(targetUrl);
      const newDetailHtml = extractDetailContent(doc);
      const newVideoHtml = extractVideoSlide(doc);
      const newEpisodeNumber = extractEpisodeNumber(doc);

      if (reducedMotion) {
        // Instant swap
        swapContent(newDetailHtml, newVideoHtml, targetUrl);
        updateOdometer(newEpisodeNumber);
        currentIndex = targetIndex;
        updateButtons();
        animating = false;
        return;
      }

      // Start odometer roll at the same moment the slot-machine begins
      updateOdometer(newEpisodeNumber);

      // ── Build the reel ──────────────────────────────────
      // swapContent happens *inside* animateTransition — between the
      // animation finishing and the clones being removed — so the old
      // content never flashes back into view in the cleanup frame.
      await animateTransition(direction, newDetailHtml, newVideoHtml, targetUrl);

      currentIndex = targetIndex;
      updateButtons();

    } catch (err) {
      console.error('[episode-nav] Navigation failed:', err);
      // Fallback: hard navigate
      window.location.href = targetUrl;
    } finally {
      animating = false;
    }
  }

  function swapContent(detailHtml, videoHtml, url) {
    const detailContent = detail.querySelector('.detail__content');
    const videoSlide = document.getElementById('video-slide');

    if (detailContent) detailContent.innerHTML = detailHtml;
    if (videoSlide) videoSlide.innerHTML = videoHtml;

    // Update URL without reload
    history.pushState({ episodeUrl: url }, '', url);

    // Update page title from the new detail content
    const newTitle = detail.querySelector('.detail__title');
    if (newTitle) {
      document.title = newTitle.textContent.trim() + ' - Higher Ed Hot Takes';
    }

    // Scroll the detail content back to top. .detail is overflow:hidden
    // (it's the non-scrolling frame); .detail__content is the actual
    // scroller, and innerHTML replacement can leave its scrollTop
    // pinned if the new content is tall enough.
    if (detailContent) detailContent.scrollTop = 0;

    // Re-init media controller for new content
    if (window.initMediaController) window.initMediaController();
  }

  async function animateTransition(direction, newDetailHtml, newVideoHtml, targetUrl) {
    const dur = 700;
    const stagger = 120; // detail starts 120ms after video — slight offset, not waiting
    const exitY = direction > 0 ? '-100%' : '100%';
    const enterY = direction > 0 ? '100%' : '-100%';

    // ── Video reel ────────────────────────────────────────
    const videoSlide = document.getElementById('video-slide');
    const videoClone = videoSlide.cloneNode(false);
    videoClone.innerHTML = newVideoHtml;
    videoClone.style.position = 'absolute';
    videoClone.style.inset = '0';
    videoClone.style.transform = `translateY(${enterY})`;
    videoClone.id = '';
    videoPanel.appendChild(videoClone);

    // Animate video: current exits, clone enters
    const videoCurrentAnim = videoSlide.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${exitY})` }],
      { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
    videoClone.animate(
      [{ transform: `translateY(${enterY})` }, { transform: 'translateY(0)' }],
      { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );

    // ── Detail reel (staggered) ───────────────────────────
    // .detail is overflow:hidden, .detail__content is 100% height + scrolls.
    // Clone matches exactly — same height, same padding, clean slide.
    const detailContent = detail.querySelector('.detail__content');
    const detailClone = document.createElement('div');
    detailClone.className = detailContent.className;
    detailClone.innerHTML = newDetailHtml;
    detailClone.style.position = 'absolute';
    detailClone.style.inset = '0';
    detailClone.style.transform = `translateY(${enterY})`;
    detail.appendChild(detailClone);

    // Make current content positionable for the exit animation
    detailContent.style.position = 'absolute';
    detailContent.style.inset = '0';

    await new Promise(resolve => setTimeout(resolve, stagger));

    const detailCurrentAnim = detailContent.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${exitY})` }],
      { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );
    detailClone.animate(
      [{ transform: `translateY(${enterY})` }, { transform: 'translateY(0)' }],
      { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );

    // Wait for both to finish
    await videoCurrentAnim.finished;
    await detailCurrentAnim.finished;

    // ── Cleanup order matters ─────────────────────────────
    // Both originals are held off-screen by fill:forwards and both
    // clones are held on-screen at translateY(0) showing the new
    // content. If we cancel the originals' animations first, they
    // snap back to transform:'' (their natural on-screen position)
    // and briefly paint their *old* content for a frame before we
    // swap it — that's the flicker.
    //
    // Instead: swap the originals' content to the new content while
    // they're still transformed off-screen (invisible swap), then
    // cancel the animations (originals return to natural position
    // already showing the new content, exactly where the clones are
    // still rendering), then remove the clones in the same frame.
    swapContent(newDetailHtml, newVideoHtml, targetUrl);

    videoSlide.getAnimations().forEach(a => a.cancel());
    detailContent.getAnimations().forEach(a => a.cancel());
    videoSlide.style.transform = '';
    detailContent.style.position = '';
    detailContent.style.inset = '';
    detailContent.style.transform = '';

    videoClone.remove();
    detailClone.remove();
  }

  // ── Event listeners ─────────────────────────────────────
  nextBtn.addEventListener('click', () => navigate(1));
  prevBtn.addEventListener('click', () => navigate(-1));

  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (animating) return;
    // Don't intercept when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'ArrowLeft') navigate(-1);
  });

  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.episodeUrl) {
      const idx = episodeLinks.indexOf(e.state.episodeUrl);
      if (idx !== -1 && idx !== currentIndex) {
        currentIndex = idx;
        // Fetch and swap without animation for back/forward
        fetchEpisodePage(e.state.episodeUrl).then(doc => {
          swapContent(
            extractDetailContent(doc),
            extractVideoSlide(doc),
            e.state.episodeUrl
          );
          updateOdometer(extractEpisodeNumber(doc));
          updateButtons();
        });
      }
    }
  });

  // Also handle clicks on episode list items as soft-nav
  document.querySelectorAll('.episode-list-panel__item').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      const idx = episodeLinks.indexOf(href);
      if (idx === -1) return; // let it hard-navigate

      e.preventDefault();

      // Close the episode list panel
      const panel = document.getElementById('episode-list-panel');
      if (panel) {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
      }

      const direction = idx > currentIndex ? 1 : -1;
      currentIndex = idx - direction; // navigate() will add the direction back
      navigate(direction);
    });
  });
}

