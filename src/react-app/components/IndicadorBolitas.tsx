type Estado = "en_ritmo" | "empuja" | "enfoque_hoy";

interface IndicadorBolitasProps {
    vendido: number;
    meta: number;
    estado: Estado;
    size?: "sm" | "md";
}

const COLOR_BY_ESTADO: Record<Estado, string> = {
    en_ritmo: "#1D9E75",
    empuja: "#EF9F27",
    enfoque_hoy: "#E24B4A",
};

const EMPTY_BG = "#1e293b"; // slate-800
const EMPTY_BORDER = "#475569"; // slate-600

type Bolita = { tipo: "llena" | "parcial" | "vacia"; porcentaje: number };

function calcularBolitas(vendido: number, meta: number): Bolita[] {
    const porcentaje = meta > 0 ? (vendido / meta) * 100 : 0;
    const bolitas: Bolita[] = [];
    for (let i = 0; i < 5; i++) {
        const umbralInicio = i * 20;
        const umbralFin = (i + 1) * 20;
        if (porcentaje >= umbralFin) {
            bolitas.push({ tipo: "llena", porcentaje: 100 });
        } else if (porcentaje > umbralInicio) {
            const llenado = ((porcentaje - umbralInicio) / 20) * 100;
            bolitas.push({ tipo: "parcial", porcentaje: llenado });
        } else {
            bolitas.push({ tipo: "vacia", porcentaje: 0 });
        }
    }
    return bolitas;
}

export default function IndicadorBolitas({
    vendido,
    meta,
    estado,
    size = "md",
}: IndicadorBolitasProps) {
    const bolitas = calcularBolitas(vendido, meta);
    const color = COLOR_BY_ESTADO[estado];
    const dim = size === "sm" ? 10 : 14;
    const gap = size === "sm" ? 4 : 5;

    return (
        <div className="inline-flex items-center" style={{ gap: `${gap}px` }}>
            {bolitas.map((b, idx) => {
                const isFirstEmptyEnfoque =
                    idx === 0 && b.tipo === "vacia" && estado === "enfoque_hoy";
                const baseStyle: React.CSSProperties = {
                    width: `${dim}px`,
                    height: `${dim}px`,
                    borderRadius: "50%",
                    flexShrink: 0,
                };

                if (b.tipo === "llena") {
                    return (
                        <span
                            key={idx}
                            style={{
                                ...baseStyle,
                                background: color,
                                boxShadow: `0 0 0 1px ${color}33`,
                            }}
                        />
                    );
                }

                if (b.tipo === "parcial") {
                    return (
                        <span
                            key={idx}
                            style={{
                                ...baseStyle,
                                background: `linear-gradient(90deg, ${color} ${b.porcentaje}%, ${EMPTY_BG} ${b.porcentaje}%)`,
                                border: `1.5px solid ${EMPTY_BORDER}`,
                            }}
                        />
                    );
                }

                return (
                    <span
                        key={idx}
                        style={{
                            ...baseStyle,
                            background: EMPTY_BG,
                            border: `1.5px solid ${isFirstEmptyEnfoque ? color : EMPTY_BORDER}`,
                        }}
                    />
                );
            })}
        </div>
    );
}
