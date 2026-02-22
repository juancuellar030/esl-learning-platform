/* ============================================================
   BINGO PDF — JS
   Uses jsPDF to generate multi-card bingo PDFs.
   Exposed as window.BingoPDF
   ============================================================ */

(function () {
    'use strict';

    // Paper sizes in mm [width, height]
    const PAPER_SIZES = {
        letter: [215.9, 279.4],
        a4: [210, 297],
        legal: [215.9, 330.2],
    };

    // Layouts: [cols, rows, landscape]
    const LAYOUTS = {
        1: { cols: 1, rows: 1, landscape: false },
        2: { cols: 2, rows: 1, landscape: true },
        4: { cols: 2, rows: 2, landscape: false },
    };

    const FONT_MAP = {
        "'Fredoka One', cursive": { id: 'FredokaOne', url: 'https://fonts.gstatic.com/s/fredokaone/v15/k3kUo8kEI-tA1RRcTZGmTlHGCaI.ttf' },
        "'Bangers', cursive": { id: 'Bangers', url: 'https://fonts.gstatic.com/s/bangers/v25/FeVQS0BTqb0h60ACH55Q3Q.ttf' },
        "'Comic Neue', cursive": { id: 'ComicNeue', url: 'https://fonts.gstatic.com/s/comicneue/v9/4UaHrEJDsxBrF37olUeD96rp4g.ttf' },
        "'Baloo 2', cursive": { id: 'Baloo2', url: 'https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdgazZpo_lI.ttf' },
        "'Bubblegum Sans', cursive": { id: 'BubblegumSans', url: 'https://fonts.gstatic.com/s/bubblegumsans/v22/AYCSpXb_Z9EORv1M5QTjEzMEteaAxIc.ttf' },
        "'Patrick Hand', cursive": { id: 'PatrickHand', url: 'https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYe8XsLO.ttf' }
    };

    async function loadFontAsBase64(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const buffer = await res.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            // Process in chunks to prevent Maximum Call Stack Size Exceeded
            const len = bytes.byteLength;
            for (let i = 0; i < len; i += 8192) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
            }
            return window.btoa(binary);
        } catch (e) {
            console.warn('Failed to load TTF font:', e);
            return null;
        }
    }

    /**
     * Main entry point.
     * @param {object} state - The bingo generator state object.
     */
    async function generate(state) {
        const { jsPDF } = window.jspdf;
        const layout = LAYOUTS[state.cardsPerPage] || LAYOUTS[1];
        let [pw, ph] = PAPER_SIZES[state.paperSize] || PAPER_SIZES.letter;

        if (layout.landscape) {
            [pw, ph] = [ph, pw]; // swap for landscape
        }

        const margin = 8;
        const cardW = (pw - margin * (layout.cols + 1)) / layout.cols;
        const cardH = (ph - margin * (layout.rows + 1)) / layout.rows;

        const doc = new jsPDF({
            orientation: layout.landscape ? 'landscape' : 'portrait',
            unit: 'mm',
            format: state.paperSize === 'legal' ? [pw, ph] : state.paperSize,
        });

        // Custom font setup
        let fontName = 'helvetica';
        const fontInfo = FONT_MAP[state.font];
        if (fontInfo) {
            const b64 = await loadFontAsBase64(fontInfo.url);
            if (b64) {
                doc.addFileToVFS(fontInfo.id + '.ttf', b64);
                // jsPDF built-in fonts use lowercase stylings, addFont takes (filename, fontName, fontStyle)
                doc.addFont(fontInfo.id + '.ttf', fontInfo.id, 'normal');
                fontName = fontInfo.id;
            }
        }

        const totalCards = state.generatedCards.length;
        let cardIndex = 0;

        // Generate pages
        while (cardIndex < totalCards) {
            if (cardIndex > 0) doc.addPage();

            for (let row = 0; row < layout.rows && cardIndex < totalCards; row++) {
                for (let col = 0; col < layout.cols && cardIndex < totalCards; col++) {
                    const x = margin + col * (cardW + margin);
                    const y = margin + row * (cardH + margin);
                    drawCard(doc, x, y, cardW, cardH, state, state.generatedCards[cardIndex], fontName);
                    cardIndex++;
                }
            }
        }

        downloadPDF(doc, 'bingo-cards.pdf');
    }

    /**
     * Fallback download using a Blob URL + anchor element.
     * Ensures the filename is respected across browsers and local servers.
     */
    function downloadPDF(doc, filename) {
        try {
            // Primary: manual blob anchor (most reliable)
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (e) {
            // Fallback: open in new tab
            const dataUri = doc.output('datauristring');
            window.open(dataUri, '_blank');
        }
    }


    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    }

    function drawCard(doc, x, y, w, h, state, items, fontName) {
        const gs = state.gridSize;
        const headerH = state.showHeader ? Math.min(h * 0.09, 10) : 0;
        const cellW = w / gs;
        const cellH = (h - headerH) / gs;

        // Determine font style based on whether we loaded a custom font
        const fontStyle = fontName === 'helvetica' ? 'bold' : 'normal';

        // Card background
        const [bgR, bgG, bB_bg] = hexToRgb(state.colorCardBg);
        doc.setFillColor(bgR, bgG, bB_bg);
        doc.roundedRect(x, y, w, h, 3, 3, 'F');

        // Extract border colors needed for both inner cells and outer border
        const [bR, bG, bB] = hexToRgb(state.colorBorder);

        // Header row
        if (state.showHeader) {
            const [hR, hG, hB] = hexToRgb(state.colorHeaderBg);
            doc.setFillColor(hR, hG, hB);
            doc.roundedRect(x, y, w, headerH, 3, 3, 'F');
            // Cover bottom-rounded corners of header
            doc.rect(x, y + headerH / 2, w, headerH / 2, 'F');

            // Header letters
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(headerH * 1.3); // Maximized header text size
            doc.setFont(fontName, fontStyle);
            const letters = getHeaderLetters(state);
            letters.forEach((letter, i) => {
                const cx = x + i * cellW + cellW / 2;
                const cy = y + headerH / 2 + headerH * 0.2;
                doc.text(letter, cx, cy, { align: 'center', baseline: 'middle' });
            });
        }

        // Grid cells
        const [tR, tG, tB] = hexToRgb(state.colorText);
        const [hbR, hbG, hbB] = hexToRgb(state.colorHeaderBg);
        const centerIdx = Math.floor((gs * gs) / 2);

        let itemIdx = 0;
        for (let row = 0; row < gs; row++) {
            for (let col = 0; col < gs; col++) {
                const cellIdx = row * gs + col;
                const cx = x + col * cellW;
                const cy = y + headerH + row * cellH;

                const isFree = state.freeSpace && cellIdx === centerIdx && gs % 2 === 1;

                // Cell background (free cell)
                if (isFree) {
                    doc.setFillColor(hbR, hbG, hbB);
                    doc.rect(cx, cy, cellW, cellH, 'F');
                }

                // Cell border
                doc.setDrawColor(bR, bG, bB);
                doc.setLineWidth(0.3);
                // Custom drawing for bottom corners to only curve the outer edges
                if (row === gs - 1 && col === 0) {
                    doc.rect(cx, cy, cellW, cellH, 'S');
                } else if (row === gs - 1 && col === gs - 1) {
                    doc.rect(cx, cy, cellW, cellH, 'S');
                } else {
                    doc.rect(cx, cy, cellW, cellH, 'S');
                }

                if (isFree) {
                    // Free space text
                    doc.setTextColor(255, 255, 255);
                    doc.setFont(fontName, fontStyle);
                    // Increased font size
                    doc.setFontSize(Math.min(cellW, cellH) * 0.35);
                    const freeText = state.freeSpaceText || '★ FREE ★';
                    doc.text(freeText, cx + cellW / 2, cy + cellH / 2, {
                        align: 'center', baseline: 'middle',
                        maxWidth: cellW - 2
                    });
                } else {
                    const item = items[itemIdx++];
                    if (!item) continue;

                    if (state.mode === 'word') {
                        // Word text
                        doc.setTextColor(tR, tG, tB);
                        doc.setFont(fontName, fontStyle);
                        // Significantly increased base font size
                        const fontSize = Math.min(cellW, cellH) * 0.45;
                        doc.setFontSize(fontSize);
                        const word = typeof item === 'string' ? item : item.name;
                        // Better wrapping width padding
                        const lines = doc.splitTextToSize(word, cellW - 2);
                        const lineH = fontSize * 0.42;
                        const totalTextH = lines.length * lineH;
                        const startY = cy + (cellH - totalTextH) / 2 + lineH / 2;
                        lines.forEach((line, li) => {
                            doc.text(line, cx + cellW / 2, startY + li * lineH, {
                                align: 'center', baseline: 'middle'
                            });
                        });
                    } else {
                        // Image
                        try {
                            const imgData = item.src;
                            const pad = 2;
                            const availW = cellW - pad * 2;
                            const availH = cellH - pad * 2;

                            const props = doc.getImageProperties(imgData);
                            const ratio = Math.min(availW / props.width, availH / props.height);
                            const finalW = props.width * ratio;
                            const finalH = props.height * ratio;
                            const cxOff = (availW - finalW) / 2;
                            const cyOff = (availH - finalH) / 2;

                            // Let jsPDF interpret the type internally or enforce PNG for transparency
                            const imgType = imgData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
                            doc.addImage(imgData, imgType, cx + pad + cxOff, cy + pad + cyOff, finalW, finalH);
                        } catch (e) {
                            // Fallback: show name
                            doc.setTextColor(tR, tG, tB);
                            doc.setFontSize(Math.min(cellW, cellH) * 0.18);
                            doc.text(item.name || '?', cx + cellW / 2, cy + cellH / 2, {
                                align: 'center', baseline: 'middle', maxWidth: cellW - 2
                            });
                        }
                    }
                }
            }
        }

        // --- OVERLAY TRICK ---
        // Draw background-colored triangles over the bottom-left and bottom-right 
        // sharp outer corners so they don't peek out behind the outer rounded border.
        doc.setFillColor(bgR, bgG, bB_bg);

        // Bottom-left corner clip
        const blX = x;
        const blY = y + h;
        doc.triangle(
            blX, blY,              // True bottom-left
            blX + 3, blY,          // Right 3px
            blX, blY - 3,          // Up 3px
            'F'
        );

        // Bottom-right corner clip
        const brX = x + w;
        const brY = y + h;
        doc.triangle(
            brX, brY,              // True bottom-right
            brX - 3, brY,          // Left 3px
            brX, brY - 3,          // Up 3px
            'F'
        );

        // Outer border drawn last to cover the sharp inner grid lines and clips
        doc.setDrawColor(bR, bG, bB);
        doc.setLineWidth(0.8);
        doc.roundedRect(x, y, w, h, 3, 3, 'S');
    }

    function getHeaderLetters(state) {
        if (state.headerMode === 'numbers') {
            return Array.from({ length: state.gridSize }, (_, i) => String(i + 1));
        }
        if (state.headerMode === 'custom') {
            const s = state.customHeader.toUpperCase().padEnd(state.gridSize, ' ').slice(0, state.gridSize);
            return [...s];
        }
        const defaults = ['B', 'I', 'N', 'G', 'O'];
        return Array.from({ length: state.gridSize }, (_, i) => defaults[i] || String.fromCharCode(65 + i));
    }

    window.BingoPDF = { generate };
})();
