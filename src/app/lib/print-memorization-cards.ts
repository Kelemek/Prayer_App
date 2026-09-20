import { escapeHtmlForPrint } from './print-html';

export type MemorizationPrintCard = {
  reference: string;
  text: string;
  translation: string;
};

/** Duplex: front page then back (long-edge). Foldable: single-sided, ref left / text right, center fold. */
export type MemorizationPrintSheetStyle = 'duplex' | 'foldable';

/** Bumped when print CSS changes — visible in tab title and data-print-layout-version. */
export const MEMORIZATION_PRINT_LAYOUT_VERSION = 9;

/** Duplex sheet: 2×3 grid. */
export const MEMORIZATION_CARDS_PER_SHEET = 6;
/** Foldable sheet: one column, three cards (reference | verse per row). */
export const MEMORIZATION_FOLDABLE_CARDS_PER_SHEET = 3;

const DUPLEX_GRID_COLS = 2;
const DUPLEX_GRID_ROWS = 3;
const FOLDABLE_GRID_COLS = 1;
const FOLDABLE_GRID_ROWS = 3;
/** US Letter in points (72 pt = 1 in). WebKit print handles pt more reliably than in. */
export const MEMORIZATION_PRINT_PAGE_WIDTH_PT = 612;
export const MEMORIZATION_PRINT_PAGE_HEIGHT_PT = 792;
export const MEMORIZATION_PRINT_PAGE_MARGIN_PT = 36;
/** Shrink content box below printable height so cut lines do not spill to page 2 in Safari. */
export const MEMORIZATION_PRINT_CONTENT_HEIGHT_FUDGE_PT = 32;
export const MEMORIZATION_PRINT_CELL_GUTTER_PX = 2;

const PT_PER_IN = 72;
const PX_PER_IN = 96;

export interface MemorizationPrintLayout {
  pageMarginPt: number;
  contentWidthPt: number;
  contentHeightPt: number;
  rowHeightPt: number;
  colWidthPt: number;
  gridCols: number;
  gridRows: number;
}

export function memorizationCardsPerSheet(
  sheetStyle: MemorizationPrintSheetStyle
): number {
  return sheetStyle === 'foldable'
    ? MEMORIZATION_FOLDABLE_CARDS_PER_SHEET
    : MEMORIZATION_CARDS_PER_SHEET;
}

function gridShapeForStyle(sheetStyle: MemorizationPrintSheetStyle): {
  cols: number;
  rows: number;
} {
  return sheetStyle === 'foldable'
    ? { cols: FOLDABLE_GRID_COLS, rows: FOLDABLE_GRID_ROWS }
    : { cols: DUPLEX_GRID_COLS, rows: DUPLEX_GRID_ROWS };
}

function formatPt(value: number): string {
  return `${value.toFixed(2)}pt`;
}

export function computeMemorizationPrintLayout(
  sheetStyle: MemorizationPrintSheetStyle = 'duplex'
): MemorizationPrintLayout {
  const { cols, rows } = gridShapeForStyle(sheetStyle);
  const gutterPx = MEMORIZATION_PRINT_CELL_GUTTER_PX;
  const gutterPt = (gutterPx / PX_PER_IN) * PT_PER_IN;
  const printableW =
    MEMORIZATION_PRINT_PAGE_WIDTH_PT - 2 * MEMORIZATION_PRINT_PAGE_MARGIN_PT;
  const printableH =
    MEMORIZATION_PRINT_PAGE_HEIGHT_PT - 2 * MEMORIZATION_PRINT_PAGE_MARGIN_PT;
  const contentW = printableW;
  const contentH = printableH - MEMORIZATION_PRINT_CONTENT_HEIGHT_FUDGE_PT;
  const colWidthPt = (contentW - (cols - 1) * gutterPt) / cols;
  const rowHeightPt = (contentH - (rows - 1) * gutterPt) / rows;

  return {
    pageMarginPt: MEMORIZATION_PRINT_PAGE_MARGIN_PT,
    contentWidthPt: contentW,
    contentHeightPt: contentH,
    rowHeightPt,
    colWidthPt,
    gridCols: cols,
    gridRows: rows,
  };
}

