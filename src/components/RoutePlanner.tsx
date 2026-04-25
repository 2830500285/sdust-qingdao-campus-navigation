import type { PlaceRecord } from '../types/navigation'

interface RoutePlannerProps {
  endPlaceId: string
  error: string
  isPlanning: boolean
  places: PlaceRecord[]
  startPlaceId: string
  onClear: () => void
  onEndChange: (placeId: string) => void
  onStartChange: (placeId: string) => void
  onSwap: () => void
}

export function RoutePlanner({
  endPlaceId,
  error,
  isPlanning,
  places,
  startPlaceId,
  onClear,
  onEndChange,
  onStartChange,
  onSwap,
}: RoutePlannerProps) {
  return (
    <section className="control-card route-planner-card" aria-labelledby="planner-title">
      <div className="control-card__header">
        <div>
          <p className="control-card__eyebrow">路线规划</p>
          <h2 id="planner-title">选择起点和终点后自动规划</h2>
        </div>
        <button type="button" className="preview-card__close" onClick={onClear}>
          清空
        </button>
      </div>
      <div className="route-planner-grid">
        <label className="route-planner-field">
          <span>起点</span>
          <select value={startPlaceId} onChange={(event) => onStartChange(event.target.value)}>
            <option value="">请选择起点</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="route-swap-button"
          onClick={onSwap}
          disabled={!startPlaceId && !endPlaceId}
        >
          对调
        </button>
        <label className="route-planner-field">
          <span>终点</span>
          <select value={endPlaceId} onChange={(event) => onEndChange(event.target.value)}>
            <option value="">请选择终点</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="route-planner-status" aria-live="polite">
        {isPlanning
          ? '正在计算路线...'
          : startPlaceId && endPlaceId
            ? '已收到起终点，系统会返回推荐步行路线。'
            : '至少需要选择一个起点和一个终点。'}
      </p>
      {error ? <p className="route-planner-error">{error}</p> : null}
    </section>
  )
}
