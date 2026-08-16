"use client";

interface CategoryNavProps {
  categories: { id: string; name: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryNav({
  categories,
  activeId,
  onSelect,
}: CategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    <nav
      aria-label="Menu categories"
      className="
        flex items-center gap-2
        overflow-x-auto
        px-4 py-3
        scrollbar-none
        overscroll-x-contain
      "
    >
      {categories.map((category) => {
        const active = activeId === category.id;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-current={active ? "true" : undefined}
            className={`
              relative shrink-0
              rounded-full
              px-4 py-2
              text-[13px]
              font-semibold
              tracking-[-0.01em]
              transition-all duration-200
              active:scale-[0.97]
              ${
                active
                  ? `
                    bg-neutral-950
                    text-white
                    shadow-sm
                  `
                  : `
                    bg-neutral-100
                    text-neutral-500
                    hover:bg-neutral-200
                    hover:text-neutral-800
                  `
              }
            `}
          >
            {category.name}
          </button>
        );
      })}
    </nav>
  );
}