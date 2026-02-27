import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadCollectedResults, type CollectedResult } from "./json.js";
import { getToolVersion } from "./config.js";
import { type ResolvedConfig, type PageInfo } from "./types.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const IMPACT_LABELS: Record<string, string> = {
  critical: "critical",
  serious:  "serious",
  moderate: "moderate",
  minor:    "minor",
};

interface ViolationNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

interface AxeViolation {
  id: string;
  impact?: string;
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: ViolationNode[];
}

function collectViolations(
  collected: CollectedResult[],
): Array<{ pageUrl: string; violation: AxeViolation }> {
  const entries: Array<{ pageUrl: string; violation: AxeViolation }> = [];
  for (const item of collected) {
    if (!item.axeResults?.violations) continue;
    const pageUrl = item.url;
    for (const v of item.axeResults.violations as AxeViolation[]) {
      entries.push({ pageUrl, violation: v });
    }
  }
  return entries;
}

function collectIncomplete(
  collected: CollectedResult[],
): Array<{ pageUrl: string; violation: AxeViolation }> {
  const entries: Array<{ pageUrl: string; violation: AxeViolation }> = [];
  for (const item of collected) {
    if (!item.axeResults?.incomplete) continue;
    const pageUrl = item.url;
    for (const v of item.axeResults.incomplete as AxeViolation[]) {
      entries.push({ pageUrl, violation: v });
    }
  }
  return entries;
}

function collectPasses(
  collected: CollectedResult[],
): Array<{ pageUrl: string; violation: AxeViolation }> {
  const entries: Array<{ pageUrl: string; violation: AxeViolation }> = [];
  for (const item of collected) {
    if (!item.axeResults?.passes) continue;
    const pageUrl = item.url;
    for (const v of item.axeResults.passes as AxeViolation[]) {
      entries.push({ pageUrl, violation: v });
    }
  }
  return entries;
}

function collectInapplicable(
  collected: CollectedResult[],
): Array<{ pageUrl: string; violation: AxeViolation }> {
  const entries: Array<{ pageUrl: string; violation: AxeViolation }> = [];
  for (const item of collected) {
    if (!item.axeResults?.inapplicable) continue;
    const pageUrl = item.url;
    for (const v of item.axeResults.inapplicable as AxeViolation[]) {
      entries.push({ pageUrl, violation: v });
    }
  }
  return entries;
}

function collectAxeVersion(collected: CollectedResult[]): string {
  for (const item of collected) {
    if (item.axeResults?.testEngine?.version) {
      return item.axeResults.testEngine.version;
    }
  }
  return "unknown";
}

function renderNodeCard(node: ViolationNode, index: number): string {
  const targets = node.target.join(", ");
  const failureRow = node.failureSummary
    ? `
                  <div>
                    <dt>失敗の理由</dt>
                    <dd class="text-failure">${escapeHtml(node.failureSummary)}</dd>
                  </div>`
    : "";
  return `
              <div class="inner-card">
                <p class="inner-card-header">要素 ${index + 1}</p>
                <dl class="dl-rows">
                  <div>
                    <dt>HTML</dt>
                    <dd><code class="code-dark">${escapeHtml(node.html)}</code></dd>
                  </div>
                  <div>
                    <dt>場所（CSSセレクタ）</dt>
                    <dd><code class="code-light">${escapeHtml(targets)}</code></dd>
                  </div>${failureRow}
                </dl>
              </div>`;
}

