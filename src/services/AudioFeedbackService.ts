/**
 * AudioFeedbackService - Web Audio utility for acoustic warnings.
 */
export class AudioFeedbackService {
    private static audioContext: AudioContext | null = null;
    private static oscillator: OscillatorNode | null = null;
    private static gainNode: GainNode | null = null;

    private static init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    /**
     * Play a short warning beep.
     */
    static beep(frequency = 440, duration = 0.1, type: OscillatorType = 'sine') {
        try {
            this.init();
            if (!this.audioContext) return;

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            gain.connect(this.audioContext.destination);
            osc.connect(gain);

            gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

            osc.start();
            osc.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            console.warn('[AUDIO_FEEDBACK] Failed to beep:', e);
        }
    }

    /**
     * Start a continuous alarm tone.
     */
    static startAlarm(frequency = 880) {
        try {
            this.init();
            if (!this.audioContext || this.oscillator) return;

            this.oscillator = this.audioContext.createOscillator();
            this.gainNode = this.audioContext.createGain();

            this.oscillator.type = 'triangle';
            this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            this.gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);

            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            this.oscillator.start();
        } catch (e) {
            console.warn('[AUDIO_FEEDBACK] Failed to start alarm:', e);
        }
    }

    /**
     * Stop the continuous alarm tone.
     */
    static stopAlarm() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
    }
}
