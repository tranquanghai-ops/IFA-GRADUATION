/**
 * IFA+ Graduation — UI Helpers & Modal Layers Module
 * Ensures that whenever any popup/modal is open:
 * 1. Scrolling the mouse wheel or swiping outside the popup card (on the backdrop)
 *    or on fixed headers/toolbars/footers of the popup redirects scroll into the
 *    active popup's scrollable content.
 * 2. Background page scrolling behind open popups is strictly prevented.
 */

const MODAL_OVERLAY_SELECTOR = [
  '.modal-backdrop',
  '.fixed.inset-0[id^="modal-"]',
  '#supervisor-student-detail-modal',
  '#student-timeline-event-dialog',
  '#rich-hyperlink-modal'
].join(', ');

let modalOpenSequence = 0;
let modalScrollControllerInitialized = false;
let activeTouchState = null;

function isModalOverlayOpen(el) {
  if (!el || !(el instanceof HTMLElement) || !el.isConnected) return false;
  if (el.classList.contains('hidden')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
    return false;
  }
  return el.getClientRects().length > 0;
}

function syncOpenModalSequences() {
  if (typeof document === 'undefined') return;
  const overlays = document.querySelectorAll(MODAL_OVERLAY_SELECTOR);
  overlays.forEach(el => {
    if (isModalOverlayOpen(el)) {
      if (!el.dataset.modalOpenSeq) {
        el.dataset.modalOpenSeq = String(++modalOpenSequence);
      }
    } else if (el.dataset.modalOpenSeq) {
      delete el.dataset.modalOpenSeq;
    }
  });
}

export function getTopmostVisibleModal() {
  if (typeof document === 'undefined') return null;
  syncOpenModalSequences();
  const overlays = Array.from(document.querySelectorAll(MODAL_OVERLAY_SELECTOR)).filter(isModalOverlayOpen);
  if (overlays.length === 0) return null;
  if (overlays.length === 1) return overlays[0];

  overlays.sort((a, b) => {
    const zA = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
    const zB = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
    if (zA !== zB) return zA - zB;
    const seqA = parseInt(a.dataset.modalOpenSeq || '0', 10);
    const seqB = parseInt(b.dataset.modalOpenSeq || '0', 10);
    return seqA - seqB;
  });

  return overlays[overlays.length - 1];
}

function isElementVisibleInModal(el, modalRoot) {
  if (!el || !(el instanceof HTMLElement) || !el.isConnected) return false;
  if (el.clientHeight <= 0 || el.clientWidth <= 0) return false;
  let curr = el;
  while (curr && curr !== modalRoot) {
    if (curr.classList.contains('hidden')) return false;
    const st = window.getComputedStyle(curr);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    curr = curr.parentElement;
  }
  return true;
}

function isScrollableOverflowValue(val) {
  return val === 'auto' || val === 'scroll' || val === 'overlay';
}

function isElementScrollableCandidate(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.tagName === 'TEXTAREA') {
    return el.scrollHeight > el.clientHeight + 1;
  }
  const style = window.getComputedStyle(el);
  const canY = isScrollableOverflowValue(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
  const canX = isScrollableOverflowValue(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
  return canY || canX;
}

function canElementScrollInDirection(el, dx, dy) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  const allowY = el.tagName === 'TEXTAREA' || isScrollableOverflowValue(style.overflowY);
  const allowX = isScrollableOverflowValue(style.overflowX);

  let canY = false;
  if (allowY && Math.abs(dy) > 0 && el.scrollHeight > el.clientHeight + 1) {
    if (dy > 0) {
      canY = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    } else if (dy < 0) {
      canY = el.scrollTop > 0;
    }
  }

  let canX = false;
  if (allowX && Math.abs(dx) > 0 && el.scrollWidth > el.clientWidth + 1) {
    if (dx > 0) {
      canX = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    } else if (dx < 0) {
      canX = el.scrollLeft > 0;
    }
  }

  return canY || canX;
}

function getWheelDeltaPixels(event, referenceEl) {
  let dx = event.deltaX || 0;
  let dy = event.deltaY || 0;
  if (event.deltaMode === 1) {
    dx *= 32;
    dy *= 32;
  } else if (event.deltaMode === 2) {
    const pageH = (referenceEl && referenceEl.clientHeight) || window.innerHeight || 600;
    const pageW = (referenceEl && referenceEl.clientWidth) || window.innerWidth || 800;
    dx *= pageW * 0.85;
    dy *= pageH * 0.85;
  }
  return { dx, dy };
}

