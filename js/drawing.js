/**
 * Drawing engine with Apple Pencil support and automatic handwriting beautification.
 * Smooths strokes in real-time and beautifies on pen lift.
 */
class DrawingEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });

        this.isDrawing = false;
        this.tool = 'pen';
        this.color = '#1a1a2e';
        this.lineWidth = 2;

        this.strokes = [];
        this.redoStack = [];
        this.currentStroke = null;

        this.currentPoints = [];
        this.allStrokePoints = [];

        // Real-time smoothing buffer
        this._pointBuffer = [];
        this._bufferSize = 8;
        this._smoothedPressure = 0.5;

        this._setupCanvas();
        this._bindEvents();
    }

    _setupCanvas() {
        this.resize();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        this.ctx.scale(dpr, dpr);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this._redrawAll();
    }

    _bindEvents() {
        this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));
        this.canvas.addEventListener('pointerleave', (e) => this._onPointerUp(e));
        this.canvas.addEventListener('pointercancel', (e) => this._onPointerUp(e));

        this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        window.addEventListener('resize', () => this.resize());
    }

    _getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure || 0.5
        };
    }

    // ===== Moving average smoothing for real-time drawing =====
    _getSmoothedPoint(pos) {
        this._pointBuffer.push(pos);
        if (this._pointBuffer.length > this._bufferSize) {
            this._pointBuffer.shift();
        }

        let sumX = 0, sumY = 0, sumP = 0, totalWeight = 0;
        const len = this._pointBuffer.length;

        for (let i = 0; i < len; i++) {
            // More recent points get higher weight
            const weight = (i + 1) / len;
            sumX += this._pointBuffer[i].x * weight;
            sumY += this._pointBuffer[i].y * weight;
            sumP += this._pointBuffer[i].pressure * weight;
            totalWeight += weight;
        }

        return {
            x: sumX / totalWeight,
            y: sumY / totalWeight,
            pressure: sumP / totalWeight
        };
    }

    // ===== Stroke beautification - runs on pen lift =====
    _beautifyStroke(points) {
        if (points.length < 3) return points;

        // Step 1: Resample at even intervals to remove speed artifacts
        const resampled = this._resamplePoints(points, 4);
        if (resampled.length < 3) return points;

        // Step 2: Apply Gaussian smoothing (multiple passes for beautiful curves)
        let smoothed = resampled;
        for (let pass = 0; pass < 3; pass++) {
            smoothed = this._gaussianSmooth(smoothed, 5);
        }

        // Step 3: Smooth pressure values separately
        smoothed = this._smoothPressure(smoothed);

        return smoothed;
    }

    _resamplePoints(points, spacing) {
        if (points.length < 2) return points;

        const result = [points[0]];
        let accumulated = 0;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            accumulated += dist;

            while (accumulated >= spacing) {
                const ratio = 1 - (accumulated - spacing) / dist;
                const newPt = {
                    x: prev.x + dx * ratio,
                    y: prev.y + dy * ratio,
                    pressure: prev.pressure + (curr.pressure - prev.pressure) * ratio
                };
                result.push(newPt);
                accumulated -= spacing;
            }
        }

        // Always include last point
        result.push(points[points.length - 1]);
        return result;
    }

    _gaussianSmooth(points, windowSize) {
        const half = Math.floor(windowSize / 2);
        const result = [];

        // Generate Gaussian kernel
        const kernel = [];
        const sigma = half / 2;
        let kernelSum = 0;
        for (let i = -half; i <= half; i++) {
            const w = Math.exp(-(i * i) / (2 * sigma * sigma));
            kernel.push(w);
            kernelSum += w;
        }
        for (let i = 0; i < kernel.length; i++) kernel[i] /= kernelSum;

        for (let i = 0; i < points.length; i++) {
            // Keep first and last few points closer to original (anchors)
            const anchorStrength = Math.min(i, points.length - 1 - i, half) / half;

            let sx = 0, sy = 0, sp = 0;

            for (let j = -half; j <= half; j++) {
                const idx = Math.max(0, Math.min(points.length - 1, i + j));
                const w = kernel[j + half];
                sx += points[idx].x * w;
                sy += points[idx].y * w;
                sp += points[idx].pressure * w;
            }

            result.push({
                x: points[i].x + (sx - points[i].x) * anchorStrength,
                y: points[i].y + (sy - points[i].y) * anchorStrength,
                pressure: sp
            });
        }

        return result;
    }

    _smoothPressure(points) {
        if (points.length < 3) return points;

        const result = points.map(p => ({ ...p }));

        // Smooth pressure with wider window
        for (let i = 1; i < result.length - 1; i++) {
            const window = 3;
            let sum = 0, count = 0;
            for (let j = -window; j <= window; j++) {
                const idx = Math.max(0, Math.min(result.length - 1, i + j));
                sum += points[idx].pressure;
                count++;
            }
            result[i].pressure = sum / count;
        }

        return result;
    }

    // ===== Pointer event handlers =====

    _onPointerDown(e) {
        e.preventDefault();
        this.isDrawing = true;
        this._pointBuffer = [];

        const pos = this._getPos(e);
        this._smoothedPressure = pos.pressure;

        this.currentStroke = {
            tool: this.tool,
            color: this.color,
            lineWidth: this.lineWidth,
            points: [{ x: pos.x, y: pos.y, pressure: pos.pressure }]
        };

        this.currentPoints = [{ x: pos.x, y: pos.y, pressure: pos.pressure, time: Date.now() }];
        this._lastDrawn = pos;
    }

    _onPointerMove(e) {
        if (!this.isDrawing) return;
        e.preventDefault();

        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

        for (const evt of events) {
            const rawPos = this._getPos(evt);

            // Real-time moving average smoothing
            const pos = this._getSmoothedPoint(rawPos);

            this.currentStroke.points.push({ x: pos.x, y: pos.y, pressure: pos.pressure });
            this.currentPoints.push({ x: rawPos.x, y: rawPos.y, pressure: rawPos.pressure, time: Date.now() });

            if (this.tool === 'eraser') {
                this._erase(pos.x, pos.y);
            } else {
                // Draw live preview as simple smooth line
                this._applyStyle(pos.pressure);
                this.ctx.beginPath();
                this.ctx.moveTo(this._lastDrawn.x, this._lastDrawn.y);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
                this._lastDrawn = pos;
            }
        }
    }

    _onPointerUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentStroke && this.currentStroke.points.length > 1 && this.tool !== 'eraser') {
            // Beautify the stroke!
            this.currentStroke.points = this._beautifyStroke(this.currentStroke.points);
            this.strokes.push(this.currentStroke);
            this.redoStack = [];
            this.allStrokePoints.push([...this.currentPoints]);

            // Redraw everything with beautified strokes
            this._redrawAll();
        } else if (this.currentStroke && this.currentStroke.points.length === 1) {
            // Single dot
            this.strokes.push(this.currentStroke);
            this.redoStack = [];
            this.allStrokePoints.push([...this.currentPoints]);
        }

        this.currentStroke = null;
        this.currentPoints = [];
        this._pointBuffer = [];
        this._lastDrawn = null;
    }

    // ===== Rendering =====

    _getWidth(pressure, tool, baseWidth) {
        const t = tool || this.tool;
        const w = baseWidth || this.lineWidth;
        if (t === 'pen') return w * (0.6 + pressure * 1.2);
        if (t === 'highlighter') return w * 4;
        return w;
    }

    _applyStyle(pressure) {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (this.tool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.color;
            this.ctx.fillStyle = this.color;
            this.ctx.globalAlpha = 1;
            this.ctx.lineWidth = this._getWidth(pressure);
        } else if (this.tool === 'highlighter') {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.strokeStyle = this.color;
            this.ctx.fillStyle = this.color;
            this.ctx.globalAlpha = 0.3;
            this.ctx.lineWidth = this._getWidth(pressure);
        } else if (this.tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.globalAlpha = 1;
            this.ctx.lineWidth = this.lineWidth * 5;
        }
    }

    _erase(x, y) {
        const size = this.lineWidth * 5;
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.globalAlpha = 1;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    _redrawAll() {
        const dpr = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

        for (const stroke of this.strokes) {
            this._drawStroke(stroke);
        }
    }

    _drawStroke(stroke) {
        const pts = stroke.points;
        if (!pts || pts.length === 0) return;

        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (stroke.tool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = stroke.color;
            this.ctx.fillStyle = stroke.color;
            this.ctx.globalAlpha = 1;
        } else if (stroke.tool === 'highlighter') {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.strokeStyle = stroke.color;
            this.ctx.fillStyle = stroke.color;
            this.ctx.globalAlpha = 0.3;
        }

        if (pts.length === 1) {
            const w = this._getWidth(pts[0].pressure, stroke.tool, stroke.lineWidth);
            this.ctx.beginPath();
            this.ctx.arc(pts[0].x, pts[0].y, w / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            return;
        }

        // Draw using Catmull-Rom spline for maximum smoothness
        this._drawCatmullRom(pts, stroke);

        this.ctx.restore();
    }

    _drawCatmullRom(pts, stroke) {
        // Catmull-Rom spline produces beautiful flowing curves
        const tension = 0.4;

        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[i];
            const p2 = pts[Math.min(pts.length - 1, i + 1)];
            const p3 = pts[Math.min(pts.length - 1, i + 2)];

            // Average pressure for this segment
            const pressure = (p1.pressure + p2.pressure) / 2;
            this.ctx.lineWidth = this._getWidth(pressure, stroke.tool, stroke.lineWidth);

            // Calculate control points from Catmull-Rom
            const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
            const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
            const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
            const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            this.ctx.stroke();
        }
    }

    // ===== Actions =====

    undo() {
        if (this.strokes.length === 0) return;
        const stroke = this.strokes.pop();
        this.redoStack.push(stroke);
        this.allStrokePoints.pop();
        this._redrawAll();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const stroke = this.redoStack.pop();
        this.strokes.push(stroke);
        this._redrawAll();
    }

    setTool(tool) { this.tool = tool; }
    setColor(color) { this.color = color; }
    setLineWidth(width) { this.lineWidth = width; }

    clear() {
        this.strokes = [];
        this.redoStack = [];
        this.allStrokePoints = [];
        const dpr = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    }

    getCanvasDataURL() { return this.canvas.toDataURL('image/png'); }

    getStrokesData() {
        return { strokes: this.strokes, strokePoints: this.allStrokePoints };
    }

    loadStrokes(data) {
        if (data && data.strokes) {
            this.strokes = data.strokes;
            this.allStrokePoints = data.strokePoints || [];
            this._redrawAll();
        }
    }

    hasContent() { return this.strokes.length > 0; }
}
