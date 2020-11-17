// based on https://codepen.io/wentin/pen/VYegqq

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

const MAX_AMP = 17;

export class SingleString {
    constructor(canvas, x, y, length, freq) {
        this.freq = freq;
        this.damping = 0.5;
        this.onpluck = () => {};

        this._p0 = new Point(x, y);
        this._p1 = new Point(x + length, y);
        this._length = length;

        this._state = 'stationary';
        this._disp = 0;
        this._pluckTime = null;

        canvas.addEventListener('mousemove', this._onMouseEvent.bind(this));
        canvas.addEventListener('mousedown', this._onMouseEvent.bind(this));
        canvas.addEventListener('mouseup', this._onMouseEvent.bind(this));
        canvas.addEventListener('mouseleave', this._onMouseEvent.bind(this));
    }

    grab(amp, downPick) {
        this._state = 'grabbed';
        this._disp = Math.min(MAX_AMP, amp) * (downPick ? 1 : -1);
    }

    pluck(amp, downPick) {
        amp = Math.min(MAX_AMP, amp);
        this.onpluck(amp / MAX_AMP);
        this._state = 'oscillating';
        this._pluckTime = Date.now();
        this._disp = amp * (downPick ? 1 : -1);
    }

    draw(ctx) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#eee';
        ctx.fillStyle = '#eee';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.26)';

        // left endpoint
        ctx.beginPath();
        ctx.arc(this._p0.x, this._p0.y, 5, 0, 2 * Math.PI);
        ctx.fill();

        this._drawString(ctx);

        // right endpoint
        ctx.beginPath();
        ctx.arc(this._p1.x, this._p1.y, 5, 0, 2 * Math.PI);
        ctx.fill();

        // left endpoint without shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0)';
        ctx.beginPath();
        ctx.arc(this._p0.x, this._p0.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }

    _onMouseEvent(e) {
        e.preventDefault();

        const rect = e.target.getBoundingClientRect();
        const mousePos = new Point(e.clientX - rect.left, e.clientY - rect.top);
        const downPick = mousePos.y > this._p0.y;

        let sagitta = Infinity;
        if (
            this._p0.x < mousePos.x &&
            mousePos.x < this._p1.x &&
            Math.abs(mousePos.y - this._p0.y) <= MAX_AMP
        ) {
            sagitta = calcArcSagitta(this._p0, mousePos, this._p1);
        }

        if (e.buttons && sagitta <= MAX_AMP) {
            // start/update grabbing
            this.grab(sagitta, downPick);
            return;
        } else if (this._state === 'grabbed') {
            // released mouse button or reached maximum tension while grabbing
            this.pluck(sagitta, downPick);
            return;
        }

        const prevMousePos = new Point(
            mousePos.x - e.movementX,
            mousePos.y - e.movementY
        );
        if (
            e.buttons &&
            lineIntersect(prevMousePos, mousePos, this._p0, this._p1)
        ) {
            // cursor quickly crossed string
            this.pluck(MAX_AMP, downPick);
        }
    }

    _drawString(ctx) {
        switch (this._state) {
            case 'stationary':
                this._drawLine(ctx);
                break;
            case 'grabbed':
                this._drawArc(ctx, this._disp);
                break;
            case 'oscillating':
                const t = (Date.now() - this._pluckTime) / 1000;
                const damp = Math.pow(this.damping, t);

                const freq = this.freq / 16; // 4 octaves lower than actual freq
                this._drawArc(
                    ctx,
                    damp * this._disp * -Math.cos(2 * Math.PI * freq * t)
                );

                if (damp < 0.01) {
                    this._state = 'stationary';
                }
                break;
            default:
                throw new Error('unreachable');
        }
    }

    _drawLine(ctx) {
        ctx.beginPath();
        ctx.moveTo(this._p0.x, this._p0.y);
        ctx.lineTo(this._p1.x, this._p1.y);
        ctx.stroke();
    }

    _drawArc(ctx, disp) {
        const x = (this._p0.x + this._p1.x) / 2;
        const y = disp / 2 + this._p0.y - this._length ** 2 / (8 * disp);
        const angle = Math.atan2(x - this._p0.x, y - this._p0.y);

        const EPS = 1e-3;
        if (!Number.isFinite(angle) || angle < EPS || Math.PI - EPS < angle) {
            this._drawLine(ctx);
            return;
        }

        const amp = Math.abs(disp);
        const r = amp / 2 + this._length ** 2 / (8 * amp);

        ctx.beginPath();
        ctx.arc(
            x,
            y,
            r,
            (3 * Math.PI) / 2 - angle,
            (3 * Math.PI) / 2 + angle,
            angle > Math.PI / 2
        );
        ctx.stroke();
    }
}

/**
 * Calculate sagitta of arc passing through 3 given points
 * @param {number} p0
 * @param {number} p
 * @param {number} p1
 * @return {number} Sagitta of arc. 0 if 3 points are colinear
 * */
function calcArcSagitta(p0, p, p1) {
    const dy1 = p.y - p0.y;
    const dx1 = p.x - p0.x;
    const dy2 = p1.y - p.y;
    const dx2 = p1.x - p.x;

    const aSlope = dy1 / dx1;
    const bSlope = dy2 / dx2;

    let x =
        aSlope * bSlope * (p0.y - p1.y) +
        bSlope * (p0.x + p.x) -
        aSlope * (p.x + p1.x);
    x /= 2 * (bSlope - aSlope);
    const y = ((p0.x + p.x) / 2 - x) / aSlope + (p0.y + p.y) / 2;
    const r = Math.hypot(p0.x - x, p0.y - y);

    if (Number.isFinite(r)) {
        return r - Math.sqrt(r ** 2 - ((p0.x - p1.x) / 2) ** 2);
    } else {
        // collinear
        return 0;
    }
}

function lineIntersect(A, B, E, F) {
    // based on https://github.com/googlecreativelab/chrome-music-lab/blob/master/harmonics%20&%20strings/js/index.js

    const a1 = B.y - A.y;
    const a2 = F.y - E.y;
    const b1 = A.x - B.x;
    const b2 = E.x - F.x;
    const c1 = B.x * A.y - A.x * B.y;
    const c2 = F.x * E.y - E.x * F.y;

    const det = a1 * b2 - a2 * b1;
    if (det === 0) {
        return false;
    }

    const xip = (b1 * c2 - b2 * c1) / det;
    const yip = (a2 * c1 - a1 * c2) / det;

    if (
        Math.pow(xip - B.x, 2) + Math.pow(yip - B.y, 2) >
        Math.pow(A.x - B.x, 2) + Math.pow(A.y - B.y, 2)
    ) {
        return false;
    }
    if (
        Math.pow(xip - A.x, 2) + Math.pow(yip - A.y, 2) >
        Math.pow(A.x - B.x, 2) + Math.pow(A.y - B.y, 2)
    ) {
        return false;
    }
    if (
        Math.pow(xip - F.x, 2) + Math.pow(yip - F.y, 2) >
        Math.pow(E.x - F.x, 2) + Math.pow(E.y - F.y, 2)
    ) {
        return false;
    }
    if (
        Math.pow(xip - E.x, 2) + Math.pow(yip - E.y, 2) >
        Math.pow(E.x - F.x, 2) + Math.pow(E.y - F.y, 2)
    ) {
        return false;
    }

    return true;
}
