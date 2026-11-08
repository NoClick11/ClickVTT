/**
 * Sintetizador procedural de áudio para combate via Web Audio API.
 * Sem dependência de arquivos externos, sem latência de rede e com volume calibrado.
 */

let audioCtx: AudioContext | null = null;

function obterContexto(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    } catch {
        return null;
    }
}

/** Toca o som de impacto/dano recebido (thud/punch com pitch drop rápido e impacto encorpado). */
export function tocarSomDano(): void {
    const ctx = obterContexto();
    if (!ctx) return;

    try {
        const agora = ctx.currentTime;

        // Oscilador 1: Impacto grave descendente (Punch)
        const osc1 = ctx.createOscillator();
        const ganho1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(160, agora);
        osc1.frequency.exponentialRampToValueAtTime(35, agora + 0.18);

        ganho1.gain.setValueAtTime(0.45, agora);
        ganho1.gain.exponentialRampToValueAtTime(0.001, agora + 0.2);

        osc1.connect(ganho1);
        ganho1.connect(ctx.destination);

        // Oscilador 2: Estalo / impacto rústico (Crunch)
        const osc2 = ctx.createOscillator();
        const ganho2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(120, agora);
        osc2.frequency.exponentialRampToValueAtTime(40, agora + 0.12);

        ganho2.gain.setValueAtTime(0.25, agora);
        ganho2.gain.exponentialRampToValueAtTime(0.001, agora + 0.14);

        osc2.connect(ganho2);
        ganho2.connect(ctx.destination);

        osc1.start(agora);
        osc2.start(agora);
        osc1.stop(agora + 0.22);
        osc2.stop(agora + 0.16);
    } catch (e) {
        console.warn('Falha ao reproduzir som de dano', e);
    }
}

/** Toca o som de cura (arpejo ascendente suave, cristalino e mágico). */
export function tocarSomCura(): void {
    const ctx = obterContexto();
    if (!ctx) return;

    try {
        const agora = ctx.currentTime;
        // Notas do acorde de cura: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
        const notas = [523.25, 659.25, 783.99, 1046.5];
        const duracaoNota = 0.08;

        notas.forEach((freq, i) => {
            const inicio = agora + i * duracaoNota;
            const osc = ctx.createOscillator();
            const ganho = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, inicio);

            // Última nota ressoa um pouco mais com shimmer
            const decay = i === notas.length - 1 ? 0.45 : 0.2;
            ganho.gain.setValueAtTime(0.001, inicio);
            ganho.gain.linearRampToValueAtTime(0.28, inicio + 0.015);
            ganho.gain.exponentialRampToValueAtTime(0.001, inicio + decay);

            osc.connect(ganho);
            ganho.connect(ctx.destination);

            osc.start(inicio);
            osc.stop(inicio + decay + 0.02);
        });
    } catch (e) {
        console.warn('Falha ao reproduzir som de cura', e);
    }
}
