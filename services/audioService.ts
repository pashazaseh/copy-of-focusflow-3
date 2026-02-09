let audioContext: AudioContext | null = null;

const getAudioContext = () => {
    if (!audioContext) {
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtor) {
            audioContext = new AudioCtor();
        }
    }
    return audioContext;
};

export const ALARM_TYPES = {
  DIGITAL: 'digital',
  BELL: 'bell',
  CHIME: 'chime'
};

export const playTone = (freq: number, duration: number, volume: number = 0.5, type: OscillatorType = 'sine') => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        console.error("Audio playback failed", e);
    }
};

export const playPickerTick = (volume: number = 0.5) => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.error("Audio playback failed", e);
    }
};

export const playAlarm = (volume: number, type: string = ALARM_TYPES.DIGITAL) => {
    switch (type) {
        case ALARM_TYPES.BELL:
            // Lower freq sine wave with long decay
            playTone(440, 1.5, volume, 'sine');
            setTimeout(() => playTone(440, 1.5, volume * 0.8, 'sine'), 1600);
            break;
        case ALARM_TYPES.CHIME:
            // High freq sine with reverb-like decay
            playTone(1200, 1.0, volume, 'sine');
            setTimeout(() => playTone(1500, 1.0, volume * 0.7, 'sine'), 200);
            setTimeout(() => playTone(1800, 1.0, volume * 0.5, 'sine'), 400);
            break;
        case ALARM_TYPES.DIGITAL:
        default:
            // Digital alarm clock style
            playTone(880, 0.1, volume, 'square');
            setTimeout(() => playTone(880, 0.1, volume, 'square'), 150);
            setTimeout(() => playTone(880, 0.1, volume, 'square'), 300);
            setTimeout(() => playTone(880, 0.1, volume, 'square'), 450);
            break;
    }
};

export const playSpinTick = (volume: number) => {
    playTone(400 + Math.random() * 200, 0.05, volume * 0.5, 'sawtooth');
};

export const playWin = (volume: number) => {
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.2, volume, 'triangle'), i * 100);
    });
};