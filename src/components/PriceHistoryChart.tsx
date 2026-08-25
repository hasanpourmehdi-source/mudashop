import type { PriceHistorySummary } from "@/lib/priceHistory";

const W = 620;
const H = 200;
const PAD_X = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 20;

// نمودار خطی ساده‌ی SVG از تاریخچه‌ی قیمت -- بدون کتابخانه. خط روند شرابی،
// خط کمترین/بیشترین نقطه‌چین خاکستری، و خط قیمت فعلی نارنجی. هر نقطه با
// <title> راهنمای مرورگر (تاریخ + قیمت) دارد.
export function PriceHistoryChart({ history }: { history: PriceHistorySummary }) {
  const { points, min, max, current } = history;
  if (points.length < 2) return null;

  const x = (i: number) =>
    PAD_X + (i / (points.length - 1)) * (W - 2 * PAD_X);
  const y = (price: number) =>
    H -
    PAD_BOTTOM -
    ((price - min) / (max - min || 1)) * (H - PAD_TOP - PAD_BOTTOM);

  const line = points.map((p, i) => `${x(i)},${y(p.price)}`).join(" ");

  const fa = (n: number) => n.toLocaleString("fa-IR");
  const dateFa = (iso: string) => new Date(iso).toLocaleDateString("fa-IR");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="نمودار تاریخچه قیمت">
        {/* خط کمترین */}
        <line x1={PAD_X} x2={W - PAD_X} y1={y(min)} y2={y(min)} className="stroke-[var(--color-line)]" strokeDasharray="4 4" strokeWidth="1" />
        <text x={W - PAD_X} y={y(min) - 4} textAnchor="end" className="fill-[var(--color-muted)] text-[10px]">
          کمترین {fa(min)}
        </text>

        {/* خط بیشترین */}
        <line x1={PAD_X} x2={W - PAD_X} y1={y(max)} y2={y(max)} className="stroke-[var(--color-line)]" strokeDasharray="4 4" strokeWidth="1" />
        <text x={W - PAD_X} y={y(max) + 12} textAnchor="end" className="fill-[var(--color-muted)] text-[10px]">
          بیشترین {fa(max)}
        </text>

        {/* خط قیمت فعلی */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={y(current)}
          y2={y(current)}
          stroke="var(--color-ochre)"
          strokeDasharray="6 3"
          strokeWidth="1.5"
        />
        <text x={PAD_X} y={y(current) - 4} className="fill-[var(--color-ochre)] text-[10px] font-bold">
          فعلی {fa(current)}
        </text>

        {/* خط روند */}
        <polyline points={line} fill="none" stroke="var(--color-wine)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* نقطه‌ها */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.price)}
            r="2.6"
            className="fill-white"
            stroke="var(--color-wine)"
            strokeWidth="1.4"
          >
            <title>{`${dateFa(p.at)} — ${fa(p.price)} تومان`}</title>
          </circle>
        ))}

        {/* برچسب‌های اولین و آخرین تاریخ */}
        <text x={PAD_X} y={H - 4} className="fill-[var(--color-muted)] text-[10px]">
          {dateFa(points[0].at)}
        </text>
        <text x={W - PAD_X} y={H - 4} textAnchor="end" className="fill-[var(--color-muted)] text-[10px]">
          {dateFa(points[points.length - 1].at)}
        </text>
      </svg>
      <span className="sr-only">{`بازه قیمت: ${fa(min)} تا ${fa(max)} تومان -- میانگین ${fa(history.avg)} تومان`}</span>
    </div>
  );
}