/**
 * Drawing engine with Apple Pencil pressure sensitivity support.
 * Uses quadratic Bézier curves for smooth, continuous strokes.
 */
class DrawingEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });

        this.isDrawing = false;
        this.tool = 'pen';        // pen | highlighter | eraser
        this.color = '#1a1a2e';
        this.lineWidth = 2;

        // Stroke history for undo/redo
        this.strokes = [];
        this.redoStack = [];
        this.currentStroke = null;

        // Current stroke raw points (for handwriting recognition)
        this.currentPoints = [];
        this.allStrokePoints = [];

        // Smoothing: keep track of last points for Bézier
        this._lastPoint = null;
        this._lastMidPoint = null;
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

    _midPoint(a, b) {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    _onPointerDown(e) {
        e.preventDefault();
        this.isDrawing = true;
        const pos = this._getPos(e);
        this._smoothedPressure = pos.pressure;

        this.currentStroke = {
            tool: this.tool,
            color: this.color,
            lineWidth: this.lineWidth,
            points: [{ x: pos.x, y: pos.y, pressure: pos.pressure }]
        };

        this.currentPoints = [{ x: pos.x, y: pos.y, pressure: pos.pressure, time: Date.now() }];

        this._lastPoint = pos;
        this._lastMidPoint = pos;

        // Draw a dot for single taps
        this._applyStyle(pos.pressure);
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, this._getWidth(pos.pressure) / 2, 0, Math.PI * 2);
        this.ctx.fill();
    }

    _onPointerMove(e) {
        if (!this.isDrawing) return;
        e.preventDefault();

        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

        for (const evt of events) {
            const pos = this._getPos(evt);

            // Smooth the pressure to prevent jitter
            this._smoothedPressure += (pos.pressure - this._smoothedPressure) * 0.3;
            const pressure = this._smoothedPressure;

            this.currentStroke.points.push({ x: pos.x, y: pos.y, pressure: pressure });
            this.currentPoints.push({ x: pos.x, y: pos.y, pressure: pressure, time: Date.now() });

            if (this.tool === 'eraser') {
                this._erase(pos.x, pos.y);
            } else {
                // Draw smooth quadratic Bézier curve through midpoints
                const midPoint = this._midPoint(this._lastPoint, pos);

                this._applyStyle(pressure);
                this.ctx.beginPath();
                this.ctx.moveTo(this._lastMidPoint.x, this._lastMidPoint.y);
                this.ctx.quadraticCurveTo(
                    this._lastPoint.x, this._lastPoint.y,
                    midPoint.x, midPoint.y
                );
                this.ctx.stroke();

                this._lastMidPoint = midPoint;
            }

            this._lastPoint = pos;
        }
    }

    _onPointerUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Draw final segment to the last point
        if (this._lastPoint && this._lastMidPoint && this.tool !== 'eraser') {
            this._applyStyle(this._smoothedPressure);
            this.ctx.beginPath();
            this.ctx.moveTo(this._lastMidPoint.x, this._lastMidPoint.y);
            this.ctx.lineTo(this._lastPoint.x, this._lastPoint.y);
            this.ctx.stroke();
        }

        if (this.currentStroke && this.currentStroke.points.length > 0) {
            this.strokes.push(this.currentStroke);
            this.redoStack = [];
            this.allStrokePoints.push([...this.currentPoints]);
        }

        this.currentStroke = null;
        this.currentPoints = [];
        this._lastPoint = null;
        this._lastMidPoint = null;
    }

    _getWidth(pressure) {
        if (this.tool === 'pen') {
            return this.lineWidth * (0.6 + pressure * 1.2);
        } else if (this.tool === 'highlighter') {
            return this.lineWidth * 4;
        }
        return this.lineWidth;
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
        if (stroke.points.length === 0) return;

        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (stroke.tool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = stroke.color;
            this.ctx.globalAlpha = 1;
        } else if (stroke.tool === 'highlighter') {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.strokeStyle = stroke.color;
            this.ctx.globalAlpha = 0.3;
        }

        const pts = stroke.points;

        if (pts.length === 1) {
            this.ctx.fillStyle = stroke.color;
            this.ctx.beginPath();
            const w = stroke.tool === 'pen'
                ? stroke.lineWidth * (0.6 + pts[0].pressure * 1.2)
                : stroke.lineWidth * 4;
            this.ctx.arc(pts[0].x, pts[0].y, w / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            return;
        }

        // Draw smooth Bézier curves through midpoints
        let lastMid = pts[0];

        for (let i = 1; i < pts.length; i++) {
            const curr = pts[i];
            const prev = pts[i - 1];
            const mid = { x: (prev.x + curr.x) / 2, y: (prev.y + curr.y) / 2 };

            const pressure = curr.pressure;
            if (stroke.tool === 'pen') {
                this.ctx.lineWidth = stroke.lineWidth * (0.6 + pressure * 1.2);
            } else if (stroke.tool === 'highlighter') {
                this.ctx.lineWidth = stroke.lineWidth * 4;
            }

            this.ctx.beginPath();
            this.ctx.moveTo(lastMid.x, lastMid.y);
            this.ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
            this.ctx.stroke();

            lastMid = mid;
        }

        // Final segment
        const lastPt = pts[pts.length - 1];
        this.ctx.beginPath();
        this.ctx.moveTo(lastMid.x, lastMid.y);
        this.ctx.lineTo(lastPt.x, lastPt.y);
        this.ctx.stroke();

        this.ctx.restore();
    }

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

    setTool(tool) {
        this.tool = tool;
    }

    setColor(color) {
        this.color = color;
    }

    setLineWidth(width) {
        this.lineWidth = width;
    }

    clear() {
        this.strokes = [];
        this.redoStack = [];
        this.allStrokePoints = [];
        const dpr = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    }

    getCanvasDataURL() {
        return this.canvas.toDataURL('image/png');
    }

    getStrokesData() {
        return {
            strokes: this.strokes,
            strokePoints: this.allStrokePoints
        };
    }

    loadStrokes(data) {
        if (data && data.strokes) {
            this.strokes = data.strokes;
            this.allStrokePoints = data.strokePoints || [];
            this._redrawAll();
        }
    }

    hasContent() {
        return this.strokes.length > 0;
    }
}
