"use client";

interface CategoryNavProps {
  categories: { id: string; name: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryNav({ categories, activeId, onSelect }: CategoryNavProps) {
  return (
    <nav className="flex gap-2 overflow-x-auto px-4 py-3">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
            activeId === cat.id
              ? "bg-[#171614] text-white"
              : "bg-[#f1eee9] text-[#77736d] hover:bg-[#e7e2da]"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </nav>
  );
}
