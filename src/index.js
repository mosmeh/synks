import * as Tone from 'tone';
import './style.css';
import { Synth } from './synth';
import { SingleString } from './single-string';

// standard guitar tuning
const FREQS = [40, 45, 50, 55, 59, 64].map(
    (note) => 440 * Math.pow(2, (note - 69) / 12)
);

const canvas = document.getElementById('canvas');
const width = canvas.width;
const height = canvas.height;
canvas.width *= window.devicePixelRatio;
canvas.height *= window.devicePixelRatio;

const ctx = canvas.getContext('2d');
ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

const paddingX = 10;
const paddingY = 50;

const strings = [];
FREQS.forEach((freq, i) => {
    const y = paddingY + (i * (height - 2 * paddingY)) / (FREQS.length - 1);
    const length = (FREQS[0] / freq) * (width - 2 * paddingX);
    strings.push(new SingleString(canvas, paddingX, y, length, freq));

    if (i > 0) {
        const rLength = width - 2 * paddingX - length;
        const rFreq = (freq * length) / rLength;
        strings.push(
            new SingleString(canvas, paddingX + length, y, rLength, rFreq)
        );
    }
});

function draw() {
    ctx.clearRect(0, 0, width, height);
    strings.forEach((string) => string.draw(ctx));
    requestAnimationFrame(draw);
}

draw();

async function setupSynth() {
    await Tone.start();

    const synth = new Synth();
    await synth.setup();

    [
        ['volume', 'volume'],
        ['chorus-depth', 'chorusDepth'],
    ].forEach(([id, prop]) => {
        const slider = document.getElementById(id);
        slider.addEventListener('input', (e) => {
            synth[prop] = +e.target.value;
        });
        synth[prop] = +slider.value;
    });

    const chorusOn = document.getElementById('chorus-on');
    chorusOn.addEventListener('input', (e) => {
        synth.chorusEnabled = e.target.checked;
    });
    synth.chorusEnabled = chorusOn.checked;

    const params = {};
    ['voices', 'brightness', 'position'].forEach((param) => {
        const slider = document.getElementById(param);
        slider.addEventListener('input', (e) => {
            params[param] = +e.target.value;
            synth.setWorkletParams(params);
        });
        params[param] = +slider.value;
    });

    const pitch = document.getElementById('pitch');
    function updatePitch() {
        const ratio = Math.pow(2, +pitch.value);
        params.freqs = [];
        for (const string of strings) {
            params.freqs.push(string.freq * ratio);
        }
    }
    pitch.addEventListener('input', () => {
        updatePitch();
        synth.setWorkletParams(params);
    });
    updatePitch();

    const decay = document.getElementById('decay');
    function updateDecay() {
        params.decay = +decay.value;
        const damping = Math.pow(0.01, 1 / params.decay);
        strings.forEach((string) => (string.damping = damping));
    }
    decay.addEventListener('input', () => {
        updateDecay();
        synth.setWorkletParams(params);
    });
    updateDecay();

    synth.setWorkletParams(params);

    strings.forEach((string, i) => {
        string.onpluck = (amp) => synth.pluck(i, amp);
    });
}

setupSynth();

function resume() {
    Tone.start();
}

document.addEventListener('mousedown', resume);
document.addEventListener('keydown', resume);
