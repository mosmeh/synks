const MIN_FREQ = 50;

class Allpass {
    constructor() {
        this.eta = 0;
        this._x1 = this._y1 = 0;
    }

    process(x) {
        const y = this._x1 + this.eta * (x - this._y1);
        this._x1 = x;
        this._y1 = y;
        return y;
    }
}

class Delay {
    constructor(maxLength) {
        let length = 1;
        while (length < maxLength) {
            length *= 2;
        }

        this._buf = new Float32Array(length);
        this._mask = length - 1;
        this._readPtr = this._writePtr = 0;
        this._allpass = new Allpass();
        this._out = 0;
    }

    set length(value) {
        let readPos = this._writePtr - value + 1;
        while (readPos < 0) {
            readPos += this._buf.length;
        }

        this._readPtr = readPos & this._mask;

        let alpha = 1 + this._readPtr - readPos;
        if (alpha < 0.5) {
            this._readPtr = (this._readPtr + 1) & this._mask;
            alpha += 1;
        }

        this._allpass.eta = (1 - alpha) / (1 + alpha);
    }

    input(x) {
        this._buf[this._writePtr] = x;
        this._readPtr = (this._readPtr + 1) & this._mask;
        this._writePtr = (this._writePtr + 1) & this._mask;
        this._out = this._allpass.process(this._buf[this._readPtr]);
    }

    output() {
        return this._out;
    }
}

class PositionFilter {
    constructor() {
        this._freq = MIN_FREQ;
        this._position = 0;
        this._delay = new Delay(sampleRate / MIN_FREQ);
    }

    set freq(value) {
        this._freq = value;
        this._delay.length = Math.floor((sampleRate * this._position) / value);
    }

    set position(value) {
        this._position = value;
        this._delay.length = Math.floor((sampleRate * value) / this._freq);
    }

    process(x) {
        this._delay.input(x);
        return x - this._delay.output();
    }
}

class DampingFilter {
    constructor() {
        this._freq = MIN_FREQ;
        this._decay = 3;
        this._x1 = this._x2 = 0;
        this._brightness = 0.5;
        this._calcRho();
    }

    set freq(value) {
        this._freq = value;
        this._calcRho();
    }

    set decay(value) {
        this._decay = value;
        this._calcRho();
    }

    set brightness(value) {
        this._brightness = value;
    }

    process(x) {
        const h0 = (1 + this._brightness) * 0.5;
        const h1 = (1 - this._brightness) * 0.25;
        const y = this._rho * (h0 * this._x1 + h1 * (x + this._x2));
        this._x2 = this._x1;
        this._x1 = x;
        return y;
    }

    _calcRho() {
        this._rho = Math.pow(0.001, 1 / (this._freq * this._decay));
    }
}

class DynamicLevelFilter {
    constructor() {
        this._omega = (Math.PI * MIN_FREQ) / sampleRate;
        this._l = this._l0 = 1;
        this._x1 = this._y1 = 0;
    }

    set freq(value) {
        this._omega = (Math.PI * value) / sampleRate;
    }

    set level(value) {
        this._l = value;
        this._l0 = value ** (1 / 3);
    }

    process(x) {
        const y =
            (this._omega * (x + this._x1) + (1 - this._omega) * this._y1) /
            (1 + this._omega);
        this._x1 = x;
        this._y1 = y;

        return this._l * this._l0 * x + (1 - this._l) * y;
    }
}

class Voice {
    constructor(num) {
        this.num = num;
        this._freq = MIN_FREQ;
        this._duration = 3 * sampleRate;
        this._delay = new Delay(sampleRate / MIN_FREQ);
        this._posFilter = new PositionFilter();
        this._dampFilter = new DampingFilter();
        this._dynFilter = new DynamicLevelFilter();
        this._i = Infinity;
        this._amp = 0;
    }

    setParams({ freq, brightness, decay, position }) {
        this._freq = freq;
        this._delay.length = sampleRate / freq - 1; // compensate for delay of damping filter
        this._posFilter.freq = freq;
        this._dampFilter.freq = freq;
        this._dynFilter.freq = freq;

        this._duration = decay * sampleRate;
        this._dampFilter.brightness = brightness;
        this._dampFilter.decay = decay;
        this._posFilter.position = position;
    }

    get playing() {
        return this._i <= this._duration;
    }

    pluck(amp) {
        this._i = 0;
        this._amp = amp;

        const LEVEL_COEF = 0.5;
        this._dynFilter.level = LEVEL_COEF * amp;
    }

    process() {
        let x = 0;

        if (this._i++ * this._freq < sampleRate) {
            x = this._amp * (2 * Math.random() - 1);
        }

        x = this._posFilter.process(x);

        let y = this._delay.output();
        x += this._dampFilter.process(y);
        this._delay.input(x);

        y = this._dynFilter.process(y);

        return y;
    }
}

class Processor extends AudioWorkletProcessor {
    constructor() {
        super();

        this._voices = [];
        this.port.onmessage = (msg) => {
            const { data } = msg;
            switch (data.type) {
                case 'params':
                    this._params = data.params;
                    while (this._voices.length > this._params.voices) {
                        this._voices.shift();
                    }
                    this._voices.forEach((voice) => {
                        voice.setParams({
                            ...this._params,
                            freq: this._params.freqs[voice.num],
                        });
                    });
                    return;
                case 'pluck':
                    const i = this._voices.findIndex(
                        (voice) => voice.num === data.which
                    );
                    if (i >= 0) {
                        const [voice] = this._voices.splice(i, 1);
                        voice.pluck(data.amp);
                        this._voices.push(voice);
                        return;
                    }

                    const voice = new Voice(data.which);
                    voice.setParams({
                        ...this._params,
                        freq: this._params.freqs[data.which],
                    });
                    voice.pluck(data.amp);
                    this._voices.push(voice);
                    while (this._voices.length > this._params.voices) {
                        this._voices.shift();
                    }

                    return;
            }
        };
    }

    process(_, outputs) {
        const out = outputs[0][0];

        for (let i = 0; i < out.length; ++i) {
            out[i] = this._voices.reduce(
                (sum, voice) => sum + voice.process(),
                0
            );
        }

        this._voices = this._voices.filter((voice) => voice.playing);

        return true;
    }
}

registerProcessor('main', Processor);
