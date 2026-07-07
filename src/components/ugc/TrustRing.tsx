export default function TrustRing({ score, size = 44 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const center = size / 2;

  return (
    <div className="inline-flex items-center gap-2">
      <svg width={size} height={size}>
        <circle cx={center} cy={center} r={radius} stroke="#ECE7FB" strokeWidth={4} fill="none" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#17A673"
          strokeWidth={4}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="text-sm font-bold">{score}%</span>
    </div>
  );
}
