/**
 * Handwriting recognition engine with learning capabilities.
 * Uses Tesseract.js for OCR and builds a personal correction dictionary.
 */
class HandwritingRecognizer {
    constructor(storageInstance) {
        this.storage = storageInstance;
        this.correctionDict = {};   // maps wrong -> correct text
        this.wordFrequency = {};    // personal word frequency for suggestions
        this.tesseractWorker = null;
        this.isReady = false;
        this.isLoading = false;
    }

    async init() {
        // Load stored corrections into memory
        try {
            const corrections = await this.storage.getAllCorrections();
            for (const corr of corrections) {
                if (corr.original && corr.corrected) {
                    this.correctionDict[corr.original.toLowerCase()] = corr.corrected;

                    // Build word frequency from corrections
                    const words = corr.corrected.split(/\s+/);
                    for (const w of words) {
                        const key = w.toLowerCase();
                        this.wordFrequency[key] = (this.wordFrequency[key] || 0) + 1;
                    }
                }
            }
        } catch (err) {
            console.warn('Could not load corrections:', err);
        }
    }

    async _ensureTesseract() {
        if (this.isReady) return;
        if (this.isLoading) {
            // Wait for loading to complete
            while (this.isLoading) {
                await new Promise(r => setTimeout(r, 200));
            }
            return;
        }

        this.isLoading = true;

        try {
            // Dynamically load Tesseract.js from CDN
            if (!window.Tesseract) {
                await this._loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
            }

            this.tesseractWorker = await Tesseract.createWorker('pol+eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        this._onProgress(m.progress);
                    }
                }
            });

            this.isReady = true;
        } catch (err) {
            console.error('Failed to initialize Tesseract:', err);
            throw new Error('Nie udało się załadować silnika rozpoznawania pisma.');
        } finally {
            this.isLoading = false;
        }
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load: ${src}`));
            document.head.appendChild(script);
        });
    }

    _onProgress(progress) {
        // Can be overridden by the app to show progress
        if (this.onProgress) {
            this.onProgress(progress);
        }
    }

    /**
     * Recognize handwriting from a canvas data URL.
     * Applies personal corrections learned over time.
     */
    async recognize(canvasDataURL) {
        await this._ensureTesseract();

        const result = await this.tesseractWorker.recognize(canvasDataURL);
        let text = result.data.text.trim();

        // Apply learned corrections
        text = this._applyCorrections(text);

        return {
            text: text,
            confidence: result.data.confidence,
            words: result.data.words
        };
    }

    /**
     * Apply personal correction dictionary to recognized text.
     * This is how the app "learns" the user's handwriting.
     */
    _applyCorrections(text) {
        if (Object.keys(this.correctionDict).length === 0) return text;

        let corrected = text;

        // Sort corrections by length (longest first) to avoid partial replacements
        const sortedKeys = Object.keys(this.correctionDict)
            .sort((a, b) => b.length - a.length);

        for (const wrong of sortedKeys) {
            const right = this.correctionDict[wrong];
            // Case-insensitive replacement preserving original case pattern
            const regex = new RegExp(this._escapeRegex(wrong), 'gi');
            corrected = corrected.replace(regex, (match) => {
                // Try to preserve the case of the first character
                if (match[0] === match[0].toUpperCase() && right[0] === right[0].toLowerCase()) {
                    return right[0].toUpperCase() + right.slice(1);
                }
                return right;
            });
        }

        return corrected;
    }

    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Learn from a user correction. Stores the mapping and
     * builds up the personal handwriting model over time.
     */
    async learnCorrection(originalText, correctedText) {
        // Store word-level corrections
        const origWords = originalText.split(/\s+/);
        const corrWords = correctedText.split(/\s+/);

        // If the texts are similar length, try word-by-word mapping
        if (origWords.length === corrWords.length) {
            for (let i = 0; i < origWords.length; i++) {
                if (origWords[i].toLowerCase() !== corrWords[i].toLowerCase()) {
                    this.correctionDict[origWords[i].toLowerCase()] = corrWords[i];
                }
            }
        }

        // Also store the full text correction
        if (originalText.toLowerCase() !== correctedText.toLowerCase()) {
            this.correctionDict[originalText.toLowerCase()] = correctedText;
        }

        // Update word frequency
        for (const w of corrWords) {
            const key = w.toLowerCase();
            this.wordFrequency[key] = (this.wordFrequency[key] || 0) + 1;
        }

        // Persist correction
        await this.storage.saveCorrection({
            original: originalText,
            corrected: correctedText,
        });
    }

    /**
     * Get statistics about the learning model.
     */
    getStats() {
        return {
            corrections: Object.keys(this.correctionDict).length,
            vocabulary: Object.keys(this.wordFrequency).length,
        };
    }
}
