export type FloatingGift = { id: number; emoji: string; name: string; from: string };

type Props = { gifts: FloatingGift[] };

export default function GiftAnimation({ gifts }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-live="polite" aria-label="Recent gifts">
      {gifts.map((gift, index) => (
        <div
          key={gift.id}
          className="absolute flex flex-col items-center"
          style={{
            bottom: "60px",
            left: `${20 + (index % 5) * 15}%`,
            animation: "floatUp 2.5s ease-out forwards",
          }}
        >
          <span className="text-4xl drop-shadow-lg" aria-hidden="true">{gift.emoji}</span>
          <span className="mt-1 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-xs text-white/80">
            {gift.from} · {gift.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export { GiftAnimation };
