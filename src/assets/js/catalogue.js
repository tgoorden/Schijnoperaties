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
})();
