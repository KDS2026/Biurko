/**
 * Drawing engine with Apple Pencil pressure sensitivity support.
 * Handles pen, highlighter, and eraser tools.
 */
class DrawingEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });

        this.isDrawing = false;
        this.tool = 'pen';        // pen | highlighter | eraser
        this.color = '#1a1a2e';
        this.lineWidth = 2;
        this.pressure = 0.5;

        // Stroke history for undo/redo
        this.strokes = [];
        this.redoStack = [];
        this.currentStroke = null;

        // Current stroke raw points (for handwriting recognition)
        this.currentPoints = [];
        this.allStrokePoints = [];

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

        // Redraw all strokes after resize
        this._redrawAll();
    }

    _bindEvents() {
        // Pointer events for Apple Pencil support
        this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));
        this.canvas.addEventListener('pointerleave', (e) => this._onPointerUp(e));
        this.canvas.addEventListener('pointercancel', (e) => this._onPointerUp(e));

        // Prevent default touch behavior on canvas
        this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        // Resize handler
        window.addEventListener('resize', () => this.resize());
    }

    _getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure || 0.5,
            pointerType: e.pointerType
        };
    }

    _onPointerDown(e) {
        // Only respond to pen or direct touch/mouse
        this.isDrawing = true;
        const pos = this._getPos(e);
        this.pressure = pos.pressure;

        this.currentStroke = {
            tool: this.tool,
            color: this.color,
            lineWidth: this.lineWidth,
            points: [{ x: pos.x, y: pos.y, pressure: pos.pressure }]
        };

        this.currentPoints = [{ x: pos.x, y: pos.y, pressure: pos.pressure, time: Date.now() }];

        this.ctx.beginPath();
        this._applyStyle(pos.pressure);
        this.ctx.moveTo(pos.x, pos.y);

        // For single dot
        this.ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
        this.ctx.stroke();
    }

    _onPointerMove(e) {
        if (!this.isDrawing) return;

        // Get coalesced events for smoother drawing (Apple Pencil)
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

        for (const evt of events) {
            const pos = this._getPos(evt);
            this.pressure = pos.pressure;

            this.currentStroke.points.push({ x: pos.x, y: pos.y, pressure: pos.pressure });
            this.currentPoints.push({ x: pos.x, y: pos.y, pressure: pos.pressure, time: Date.now() });

            if (this.tool === 'eraser') {
                this._erase(pos.x, pos.y);
            } else {
                this._applyStyle(pos.pressure);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x, pos.y);
            }
        }
    }

    _onPointerUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentStroke && this.currentStroke.points.length > 0) {
            this.strokes.push(this.currentStroke);
            this.redoStack = [];

            // Save points for handwriting recognition
            this.allStrokePoints.push([...this.currentPoints]);
        }

        this.currentStroke = null;
        this.currentPoints = [];
        this.ctx.beginPath();
    }

    _applyStyle(pressure) {
        if (this.tool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.color;
            this.ctx.globalAlpha = 1;
            // Pressure-sensitive line width
            this.ctx.lineWidth = this.lineWidth * (0.5 + pressure * 1.5);
        } else if (this.tool === 'highlighter') {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.strokeStyle = this.color;
            this.ctx.globalAlpha = 0.3;
            this.ctx.lineWidth = this.lineWidth * 4;
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

        if (stroke.tool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = stroke.color;
            this.ctx.globalAlpha = 1;
        } else if (stroke.tool === 'highlighter') {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.strokeStyle = stroke.color;
            this.ctx.globalAlpha = 0.3;
        }

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        for (let i = 1; i < stroke.points.length; i++) {
            const prev = stroke.points[i - 1];
            const curr = stroke.points[i];

            this.ctx.beginPath();

            if (stroke.tool === 'pen') {
                this.ctx.lineWidth = stroke.lineWidth * (0.5 + curr.pressure * 1.5);
            } else if (stroke.tool === 'highlighter') {
                this.ctx.lineWidth = stroke.lineWidth * 4;
            }

            this.ctx.moveTo(prev.x, prev.y);
            this.ctx.lineTo(curr.x, curr.y);
            this.ctx.stroke();
        }

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
