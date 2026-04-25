import { Link } from 'react-router-dom'

import { getCategoryAccent, getCategoryIcon, getCategoryLabel } from '../lib/navigation'
import type { FilterState, PlaceRecord } from '../types/navigation'

interface PlacePreviewProps {
  endPlaceId: string
  filters: FilterState
  onEndSelect: (placeId: string) => void
  onClose: () => void
  onStartSelect: (placeId: string) => void
  place: PlaceRecord | null
  startPlaceId: string
}

export function PlacePreview({
  endPlaceId,
  filters,
  onEndSelect,
  onClose,
  onStartSelect,
  place,
  startPlaceId,
}: PlacePreviewProps) {
  if (!place) {
    return (
      <aside className="preview-card preview-card--placeholder" aria-live="polite">
        <p className="control-card__eyebrow">地点详情预览</p>
        <h2>点击地图点位或地点列表</h2>
        <p>系统会在这里展示简介、到达建议和直达详情页入口。</p>
      </aside>
    )
  }

  const accent = getCategoryAccent(place.categoryId)
  const searchParams = new URLSearchParams()

  if (filters.q.trim()) {
    searchParams.set('q', filters.q.trim())
  }

  if (filters.category !== 'all') {
    searchParams.set('category', filters.category)
  }

  if (filters.zone !== 'all') {
    searchParams.set('zone', filters.zone)
  }

  if (filters.start) {
    searchParams.set('start', filters.start)
  }

  if (filters.end) {
    searchParams.set('end', filters.end)
  }

  return (
    <aside className="preview-card" aria-label="已选地点详情">
      <div className="preview-card__header">
        <div>
          <p className="control-card__eyebrow">地点详情预览</p>
          <h2>{place.name}</h2>
        </div>
        <button type="button" className="preview-card__close" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="preview-card__badges">
        <span className="preview-card__badge" style={{ borderColor: accent, color: accent }}>
          {getCategoryIcon(place.categoryId)} {getCategoryLabel(place.categoryId)}
        </span>
        <span className="preview-card__badge">{place.zone}</span>
      </div>
      <p className="preview-card__description">{place.description}</p>
      <section className="preview-card__section">
        <h3>抵达建议</h3>
        <p>{place.arrivalTips}</p>
      </section>
      <section className="preview-card__section">
        <h3>检索关键词</h3>
        <div className="preview-card__tags">
          {[...place.aliases, ...place.keywords].slice(0, 6).map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      </section>
      <div className="preview-card__actions">
        <button
          type="button"
          className={startPlaceId === place.id ? 'preview-card__action preview-card__action--active' : 'preview-card__action'}
          onClick={() => onStartSelect(place.id)}
        >
          设为起点
        </button>
        <button
          type="button"
          className={endPlaceId === place.id ? 'preview-card__action preview-card__action--active' : 'preview-card__action'}
          onClick={() => onEndSelect(place.id)}
        >
          设为终点
        </button>
      </div>
      <Link
        className="preview-card__link"
        to={`/place/${place.id}${searchParams.size ? `?${searchParams.toString()}` : ''}`}
      >
        进入详情页
      </Link>
    </aside>
  )
}
