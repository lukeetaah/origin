// ==========================================
// RUPTURA 2: Procedural Audio Engine (V3)
// ==========================================

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeNodes: Set<AudioBufferSourceNode | OscillatorNode> = new Set();
  private speechAudio: HTMLAudioElement | null = null;
  private speechSequence = 0;
  
  // Room tone nodes
  private roomToneGain: GainNode | null = null;
  private roomToneFilter: BiquadFilterNode | null = null;
  private roomToneSrc: AudioBufferSourceNode | null = null;

  async unlock() {
    if (!this.ctx) {
      const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      this.ctx = new AudioContextConstructor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4; // Slightly increased master volume
      this.master.connect(this.ctx.destination);

      // Create noise buffer (white noise)
      const size = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

      this.initRoomTone();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    await this.loadBrowserVoices();
  }

  async speak(text: string) {
    const sequence = ++this.speechSequence;
    if (this.speechAudio) {
      this.speechAudio.pause();
      this.speechAudio = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || sequence !== this.speechSequence) return this.speakWithLocalSouthAmericanVoice(text);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.speechAudio = audio;
      audio.volume = 0.92;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.speakWithLocalSouthAmericanVoice(text);
      };
      await audio.play();
    } catch {
      this.speakWithLocalSouthAmericanVoice(text);
    }
  }

  private speakWithLocalSouthAmericanVoice(text: string) {
    if (!('speechSynthesis' in window)) {
      this.playNarratorMurmur(text);
      return;
    }
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const southAmericanLocales = ['es-ar', 'es-uy', 'es-cl', 'es-co', 'es-pe', 'es-ve', 'es-bo', 'es-py', 'es-ec'];
    const latinFallbackLocales = ['es-419', 'es-us'];
    const preferredMaleHints = ['tomas', 'tomás', 'diego', 'jorge', 'carlos', 'pablo', 'juan', 'miguel', 'male', 'masculino', 'hombre'];
    const bannedHints = ['españa', 'espana', 'spain', 'mexico', 'méxico', 'mexicana', 'sabina'];
    const validLatinVoice = (voiceCandidate: SpeechSynthesisVoice) => {
      const lang = voiceCandidate.lang.toLowerCase();
      const name = voiceCandidate.name.toLowerCase();
      return lang.startsWith('es') && lang !== 'es-es' && lang !== 'es-mx' && !bannedHints.some(hint => name.includes(hint));
    };
    const preferredVoice = voices.find(v => southAmericanLocales.includes(v.lang.toLowerCase()) && preferredMaleHints.some(hint => v.name.toLowerCase().includes(hint))) ||
      voices.find(v => southAmericanLocales.includes(v.lang.toLowerCase())) ||
      voices.find(v => latinFallbackLocales.includes(v.lang.toLowerCase()) && preferredMaleHints.some(hint => v.name.toLowerCase().includes(hint)) && validLatinVoice(v)) ||
      voices.find(v => latinFallbackLocales.includes(v.lang.toLowerCase()) && validLatinVoice(v)) ||
      voices.find(validLatinVoice);

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
      utterance.rate = 0.92;
      utterance.pitch = 0.78;
      utterance.volume = 0.9;
      synth.speak(utterance);
      return;
    }
    const allowedLocales = ['es-ar', 'es-uy', 'es-cl', 'es-co', 'es-pe', 'es-ve', 'es-bo', 'es-py'];
    const maleHints = ['tomas', 'tomás', 'diego', 'jorge', 'carlos', 'pablo', 'juan', 'male', 'masculino', 'hombre'];
    const voice = voices.find(v => allowedLocales.includes(v.lang.toLowerCase()) && maleHints.some(hint => v.name.toLowerCase().includes(hint))) ||
      voices.find(v => allowedLocales.includes(v.lang.toLowerCase()));

    if (!voice) {
      this.playNarratorMurmur(text);
      return;
    }

    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.92;
    utterance.pitch = 0.82;
    utterance.volume = 0.9;
    synth.speak(utterance);
  }

  private loadBrowserVoices() {
    if (!('speechSynthesis' in window)) return Promise.resolve();
    const synth = window.speechSynthesis;
    if (synth.getVoices().length > 0) return Promise.resolve();

    return new Promise<void>(resolve => {
      const done = () => {
        synth.removeEventListener('voiceschanged', done);
        resolve();
      };
      synth.addEventListener('voiceschanged', done, { once: true });
      window.setTimeout(done, 700);
    });
  }

  private playNarratorMurmur(text: string) {
    if (!this.ctx || !this.master) return;
    const syllables = Math.min(22, Math.max(6, Math.floor(text.length / 18)));
    const base = 92;

    for (let i = 0; i < syllables; i++) {
      const start = this.ctx.currentTime + i * 0.105;
      const osc = this.ctx.createOscillator();
      const buzz = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      buzz.type = 'triangle';
      osc.frequency.setValueAtTime(base + Math.sin(i * 1.7) * 14, start);
      buzz.frequency.setValueAtTime(base * 0.5 + Math.cos(i) * 6, start);
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      filter.Q.value = 1.8;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.095);

      osc.connect(filter);
      buzz.connect(filter);
      filter.connect(gain).connect(this.master);
      osc.start(start);
      buzz.start(start);
      osc.stop(start + 0.11);
      buzz.stop(start + 0.11);
      this.activeNodes.add(osc);
      this.activeNodes.add(buzz);
      osc.onended = () => this.activeNodes.delete(osc);
      buzz.onended = () => this.activeNodes.delete(buzz);
    }
  }

  private initRoomTone() {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;

    // Continuous deep rumble
    this.roomToneSrc = this.ctx.createBufferSource();
    this.roomToneSrc.buffer = this.noiseBuffer;
    this.roomToneSrc.loop = true;

    this.roomToneFilter = this.ctx.createBiquadFilter();
    this.roomToneFilter.type = 'lowpass';
    this.roomToneFilter.frequency.value = 40; // Very deep
    this.roomToneFilter.Q.value = 1;

    this.roomToneGain = this.ctx.createGain();
    this.roomToneGain.gain.value = 0; // Starts silent until entered

    this.roomToneSrc.connect(this.roomToneFilter).connect(this.roomToneGain).connect(this.master);
    this.roomToneSrc.start();
  }

  // Modulates the constant background tension based on emotional weight
  setRoomToneIntensity(weight: number) {
    if (!this.ctx || !this.roomToneGain || !this.roomToneFilter) return;
    
    // As things get worse, the rumble gets deeper and quieter (asphyxiating silence)
    const targetFreq = Math.max(20, 50 - (weight * 5));
    const targetGain = Math.max(0.05, 0.4 - (weight * 0.08));

    this.roomToneFilter.frequency.linearRampToValueAtTime(targetFreq, this.ctx.currentTime + 3);
    this.roomToneGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 3);
  }

  // TV static - bandpassed noise
  playTVStatic(intensity: number = 0.3, durationMs: number = 2000) {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800 + intensity * 400;
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + durationMs / 1000);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + durationMs / 1000);
    this.activeNodes.add(src);
    src.onended = () => this.activeNodes.delete(src);
  }

  // Wooden creak / door
  playCreak(pitch: number = 80) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    
    // Add a lowpass filter to make it sound more like wood, less like a synth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    osc.connect(filter).connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
    this.activeNodes.add(osc);
    osc.onended = () => this.activeNodes.delete(osc);
  }

  // Soft knock 
  playKnock() {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Ambient hum (fridge, fan)
  playHum(durationMs: number = 3000, freq: number = 60) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime + durationMs / 2000);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + durationMs / 1000);
    this.activeNodes.add(osc);
    osc.onended = () => this.activeNodes.delete(osc);
  }

  // Drip
  playDrip() {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // Lock rattle
  playLocked() {
    if (!this.ctx || !this.master) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!this.ctx || !this.master) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 200 + Math.random() * 100;
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        osc.connect(filter).connect(gain).connect(this.master!);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      }, i * 60);
    }
  }

  // --- FOLEY EFFECTS ---
  
  playPaperRustle() {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + 0.15);
  }

  playWoodTap() {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + 0.1);
  }

  playStaticZap() {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    
    src.connect(gain).connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + 0.06);
  }

  // Intense full-spectrum noise burst for the final door slam
  playDoorSlam() {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    
    // Add a huge bass drop underneath the slam
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.5);

    const gainNode = this.ctx.createGain();
    // Huge peak, fast decay
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(2.0, this.ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

    // Filter to make it sound punchy and muffled
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(8000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3);

    src.connect(filter);
    osc.connect(filter);
    filter.connect(gainNode).connect(this.master);
    
    src.start();
    osc.start();
    src.stop(this.ctx.currentTime + 1.0);
    osc.stop(this.ctx.currentTime + 1.0);
  }

  // Heartbeat for endings
  playHeartbeat(durationMs: number) {
    if (!this.ctx || !this.master) return;
    let time = this.ctx.currentTime;
    const endTime = time + durationMs / 1000;
    
    while (time < endTime) {
      const playBeat = (t: number, p: number) => {
        if (!this.ctx || !this.master) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.1);
        gain.gain.setValueAtTime(p, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain).connect(this.master);
        osc.start(t);
        osc.stop(t + 0.2);
      };

      playBeat(time, 0.6);
      playBeat(time + 0.15, 0.4);
      
      // Speed up as it gets closer to the end
      const progress = 1 - ((endTime - time) / (durationMs / 1000));
      const interval = 1.0 - (progress * 0.6); // Gets faster
      
      time += interval;
    }
  }

  // Tinnitus for asphyxiating silence
  playTinnitus(intensity: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 8500 + (Math.random() * 200); 
    
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.015 * intensity, this.ctx.currentTime + 2.0);
    
    osc.connect(gainNode).connect(this.master);
    osc.start();
    this.activeNodes.add(osc);
  }

  silenceEverythingExceptTinnitus() {
    this.activeNodes.forEach(n => { try { n.stop(); } catch {} });
    this.activeNodes.clear();
    if (this.roomToneGain && this.ctx) {
      this.roomToneGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    }
  }

  playHoldSilence() {
    if (!this.ctx || !this.roomToneGain) return;
    const currentGain = this.roomToneGain.gain.value;
    // Sudden drop to near zero
    this.roomToneGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    // Slow eerie recovery
    this.roomToneGain.gain.exponentialRampToValueAtTime(currentGain || 0.1, this.ctx.currentTime + 3.0);
  }

  // Scene ambient
  playMemoryUnlock() {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    // Deep bass drop
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(15, this.ctx.currentTime + 1.2);
    
    // Impact envelope
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    
    // Lowpass filter to muffle it like a heartbeat
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1.2);
    
    osc.connect(filter).connect(gainNode).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.6);
  }

  playSceneAmbient(scene: string) {
    if (scene === 'kitchen') {
      this.playDrip();
      setTimeout(() => this.playHum(5000, 55), 500);
    } else if (scene === 'living') {
      this.playTVStatic(0.15, 3000);
    } else if (scene === 'bedroom') {
      this.playHum(4000, 50);
    }
  }

  destroy() {
    this.speechSequence++;
    if (this.speechAudio) this.speechAudio.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.activeNodes.forEach(n => { try { n.stop(); } catch {} });
    this.activeNodes.clear();
    if (this.roomToneSrc) {
      try { this.roomToneSrc.stop(); } catch {}
    }
    if (this.ctx) this.ctx.close();
  }
}
