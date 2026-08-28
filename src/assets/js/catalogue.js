(function () {
  function setTabs(root, tab) {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', selected ? 'true' : 'false');
      candidate.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== tab.getAttribute('aria-controls');
    });
  }

  document.querySelectorAll('[data-tabs]').forEach((root) => {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => setTabs(root, tab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        tabs[nextIndex].focus();
        setTabs(root, tabs[nextIndex]);
      });
    });
  });

  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  if (menuToggle && mobileMenu) {
    const menuIcon = menuToggle.querySelector('[aria-hidden="true"]');
    const setMenuOpen = (open) => {
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mobileMenu.classList.toggle('is-open', open);
      if (menuIcon) menuIcon.textContent = open ? '×' : '☰';
    };

    menuToggle.addEventListener('click', () => {
      setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
    });
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenuOpen(false));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || menuToggle.getAttribute('aria-expanded') !== 'true') return;
      setMenuOpen(false);
      menuToggle.focus();
    });
  }

  document.querySelectorAll('[data-reverse-grid]').forEach((button) => {
    const grid = document.querySelector('[data-card-grid]');
    if (!grid) return;
    button.addEventListener('click', () => {
      const descending = button.getAttribute('aria-pressed') !== 'true';
      const cards = Array.from(grid.querySelectorAll('[data-card]'));
      cards.reverse().forEach((card) => grid.appendChild(card));
      button.setAttribute('aria-pressed', descending ? 'true' : 'false');
      button.textContent = descending ? 'Descending' : 'Ascending';
    });
  });

  document.querySelectorAll('[data-image-viewer]').forEach((viewer) => {
    const image = viewer.querySelector('img[data-original-src]');
    const button = viewer.querySelector('[data-image-fullscreen-toggle]');
    const icon = button?.querySelector('[aria-hidden="true"]');
    if (!image || !button || typeof viewer.requestFullscreen !== 'function') {
      button?.remove();
      return;
    }

    const normalSource = image.getAttribute('src');
    const normalSourceSet = image.getAttribute('srcset');
    const normalSizes = image.getAttribute('sizes');
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let pointerId = null;
    let pointerX = 0;
    let pointerY = 0;
    let gestureStartScale = 1;

    const isFullscreen = () => document.fullscreenElement === viewer;
    const renderTransform = () => {
      image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    };
    const resetTransform = () => {
      scale = 1;
      translateX = 0;
      translateY = 0;
      image.style.removeProperty('transform');
    };
    const showOriginal = () => {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.setAttribute('src', image.dataset.originalSrc);
    };
    const restoreNormalSource = () => {
      image.setAttribute('src', normalSource);
      if (normalSourceSet) image.setAttribute('srcset', normalSourceSet);
      else image.removeAttribute('srcset');
      if (normalSizes) image.setAttribute('sizes', normalSizes);
      else image.removeAttribute('sizes');
    };

    button.addEventListener('click', async () => {
      if (isFullscreen()) {
        await document.exitFullscreen();
        return;
      }

      showOriginal();
      try {
        await viewer.requestFullscreen();
      } catch (_error) {
        restoreNormalSource();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const active = isFullscreen();
      button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'View image fullscreen');
      button.setAttribute('title', active ? 'Exit fullscreen' : 'View image fullscreen');
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (icon) icon.textContent = active ? 'x' : '⛶';
      if (!active) {
        pointerId = null;
        viewer.classList.remove('is-panning');
        resetTransform();
        restoreNormalSource();
      }
    });

    viewer.addEventListener('wheel', (event) => {
      if (!isFullscreen()) return;
      event.preventDefault();

      if (event.ctrlKey || event.metaKey) {
        const previousScale = scale;
        scale = Math.min(8, Math.max(1, scale * Math.exp(-event.deltaY * 0.01)));
        const rect = viewer.getBoundingClientRect();
        const cursorX = event.clientX - rect.left - rect.width / 2;
        const cursorY = event.clientY - rect.top - rect.height / 2;
        const ratio = scale / previousScale;
        translateX = cursorX - (cursorX - translateX) * ratio;
        translateY = cursorY - (cursorY - translateY) * ratio;
        if (scale === 1) {
          translateX = 0;
          translateY = 0;
        }
      } else if (scale > 1) {
        translateX -= event.deltaX;
        translateY -= event.deltaY;
      }

      renderTransform();
    }, { passive: false });

    viewer.addEventListener('gesturestart', (event) => {
      if (!isFullscreen()) return;
      event.preventDefault();
      gestureStartScale = scale;
    });
    viewer.addEventListener('gesturechange', (event) => {
      if (!isFullscreen()) return;
      event.preventDefault();
      scale = Math.min(8, Math.max(1, gestureStartScale * event.scale));
      if (scale === 1) {
        translateX = 0;
        translateY = 0;
      }
      renderTransform();
    });
    viewer.addEventListener('gestureend', (event) => {
      if (isFullscreen()) event.preventDefault();
    });

    viewer.addEventListener('pointerdown', (event) => {
      if (!isFullscreen() || scale <= 1 || event.target.closest('button')) return;
      pointerId = event.pointerId;
      pointerX = event.clientX;
      pointerY = event.clientY;
      viewer.setPointerCapture(pointerId);
      viewer.classList.add('is-panning');
    });
    viewer.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      translateX += event.clientX - pointerX;
      translateY += event.clientY - pointerY;
      pointerX = event.clientX;
      pointerY = event.clientY;
      renderTransform();
    });
    const stopPanning = (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      viewer.classList.remove('is-panning');
    };
    viewer.addEventListener('pointerup', stopPanning);
    viewer.addEventListener('pointercancel', stopPanning);
    viewer.addEventListener('dblclick', (event) => {
      if (!isFullscreen() || event.target.closest('button')) return;
      event.preventDefault();
      resetTransform();
    });
  });

  document.querySelectorAll('form.search-placeholder').forEach((form) => {
    const input = form.querySelector('input[name="q"]');
    const button = form.querySelector('button[type="submit"]');
    if (!input) return;

    const openSearch = () => {
      const query = input.value.trim();
      const target = new URL('/search/', window.location.origin);
      if (query) target.searchParams.set('q', query);
      window.location.assign(target);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      openSearch();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      openSearch();
    });
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      openSearch();
    });
  });
})();