function memorizationCardsPrintStyles(
  layout: MemorizationPrintLayout,
  sheetStyle: MemorizationPrintSheetStyle
): string {
  const pageMargin = formatPt(layout.pageMarginPt);
  const contentW = formatPt(layout.contentWidthPt);
  const contentH = formatPt(layout.contentHeightPt);
  const rowH = formatPt(layout.rowHeightPt);
  const gridCols = sheetStyle === 'foldable' ? '1fr' : '1fr 1fr';
  const gridRows = `repeat(${layout.gridRows}, ${rowH})`;

  return `
    @page {
      size: ${formatPt(MEMORIZATION_PRINT_PAGE_WIDTH_PT)} ${formatPt(MEMORIZATION_PRINT_PAGE_HEIGHT_PT)};
      margin: ${pageMargin};
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      color: #111;
      background: #f3f4f6;
    }
    .no-print {
      margin: 1rem auto;
      max-width: ${contentW};
      padding: 0.75rem 1rem;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.45;
      background: #eff6ff;
      border: 1px solid #93c5fd;
      border-radius: 8px;
    }
    .print-page {
      width: ${contentW};
      height: ${contentH};
      max-width: ${contentW};
      max-height: ${contentH};
      margin: 0 auto 1rem;
      padding: 0;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sheet-break {
      break-after: page;
      page-break-after: always;
      height: 0;
      margin: 0;
      padding: 0;
      border: 0;
      line-height: 0;
      font-size: 0;
      visibility: hidden;
    }
    .card-grid {
      display: grid;
      grid-template-columns: ${gridCols};
      grid-template-rows: ${gridRows};
      gap: ${MEMORIZATION_PRINT_CELL_GUTTER_PX}px;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
    .card-cell {
      min-height: 0;
      min-width: 0;
      height: ${rowH};
      max-height: ${rowH};
      overflow: hidden;
    }
    .card {
      width: 100%;
      height: 100%;
      max-height: 100%;
      margin: 0;
      padding: 14pt 10pt;
      border: none;
      outline: 1px dashed #6b7280;
      outline-offset: -1px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
    }
    .card-empty {
      outline-color: #d1d5db;
      background: #fafafa;
    }
    .card-front-ref,
    .card-back-text {
      margin: 0;
      max-width: 100%;
    }
    .card-front-ref {
      font-size: 16pt;
      font-weight: 700;
      line-height: 1.2;
    }
    .card-front-trans {
      margin-top: 5pt;
      font-size: 8.5pt;
      letter-spacing: 0.06em;
      color: #4b5563;
      font-family: system-ui, sans-serif;
    }
    .card-back {
      justify-content: center;
    }
    .card-back-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      max-height: 100%;
      overflow: hidden;
    }
    .card-back-text {
      font-size: 11pt;
      line-height: 1.3;
      overflow: hidden;
    }
    .card-back-ref {
      font-size: 8pt;
      color: #6b7280;
      font-family: system-ui, sans-serif;
      margin-top: 6pt;
      flex-shrink: 0;
    }
    .card-foldable {
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 100%;
      height: 100%;
      max-height: 100%;
      margin: 0;
      outline: 1px dashed #6b7280;
      outline-offset: -1px;
      overflow: hidden;
    }
    .card-foldable.card-empty {
      outline-color: #d1d5db;
      background: #fafafa;
    }
    .card-fold-half {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-width: 0;
      min-height: 0;
      padding: 10pt 8pt;
      overflow: hidden;
    }
    .card-fold-half--front {
      border-right: 1px dashed #9ca3af;
    }
    .card-fold-back-text {
      font-size: 9.5pt;
      line-height: 1.28;
      margin: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .card-fold-back-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      max-height: 100%;
      overflow: hidden;
    }
    .card-fold-back-ref {
      font-size: 7pt;
      color: #6b7280;
      font-family: system-ui, sans-serif;
      margin-top: 5pt;
      flex-shrink: 0;
    }
    @media print {
      .no-print { display: none !important; }
      html, body { background: #fff; }
      .print-page {
        margin: 0;
        box-shadow: none;
        width: ${contentW};
        height: ${contentH};
        max-height: ${contentH};
        overflow: hidden;
      }
    }
  `;
}

