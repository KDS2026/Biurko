/**
 * Main application controller - wires everything together.
 */
(async function () {
    'use strict';

    // ===== DOM Elements =====
    const $ = (sel) => document.querySelector(sel);
    const canvas = $('#drawing-canvas');
    const sidebar = $('#sidebar');
    const notesList = $('#notes-list');
    const quoteText = $('#quote-text');
    const quoteAuthor = $('#quote-author');
    const noteDate = $('#note-date');
    const noteLocation = $('#note-location');
    const recognizedPanel = $('#recognized-panel');
    const recognizedText = $('#recognized-text');
    const correctionModal = $('#correction-modal');
    const correctionInput = $('#correction-input');

    // ===== State =====
    let currentNoteId = null;
    let autoSaveTimer = null;
    let sidebarOverlay = null;

    // ===== Initialize Storage =====
    await storage.init();

    // ===== Initialize Outreach Organizations Panel =====
    const orgsPanel = initOrgsPanel(storage);
    await orgsPanel.seedIfEmpty();

    // ===== Initialize Drawing Engine =====
    const drawingEngine = new DrawingEngine(canvas);

    // ===== Initialize Recognizer =====
    const recognizer = new HandwritingRecognizer(storage);
    await recognizer.init();

    // ===== Daily Quote =====
    function showDailyQuote() {
        const quote = getDailyQuote();
        quoteText.textContent = `\u201E${quote.text}\u201D`;
        quoteAuthor.textContent = `\u2014 ${quote.author}`;
    }
    showDailyQuote();

    // ===== Date & Location =====
    function formatDate(date) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('pl-PL', options);
    }

    function updateDate(date) {
        noteDate.textContent = formatDate(date || new Date());
    }

    async function getLocation() {
        if (!navigator.geolocation) {
            noteLocation.textContent = '';
            return null;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    // Try reverse geocoding
                    try {
                        const resp = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pl`
                        );
                        const data = await resp.json();
                        const city = data.address.city || data.address.town || data.address.village || '';
                        const country = data.address.country || '';
                        const locationStr = city ? `${city}, ${country}` : country;
                        noteLocation.textContent = locationStr ? `\uD83D\uDCCD ${locationStr}` : '';
                        resolve(locationStr);
                    } catch {
                        noteLocation.textContent = `\uD83D\uDCCD ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
                        resolve(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
                    }
                },
                () => {
                    noteLocation.textContent = '';
                    resolve(null);
                },
                { timeout: 5000, enableHighAccuracy: false }
            );
        });
    }

    // ===== Notes Management =====
    async function createNewNote() {
        // Save current note first
        if (currentNoteId) {
            await saveCurrentNote();
        }

        const id = 'note_' + Date.now();
        const now = new Date();
        const location = await getLocation();

        const note = {
            id: id,
            createdAt: now.getTime(),
            date: formatDate(now),
            location: location || '',
            strokesData: null,
            thumbnail: null,
            recognizedText: '',
        };

        await storage.saveNote(note);
        currentNoteId = id;
        drawingEngine.clear();
        updateDate(now);
        await refreshNotesList();
    }

    async function saveCurrentNote() {
        if (!currentNoteId) return;

        const existing = await storage.getNote(currentNoteId);
        if (!existing) return;

        existing.strokesData = drawingEngine.getStrokesData();
        existing.thumbnail = drawingEngine.hasContent() ? drawingEngine.getCanvasDataURL() : null;

        await storage.saveNote(existing);
    }

    async function loadNote(id) {
        if (currentNoteId && currentNoteId !== id) {
            await saveCurrentNote();
        }

        const note = await storage.getNote(id);
        if (!note) return;

        currentNoteId = id;
        drawingEngine.clear();

        if (note.strokesData) {
            drawingEngine.loadStrokes(note.strokesData);
        }

        updateDate(new Date(note.createdAt));
        if (note.location) {
            noteLocation.textContent = `\uD83D\uDCCD ${note.location}`;
        } else {
            noteLocation.textContent = '';
        }

        await refreshNotesList();
    }

    async function deleteNote(id) {
        await storage.deleteNote(id);
        if (currentNoteId === id) {
            currentNoteId = null;
            drawingEngine.clear();
        }
        const notes = await storage.getAllNotes();
        if (notes.length > 0) {
            await loadNote(notes[0].id);
        } else {
            await createNewNote();
        }
    }

    async function refreshNotesList() {
        const notes = await storage.getAllNotes();

        if (notes.length === 0) {
            notesList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <p>Brak notatek.<br>Utwórz nową!</p>
                </div>
            `;
            return;
        }

        notesList.innerHTML = notes.map(note => `
            <div class="note-item ${note.id === currentNoteId ? 'active' : ''}" data-id="${note.id}">
                <div class="note-item-date">${note.date || formatDate(new Date(note.createdAt))}</div>
                <div class="note-item-preview">${note.recognizedText || 'Notatka odręczna'}</div>
                ${note.location ? `<div class="note-item-location">\uD83D\uDCCD ${note.location}</div>` : ''}
                <button class="btn-delete-note" data-delete-id="${note.id}" title="Usuń">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                    </svg>
                </button>
            </div>
        `).join('');

        // Bind click events
        notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-note')) return;
                loadNote(item.dataset.id);
                closeSidebar();
            });
        });

        notesList.querySelectorAll('.btn-delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Usunąć tę notatkę?')) {
                    deleteNote(btn.dataset.deleteId);
                }
            });
        });
    }

    // ===== Auto-save =====
    function scheduleAutoSave() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => saveCurrentNote(), 2000);
    }

    canvas.addEventListener('pointerup', scheduleAutoSave);

    // ===== Toolbar Events =====
    // Tools
    document.querySelectorAll('.btn-tool').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            drawingEngine.setTool(btn.dataset.tool);
        });
    });

    // Colors
    document.querySelectorAll('.btn-color').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-color').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            drawingEngine.setColor(btn.dataset.color);
        });
    });

    // Pen size
    $('#pen-size').addEventListener('input', (e) => {
        drawingEngine.setLineWidth(parseInt(e.target.value));
    });

    // Undo / Redo
    $('#btn-undo').addEventListener('click', () => drawingEngine.undo());
    $('#btn-redo').addEventListener('click', () => drawingEngine.redo());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                drawingEngine.redo();
            } else {
                drawingEngine.undo();
            }
        }
    });

    // ===== Sidebar Toggle =====
    function openSidebar() {
        sidebar.classList.add('open');
        if (!sidebarOverlay) {
            sidebarOverlay = document.createElement('div');
            sidebarOverlay.className = 'sidebar-overlay visible';
            sidebarOverlay.addEventListener('click', closeSidebar);
            document.body.appendChild(sidebarOverlay);
        } else {
            sidebarOverlay.classList.add('visible');
        }
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('visible');
        }
    }

    $('#btn-menu').addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    $('#btn-new-note').addEventListener('click', () => {
        createNewNote();
        closeSidebar();
    });

    // ===== Recognition =====
    let lastRecognizedOriginal = '';

    function showLoading(text) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <div class="loading-text">${text}</div>
        `;
        document.body.appendChild(overlay);
    }

    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.remove();
    }

    $('#btn-recognize').addEventListener('click', async () => {
        if (!drawingEngine.hasContent()) {
            alert('Najpierw napisz coś na kartce!');
            return;
        }

        showLoading('Rozpoznaję pismo...');

        try {
            const dataURL = drawingEngine.getCanvasDataURL();
            const result = await recognizer.recognize(dataURL);

            hideLoading();

            if (result.text) {
                lastRecognizedOriginal = result.text;
                recognizedText.textContent = result.text;
                recognizedPanel.classList.remove('hidden');

                // Save recognized text to note
                if (currentNoteId) {
                    const note = await storage.getNote(currentNoteId);
                    if (note) {
                        note.recognizedText = result.text.substring(0, 100);
                        await storage.saveNote(note);
                        await refreshNotesList();
                    }
                }
            } else {
                alert('Nie udało się rozpoznać tekstu. Spróbuj pisać wyraźniej.');
            }
        } catch (err) {
            hideLoading();
            console.error('Recognition error:', err);
            alert('Błąd rozpoznawania: ' + err.message);
        }
    });

    // Close recognized panel
    $('#btn-close-recognized').addEventListener('click', () => {
        recognizedPanel.classList.add('hidden');
    });

    // Copy text
    $('#btn-copy-text').addEventListener('click', () => {
        navigator.clipboard.writeText(recognizedText.textContent).then(() => {
            const btn = $('#btn-copy-text');
            btn.textContent = 'Skopiowano!';
            setTimeout(() => { btn.textContent = 'Kopiuj tekst'; }, 1500);
        });
    });

    // Correction / Learning
    $('#btn-correct-text').addEventListener('click', () => {
        correctionInput.value = recognizedText.textContent;
        correctionModal.classList.remove('hidden');
        correctionInput.focus();
    });

    $('#btn-cancel-correction').addEventListener('click', () => {
        correctionModal.classList.add('hidden');
    });

    $('#btn-save-correction').addEventListener('click', async () => {
        const corrected = correctionInput.value.trim();
        if (corrected && corrected !== lastRecognizedOriginal) {
            await recognizer.learnCorrection(lastRecognizedOriginal, corrected);

            // Also save stroke data paired with the correction for future learning
            const strokesData = drawingEngine.getStrokesData();
            await storage.saveHandwritingData({
                strokePoints: strokesData.strokePoints,
                recognizedText: lastRecognizedOriginal,
                correctedText: corrected,
                timestamp: Date.now()
            });

            recognizedText.textContent = corrected;

            // Update note
            if (currentNoteId) {
                const note = await storage.getNote(currentNoteId);
                if (note) {
                    note.recognizedText = corrected.substring(0, 100);
                    await storage.saveNote(note);
                    await refreshNotesList();
                }
            }

            const stats = recognizer.getStats();
            console.log(`Nauka pisma: ${stats.corrections} poprawek, ${stats.vocabulary} słów w słowniku`);
        }

        correctionModal.classList.add('hidden');
    });

    // ===== Initial Load =====
    const existingNotes = await storage.getAllNotes();
    if (existingNotes.length > 0) {
        await loadNote(existingNotes[0].id);
    } else {
        await createNewNote();
    }

    await refreshNotesList();

    // ===== Save before leaving =====
    window.addEventListener('beforeunload', () => {
        saveCurrentNote();
    });

    // ===== Register Service Worker =====
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('sw.js');
        } catch (err) {
            console.log('SW registration failed:', err);
        }
    }

})();
