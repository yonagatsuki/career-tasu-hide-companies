// ==UserScript==
// @name         キャリタス就活 - 企業カード非表示
// @namespace    https://job.career-tasu.jp/
// @version      1.0.0
// @description  キャリタス就活の就職検索結果で、指定した企業の求人カードを次回以降も非表示にします。
// @author       https://github.com/yonagatsuki/career-tasu-hide-companies
// @homepageURL  https://github.com/yonagatsuki/career-tasu-hide-companies
// @supportURL   https://github.com/yonagatsuki/career-tasu-hide-companies/issues
// @match        https://job.career-tasu.jp/employment-search/result/*
// @match        https://job.career-tasu.jp/employment-search/result*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'careerTasuHiddenCompanies:v1';
  const PROCESSED_ATTR = 'data-ct-hide-processed';
  const HIDDEN_ATTR = 'data-ct-company-hidden';

  const COMPANY_LINK_SELECTORS = [
    'a[href*="/company/"]',
    'a[href*="/company-detail/"]',
    'a[href*="/corporation/"]',
    'a[href*="/corp/"]',
    'a[href*="/employment/company"]',
    'a[href*="companyId="]',
    'a[href*="corpId="]'
  ];

  const CARD_SELECTORS = [
    'li',
    'article',
    '.card',
    '.box',
    '.result',
    '.resultBox',
    '.result-box',
    '.searchResult',
    '.search-result',
    '[class*="result"]',
    '[class*="Result"]',
    '[class*="company"]',
    '[class*="Company"]',
    '[class*="job"]',
    '[class*="Job"]'
  ];

  const STYLE_TEXT = `
    .ct-hide-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 5px 10px;
      border: 1px solid #b5bdc8;
      border-radius: 4px;
      background: #fff;
      color: #333;
      font-size: 12px;
      line-height: 1.3;
      cursor: pointer;
      box-sizing: border-box;
      white-space: nowrap;
    }
    .ct-hide-button:hover {
      background: #f4f6f8;
      border-color: #8d98a8;
    }
    .ct-hide-toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
    }
    .ct-floating-open {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483646;
      border: 1px solid #1f5faa;
      border-radius: 4px;
      background: #1f6fbd;
      color: #fff;
      box-shadow: 0 6px 18px rgba(0, 0, 0, .18);
      font-size: 13px;
      font-weight: 700;
      padding: 10px 14px;
      cursor: pointer;
    }
    .ct-floating-open:hover {
      background: #165a9c;
    }
    .ct-panel-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      background: rgba(0, 0, 0, .25);
      display: none;
    }
    .ct-panel-backdrop.is-open {
      display: block;
    }
    .ct-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: min(420px, 92vw);
      height: 100vh;
      z-index: 2147483647;
      background: #fff;
      box-shadow: -10px 0 30px rgba(0, 0, 0, .18);
      transform: translateX(100%);
      transition: transform .18s ease;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #222;
    }
    .ct-panel.is-open {
      transform: translateX(0);
    }
    .ct-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 18px;
      border-bottom: 1px solid #e2e6ea;
    }
    .ct-panel-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }
    .ct-panel-close {
      border: 0;
      background: transparent;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      color: #333;
    }
    .ct-panel-body {
      padding: 14px 18px 18px;
      overflow: auto;
      flex: 1;
    }
    .ct-panel-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 12px;
    }
    .ct-hidden-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .ct-hidden-item {
      border: 1px solid #e0e5ea;
      border-radius: 4px;
      padding: 10px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      background: #fff;
    }
    .ct-company-link {
      color: #0b65b9;
      text-decoration: underline;
      word-break: break-word;
      font-weight: 700;
    }
    .ct-empty {
      margin: 24px 0;
      color: #67727e;
      font-size: 14px;
    }
  `;

  function loadHiddenMap() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_error) {
      return {};
    }
  }

  function saveHiddenMap(hiddenMap) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenMap));
  }

  function normalizeName(name) {
    return String(name || '')
      .replace(/\s+/g, ' ')
      .replace(/^企業情報\s*/u, '')
      .replace(/\s*企業情報$/u, '')
      .trim();
  }

  function absoluteUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch (_error) {
      return location.href;
    }
  }

  function isCompanyLink(link) {
    if (!link || !link.href) return false;
    return COMPANY_LINK_SELECTORS.some((selector) => {
      try {
        return link.matches(selector);
      } catch (_error) {
        return false;
      }
    });
  }

  function cleanLinkText(link) {
    const aria = link.getAttribute('aria-label');
    const title = link.getAttribute('title');
    return normalizeName(aria || title || link.textContent);
  }

  function findCompanyLink(card) {
    const links = Array.from(card.querySelectorAll('a[href]'));
    return links.find(isCompanyLink) || links.find((link) => {
      const text = cleanLinkText(link);
      return text && /会社|企業|株式会社|有限会社|法人|組合/u.test(text);
    });
  }

  function findCompanyName(card, link) {
    const likelyNameElement = card.querySelector([
      '[class*="company"]',
      '[class*="Company"]',
      '[class*="corp"]',
      '[class*="Corp"]',
      '[class*="企業"]',
      '[class*="社名"]',
      'h1',
      'h2',
      'h3',
      'h4'
    ].join(','));

    const fromLikely = normalizeName(likelyNameElement && likelyNameElement.textContent);
    const fromLink = normalizeName(link && cleanLinkText(link));
    const candidates = [fromLikely, fromLink].filter(Boolean);
    return candidates.find((name) => name.length >= 2 && name.length <= 80) || '';
  }

  function findCardFromLink(link) {
    for (const selector of CARD_SELECTORS) {
      const card = link.closest(selector);
      if (card && card !== document.body && card !== document.documentElement) {
        const rect = card.getBoundingClientRect();
        if (rect.width > 180 || card.querySelectorAll('a').length >= 2) return card;
      }
    }
    return null;
  }

  function discoverCards() {
    const cards = new Set();

    document.querySelectorAll(COMPANY_LINK_SELECTORS.join(',')).forEach((link) => {
      const card = findCardFromLink(link);
      if (card) cards.add(card);
    });

    document.querySelectorAll(CARD_SELECTORS.join(',')).forEach((candidate) => {
      if (candidate === document.body || candidate === document.documentElement) return;
      if (candidate.querySelector('a[href]') && findCompanyLink(candidate)) cards.add(candidate);
    });

    return Array.from(cards).filter((card) => !Array.from(cards).some((other) => {
      return other !== card && other.contains(card) && findCompanyLink(other);
    }));
  }

  function addHideButton(card, company) {
    if (card.querySelector(':scope > .ct-hide-toolbar, .ct-hide-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'ct-hide-toolbar';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ct-hide-button';
    button.textContent = 'この企業を非表示';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const hiddenMap = loadHiddenMap();
      hiddenMap[company.name] = {
        name: company.name,
        url: company.url,
        hiddenAt: new Date().toISOString()
      };
      saveHiddenMap(hiddenMap);
      hideMatchingCards();
      renderPanelList();
    });

    toolbar.appendChild(button);
    card.insertBefore(toolbar, card.firstChild);
  }

  function getCompanyFromCard(card) {
    const link = findCompanyLink(card);
    const name = findCompanyName(card, link);
    if (!name) return null;

    return {
      name,
      url: absoluteUrl(link ? link.href : location.href)
    };
  }

  function processCard(card) {
    if (card.getAttribute(PROCESSED_ATTR) === '1') return;

    const company = getCompanyFromCard(card);
    if (!company) return;

    card.setAttribute(PROCESSED_ATTR, '1');
    card.setAttribute('data-ct-company-name', company.name);
    addHideButton(card, company);
  }

  function processCards() {
    discoverCards().forEach(processCard);
    hideMatchingCards();
  }

  function hideMatchingCards() {
    const hiddenMap = loadHiddenMap();
    document.querySelectorAll(`[${PROCESSED_ATTR}="1"]`).forEach((card) => {
      const companyName = card.getAttribute('data-ct-company-name');
      if (companyName && hiddenMap[companyName]) {
        card.style.display = 'none';
        card.setAttribute(HIDDEN_ATTR, '1');
      } else if (card.getAttribute(HIDDEN_ATTR) === '1') {
        card.style.display = '';
        card.removeAttribute(HIDDEN_ATTR);
      }
    });
  }

  function removeHiddenCompany(name) {
    const hiddenMap = loadHiddenMap();
    delete hiddenMap[name];
    saveHiddenMap(hiddenMap);
    renderPanelList();
    hideMatchingCards();
  }

  function clearHiddenCompanies() {
    if (!confirm('非表示リストをすべて解除しますか？')) return;
    saveHiddenMap({});
    renderPanelList();
    hideMatchingCards();
  }

  function createPanel() {
    if (document.getElementById('ct-hidden-panel')) return;

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'ct-floating-open';
    openButton.textContent = '非表示リスト';
    openButton.addEventListener('click', openPanel);
    document.body.appendChild(openButton);

    const backdrop = document.createElement('div');
    backdrop.className = 'ct-panel-backdrop';
    backdrop.id = 'ct-panel-backdrop';
    backdrop.addEventListener('click', closePanel);
    document.body.appendChild(backdrop);

    const panel = document.createElement('aside');
    panel.className = 'ct-panel';
    panel.id = 'ct-hidden-panel';
    panel.setAttribute('aria-label', '非表示リスト');
    panel.innerHTML = `
      <div class="ct-panel-header">
        <h2 class="ct-panel-title">非表示リスト</h2>
        <button type="button" class="ct-panel-close" aria-label="閉じる">×</button>
      </div>
      <div class="ct-panel-body">
        <div class="ct-panel-actions">
          <button type="button" class="ct-hide-button" id="ct-clear-all">すべて解除</button>
        </div>
        <div id="ct-hidden-list-root"></div>
      </div>
    `;
    panel.querySelector('.ct-panel-close').addEventListener('click', closePanel);
    panel.querySelector('#ct-clear-all').addEventListener('click', clearHiddenCompanies);
    document.body.appendChild(panel);

    renderPanelList();
  }

  function openPanel() {
    document.getElementById('ct-panel-backdrop').classList.add('is-open');
    document.getElementById('ct-hidden-panel').classList.add('is-open');
    renderPanelList();
  }

  function closePanel() {
    document.getElementById('ct-panel-backdrop').classList.remove('is-open');
    document.getElementById('ct-hidden-panel').classList.remove('is-open');
  }

  function renderPanelList() {
    const root = document.getElementById('ct-hidden-list-root');
    if (!root) return;

    const hiddenCompanies = Object.values(loadHiddenMap())
      .filter((item) => item && item.name)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'));

    if (!hiddenCompanies.length) {
      root.innerHTML = '<p class="ct-empty">非表示にした企業はありません。</p>';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'ct-hidden-list';

    hiddenCompanies.forEach((company) => {
      const item = document.createElement('li');
      item.className = 'ct-hidden-item';

      const link = document.createElement('a');
      link.className = 'ct-company-link';
      link.href = company.url || location.href;
      link.textContent = company.name;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'ct-hide-button';
      removeButton.textContent = '解除';
      removeButton.addEventListener('click', () => removeHiddenCompany(company.name));

      item.appendChild(link);
      item.appendChild(removeButton);
      list.appendChild(item);
    });

    root.replaceChildren(list);
  }

  function injectStyle() {
    if (document.getElementById('ct-hide-style')) return;
    const style = document.createElement('style');
    style.id = 'ct-hide-style';
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
  }

  function debounce(fn, delay) {
    let timer = null;
    return function debounced() {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  function init() {
    injectStyle();
    createPanel();
    processCards();

    const refresh = debounce(processCards, 250);
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
