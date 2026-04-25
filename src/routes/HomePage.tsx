import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AmapPoiExplorer } from '../components/AmapPoiExplorer'
import { CampusMap } from '../components/CampusMap'
import { CampusOverview } from '../components/CampusOverview'
import { CategoryFilter } from '../components/CategoryFilter'
import { EmptyState } from '../components/EmptyState'
import { PlaceList } from '../components/PlaceList'
import { PlacePreview } from '../components/PlacePreview'
import { RoutePlanner } from '../components/RoutePlanner'
import { RouteSummary } from '../components/RouteSummary'
import { SearchBar } from '../components/SearchBar'
import { campusConfig, campusZones } from '../data/campus'
import { placeCategories } from '../data/categories'
import { places } from '../data/places'
import { requestRoutePlan } from '../lib/api'
import {
  buildMapMarkers,
  buildSearchParams,
  defaultFilters,
  filterPlaces,
  getAvailableZones,
  getPlaceById,
  parseFilters,
} from '../lib/navigation'
import type { FilterState, LivePoiSelection, PlannedRoute } from '../types/navigation'

function updateFilterState(
  currentSearchParams: URLSearchParams,
  nextPatch: Partial<FilterState>,
) {
  const currentFilters = parseFilters(currentSearchParams)
  const nextFilters: FilterState = { ...currentFilters, ...nextPatch }

  if (
    nextPatch.q !== undefined ||
    nextPatch.category !== undefined ||
    nextPatch.zone !== undefined
  ) {
    nextFilters.selected = nextPatch.selected ?? ''
  }

  return buildSearchParams(nextFilters)
}

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [hoveredId, setHoveredId] = useState('')
  const [livePoi, setLivePoi] = useState<LivePoiSelection | null>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null)
  const filters = parseFilters(searchParams)
  const visiblePlaces = filterPlaces(places, filters)
  const displayedPlaceIds = new Set(
    [
      ...visiblePlaces.map((place) => place.id),
      filters.selected,
      filters.start,
      filters.end,
    ].filter(Boolean),
  )
  const displayedPlaces = places.filter((place) => displayedPlaceIds.has(place.id))
  const markers = buildMapMarkers(displayedPlaces)
  const selectedPlace = getPlaceById(places, filters.selected)
  const activePlaceId = hoveredId || selectedPlace?.id || ''
  const knownZones = getAvailableZones(places)

  function applyPatch(nextPatch: Partial<FilterState>) {
    setLivePoi(null)
    setSearchParams(updateFilterState(searchParams, nextPatch), { replace: true })
  }

  function resetFilters() {
    setLivePoi(null)
    setSearchParams(buildSearchParams(defaultFilters), { replace: true })
    setPlannedRoute(null)
    setRouteError('')
  }

  function clearRoute() {
    setLivePoi(null)
    applyPatch({
      start: '',
      end: '',
    })
  }

  function swapRoute() {
    applyPatch({
      start: filters.end,
      end: filters.start,
    })
  }

  useEffect(() => {
    let cancelled = false

    async function runRoutePlan() {
      if (!filters.start || !filters.end) {
        setPlannedRoute(null)
        setRouteError('')
        setIsPlanning(false)
        return
      }

      setIsPlanning(true)
      setRouteError('')

      try {
        const nextRoute = await requestRoutePlan({
          startPlaceId: filters.start,
          endPlaceId: filters.end,
        })

        if (!cancelled) {
          setPlannedRoute(nextRoute)
        }
      } catch (error) {
        if (!cancelled) {
          setPlannedRoute(null)
          setRouteError(error instanceof Error ? error.message : '路线规划失败。')
        }
      } finally {
        if (!cancelled) {
          setIsPlanning(false)
        }
      }
    }

    void runRoutePlan()

    return () => {
      cancelled = true
    }
  }, [filters.end, filters.start])

  return (
    <div className="page-shell">
      <header className="hero-banner">
        <div className="hero-banner__content">
          <p className="hero-banner__eyebrow">Shandong University of Science and Technology</p>
          <h1>山东科技大学青岛校区校内导航</h1>
          <p className="hero-banner__summary">
            现在不仅能查地点，还能选择起点和终点并计算步行路线。当前版本已经把教学组团、宿舍组团和若水园等常用目的地接入到校内步行路网中。
          </p>
        </div>
        <div className="hero-banner__stats">
          <div>
            <strong>首批点位</strong>
            <span>{places.length} 个</span>
          </div>
          <div>
            <strong>覆盖类别</strong>
            <span>{placeCategories.length} 类</span>
          </div>
          <div>
            <strong>当前能力</strong>
            <span>起终点导航</span>
          </div>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="navigation-stage" aria-label="首屏导航区">
          <div className="navigation-stage__panel">
            <RoutePlanner
              endPlaceId={filters.end}
              error={routeError}
              isPlanning={isPlanning}
              places={places}
              startPlaceId={filters.start}
              onClear={clearRoute}
              onEndChange={(placeId) => applyPatch({ end: placeId })}
              onStartChange={(placeId) => applyPatch({ start: placeId })}
              onSwap={swapRoute}
            />
            <RouteSummary places={places} route={plannedRoute} />
            <PlacePreview
              endPlaceId={filters.end}
              filters={filters}
              startPlaceId={filters.start}
              onClose={() => applyPatch({ selected: '' })}
              onEndSelect={(placeId) => applyPatch({ end: placeId })}
              onStartSelect={(placeId) => applyPatch({ start: placeId })}
              place={selectedPlace}
            />
          </div>

          <div className="navigation-stage__map">
            <CampusMap
              activeMarkerId={activePlaceId}
              campus={campusConfig}
              endPlaceId={filters.end}
              livePoi={livePoi}
              markers={markers}
              places={places}
              route={plannedRoute}
              selectedPlaceId={filters.selected}
              startPlaceId={filters.start}
              onMarkerEnter={setHoveredId}
              onMarkerLeave={() => setHoveredId('')}
              onMarkerSelect={(markerId) => applyPatch({ selected: markerId })}
            />
          </div>
        </section>

        <div className="workspace-grid__lower">
          <div className="workspace-grid__main">
            <SearchBar
              count={visiblePlaces.length}
              total={places.length}
              value={filters.q}
              onChange={(nextValue) => applyPatch({ q: nextValue })}
            />
            <AmapPoiExplorer
              campus={campusConfig}
              query={filters.q}
              selectedPoiId={livePoi?.id ?? ''}
              onLocate={setLivePoi}
            />
            <CategoryFilter
              activeCategory={filters.category}
              categories={placeCategories}
              onChange={(categoryId) => applyPatch({ category: categoryId })}
            />
            <CampusOverview
              activeZone={filters.zone}
              campus={campusConfig}
              zones={campusZones}
              onZoneChange={(zoneName) => applyPatch({ zone: zoneName })}
            />
            {visiblePlaces.length ? (
              <PlaceList
                activePlaceId={activePlaceId}
                endPlaceId={filters.end}
                places={visiblePlaces}
                selectedPlaceId={filters.selected}
                startPlaceId={filters.start}
                onPlaceEnter={setHoveredId}
                onPlaceLeave={() => setHoveredId('')}
                onPlaceSelect={(placeId) => applyPatch({ selected: placeId })}
              />
            ) : (
              <EmptyState onReset={resetFilters} />
            )}
          </div>

          <aside className="workspace-grid__aside">
            <section className="support-card" aria-labelledby="support-title">
              <p className="control-card__eyebrow">使用提示</p>
              <h2 id="support-title">当前版本的可用范围</h2>
              <ul>
                <li>本地路网当前支持在 {places.length} 个校内点位之间规划步行路线。</li>
                <li>更多楼宇、学院、餐厅和服务点会通过高德实时地点面板补齐定位。</li>
                <li>路线不是写死的固定模板，而是后端根据路网和起终点实时计算。</li>
                <li>地图会同步高亮起点、终点和推荐路线，方便快速确认方向。</li>
                <li>继续补充节点、边和封路规则后，本地校内路线精度还能进一步提升。</li>
              </ul>
            </section>
            <section className="support-card" aria-labelledby="zone-title">
              <p className="control-card__eyebrow">数据概况</p>
              <h2 id="zone-title">当前路网覆盖</h2>
              <ul>
                <li>已覆盖 {knownZones.length} 个分区主干路线。</li>
                <li>搜索支持楼宇别名、J 楼简称、宿舍编号和若水园等景观关键词。</li>
                <li>替换正式底图后，只需要微调点位和节点坐标，不影响路径算法。</li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