function applyScrollDelta(el, dx, dy) {
  if (!el) return;
  if (dy !== 0 && el.scrollHeight > el.clientHeight) {
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = Math.min(maxTop, Math.max(0, el.scrollTop + dy));
  }
  if (dx !== 0 && el.scrollWidth > el.clientWidth) {
    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    el.scrollLeft = Math.min(maxLeft, Math.max(0, el.scrollLeft + dx));
  }
}

export function findActiveModalScrollContainer(topModal, pointerEvent, dx = 0, dy = 0, excludeElements = []) {
  if (!topModal) return null;
  const excludeSet = new Set(excludeElements);

  const descendants = Array.from(topModal.querySelectorAll('*'));
  if (isElementScrollableCandidate(topModal)) {
    descendants.unshift(topModal);
  }

  const candidates = descendants.filter(el => {
    if (!(el instanceof HTMLElement)) return false;
    if (excludeSet.has(el)) return false;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') return false;
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return false;
    if (el.id === 'round-student-suggestions') return false;
    if (!isElementVisibleInModal(el, topModal)) return false;
    return isElementScrollableCandidate(el);
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const clientX = typeof pointerEvent?.clientX === 'number' ? pointerEvent.clientX : null;
  const clientY = typeof pointerEvent?.clientY === 'number' ? pointerEvent.clientY : null;

  const directional = (dx !== 0 || dy !== 0)
    ? candidates.filter(el => canElementScrollInDirection(el, dx, dy))
    : [];
  const pool = directional.length > 0 ? directional : candidates;

  if (pool.length === 1) return pool[0];

  let best = pool[0];
  let bestScore = -Infinity;

  for (const el of pool) {
    const rect = el.getBoundingClientRect();
    let score = 0;

    if (
      el.classList.contains('flex-1') ||
      el.id === 'modal-round-workspace-body' ||
      el.id === 'cws-col-grading' ||
      el.classList.contains('topic-preview-scroll') ||
      el.classList.contains('student-timeline-event-scroll')
    ) {
      score += 500000;
    }

    const hasAncestorInPool = pool.some(other => other !== el && other.contains(el));
    if (!hasAncestorInPool) {
      score += 300000;
    }

    if (clientX !== null && clientX >= rect.left && clientX <= rect.right) {
      score += 200000;
    }
    if (clientY !== null && clientY >= rect.top && clientY <= rect.bottom) {
      score += 100000;
    }

    score += Math.min(rect.width * rect.height, 400000) * 0.25;
    score += Math.min(el.scrollHeight - el.clientHeight, 5000) * 10;

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

function collectScrollableAncestorsInModal(target, topModal) {
  const ancestors = [];
  if (!(target instanceof Element) || !topModal.contains(target)) {
    return ancestors;
  }
  let curr = target;
  while (curr && curr !== topModal) {
    if (isElementScrollableCandidate(curr)) {
      ancestors.push(curr);
    }
    curr = curr.parentElement;
  }
  if (isElementScrollableCandidate(topModal)) {
    ancestors.push(topModal);
  }
  return ancestors;
}

function handleGlobalModalWheel(event) {
  if (event.ctrlKey || event.metaKey) return;

  const topModal = getTopmostVisibleModal();
  if (!topModal) return;

  let { dx, dy } = getWheelDeltaPixels(event, topModal);
  if (event.shiftKey && dx === 0 && dy !== 0) {
    dx = dy;
    dy = 0;
  }

  // Always block background page scrolling while a popup/modal is open
  event.preventDefault();

  if (dx === 0 && dy === 0) return;

  const ancestorScrollables = collectScrollableAncestorsInModal(event.target, topModal);
  for (const el of ancestorScrollables) {
    if (canElementScrollInDirection(el, dx, dy)) {
      applyScrollDelta(el, dx, dy);
      return;
    }
  }

  const fallbackScrollEl = findActiveModalScrollContainer(topModal, event, dx, dy, ancestorScrollables);
  if (fallbackScrollEl) {
    applyScrollDelta(fallbackScrollEl, dx, dy);
  }
}

function handleGlobalModalTouchStart(event) {
  if (!event.touches || event.touches.length !== 1) {
    activeTouchState = null;
    return;
  }
  const topModal = getTopmostVisibleModal();
  if (!topModal) {
    activeTouchState = null;
    return;
  }
  const touch = event.touches[0];
  activeTouchState = {
    lastX: touch.clientX,
    lastY: touch.clientY,
    target: event.target
  };
}

function handleGlobalModalTouchMove(event) {
  if (!event.touches || event.touches.length !== 1) return;
  const topModal = getTopmostVisibleModal();
  if (!topModal) return;

  const touch = event.touches[0];
  if (!activeTouchState) {
    activeTouchState = {
      lastX: touch.clientX,
      lastY: touch.clientY,
      target: event.target
    };
    return;
  }

  const dx = activeTouchState.lastX - touch.clientX;
  const dy = activeTouchState.lastY - touch.clientY;
  activeTouchState.lastX = touch.clientX;
  activeTouchState.lastY = touch.clientY;

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

  const target = event.target instanceof Element ? event.target : activeTouchState.target;
  const ancestorScrollables = collectScrollableAncestorsInModal(target, topModal);

  // If touching inside a scrollable container of the modal that can scroll in this direction, allow native touch scroll
  for (const el of ancestorScrollables) {
    if (canElementScrollInDirection(el, dx, dy)) {
      return;
    }
  }

  // Otherwise (touching backdrop, fixed header/footer, or at scroll boundary), prevent background scroll and redirect into modal
  if (event.cancelable) {
    event.preventDefault();
  }
  const fallbackScrollEl = findActiveModalScrollContainer(topModal, touch, dx, dy, ancestorScrollables);
  if (fallbackScrollEl) {
    applyScrollDelta(fallbackScrollEl, dx, dy);
  }
}

function handleGlobalModalKeyDown(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const topModal = getTopmostVisibleModal();
  if (!topModal) return;

  const target = event.target;
  if (target instanceof HTMLElement) {
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
      return;
    }
    if ((tag === 'BUTTON' || tag === 'A') && (event.key === ' ' || event.key === 'Enter')) {
      return;
    }
  }

  const scrollKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];
  if (!scrollKeys.includes(event.key)) return;

  const scrollEl = findActiveModalScrollContainer(topModal, null, 0, 1);
  if (!scrollEl) {
    event.preventDefault();
    return;
  }

  const step = 48;
  const page = Math.max(120, Math.floor(scrollEl.clientHeight * 0.85));
  let dy = 0;

  switch (event.key) {
    case 'ArrowDown':
      dy = step;
      break;
    case 'ArrowUp':
      dy = -step;
      break;
    case 'PageDown':
      dy = page;
      break;
    case ' ':
      dy = event.shiftKey ? -page : page;
      break;
    case 'PageUp':
      dy = -page;
      break;
    case 'Home':
      dy = -scrollEl.scrollHeight;
      break;
    case 'End':
      dy = scrollEl.scrollHeight;
      break;
    default:
      return;
  }

  event.preventDefault();
  applyScrollDelta(scrollEl, 0, dy);
}

export function initUIHelpers() {
  if (typeof window === 'undefined' || modalScrollControllerInitialized) return;
  modalScrollControllerInitialized = true;

  window.addEventListener('wheel', handleGlobalModalWheel, { passive: false, capture: true });
  window.addEventListener('touchstart', handleGlobalModalTouchStart, { passive: true, capture: true });
  window.addEventListener('touchmove', handleGlobalModalTouchMove, { passive: false, capture: true });
  window.addEventListener('keydown', handleGlobalModalKeyDown, { capture: true });

  if (typeof MutationObserver !== 'undefined' && document.body) {
    const observer = new MutationObserver(() => syncOpenModalSequences());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  console.log('[IFA Graduation] UI helpers & global modal scroll controller ready');
}

if (typeof window !== 'undefined') {
  window.initUIHelpers = initUIHelpers;
  window.getTopmostVisibleModal = getTopmostVisibleModal;
  window.findActiveModalScrollContainer = findActiveModalScrollContainer;
  initUIHelpers();
}

