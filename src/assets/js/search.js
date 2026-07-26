(function () {
  const state = window.__fictionalHealingSearch || (window.__fictionalHealingSearch = {});
  const form = document.querySelector('[data-search-form]');
  const queryInput = form?.querySelector('input[name="q"]');
  const status = document.querySelector('[data-search-status]');
  const resultsList = document.querySelector('[data-search-results]');

  if (!form || !queryInput || !status || !resultsList) return;

  function loadMiniSearch() {
    if (window.MiniSearch) return Promise.resolve(window.MiniSearch);
    if (state.libraryPromise) return state.libraryPromise;

    state.libraryPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-minisearch]');
      const script = existing || document.createElement('script');
      script.addEventListener('load', () => resolve(window.MiniSearch), { once: true });
      script.addEventListener('error', () => reject(new Error('MiniSearch could not be loaded.')), { once: true });
      if (!existing) {
        script.src = '/assets/vendor/minisearch.min.js';
        script.dataset.minisearch = '';
        document.head.appendChild(script);
      }
    });

    return state.libraryPromise;
  }

  function loadDocuments() {
    if (!state.documentsPromise) {
      state.documentsPromise = fetch('/assets/search/documents.json')
        .then((response) => {
          if (!response.ok) throw new Error(`Search documents could not be loaded (${response.status}).`);
          return response.json();
        });
    }
    return state.documentsPromise;
  }

  function getSearchIndex() {
    if (!state.indexPromise) {
      state.indexPromise = Promise.all([loadMiniSearch(), loadDocuments()])
        .then(([MiniSearch, documents]) => {
          const miniSearch = new MiniSearch({
            fields: ['title', 'creator_text', 'search_text'],
            storeFields: [
              'url',
              'title',
              'creator_text',
              'date_composite',
              'image_url',
              'image_srcset'
            ],
            searchOptions: {
              boost: { title: 3, creator_text: 2 },
              prefix: true,
              fuzzy: 0.2
            }
          });
          miniSearch.addAll(documents);
          return miniSearch;
        });
    }
    return state.indexPromise;
  }

  function appendText(element, value) {
    element.appendChild(document.createTextNode(value));
  }

  function resultCard(result) {
    const item = document.createElement('li');
    item.className = 'image-card';
    item.dataset.card = '';

    const link = document.createElement('a');
    link.className = 'card-link';
    link.href = result.url;

    const figure = document.createElement('figure');
    if (result.image_url) {
      const image = document.createElement('img');
      image.src = result.image_url;
      if (result.image_srcset) image.srcset = result.image_srcset;
      image.sizes = '(min-width: 1200px) 18rem, (min-width: 800px) 25vw, 50vw';
      image.alt = result.title || '';
      image.loading = 'lazy';
      image.decoding = 'async';
      figure.appendChild(image);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder-image';
      placeholder.setAttribute('role', 'img');
      placeholder.setAttribute('aria-label', `No thumbnail available for ${result.title || 'this item'}`);
      placeholder.textContent = 'No image';
      figure.appendChild(placeholder);
    }

    const caption = document.createElement('figcaption');
    const title = document.createElement('strong');
    title.textContent = result.title || '-';
    const creator = document.createElement('em');
    creator.className = 'card-creator';
    creator.textContent = result.creator_text || '-';
    const date = document.createElement('span');
    date.className = 'card-date';
    date.textContent = result.date_composite || 'Date unknown';
    caption.append(title, creator, date);
    figure.appendChild(caption);
    link.appendChild(figure);
    item.appendChild(link);
    return item;
  }

  function renderResults(results, query) {
    resultsList.replaceChildren(...results.map(resultCard));
    const count = results.length;
    status.textContent = count
      ? `${count} result${count === 1 ? '' : 's'} for “${query}”.`
      : `No results for “${query}”.`;
  }

  async function search(query) {
    const cleanQuery = query.trim();
    queryInput.value = cleanQuery;
    resultsList.replaceChildren();

    if (!cleanQuery) {
      status.textContent = 'Enter a search term to search the catalogue.';
      return;
    }

    status.textContent = 'Searching…';
    try {
      const miniSearch = await getSearchIndex();
      renderResults(miniSearch.search(cleanQuery), cleanQuery);
    } catch (error) {
      status.textContent = 'Search is temporarily unavailable.';
      console.error(error);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = queryInput.value.trim();
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.pushState({}, '', url);
    search(query);
  });

  window.addEventListener('popstate', () => {
    search(new URLSearchParams(window.location.search).get('q') || '');
  });

  search(new URLSearchParams(window.location.search).get('q') || '');
})();
