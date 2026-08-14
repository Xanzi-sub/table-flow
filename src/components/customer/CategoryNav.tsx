"use client";

interface CategoryNavProps {
  categories: { id: string; name: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryNav({ categories, activeId, onSelect }: CategoryNavProps) {
  return (
    <nav className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeId === cat.id
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </nav>
  );
}
