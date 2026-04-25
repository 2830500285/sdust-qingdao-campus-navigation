import type { PlaceCategory } from '../types/navigation'

interface CategoryFilterProps {
  activeCategory: string
  categories: PlaceCategory[]
  onChange: (categoryId: string) => void
}

export function CategoryFilter({
  activeCategory,
  categories,
  onChange,
}: CategoryFilterProps) {
  return (
    <section className="control-card" aria-labelledby="category-title">
      <div className="control-card__header">
        <p className="control-card__eyebrow">分类筛选</p>
        <h2 id="category-title">先锁定场景，再看地图和列表</h2>
      </div>
      <div className="category-filter" role="group" aria-label="地点分类">
        <button
          type="button"
          className={activeCategory === 'all' ? 'chip chip--active' : 'chip'}
          onClick={() => onChange('all')}
        >
          <span className="chip__icon">全</span>
          <span>全部</span>
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={activeCategory === category.id ? 'chip chip--active' : 'chip'}
            onClick={() => onChange(category.id)}
          >
            <span
              aria-hidden="true"
              className="chip__icon"
              style={{ borderColor: category.accent, color: category.accent }}
            >
              {category.icon}
            </span>
            <span>{category.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