export function chunkMemorizationCardsForSheets(
  cards: MemorizationPrintCard[],
  cardsPerSheet = MEMORIZATION_CARDS_PER_SHEET
): MemorizationPrintCard[][] {
  const sheets: MemorizationPrintCard[][] = [];
  for (let i = 0; i < cards.length; i += cardsPerSheet) {
    sheets.push(cards.slice(i, i + cardsPerSheet));
  }
  return sheets;
}

function padSheetToGrid(
  sheet: MemorizationPrintCard[],
  cardsPerSheet: number
): (MemorizationPrintCard | null)[] {
  const cells: (MemorizationPrintCard | null)[] = [...sheet];
  while (cells.length < cardsPerSheet) {
    cells.push(null);
  }
  return cells.slice(0, cardsPerSheet);
}

function gridFromCells(
  cells: (MemorizationPrintCard | null)[],
  cols: number,
  rows: number
): (MemorizationPrintCard | null)[][] {
  const grid: (MemorizationPrintCard | null)[][] = [];
  for (let row = 0; row < rows; row++) {
    const rowCells: (MemorizationPrintCard | null)[] = [];
    for (let col = 0; col < cols; col++) {
      rowCells.push(cells[row * cols + col] ?? null);
    }
    grid.push(rowCells);
  }
  return grid;
}

/** Back grid mirrors columns for long-edge duplex so each card lines up with its front. */
export function mirrorBackGridForLongEdgeDuplex(
  frontGrid: (MemorizationPrintCard | null)[][]
): (MemorizationPrintCard | null)[][] {
  return frontGrid.map((row) => {
    const mirrored: (MemorizationPrintCard | null)[] = [];
    for (let col = 0; col < DUPLEX_GRID_COLS; col++) {
      mirrored.push(row[DUPLEX_GRID_COLS - 1 - col] ?? null);
    }
    return mirrored;
  });
}

function renderFrontCell(card: MemorizationPrintCard | null): string {
  if (!card) {
    return '<div class="card card-empty"></div>';
  }
  const ref = escapeHtmlForPrint(card.reference);
  const trans = escapeHtmlForPrint(card.translation.toUpperCase());
  return `<div class="card card-front">
    <div class="card-front-ref">${ref}</div>
    <div class="card-front-trans">${trans}</div>
  </div>`;
}

function renderBackCell(card: MemorizationPrintCard | null): string {
  if (!card) {
    return '<div class="card card-empty"></div>';
  }
  const text = escapeHtmlForPrint(card.text);
  const ref = escapeHtmlForPrint(card.reference);
  return `<div class="card card-back">
    <div class="card-back-inner">
      <div class="card-back-text">${text}</div>
      <div class="card-back-ref">${ref}</div>
    </div>
  </div>`;
}

function renderFoldableCell(card: MemorizationPrintCard | null): string {
  if (!card) {
    return `<div class="card-foldable card-empty">
      <div class="card-fold-half card-fold-half--front"></div>
      <div class="card-fold-half card-fold-half--back"></div>
    </div>`;
  }
  const ref = escapeHtmlForPrint(card.reference);
  const trans = escapeHtmlForPrint(card.translation.toUpperCase());
  const text = escapeHtmlForPrint(card.text);
  return `<div class="card-foldable">
    <div class="card-fold-half card-fold-half--front">
      <div class="card-front-ref">${ref}</div>
      <div class="card-front-trans">${trans}</div>
    </div>
    <div class="card-fold-half card-fold-half--back">
      <div class="card-fold-back-inner">
        <div class="card-fold-back-text">${text}</div>
        <div class="card-fold-back-ref">${ref}</div>
      </div>
    </div>
  </div>`;
}

function renderFoldableGridCells(grid: (MemorizationPrintCard | null)[][]): string {
  return grid
    .flat()
    .map((cell) => `<div class="card-cell">${renderFoldableCell(cell)}</div>`)
    .join('');
}

