import { useEffect, useMemo, useRef, useState } from 'react'

import type { CampusConfig, LivePoiSelection, PlaceRecord } from '../types/navigation'

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode?: string
      serviceHost?: string
    }
  }
}

type LngLatTuple = [number, number]

interface AmapPoiRecord {
  location?: unknown
}

interface AmapPoiResult {
  poiList?: {
    pois?: AmapPoiRecord[]
  }
}

interface AmapWalkingResult {
  routes?: unknown[]
}

interface AmapMarkerInstance {
  setMap: (map: AmapMapInstance | null) => void
}

interface AmapPlaceSearchInstance {
  search: (
    keyword: string,
    callback: (status: string, result: AmapPoiResult) => void,
  ) => void
}

interface AmapWalkingInstance {
  search: (
    start: LngLatTuple,
    end: LngLatTuple,
    callback: (status: string, result: AmapWalkingResult) => void,
  ) => void
  clear?: () => void
}

interface AmapMapInstance {
  addControl: (control: unknown) => void
  setCenter: (center: LngLatTuple) => void
  setZoom: (zoom: number) => void
  destroy?: () => void
}

interface AmapNamespace {
  Map: new (
    container: HTMLDivElement,
    options: Record<string, unknown>,
  ) => AmapMapInstance
  Scale: new () => unknown
  ToolBar: new (options?: Record<string, unknown>) => unknown
  MapType: new (options?: Record<string, unknown>) => unknown
  Geolocation: new (options?: Record<string, unknown>) => unknown
  PlaceSearch: new (options?: Record<string, unknown>) => AmapPlaceSearchInstance
  Walking: new (options?: Record<string, unknown>) => AmapWalkingInstance
  Marker: new (options?: Record<string, unknown>) => AmapMarkerInstance
}

const DEFAULT_CENTER: LngLatTuple = [120.12043, 36.001796]
const DEFAULT_ZOOM = 16
const CAMPUS_MAX_DISTANCE_METERS = 3200

interface AmapLiveMapProps {
  campus: CampusConfig
  endPlaceId: string
  livePoi: LivePoiSelection | null
  places: PlaceRecord[]
  selectedPlaceId: string
  startPlaceId: string
}

function toLngLatTuple(value: unknown): LngLatTuple | null {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    return [value[0], value[1]]
  }

  if (
    value &&
    typeof value === 'object' &&
    'lng' in value &&
    'lat' in value &&
    typeof value.lng === 'number' &&
    typeof value.lat === 'number'
  ) {
    return [value.lng, value.lat]
  }

  return null
}

