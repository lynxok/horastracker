import { useCallback, useRef } from 'react';

export const useThematicSounds = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playThematicSound = useCallback((theme: string, type: 'punch-in' | 'punch-out' | 'click' | 'success') => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (theme) {
      case 'cyberpunk':
        if (type === 'punch-in') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(110, now);
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
        } else if (type === 'punch-out') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
        }
        break;

      case 'matrix':
        osc.type = 'square';
        osc.frequency.setValueAtTime(type === 'punch-in' ? 880 : 440, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;

      case 'winamp':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;

      default:
        // Default click sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(type === 'success' ? 880 : 440, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
  }, []);

  return { playThematicSound };
};