function renderGridCells(
  grid: (MemorizationPrintCard | null)[][],
  side: 'front' | 'back'
): string {
  return grid
    .flat()
    .map((cell) => {
      const inner = side === 'front' ? renderFrontCell(cell) : renderBackCell(cell);
      return `<div class="card-cell">${inner}</div>`;
    })
    .join('');
}

const SHEET_BREAK = '<div class="sheet-break"></div>';

function renderPage(
  grid: (MemorizationPrintCard | null)[][],
  side: 'front' | 'back' | 'foldable',
  layout: MemorizationPrintLayout
): string {
  const contentW = formatPt(layout.contentWidthPt);
  const contentH = formatPt(layout.contentHeightPt);
  const cells =
    side === 'foldable'
      ? renderFoldableGridCells(grid)
      : renderGridCells(grid, side);
  return `<div class="print-page sheet-${side}" style="width:${contentW};height:${contentH};max-height:${contentH}">
  <div class="card-grid">${cells}</div>
</div>`;
}

function buildDuplexSheetParts(
  sheets: MemorizationPrintCard[][],
  layout: MemorizationPrintLayout
): string[] {
  const parts: string[] = [];
  sheets.forEach((sheet, sheetIndex) => {
    const cells = padSheetToGrid(sheet, MEMORIZATION_CARDS_PER_SHEET);
    const frontGrid = gridFromCells(cells, layout.gridCols, layout.gridRows);
    const backGrid = mirrorBackGridForLongEdgeDuplex(frontGrid);
    const isLastSheet = sheetIndex === sheets.length - 1;

    parts.push(renderPage(frontGrid, 'front', layout));
    parts.push(SHEET_BREAK);
    parts.push(renderPage(backGrid, 'back', layout));
    if (!isLastSheet) {
      parts.push(SHEET_BREAK);
    }
  });
  return parts;
}

function buildFoldableSheetParts(
  sheets: MemorizationPrintCard[][],
  layout: MemorizationPrintLayout
): string[] {
  const parts: string[] = [];
  sheets.forEach((sheet, sheetIndex) => {
    const cells = padSheetToGrid(sheet, MEMORIZATION_FOLDABLE_CARDS_PER_SHEET);
    const grid = gridFromCells(cells, layout.gridCols, layout.gridRows);
    const isLastSheet = sheetIndex === sheets.length - 1;
    parts.push(renderPage(grid, 'foldable', layout));
    if (!isLastSheet) {
      parts.push(SHEET_BREAK);
    }
  });
  return parts;
}

function printInstructions(sheetStyle: MemorizationPrintSheetStyle): string {
  if (sheetStyle === 'foldable') {
    return (
      'Print <strong>single-sided</strong>. Cut on the outer dashed lines, then fold each card in half ' +
      'on the <strong>center vertical line</strong> (reference on the left, verse on the right).'
    );
  }
  return (
    'Print duplex on the <strong>long edge</strong> (flip on long side). Cut on the dashed lines. ' +
    'Each sheet prints a front page then a back page.'
  );
}

export function buildMemorizationCardsPrintHtml(
  cards: MemorizationPrintCard[],
  sheetStyle: MemorizationPrintSheetStyle = 'duplex'
): string {
  const layout = computeMemorizationPrintLayout(sheetStyle);
  const sheets = chunkMemorizationCardsForSheets(
    cards,
    memorizationCardsPerSheet(sheetStyle)
  );
  const parts =
    sheetStyle === 'foldable'
      ? buildFoldableSheetParts(sheets, layout)
      : buildDuplexSheetParts(sheets, layout);

  const body = parts.join('\n');
  const styleLabel = sheetStyle === 'foldable' ? 'Foldable' : 'Duplex';
  const title = `Print v${MEMORIZATION_PRINT_LAYOUT_VERSION} — verses (${styleLabel})`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${memorizationCardsPrintStyles(layout, sheetStyle)}</style>
</head>
<body data-print-layout-version="${MEMORIZATION_PRINT_LAYOUT_VERSION}" data-print-sheet-style="${sheetStyle}">
  <div class="no-print">
    <strong>Layout v${MEMORIZATION_PRINT_LAYOUT_VERSION} — ${styleLabel}</strong> —
    ${printInstructions(sheetStyle)}
  </div>
  ${body}
</body>
</html>`;
}