function haversineDistance(from: LngLatTuple, to: LngLatTuple) {
  const earthRadius = 6_371_000
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRadians(to[1] - from[1])
  const dLng = toRadians(to[0] - from[0])
  const lat1 = toRadians(from[1])
  const lat2 = toRadians(to[1])

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

function getCampusQueries(campus: CampusConfig) {
  return [
    campus.name,
    `${campus.name}${campus.city}`,
    `${campus.name} ${campus.city}`,
    `${campus.city}${campus.name}`,
  ]
}

function getPlaceQueries(campus: CampusConfig, place: PlaceRecord) {
  const candidates = [
    `${campus.name}${place.name}`,
    `${campus.name} ${place.name}`,
    `${place.name}${campus.name}`,
    `${campus.city}${place.name}`,
    place.name,
    ...place.aliases.map((alias) => `${campus.name}${alias}`),
    ...place.aliases,
  ]

  return Array.from(new Set(candidates.map((value) => value.trim()).filter(Boolean)))
}

export function AmapLiveMap({
  campus,
  endPlaceId,
  livePoi,
  places,
  selectedPlaceId,
  startPlaceId,
}: AmapLiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<AmapMapInstance | null>(null)
  const AMapRef = useRef<AmapNamespace | null>(null)
  const placeSearchRef = useRef<AmapPlaceSearchInstance | null>(null)
  const walkingRef = useRef<AmapWalkingInstance | null>(null)
  const overlaysRef = useRef<AmapMarkerInstance[]>([])
  const campusCenterRef = useRef<LngLatTuple>(DEFAULT_CENTER)
  const placeCacheRef = useRef(new Map<string, LngLatTuple>())
  const [status, setStatus] = useState('正在等待高德实景地图初始化。')
  const [error, setError] = useState('')

  const keyedPlaces = useMemo(
    () => Object.fromEntries(places.map((place) => [place.id, place])),
    [places],
  )

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const amapKey = import.meta.env.VITE_AMAP_JSAPI_KEY
      const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE

      if (!amapKey || !securityJsCode) {
        setError('当前环境未配置高德地图前端凭据，无法加载实景底图。')
        setStatus('请在本地 `.env.local` 中补充高德 JSAPI 凭据。')
        return
      }

      if (!containerRef.current) {
        return
      }

      try {
        const { default: AMapLoader } = await import('@amap/amap-jsapi-loader')

        window._AMapSecurityConfig = {
          securityJsCode,
        }

        const AMap = (await AMapLoader.load({
          key: amapKey,
          version: '2.0',
          plugins: [
            'AMap.Scale',
            'AMap.ToolBar',
            'AMap.MapType',
            'AMap.PlaceSearch',
            'AMap.Geolocation',
            'AMap.Walking',
          ],
        })) as AmapNamespace

        if (cancelled || !containerRef.current) {
          return
        }

        const map = new AMap.Map(containerRef.current, {
          viewMode: '3D',
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          mapStyle: 'amap://styles/normal',
        })

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: 'RB' }))
        map.addControl(new AMap.MapType({ position: 'RT' }))
        map.addControl(
          new AMap.Geolocation({
            position: 'LB',
            showCircle: true,
            showMarker: true,
          }),
        )

        const placeSearch = new AMap.PlaceSearch({
          city: '青岛市',
          pageSize: 8,
          pageIndex: 1,
          citylimit: false,
          autoFitView: false,
        })

        AMapRef.current = AMap
        mapRef.current = map
        placeSearchRef.current = placeSearch
        walkingRef.current = new AMap.Walking({
          map,
          hideMarkers: true,
          autoFitView: true,
        })

        for (const query of getCampusQueries(campus)) {
          const center = await new Promise<LngLatTuple | null>((resolve) => {
            placeSearch.search(query, (searchStatus: string, result: AmapPoiResult) => {
              if (searchStatus !== 'complete' || !result?.poiList?.pois?.length) {
                resolve(null)
                return
              }

              resolve(toLngLatTuple(result.poiList.pois[0].location))
            })
          })

          if (center) {
            campusCenterRef.current = center
            map.setCenter(center)
            map.setZoom(DEFAULT_ZOOM)
            break
          }
        }

        setError('')
        setStatus('高德实景已就绪，可查看真实底图、定位与路线叠加。')
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '高德地图加载失败。')
        setStatus('高德地图初始化失败，请检查本地凭据或网络状态。')
      }
    }

    void initMap()

    return () => {
      cancelled = true
      overlaysRef.current.forEach((overlay) => overlay?.setMap?.(null))
      overlaysRef.current = []
      walkingRef.current?.clear?.()
      mapRef.current?.destroy?.()
      mapRef.current = null
    }
  }, [campus])

  useEffect(() => {
    let cancelled = false

    async function updateScene() {
      if (!mapRef.current || !placeSearchRef.current || !AMapRef.current) {
        return
      }

      function clearOverlays() {
        overlaysRef.current.forEach((overlay) => overlay?.setMap?.(null))
        overlaysRef.current = []
        walkingRef.current?.clear?.()
      }

      function addMarker(
        position: LngLatTuple,
        title: string,
        labelClassName = 'amap-live-label',
        labelPrefix = '',
      ) {
        const marker = new AMapRef.current!.Marker({
          position,
          title,
          label: {
            content: `<div class="${labelClassName}">${labelPrefix}${title}</div>`,
          },
        })

        overlaysRef.current.push(marker)
        marker.setMap(mapRef.current)
      }

      async function searchKeyword(keyword: string) {
        return await new Promise<AmapPoiRecord[]>((resolve) => {
          placeSearchRef.current?.search(keyword, (searchStatus: string, result: AmapPoiResult) => {
            if (searchStatus !== 'complete' || !result?.poiList?.pois?.length) {
              resolve([])
              return
            }

            resolve(result.poiList.pois)
          })
        })
      }

      async function resolvePlaceLocation(place: PlaceRecord) {
        const cached = placeCacheRef.current.get(place.id)

        if (cached) {
          return cached
        }

        for (const query of getPlaceQueries(campus, place)) {
          const pois = await searchKeyword(query)
          const candidates = pois
            .map((poi) => toLngLatTuple(poi.location))
            .filter((value): value is LngLatTuple => value !== null)

          if (!candidates.length) {
            continue
          }

          const nearby = candidates
            .map((candidate) => ({
              candidate,
              distance: haversineDistance(campusCenterRef.current, candidate),
            }))
            .sort((left, right) => left.distance - right.distance)

          const bestCandidate =
            nearby.find((item) => item.distance <= CAMPUS_MAX_DISTANCE_METERS)?.candidate ??
            candidates[0]

          placeCacheRef.current.set(place.id, bestCandidate)
          return bestCandidate
        }

        return null
      }

      clearOverlays()
      setError('')

      const startPlace = keyedPlaces[startPlaceId]
      const endPlace = keyedPlaces[endPlaceId]
      const selectedPlace = keyedPlaces[selectedPlaceId]

      if (livePoi) {
        const location: LngLatTuple = [livePoi.lng, livePoi.lat]
        addMarker(location, livePoi.name)
        mapRef.current.setCenter(location)
        mapRef.current.setZoom(18)
        setStatus(`已在高德实景中定位 ${livePoi.name}。`)
        return
      }

      if (startPlace && endPlace) {
        setStatus('正在尝试用高德实景查询这两个校内点位的真实位置。')

        const [startLocation, endLocation] = await Promise.all([
          resolvePlaceLocation(startPlace),
          resolvePlaceLocation(endPlace),
        ])

        if (cancelled) {
          return
        }

        if (!startLocation || !endLocation) {
          setError('高德地图暂未准确识别这组校内点位，仍可继续使用本地路网路线。')
          setStatus('真实底图已加载，但这条校内路线仍建议以本地路网结果为准。')
          return
        }

        addMarker(startLocation, startPlace.name, 'amap-live-label', '起 ')
        addMarker(endLocation, endPlace.name, 'amap-live-label amap-live-label--end', '终 ')

        setStatus('高德地图正在规划真实步行路线。')

        walkingRef.current?.search(
          startLocation,
          endLocation,
          (searchStatus: string, result: AmapWalkingResult) => {
            if (cancelled) {
              return
            }

            if (searchStatus === 'complete' && result?.routes?.length) {
              setStatus('高德实景步行路线已生成，可与本地路网路线对照查看。')
              return
            }

            setError('高德地图未返回可用步行路线，可能因为校内道路未完整收录。')
            setStatus('当前仍建议以本地路网中的校内步行路线为主。')
          },
        )

        return
      }

      if (selectedPlace) {
        setStatus(`正在高德实景中定位 ${selectedPlace.name}。`)
        const location = await resolvePlaceLocation(selectedPlace)

        if (cancelled) {
          return
        }

        if (!location) {
          setError(`高德地图暂未精确识别 ${selectedPlace.name}，可以继续参考本地路网图。`)
          setStatus('高德实景已加载，但当前点位未成功匹配。')
          return
        }

        addMarker(location, selectedPlace.name)
        mapRef.current.setCenter(location)
        mapRef.current.setZoom(17)
        setStatus(`已在高德实景中定位 ${selectedPlace.name}。`)
        return
      }

      mapRef.current.setCenter(campusCenterRef.current)
      mapRef.current.setZoom(DEFAULT_ZOOM)
      setStatus('高德实景已加载，可切换起终点、点击本地点位或实时地点进行查看。')
    }

    void updateScene()

    return () => {
      cancelled = true
    }
  }, [campus, endPlaceId, keyedPlaces, livePoi, selectedPlaceId, startPlaceId])

  return (
    <div className="amap-panel">
      <div ref={containerRef} className="amap-panel__container" aria-label="高德实景地图" />
      <div className="amap-panel__status" aria-live="polite">
        <strong>高德实景</strong>
        <p>{status}</p>
        {error ? <p className="amap-panel__error">{error}</p> : null}
      </div>
    </div>
  )
}
