import * as Tone from 'tone';
import worklet from '-!url-loader?limit=false!./worklet';

export class Synth {
    async setup() {
        const context = new AudioContext({ sampleRate: 44100 });
        Tone.setContext(new Tone.Context(context));

        await context.audioWorklet.addModule(worklet, { credentials: 'omit' });
        const workletNode = new AudioWorkletNode(context, 'main', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [1],
        });
        this._port = workletNode.port;

        this._input = new Tone.Gain();
        this._chorus = new Tone.Chorus(2, 2, 0.1).start();
        this._reverb = new Tone.Reverb().set({
            wet: 0.3,
            decay: 0.5,
            preDelay: 0.01,
        });
        this._gain = new Tone.Gain(1);
        const limiter = new Tone.Limiter(-20);

        Tone.connectSeries(
            workletNode,
            this._input,
            this._chorus,
            this._reverb,
            this._gain,
            limiter,
            context.destination
        );
    }

    set volume(value) {
        this._gain.gain.value = value;
    }

    set chorusEnabled(on) {
        this._input.disconnect();
        if (on) {
            this._input.connect(this._chorus);
        } else {
            this._input.connect(this._reverb);
        }
    }

    set chorusDepth(depth) {
        this._chorus.set({ depth });
    }

    setWorkletParams(params) {
        this._port.postMessage({
            type: 'params',
            params,
        });
    }

    pluck(which, amp) {
        this._port.postMessage({
            type: 'pluck',
            which,
            amp,
        });
    }
}