function renderRuleInfo(v: AxeViolation): string {
  const wcagTags = v.tags
    .filter((t) => t.startsWith("wcag") || t === "best-practice" || t === "section508")
    .map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`)
    .join("");
  return `
              <div class="rule-info">
                <span class="detail-label">ルール情報</span>
                <div class="inner-card">
                  <dl class="dl-rows">
                    <div>
                      <dt>タグ</dt>
                      <dd><div class="tag-list">${wcagTags}</div></dd>
                    </div>
                    <div>
                      <dt>参考リンク</dt>
                      <dd><a href="${escapeHtml(v.helpUrl)}" target="_blank" rel="noopener noreferrer" class="help-link">${escapeHtml(v.helpUrl)}</a></dd>
                    </div>
                  </dl>
                </div>
              </div>`;
}

function renderRow(
  pageUrl: string,
  v: AxeViolation,
  index: number,
): string {
  const impact = v.impact ?? "";
  const impactLabel = IMPACT_LABELS[impact] ?? impact;
  const impactClass = Object.keys(IMPACT_LABELS).includes(impact) ? `badge-${impact}` : "";

  const nodeCards = v.nodes.map((node, ni) => renderNodeCard(node, ni)).join("");

  return `
          <details>
            <summary>
              <div aria-hidden="true" class="toggle-cell">
                <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="cell-no">${index + 1}</div>
              <div class="cell-url"><span>${escapeHtml(pageUrl)}</span></div>
              <div class="cell-impact">
                <span class="badge ${escapeHtml(impactClass)}">
                  <span aria-hidden="true" class="badge-dot"></span>${escapeHtml(impactLabel)}
                </span>
              </div>
              <div class="cell-ruleid"><code class="ruleid-code">${escapeHtml(v.id)}</code></div>
              <div class="cell-desc">${escapeHtml(v.help)}</div>
              <div class="cell-count"><span class="count-badge">${v.nodes.length}</span></div>
            </summary>
            <div class="detail-panel">
              <p class="detail-label">影響を受ける要素</p>${nodeCards}${renderRuleInfo(v)}
            </div>
          </details>`;
}

function renderIncompleteRow(
  pageUrl: string,
  v: AxeViolation,
  index: number,
): string {
  const nodeCards = v.nodes.map((node, ni) => renderNodeCard(node, ni)).join("");

  return `
          <details>
            <summary>
              <div aria-hidden="true" class="toggle-cell">
                <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="cell-no">${index + 1}</div>
              <div class="cell-url"><span>${escapeHtml(pageUrl)}</span></div>
              <div class="cell-ruleid"><code class="ruleid-code">${escapeHtml(v.id)}</code></div>
              <div class="cell-desc">${escapeHtml(v.help)}</div>
              <div class="cell-count"><span class="count-badge">${v.nodes.length}</span></div>
            </summary>
            <div class="detail-panel">
              <p class="detail-label">確認が必要な要素</p>${nodeCards}${renderRuleInfo(v)}
            </div>
          </details>`;
}

function renderPassRow(
  pageUrl: string,
  v: AxeViolation,
  index: number,
): string {
  const nodeCards = v.nodes.map((node, ni) => renderNodeCard(node, ni)).join("");
  const detail = v.nodes.length > 0
    ? `<div class="detail-panel"><p class="detail-label">合格した要素</p>${nodeCards}${renderRuleInfo(v)}</div>`
    : `<div class="detail-panel">${renderRuleInfo(v)}</div>`;
  return `
          <details>
            <summary>
              <div aria-hidden="true" class="toggle-cell">
                <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="cell-no">${index + 1}</div>
              <div class="cell-url"><span>${escapeHtml(pageUrl)}</span></div>
              <div class="cell-ruleid"><code class="ruleid-code">${escapeHtml(v.id)}</code></div>
              <div class="cell-desc">${escapeHtml(v.help)}</div>
              <div class="cell-count"><span class="count-badge">${v.nodes.length}</span></div>
            </summary>
            ${detail}
          </details>`;
}

function renderInapplicableRow(
  pageUrl: string,
  v: AxeViolation,
  index: number,
): string {
  return `
          <details>
            <summary>
              <div aria-hidden="true" class="toggle-cell">
                <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="cell-no">${index + 1}</div>
              <div class="cell-url"><span>${escapeHtml(pageUrl)}</span></div>
              <div class="cell-ruleid"><code class="ruleid-code">${escapeHtml(v.id)}</code></div>
              <div class="cell-desc">${escapeHtml(v.help)}</div>
            </summary>
            <div class="detail-panel">${renderRuleInfo(v)}</div>
          </details>`;
}

const CSS = `
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; }
    h1, h2, h3, h4, h5, h6 { margin: 0; font-size: inherit; font-weight: inherit; }
    p { margin: 0; }
    dl, dd { margin: 0; }

    /* Base */
    body {
      min-height: 100vh;
      background-color: #f9fafb;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    /* Header */
    header { background-color: #f9fafb; }
    .header-inner {
      max-width: 72rem;
      margin: 0 auto;
      padding: 2rem 1.5rem 1.5rem;
    }
    header h1 {
      font-size: 1.25rem;
      line-height: 1.75rem;
      font-weight: 500;
      color: #111827;
      margin-bottom: 0.25rem;
    }
    header p {
      font-size: 1rem;
      line-height: 1.5rem;
      color: #4b5563;
    }
    .header-meta {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      line-height: 1rem;
      color: #9ca3af;
    }
    .header-meta span + span::before {
      content: " | ";
    }

    /* Main */
    main {
      max-width: 72rem;
      margin: 0 auto;
      padding: 1.5rem;
    }
    main > section + section { margin-top: 2rem; }

    /* Section heading */
    .section-heading {
      font-size: 0.875rem;
      line-height: 1.25rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.75rem;
    }

    /* Card */
    .card {
      background-color: #ffffff;
      border-radius: 0.75rem;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }
    .card-scroll { overflow-x: auto; }

    /* Grid table - violations (with impact column) */
    .grid-table {
      display: grid;
      grid-template-columns: 2.5rem 3rem minmax(0, 1fr) 7rem 11rem minmax(0, 2fr) 5.5rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      min-width: 48rem;
    }

    /* Grid table - incomplete/passes (no impact column) */
    .grid-table-incomplete {
      display: grid;
      grid-template-columns: 2.5rem 3rem minmax(0, 1fr) 11rem minmax(0, 2fr) 5.5rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      min-width: 40rem;
    }

    /* Grid table - inapplicable (no impact/count column) */
    .grid-table-inapplicable {
      display: grid;
      grid-template-columns: 2.5rem 3rem minmax(0, 1fr) 11rem minmax(0, 2fr);
      font-size: 0.875rem;
      line-height: 1.25rem;
      min-width: 36rem;
    }

    .grid-table-header { display: contents; }
    .grid-table-header > div,
    .grid-table-incomplete-header > div {
      padding: 0.75rem 1rem;
      background-color: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      font-size: 0.75rem;
      line-height: 1rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
    .grid-table-incomplete-header { display: contents; }
    .th-count { text-align: center; white-space: nowrap; }

    /* Details row - violations */
    .grid-table > details {
      grid-column: 1 / -1;
      display: block;
      border-bottom: 1px solid #f3f4f6;
    }
    .grid-table > details > summary {
      display: grid;
      grid-template-columns: 2.5rem 3rem minmax(0, 1fr) 7rem 11rem minmax(0, 2fr) 5.5rem;
      align-items: center;
      list-style: none;
      cursor: pointer;
    }
    .grid-table > details > summary::-webkit-details-marker { display: none; }

    /* Details row - incomplete */
    .grid-table-incomplete > details {
      grid-column: 1 / -1;
      display: block;
      border-bottom: 1px solid #f3f4f6;
    }
    .grid-table-incomplete > details > summary {
      display: grid;
      grid-template-columns: 2.5rem 3rem minmax(0, 1fr) 11rem minmax(0, 2fr) 5.5rem;
      align-items: center;
      list-style: none;
      cursor: pointer;
    }
    .grid-table-incomplete > details > summary::-webkit-details-marker { display: none; }

    /* Details row - inapplicable */
    .grid-table-inapplicable > details {
      grid-column: 1 / -1;
      display: block;
      border-bottom: 1px solid #f3f4f6;
    }
    .grid-table-inapplicable > details > summary {
      display: grid;
      grid-template-columns: 2.5rem 3rem minmax(0, 1fr) 11rem minmax(0, 2fr);
      align-items: center;
      list-style: none;
      cursor: pointer;
    }
    .grid-table-inapplicable > details > summary::-webkit-details-marker { display: none; }

    /* Chevron */
    .toggle-cell { padding: 0.75rem 1rem; }
    .toggle-cell .chevron { transform: rotate(-90deg); }
    details[open] > summary .toggle-cell .chevron { transform: rotate(0deg); }

    /* Summary cells */
    .cell-no {
      padding: 0.75rem 1rem;
      font-size: 0.75rem;
      line-height: 1rem;
      color: #9ca3af;
    }
    .cell-url { padding: 0.75rem 1rem; overflow: hidden; }
    .cell-url span {
      display: block;
      font-size: 0.75rem;
      line-height: 1rem;
      color: #6b7280;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell-impact { padding: 0.75rem 1rem; }
    .cell-ruleid { padding: 0.75rem 1rem; }
    .cell-desc { padding: 0.75rem 1rem; color: #374151; }
    .cell-count { padding: 0.75rem 1rem; text-align: center; }

    /* Impact badge */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      line-height: 1rem;
    }
    .badge-dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 9999px;
      flex-shrink: 0;
    }
    .badge-minor    { background-color: #dbeafe; }
    .badge-minor    .badge-dot { background-color: #60a5fa; }
    .badge-moderate { background-color: #fef9c3; }
    .badge-moderate .badge-dot { background-color: #facc15; }
    .badge-serious  { background-color: #ffedd5; }
    .badge-serious  .badge-dot { background-color: #fb923c; }
    .badge-critical { background-color: #fee2e2; }
    .badge-critical .badge-dot { background-color: #f87171; }

    /* Rule ID */
    .ruleid-code {
      font-size: 0.75rem;
      line-height: 1rem;
      background-color: #f3f4f6;
      color: #374151;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    /* Count badge */
    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 9999px;
      background-color: #f3f4f6;
      color: #4b5563;
      font-size: 0.75rem;
      line-height: 1rem;
    }

    /* Detail panel */
    .detail-panel {
      background-color: #f9fafb;
      padding: 1.25rem 1.5rem;
    }
    .detail-panel > * + * { margin-top: 0.75rem; }
    .detail-label {
      font-size: 0.75rem;
      line-height: 1rem;
      color: #6b7280;
    }

    /* Inner card */
    .inner-card {
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
      background-color: #ffffff;
      overflow: hidden;
    }
    .inner-card-header {
      padding: 0.375rem 0.75rem;
      background-color: #f9fafb;
      border-bottom: 1px solid #f3f4f6;
      font-size: 0.75rem;
      line-height: 1rem;
      color: #9ca3af;
    }

    /* Definition list */
    .dl-rows {
      width: 100%;
      font-size: 0.75rem;
      line-height: 1rem;
    }
    .dl-rows > div {
      display: flex;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
    }
    .dl-rows > div + div { border-top: 1px solid #f3f4f6; }
    .dl-rows dt {
      width: 9rem;
      flex-shrink: 0;
      color: #6b7280;
      white-space: nowrap;
      font-weight: 500;
    }
    .dl-rows dd { min-width: 0; }

    /* Code */
    .code-dark {
      display: block;
      background-color: #020617;
      color: #ffffff;
      border-radius: 0.25rem;
      padding: 0.375rem 0.5rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.75rem;
      line-height: 1rem;
      word-break: break-all;
    }
    .code-light {
      background-color: #f3f4f6;
      color: #374151;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.75rem;
      line-height: 1rem;
      word-break: break-all;
    }
    .text-failure { color: #374151; white-space: pre-wrap; }

    /* Rule info */
    .rule-info { padding-top: 0.5rem; border-top: 1px solid #e5e7eb; }
    .rule-info > .detail-label { display: block; margin-bottom: 0.5rem; }

    /* Tags */
    .tag-list { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .tag-pill {
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      border: 1px solid #d1d5db;
      color: #6b7280;
      font-size: 0.75rem;
      line-height: 1rem;
    }

    /* Link */
    .help-link { color: #4f46e5; word-break: break-all; text-decoration: none; }
    .help-link:hover { text-decoration: underline; }

    /* Focus */
    :focus-visible { outline: 1px solid #4f46e5; outline-offset: -4px; }

    /* Page list grid */
    .grid-table-pagelist {
      display: grid;
      grid-template-columns: 3rem minmax(0, 1fr);
      font-size: 0.875rem;
      line-height: 1.25rem;
      min-width: 20rem;
    }
    .list-row {
      display: contents;
    }
    .list-row > div {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #f3f4f6;
    }
    .list-row:last-child > div { border-bottom: none; }
`;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildHtml(
  violationRows: string,
  incompleteRows: string,
  passRows: string,
  inapplicableRows: string,
  violationCount: number,
  incompleteCount: number,
  passCount: number,
  inapplicableCount: number,
  showIncomplete: boolean,
  showPasses: boolean,
  showInapplicable: boolean,
  meta: { timestamp: string; axeVersion: string; toolVersion: string },
  pages: PageInfo[],
  excludedPages: PageInfo[],
): string {
  const summaryText = violationCount === 0
    ? "問題は検出されませんでした"
    : `${violationCount} 件の問題が検出されました`;

  const auditedPageRows = pages.map((p, i) => `
            <div class="list-row">
              <div class="cell-no">${i + 1}</div>
              <div class="cell-url"><span>${escapeHtml(p.path)}</span></div>
            </div>`).join("");
  const auditedPagesSection = `
    <section>
      <h2 class="section-heading">検査対象ページ ${pages.length}件</h2>
      <div class="card">
        <div class="card-scroll">
          <div class="grid-table-pagelist">
            <div class="grid-table-incomplete-header">
              <div>No</div>
              <div>URL</div>
            </div>${auditedPageRows}
          </div>
        </div>
      </div>
    </section>`;

  const excludedPageRows = excludedPages.map((p, i) => `
            <div class="list-row">
              <div class="cell-no">${i + 1}</div>
              <div class="cell-url"><span>${escapeHtml(p.path)}</span></div>
            </div>`).join("");
  const excludedPagesSection = excludedPages.length > 0 ? `
    <section>
      <h2 class="section-heading">除外ページ ${excludedPages.length}件</h2>
      <div class="card">
        <div class="card-scroll">
          <div class="grid-table-pagelist">
            <div class="grid-table-incomplete-header">
              <div>No</div>
              <div>URL</div>
            </div>${excludedPageRows}
          </div>
        </div>
      </div>
    </section>` : "";

  const violationSection = `
    <section>
      <h2 class="section-heading">違反 (violations) ${violationCount}件</h2>
      <div class="card">
        <div class="card-scroll">
          <div class="grid-table">
            <div class="grid-table-header">
              <div><span class="sr-only">詳細</span></div>
              <div>No</div>
              <div>URL</div>
              <div>深刻度</div>
              <div>ルールID</div>
              <div>説明</div>
              <div class="th-count">影響要素数</div>
            </div>${violationRows}
          </div>
        </div>
      </div>
    </section>`;

  const incompleteSection = showIncomplete ? `
    <section>
      <h2 class="section-heading">要確認 (incomplete) ${incompleteCount}件</h2>
      <div class="card">
        <div class="card-scroll">
          <div class="grid-table-incomplete">
            <div class="grid-table-incomplete-header">
              <div><span class="sr-only">詳細</span></div>
              <div>No</div>
              <div>URL</div>
              <div>ルールID</div>
              <div>説明</div>
              <div class="th-count">要素数</div>
            </div>${incompleteRows}
          </div>
        </div>
      </div>
    </section>` : "";

  const passSection = showPasses ? `
    <section>
      <h2 class="section-heading">合格 (passes) ${passCount}件</h2>
      <div class="card">
        <div class="card-scroll">
          <div class="grid-table-incomplete">
            <div class="grid-table-incomplete-header">
              <div><span class="sr-only">詳細</span></div>
              <div>No</div>
              <div>URL</div>
              <div>ルールID</div>
              <div>説明</div>
              <div class="th-count">要素数</div>
            </div>${passRows}
          </div>
        </div>
      </div>
    </section>` : "";

  const inapplicableSection = showInapplicable ? `
    <section>
      <h2 class="section-heading">非対象 (inapplicable) ${inapplicableCount}件</h2>
      <div class="card">
        <div class="card-scroll">
          <div class="grid-table-inapplicable">
            <div class="grid-table-incomplete-header">
              <div><span class="sr-only">詳細</span></div>
              <div>No</div>
              <div>URL</div>
              <div>ルールID</div>
              <div>説明</div>
            </div>${inapplicableRows}
          </div>
        </div>
      </div>
    </section>` : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>アクセシビリティ検査結果</title>
  <style>${CSS}  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <h1>アクセシビリティ検査結果</h1>
      <p>${summaryText}</p>
      <p class="header-meta">
        <span>実行日時: ${escapeHtml(formatTimestamp(meta.timestamp))}</span>
        <span>axe-core ${escapeHtml(meta.axeVersion)}</span>
        <span>axe-audit ${escapeHtml(meta.toolVersion)}</span>
      </p>
    </div>
  </header>
  <main>${violationSection}${incompleteSection}${passSection}${inapplicableSection}${auditedPagesSection}${excludedPagesSection}
  </main>
</body>
</html>`;
}

export function generateHtmlReport(tmpDir: string, config: Pick<ResolvedConfig, "showIncomplete" | "showPasses" | "showInapplicable">, pages: PageInfo[], excludedPages: PageInfo[], cwd: string = process.cwd()): void {
  const collected = loadCollectedResults(tmpDir);
  const violations = collectViolations(collected);
  const incomplete = config.showIncomplete ? collectIncomplete(collected) : [];
  const passes = config.showPasses ? collectPasses(collected) : [];
  const inapplicable = config.showInapplicable ? collectInapplicable(collected) : [];
  const axeVersion = collectAxeVersion(collected);

  const violationRows = violations.map(({ pageUrl, violation }, i) => renderRow(pageUrl, violation, i)).join("");
  const incompleteRows = incomplete.map(({ pageUrl, violation }, i) => renderIncompleteRow(pageUrl, violation, i)).join("");
  const passRows = passes.map(({ pageUrl, violation }, i) => renderPassRow(pageUrl, violation, i)).join("");
  const inapplicableRows = inapplicable.map(({ pageUrl, violation }, i) => renderInapplicableRow(pageUrl, violation, i)).join("");

  const html = buildHtml(
    violationRows,
    incompleteRows,
    passRows,
    inapplicableRows,
    violations.length,
    incomplete.length,
    passes.length,
    inapplicable.length,
    config.showIncomplete,
    config.showPasses,
    config.showInapplicable,
    {
      timestamp: new Date().toISOString(),
      axeVersion,
      toolVersion: getToolVersion(),
    },
    pages,
    excludedPages,
  );

  const outputDir = resolve(cwd, "axe-audit");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "report.html");
  writeFileSync(outputPath, html, "utf-8");
  console.log(`HTML report saved: ${outputPath}`);
}
