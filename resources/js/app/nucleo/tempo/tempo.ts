export interface TempoMesa {
    dia: number;
    hora: number;
    minuto: number;
}

/** Adiciona minutos ao tempo da mesa, virando o dia automaticamente se passar das 24h ou voltar antes das 00h. */
export function adicionarTempo(atual: TempoMesa, deltaMinutos: number): TempoMesa {
    const totalMinutos = atual.hora * 60 + atual.minuto + deltaMinutos;
    const diasExtra = Math.floor(totalMinutos / (24 * 60));
    let minutosRestantes = totalMinutos % (24 * 60);
    if (minutosRestantes < 0) {
        minutosRestantes += 24 * 60;
    }
    const novoDia = Math.max(1, atual.dia + diasExtra);
    const novaHora = Math.floor(minutosRestantes / 60);
    const novoMinuto = minutosRestantes % 60;

    return {
        dia: novoDia,
        hora: novaHora,
        minuto: novoMinuto,
    };
}

export function formatarHora(hora: number, minuto: number): string {
    return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

export function periodoDoDia(hora: number): 'madrugada' | 'manha' | 'tarde' | 'noite' {
    if (hora >= 5 && hora < 12) return 'manha';
    if (hora >= 12 && hora < 18) return 'tarde';
    if (hora >= 18 && hora < 22) return 'noite';
    return 'madrugada';
}

export function rotuloPeriodo(hora: number): string {
    switch (periodoDoDia(hora)) {
        case 'manha':
            return 'Manhã';
        case 'tarde':
            return 'Tarde';
        case 'noite':
            return 'Noite';
        case 'madrugada':
            return 'Madrugada';
    }
}
