"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { MenuCategory, MenuCategoryGroup, MenuItem } from "@/types/database";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createCategoryGroup,
  deleteCategoryGroup,
  createMenuItem,
  reorderMenuItems,
} from "@/app/actions/menu";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { SortableMenuItemRow } from "./SortableMenuItemRow";

const UNGROUPED_ID = "__ungrouped__";

export function MenuManager({
  initialCategories,
  initialItems,
  initialGroups,
}: {
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
  initialGroups: MenuCategoryGroup[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGroup, setNewCategoryGroup] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const sensors = useSensors(useSensor(PointerSensor));

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const result = await createCategoryGroup(newGroupName.trim());
    if (result.success) {
      setGroups((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: newGroupName.trim(),
          sort_order: prev.length,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ]);
      setNewGroupName("");
    }
  }

  async function handleDeleteGroup(id: string) {
    const result = await deleteCategoryGroup(id);
    if (result.success) {
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setCategories((prev) =>
        prev.map((c) => (c.group_id === id ? { ...c, group_id: null } : c))
      );
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    const groupId = newCategoryGroup || null;
    const result = await createCategory(newCategoryName.trim(), groupId);
    if (result.success) {
      setCategories((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: newCategoryName.trim(),
          sort_order: prev.length,
          is_active: true,
          group_id: groupId,
        },
      ]);
      setNewCategoryName("");
    }
  }

  async function handleMoveCategoryToGroup(categoryId: string, groupId: string) {
    const nextGroupId = groupId || null;
    const result = await updateCategory(categoryId, { group_id: nextGroupId });
    if (result.success) {
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, group_id: nextGroupId } : c))
      );
    }
  }

  async function handleToggleCategoryActive(cat: MenuCategory) {
    const nextActive = !cat.is_active;
    const result = await updateCategory(cat.id, { is_active: nextActive });
    if (result.success) {
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, is_active: nextActive } : c))
      );
    }
  }

  async function handleDeleteCategory(id: string) {
    const result = await deleteCategory(id);
    if (result.success) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  }

  async function handleAddItem(categoryId: string, name: string, price: number) {
    const result = await createMenuItem({ categoryId, name, price });
    if (result.success && result.data) {
      setItems((prev) => [
        ...prev,
        {
          id: result.data!.id,
          category_id: categoryId,
          name,
          description: null,
          price,
          image_url: null,
          status: "draft",
          source: "manual",
          scan_confidence: null,
          scan_job_id: null,
          sort_order: prev.filter((i) => i.category_id === categoryId).length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    }
  }

  function handleItemChanged(updated: MenuItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleItemDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleDragEnd(categoryId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const categoryItems = items.filter((i) => i.category_id === categoryId);
    const oldIndex = categoryItems.findIndex((i) => i.id === active.id);
    const newIndex = categoryItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(categoryItems, oldIndex, newIndex);

    setItems((prev) => [
      ...prev.filter((i) => i.category_id !== categoryId),
      ...reordered,
    ]);

    await reorderMenuItems(
      reordered.map((item, index) => ({ id: item.id, sort_order: index }))
    );
  }

  return (
    <div>
      <PageHeader title="Menu" description="Organize groups, categories and items." />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">New group (e.g. Food, Drinks)</span>
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
            className="input w-56"
          />
        </label>
        <button onClick={handleCreateGroup} className="btn btn-secondary">
          Add Group
        </button>
      </div>

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">New category name</span>
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g. Starters"
            className="input w-56"
          />
        </label>
        <label className="text-sm">
          <span className="label">Group</span>
          <Select
            value={newCategoryGroup}
            onChange={(e) => setNewCategoryGroup(e.target.value)}
            className="w-48"
          >
            <option value="">Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </label>
        <button onClick={handleCreateCategory} className="btn btn-primary">
          Add Category
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {[...groups, { id: UNGROUPED_ID, name: "Ungrouped", sort_order: Infinity, is_active: true, created_at: "" }]
          .map((group) => {
            const groupCategories = categories
              .filter((c) => (c.group_id ?? UNGROUPED_ID) === group.id)
              .sort((a, b) => a.sort_order - b.sort_order);

            if (groupCategories.length === 0) return null;

            return (
              <section key={group.id}>
                <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <h2 className="text-base font-bold uppercase tracking-wide text-[var(--foreground)]">
                    {group.name}
                  </h2>
                  {group.id !== UNGROUPED_ID && (
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="btn btn-ghost !text-[var(--danger-600)] !px-2 !py-1 text-xs"
                    >
                      Delete group
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-6">
                  {groupCategories.map((cat) => {
                    const categoryItems = items
                      .filter((i) => i.category_id === cat.id)
                      .sort((a, b) => a.sort_order - b.sort_order);

                    return (
                      <CategorySection
                        key={cat.id}
                        category={cat}
                        items={categoryItems}
                        categories={categories}
                        groups={groups}
                        sensors={sensors}
                        onToggleActive={() => handleToggleCategoryActive(cat)}
                        onDelete={() => handleDeleteCategory(cat.id)}
                        onMoveGroup={(groupId) => handleMoveCategoryToGroup(cat.id, groupId)}
                        onAddItem={(name, price) => handleAddItem(cat.id, name, price)}
                        onDragEnd={(e) => handleDragEnd(cat.id, e)}
                        onItemChanged={handleItemChanged}
                        onItemDeleted={handleItemDeleted}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}

function CategorySection({
  category,
  items,
  categories,
  groups,
  sensors,
  onToggleActive,
  onDelete,
  onMoveGroup,
  onAddItem,
  onDragEnd,
  onItemChanged,
  onItemDeleted,
}: {
  category: MenuCategory;
  items: MenuItem[];
  categories: MenuCategory[];
  groups: MenuCategoryGroup[];
  sensors: ReturnType<typeof useSensors>;
  onToggleActive: () => void;
  onDelete: () => void;
  onMoveGroup: (groupId: string) => void;
  onAddItem: (name: string, price: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onItemChanged: (item: MenuItem) => void;
  onItemDeleted: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  return (
    <section className="panel-muted p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[var(--foreground)]">{category.name}</h3>
        <div className="flex items-center gap-2">
          <Select
            value={category.group_id ?? ""}
            onChange={(e) => onMoveGroup(e.target.value)}
            className="!w-40 !py-1.5 !text-xs"
          >
            <option value="">Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <button
            onClick={onToggleActive}
            className={`badge ${category.is_active ? "badge-success" : "badge-neutral"}`}
          >
            {category.is_active ? "Active" : "Hidden"}
          </button>
          <button
            onClick={onDelete}
            className="btn btn-ghost !text-[var(--danger-600)] !px-2 !py-1 text-xs"
          >
            Delete category
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <SortableMenuItemRow
                key={item.id}
                item={item}
                categories={categories}
                onChanged={onItemChanged}
                onDeleted={onItemDeleted}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Item name"
          className="input flex-1 !py-1.5"
        />
        <input
          type="number"
          step="0.01"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          placeholder="Price"
          className="input w-24 !py-1.5"
        />
        <button
          onClick={() => {
            if (!newName || !newPrice) return;
            onAddItem(newName, Number(newPrice));
            setNewName("");
            setNewPrice("");
          }}
          className="btn btn-primary !py-1.5 !text-xs"
        >
          Add
        </button>
      </div>
    </section>
  );
}
