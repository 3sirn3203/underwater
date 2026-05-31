import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as L from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import {
  BarChart2,
  Check,
  ChevronDown,
  Cpu,
  Droplet,
  Filter,
  Info,
  MapPin,
  RefreshCw,
  Search,
  Sliders,
  X,
} from 'lucide-react';
import modelConfig from './model/model_config.json';
import { predictSuitability } from './model/predict';

interface Well {
  id: number;
  name: string;
  prov: string;
  city: string;
  town: string;
  lat: number;
  lng: number;
  is_dev: number;
  prob: number;
  pred: number;
  depth: number;
  drought: number;
  pump: number;
  nat_lvl: number;
  stab_lvl: number;
  storage: number;
  wq_type: number;
  hydro: string;
  aquifer: string;
}

interface PredictInput {
  hydrogeology: string;
  aquifer: string;
  water_quality_type: string;
  mean_well_depth: number;
  drought_vulnerability: number;
  mean_pumped_volume_per_day: number;
  mean_natural_water_level: number;
  mean_stable_water_level: number;
  mean_storage_coef: number;
}

interface ImpactRow {
  key: keyof PredictInput;
  label: string;
  unit: string;
  delta: number;
  baselineText: string;
}

type LoadState = 'loading' | 'ready' | 'error';
type SuitabilityFilter = 'all' | 'suitable' | 'unsuitable' | 'actual-suitable' | 'unknown';
type DisplayMode = 'density' | 'priority' | 'points';
type FilterDropdownId = 'province' | 'suitability';

interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
  count: number;
  suitable: number;
  actualSuitable: number;
  avgProb: number;
  maxProb: number;
  label: string;
}

interface DropdownOption<T extends string> {
  value: T;
  label: string;
  meta?: string;
}

const DATA_URL = '/data/wells_data.json';
const INITIAL_CENTER: [number, number] = [36.25, 127.85];
const INITIAL_ZOOM = 7;
const OHE_CATEGORIES = modelConfig.ohe_categories as string[][];
const NUMERICAL_MEANS = modelConfig.scaler_mean as number[];

const DEFAULT_INPUT: PredictInput = {
  hydrogeology: 'f',
  aquifer: '충적',
  water_quality_type: '0',
  mean_well_depth: Math.round(NUMERICAL_MEANS[0]),
  drought_vulnerability: 3,
  mean_pumped_volume_per_day: Math.round(NUMERICAL_MEANS[2]),
  mean_natural_water_level: Math.round(NUMERICAL_MEANS[3]),
  mean_stable_water_level: Math.round(NUMERICAL_MEANS[4]),
  mean_storage_coef: 1,
};

const FILTER_OPTIONS: Array<{ value: SuitabilityFilter; label: string }> = [
  { value: 'all', label: '전체 후보지' },
  { value: 'suitable', label: '적합 예측' },
  { value: 'unsuitable', label: '부적합 예측' },
  { value: 'actual-suitable', label: '실제 적합 라벨' },
  { value: 'unknown', label: '미판정 예측 대상' },
];

const FILTER_META: Record<SuitabilityFilter, string> = {
  all: '모든 후보 표시',
  suitable: '모델이 적합으로 본 지점',
  unsuitable: '모델이 부적합으로 본 지점',
  'actual-suitable': '라벨 데이터 기준',
  unknown: '예측 대상 미라벨 지점',
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function getLabelText(well: Well) {
  if (well.is_dev === 1) return '실제 적합';
  if (well.is_dev === 0) return '실제 부적합';
  return well.pred === 1 ? '예측 적합' : '예측 부적합';
}

function getMarkerStyle(well: Well): L.CircleMarkerOptions {
  if (well.is_dev === 1) {
    return { color: '#047857', fillColor: '#10b981', fillOpacity: 0.86, weight: 1.2 };
  }

  if (well.is_dev === 0) {
    return { color: '#dc2626', fillColor: '#fb7185', fillOpacity: 0.8, weight: 1.1 };
  }

  if (well.prob >= 0.7) {
    return { color: '#0f766e', fillColor: '#2dd4bf', fillOpacity: 0.78, weight: 0.7 };
  }

  if (well.prob >= 0.5) {
    return { color: '#0891b2', fillColor: '#67e8f9', fillOpacity: 0.72, weight: 0.65 };
  }

  if (well.prob >= 0.3) {
    return { color: '#d97706', fillColor: '#fbbf24', fillOpacity: 0.62, weight: 0.55 };
  }

  return { color: '#e11d48', fillColor: '#fda4af', fillOpacity: 0.56, weight: 0.5 };
}

function getPointRadius(zoom: number) {
  if (zoom >= 12) return 6;
  if (zoom >= 10) return 4.6;
  if (zoom >= 8) return 3.4;
  return 2.6;
}

function getDisplayMode(zoom: number, filteredCount: number): DisplayMode {
  if (zoom >= 11 || filteredCount <= 1800) return 'points';
  if (zoom >= 8) return 'priority';
  return 'density';
}

function getDisplayModeLabel(mode: DisplayMode) {
  if (mode === 'density') return '밀도 집계';
  if (mode === 'priority') return '중요 후보';
  return '개별 지점';
}

function getClusterBinSize(zoom: number) {
  if (zoom < 7) return 0.58;
  return 0.36;
}

function getPriorityBinSize(zoom: number) {
  if (zoom < 9) return 0.1;
  return 0.065;
}

function isPriorityWell(well: Well) {
  return well.pred === 1 || well.is_dev !== -1 || well.prob >= 0.45;
}

function getCellKey(lat: number, lng: number, binSize: number) {
  return `${Math.floor(lat / binSize)}:${Math.floor(lng / binSize)}`;
}

function buildClusterPoints(wells: Well[], zoom: number): ClusterPoint[] {
  const binSize = getClusterBinSize(zoom);
  const buckets = new Map<
    string,
    {
      latSum: number;
      lngSum: number;
      probSum: number;
      count: number;
      suitable: number;
      actualSuitable: number;
      maxProb: number;
      label: string;
    }
  >();

  wells.forEach((well) => {
    const key = getCellKey(well.lat, well.lng, binSize);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.latSum += well.lat;
      bucket.lngSum += well.lng;
      bucket.probSum += well.prob;
      bucket.count += 1;
      bucket.suitable += well.pred === 1 ? 1 : 0;
      bucket.actualSuitable += well.is_dev === 1 ? 1 : 0;
      if (well.prob > bucket.maxProb) {
        bucket.maxProb = well.prob;
        bucket.label = [well.prov, well.city].filter(Boolean).join(' ');
      }
      return;
    }

    buckets.set(key, {
      latSum: well.lat,
      lngSum: well.lng,
      probSum: well.prob,
      count: 1,
      suitable: well.pred === 1 ? 1 : 0,
      actualSuitable: well.is_dev === 1 ? 1 : 0,
      maxProb: well.prob,
      label: [well.prov, well.city].filter(Boolean).join(' '),
    });
  });

  return Array.from(buckets.entries()).map(([id, bucket]) => ({
    id,
    lat: bucket.latSum / bucket.count,
    lng: bucket.lngSum / bucket.count,
    count: bucket.count,
    suitable: bucket.suitable,
    actualSuitable: bucket.actualSuitable,
    avgProb: bucket.probSum / bucket.count,
    maxProb: bucket.maxProb,
    label: bucket.label,
  }));
}

function buildPriorityWells(wells: Well[], zoom: number) {
  const binSize = getPriorityBinSize(zoom);
  const selected = new Map<number, Well>();
  const representativeByCell = new Map<string, Well>();

  wells.forEach((well) => {
    if (isPriorityWell(well)) {
      selected.set(well.id, well);
      return;
    }

    const key = getCellKey(well.lat, well.lng, binSize);
    const current = representativeByCell.get(key);
    if (!current || well.prob > current.prob) {
      representativeByCell.set(key, well);
    }
  });

  representativeByCell.forEach((well) => {
    if (!selected.has(well.id)) {
      selected.set(well.id, well);
    }
  });

  return Array.from(selected.values()).sort((a, b) => b.prob - a.prob);
}

function getClusterStyle(cluster: ClusterPoint): L.CircleMarkerOptions {
  const ratio = cluster.count > 0 ? cluster.suitable / cluster.count : 0;
  const radius = Math.max(8, Math.min(28, 6 + Math.sqrt(cluster.count) * 1.15));

  if (ratio >= 0.35 || cluster.maxProb >= 0.7) {
    return {
      radius,
      color: '#047857',
      fillColor: '#10b981',
      fillOpacity: 0.38,
      weight: 1.3,
    };
  }

  if (ratio >= 0.12 || cluster.maxProb >= 0.5) {
    return {
      radius,
      color: '#0891b2',
      fillColor: '#67e8f9',
      fillOpacity: 0.34,
      weight: 1.2,
    };
  }

  return {
    radius,
    color: '#d97706',
    fillColor: '#fbbf24',
    fillOpacity: 0.3,
    weight: 1,
  };
}

function buildTooltipHtml(well: Well) {
  const location = [well.prov, well.city, well.town].filter(Boolean).join(' ');
  return `
    <div class="well-tooltip-card">
      <div class="well-tooltip-title">${escapeHtml(well.name || `후보지 #${well.id}`)}</div>
      <div class="well-tooltip-location">${escapeHtml(location)}</div>
      <div class="well-tooltip-meta">
        <span>${escapeHtml(getLabelText(well))}</span>
        <strong>${formatPercent(well.prob)}</strong>
      </div>
    </div>
  `;
}

function buildClusterTooltipHtml(cluster: ClusterPoint) {
  const suitableRatio = cluster.count > 0 ? cluster.suitable / cluster.count : 0;

  return `
    <div class="well-tooltip-card">
      <div class="well-tooltip-title">${escapeHtml(cluster.label || '집계 영역')}</div>
      <div class="well-tooltip-location">${cluster.count.toLocaleString()}개 후보지 집계</div>
      <div class="well-tooltip-meta">
        <span>적합 예측 ${cluster.suitable.toLocaleString()}개</span>
        <strong>${formatPercent(suitableRatio)}</strong>
      </div>
      <div class="well-tooltip-note">평균 ${formatPercent(cluster.avgProb)} · 최고 ${formatPercent(cluster.maxProb)}</div>
    </div>
  `;
}

function getInputFromWell(well: Well): PredictInput {
  return {
    hydrogeology: well.hydro || DEFAULT_INPUT.hydrogeology,
    aquifer: well.aquifer || DEFAULT_INPUT.aquifer,
    water_quality_type: String(well.wq_type),
    mean_well_depth: Math.round(well.depth),
    drought_vulnerability: well.drought || DEFAULT_INPUT.drought_vulnerability,
    mean_pumped_volume_per_day: Math.round(well.pump),
    mean_natural_water_level: Math.round(well.nat_lvl),
    mean_stable_water_level: Math.round(well.stab_lvl),
    mean_storage_coef: well.storage,
  };
}

function calculateImpactRows(input: PredictInput, probability: number): ImpactRow[] {
  const baselines: Array<{
    key: keyof PredictInput;
    label: string;
    unit: string;
    value: string | number;
    baselineText: string;
  }> = [
    { key: 'hydrogeology', label: '수문지질', unit: '', value: DEFAULT_INPUT.hydrogeology, baselineText: DEFAULT_INPUT.hydrogeology },
    { key: 'aquifer', label: '대수층', unit: '', value: DEFAULT_INPUT.aquifer, baselineText: `${DEFAULT_INPUT.aquifer}층` },
    { key: 'water_quality_type', label: '수질 군집', unit: '', value: DEFAULT_INPUT.water_quality_type, baselineText: `유형 ${DEFAULT_INPUT.water_quality_type}` },
    { key: 'mean_well_depth', label: '관정 깊이', unit: 'm', value: NUMERICAL_MEANS[0], baselineText: `${formatNumber(NUMERICAL_MEANS[0])} m` },
    { key: 'drought_vulnerability', label: '가뭄 등급', unit: '등급', value: NUMERICAL_MEANS[1], baselineText: `${formatNumber(NUMERICAL_MEANS[1])} 등급` },
    { key: 'mean_pumped_volume_per_day', label: '평균 양수량', unit: 'm³/d', value: NUMERICAL_MEANS[2], baselineText: `${formatNumber(NUMERICAL_MEANS[2])} m³/d` },
    { key: 'mean_natural_water_level', label: '자연수위', unit: 'm', value: NUMERICAL_MEANS[3], baselineText: `${formatNumber(NUMERICAL_MEANS[3])} m` },
    { key: 'mean_stable_water_level', label: '안정수위', unit: 'm', value: NUMERICAL_MEANS[4], baselineText: `${formatNumber(NUMERICAL_MEANS[4])} m` },
    { key: 'mean_storage_coef', label: '저류계수 측정', unit: '', value: NUMERICAL_MEANS[5], baselineText: `평균 ${formatNumber(NUMERICAL_MEANS[5])}` },
  ];

  return baselines
    .map((baseline) => {
      const mutedInput = { ...input, [baseline.key]: baseline.value } as PredictInput;
      const mutedProbability = predictSuitability(mutedInput).probability;
      return {
        key: baseline.key,
        label: baseline.label,
        unit: baseline.unit,
        delta: probability - mutedProbability,
        baselineText: baseline.baselineText,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function ChangeView({ selectedWell }: { selectedWell: Well | null }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedWell) return;
    map.flyTo([selectedWell.lat, selectedWell.lng], Math.max(map.getZoom(), 12), {
      animate: true,
      duration: 0.85,
    });
  }, [map, selectedWell]);

  return null;
}

function MapZoomReporter({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function FilterDropdown<T extends string>({
  id,
  label,
  icon,
  value,
  options,
  openDropdown,
  onOpenChange,
  onChange,
}: {
  id: FilterDropdownId;
  label: string;
  icon: ReactNode;
  value: T;
  options: DropdownOption<T>[];
  openDropdown: FilterDropdownId | null;
  onOpenChange: (id: FilterDropdownId | null) => void;
  onChange: (value: T) => void;
}) {
  const isOpen = openDropdown === id;
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const buttonId = `${id}-dropdown-button`;
  const listboxId = `${id}-dropdown-listbox`;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className={`dropdown-shell ${isOpen ? 'is-open' : ''}`} ref={rootRef}>
      <button
        id={buttonId}
        type="button"
        className="dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => onOpenChange(isOpen ? null : id)}
      >
        <span className="dropdown-icon">{icon}</span>
        <span className="dropdown-copy">
          <span>{label}</span>
          <strong>{selectedOption.label}</strong>
        </span>
        <ChevronDown size={16} className="dropdown-chevron" />
      </button>

      {isOpen && (
        <div className="dropdown-menu" role="listbox" id={listboxId} aria-labelledby={buttonId}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={`dropdown-option ${selected ? 'is-selected' : ''}`}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(null);
                }}
              >
                <span className="option-text">
                  <strong>{option.label}</strong>
                  {option.meta && <small>{option.meta}</small>}
                </span>
                {selected && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClusterCanvasLayer({ clusters }: { clusters: ClusterPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (clusters.length === 0) return;

    const renderer = L.canvas({ padding: 0.5 });
    const layerGroup = L.layerGroup().addTo(map);

    clusters.forEach((cluster) => {
      const marker = L.circleMarker([cluster.lat, cluster.lng], {
        ...getClusterStyle(cluster),
        renderer,
        bubblingMouseEvents: false,
      });

      marker.bindTooltip(buildClusterTooltipHtml(cluster), {
        className: 'well-tooltip-shell',
        direction: 'top',
        opacity: 1,
        offset: L.point(0, -12),
        sticky: true,
      });

      marker.on('click', () => {
        map.flyTo([cluster.lat, cluster.lng], Math.max(map.getZoom() + 2, 9), {
          animate: true,
          duration: 0.7,
        });
      });

      marker.addTo(layerGroup);
    });

    return () => {
      layerGroup.remove();
      renderer.remove();
    };
  }, [clusters, map]);

  return null;
}

function WellCanvasLayer({
  wells,
  onSelect,
}: {
  wells: Well[];
  onSelect: (well: Well) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (wells.length === 0) return;

    const renderer = L.canvas({ padding: 0.5 });
    const layerGroup = L.layerGroup().addTo(map);
    const radius = getPointRadius(map.getZoom());

    wells.forEach((well) => {
      const marker = L.circleMarker([well.lat, well.lng], {
        ...getMarkerStyle(well),
        radius,
        renderer,
        bubblingMouseEvents: false,
      });

      marker.bindTooltip(buildTooltipHtml(well), {
        className: 'well-tooltip-shell',
        direction: 'top',
        opacity: 1,
        offset: L.point(0, -8),
        sticky: true,
      });

      marker.on('click', () => onSelect(well));
      marker.addTo(layerGroup);
    });

    const handleZoomEnd = () => {
      const nextRadius = getPointRadius(map.getZoom());
      layerGroup.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
          layer.setRadius(nextRadius);
        }
      });
    };

    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('zoomend', handleZoomEnd);
      layerGroup.remove();
      renderer.remove();
    };
  }, [map, onSelect, wells]);

  return null;
}

export default function App() {
  const [wells, setWells] = useState<Well[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('전체');
  const [suitabilityFilter, setSuitabilityFilter] = useState<SuitabilityFilter>('all');
  const [input, setInput] = useState<PredictInput>(DEFAULT_INPUT);
  const [mapZoom, setMapZoom] = useState(INITIAL_ZOOM);
  const [openDropdown, setOpenDropdown] = useState<FilterDropdownId | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWells() {
      try {
        setLoadState('loading');
        const response = await fetch(DATA_URL);
        if (!response.ok) {
          throw new Error(`데이터 요청 실패: ${response.status}`);
        }

        const data = (await response.json()) as Well[];
        if (!Array.isArray(data)) {
          throw new Error('관정 데이터 형식이 올바르지 않습니다.');
        }

        if (!cancelled) {
          setWells(data);
          setLoadState('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '알 수 없는 로딩 오류');
          setLoadState('error');
        }
      }
    }

    loadWells();

    return () => {
      cancelled = true;
    };
  }, []);

  const provinceOptions = useMemo<DropdownOption<string>[]>(() => {
    const counts = new Map<string, number>();
    wells.forEach((well) => {
      if (!well.prov) return;
      counts.set(well.prov, (counts.get(well.prov) ?? 0) + 1);
    });

    return [
      { value: '전체', label: '전국', meta: `${wells.length.toLocaleString()}개 후보` },
      ...Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'ko'))
        .map(([province, count]) => ({
          value: province,
          label: province,
          meta: `${count.toLocaleString()}개 후보`,
        })),
    ];
  }, [wells]);

  const suitabilityOptions = useMemo<DropdownOption<SuitabilityFilter>[]>(
    () =>
      FILTER_OPTIONS.map((option) => ({
        ...option,
        meta: FILTER_META[option.value],
      })),
    [],
  );

  const filteredWells = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return wells.filter((well) => {
      const searchable = `${well.name} ${well.prov} ${well.city} ${well.town}`.toLowerCase();
      const matchesSearch = query.length === 0 || searchable.includes(query);
      const matchesProvince = provinceFilter === '전체' || well.prov === provinceFilter;

      let matchesSuitability = true;
      if (suitabilityFilter === 'suitable') matchesSuitability = well.pred === 1;
      if (suitabilityFilter === 'unsuitable') matchesSuitability = well.pred === 0;
      if (suitabilityFilter === 'actual-suitable') matchesSuitability = well.is_dev === 1;
      if (suitabilityFilter === 'unknown') matchesSuitability = well.is_dev === -1;

      return matchesSearch && matchesProvince && matchesSuitability;
    });
  }, [provinceFilter, searchQuery, suitabilityFilter, wells]);

  const stats = useMemo(() => {
    const suitable = filteredWells.filter((well) => well.pred === 1).length;
    const actualSuitable = filteredWells.filter((well) => well.is_dev === 1).length;
    const unknown = filteredWells.filter((well) => well.is_dev === -1).length;

    return {
      total: wells.length,
      visible: filteredWells.length,
      suitable,
      actualSuitable,
      unknown,
      suitableRatio: filteredWells.length > 0 ? suitable / filteredWells.length : 0,
    };
  }, [filteredWells, wells.length]);

  const mapVisual = useMemo(() => {
    const mode = getDisplayMode(mapZoom, filteredWells.length);

    if (mode === 'density') {
      const clusters = buildClusterPoints(filteredWells, mapZoom);
      return {
        mode,
        clusters,
        points: [] as Well[],
        displayedCount: clusters.length,
        representedCount: filteredWells.length,
      };
    }

    if (mode === 'priority') {
      const points = buildPriorityWells(filteredWells, mapZoom);
      return {
        mode,
        clusters: [] as ClusterPoint[],
        points,
        displayedCount: points.length,
        representedCount: filteredWells.length,
      };
    }

    return {
      mode,
      clusters: [] as ClusterPoint[],
      points: filteredWells,
      displayedCount: filteredWells.length,
      representedCount: filteredWells.length,
    };
  }, [filteredWells, mapZoom]);

  const prediction = useMemo(() => predictSuitability(input), [input]);
  const impactRows = useMemo(
    () => calculateImpactRows(input, prediction.probability),
    [input, prediction.probability],
  );
  const maxImpact = Math.max(...impactRows.map((row) => Math.abs(row.delta)), 0.001);

  const updateInput = useCallback(
    <K extends keyof PredictInput>(key: K, value: PredictInput[K]) => {
      setInput((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const loadWellIntoSimulator = useCallback((well: Well) => {
    setInput(getInputFromWell(well));
  }, []);

  const handleSelectWell = useCallback(
    (well: Well) => {
      setSelectedWell(well);
      loadWellIntoSimulator(well);
    },
    [loadWellIntoSimulator],
  );

  const clearSelection = useCallback(() => {
    setSelectedWell(null);
  }, []);

  const scoreStyle = {
    '--score-angle': `${prediction.probability * 360}deg`,
  } as CSSProperties;

  return (
    <main className="app-shell">
      <section className="map-stage" aria-label="대한민국 지하수 저류댐 적합도 지도">
        <MapContainer
          center={INITIAL_CENTER}
          zoom={INITIAL_ZOOM}
          minZoom={6}
          maxZoom={18}
          preferCanvas
          zoomControl={false}
          className="map-canvas"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomright" />
          <ChangeView selectedWell={selectedWell} />
          <MapZoomReporter onZoomChange={setMapZoom} />
          {loadState === 'ready' && (
            <>
              {mapVisual.mode === 'density' && (
                <ClusterCanvasLayer clusters={mapVisual.clusters} />
              )}
              {mapVisual.mode !== 'density' && (
                <WellCanvasLayer wells={mapVisual.points} onSelect={handleSelectWell} />
              )}
            </>
          )}
          {selectedWell && (
            <CircleMarker
              center={[selectedWell.lat, selectedWell.lng]}
              radius={10}
              pathOptions={{
                color: '#0f766e',
                fillColor: '#14b8a6',
                fillOpacity: 0.9,
                weight: 3,
              }}
            />
          )}
        </MapContainer>
        <div className="map-soft-light" />
      </section>

      <header className="top-bar liquid-panel">
        <div className="brand-block">
          <div className="brand-icon">
            <Droplet size={22} />
          </div>
          <div>
            <p className="eyebrow">XGBoost Siting Suitability</p>
            <h1>지하수 저류댐 입지 적합도</h1>
          </div>
        </div>

        <label className="search-box">
          <Search size={18} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="관정명, 시군구, 읍면동 검색"
            aria-label="관정명 또는 지역 검색"
          />
          {searchQuery.length > 0 && (
            <button type="button" className="icon-button" onClick={() => setSearchQuery('')} aria-label="검색어 지우기">
              <X size={16} />
            </button>
          )}
        </label>

        <div className="filter-row" aria-label="지도 필터">
          <FilterDropdown
            id="province"
            label="지역"
            icon={<MapPin size={16} />}
            value={provinceFilter}
            options={provinceOptions}
            openDropdown={openDropdown}
            onOpenChange={setOpenDropdown}
            onChange={setProvinceFilter}
          />

          <FilterDropdown
            id="suitability"
            label="표시 기준"
            icon={<Filter size={16} />}
            value={suitabilityFilter}
            options={suitabilityOptions}
            openDropdown={openDropdown}
            onOpenChange={setOpenDropdown}
            onChange={setSuitabilityFilter}
          />
        </div>
      </header>

      <aside className="predict-panel liquid-panel" aria-label="입지 적합도 예측 패널">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Interactive Model</p>
            <h2>가상 입지 시뮬레이터</h2>
          </div>
          <Cpu size={22} />
        </div>

        <div className="panel-scroll">
          <section className={`prediction-card ${prediction.label === 1 ? 'is-suitable' : 'is-unsuitable'}`}>
            <div className="score-ring" style={scoreStyle}>
              <div>
                <strong>{formatPercent(prediction.probability)}</strong>
                <span>적합 확률</span>
              </div>
            </div>
            <div className="prediction-copy">
              <p className="eyebrow">현재 입력값 예측</p>
              <h3>{prediction.label === 1 ? '입지 적합 가능성이 높음' : '입지 적합 가능성이 낮음'}</h3>
              <p>
                XGBoost 추론 엔진이 브라우저에서 입력 변수를 즉시 평가합니다.
              </p>
            </div>
          </section>

          <form className="control-stack" onSubmit={(event) => event.preventDefault()}>
            <div className="section-title">
              <Sliders size={16} />
              <span>모델 입력 변수</span>
            </div>

            <div className="field-grid two-columns">
              <label className="control-field">
                <span>수문지질</span>
                <select
                  value={input.hydrogeology}
                  onChange={(event) => updateInput('hydrogeology', event.target.value)}
                >
                  {OHE_CATEGORIES[0].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="control-field">
                <span>대수층</span>
                <select
                  value={input.aquifer}
                  onChange={(event) => updateInput('aquifer', event.target.value)}
                >
                  {OHE_CATEGORIES[1].map((option) => (
                    <option key={option} value={option}>
                      {option}층
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-grid two-columns">
              <label className="control-field">
                <span>수질 군집</span>
                <select
                  value={input.water_quality_type}
                  onChange={(event) => updateInput('water_quality_type', event.target.value)}
                >
                  {OHE_CATEGORIES[2].map((option) => (
                    <option key={option} value={option}>
                      유형 {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="control-field">
                <span>저류계수 측정</span>
                <select
                  value={input.mean_storage_coef}
                  onChange={(event) => updateInput('mean_storage_coef', Number(event.target.value))}
                >
                  <option value={1}>측정 완료</option>
                  <option value={0}>미측정</option>
                </select>
              </label>
            </div>

            <label className="range-field">
              <span>
                관정 깊이 <strong>{input.mean_well_depth} m</strong>
              </span>
              <input
                type="range"
                min={5}
                max={250}
                value={input.mean_well_depth}
                onChange={(event) => updateInput('mean_well_depth', Number(event.target.value))}
              />
            </label>

            <label className="range-field">
              <span>
                평균 양수량 <strong>{input.mean_pumped_volume_per_day} m³/d</strong>
              </span>
              <input
                type="range"
                min={0}
                max={1500}
                step={10}
                value={input.mean_pumped_volume_per_day}
                onChange={(event) => updateInput('mean_pumped_volume_per_day', Number(event.target.value))}
              />
            </label>

            <label className="range-field">
              <span>
                자연수위 <strong>{input.mean_natural_water_level} m</strong>
              </span>
              <input
                type="range"
                min={0}
                max={60}
                value={input.mean_natural_water_level}
                onChange={(event) => updateInput('mean_natural_water_level', Number(event.target.value))}
              />
            </label>

            <label className="range-field">
              <span>
                안정수위 <strong>{input.mean_stable_water_level} m</strong>
              </span>
              <input
                type="range"
                min={0}
                max={80}
                value={input.mean_stable_water_level}
                onChange={(event) => updateInput('mean_stable_water_level', Number(event.target.value))}
              />
            </label>

            <label className="control-field">
              <span>가뭄 취약 등급</span>
              <select
                value={input.drought_vulnerability}
                onChange={(event) => updateInput('drought_vulnerability', Number(event.target.value))}
              >
                {[0, 1, 2, 3, 4, 5].map((grade) => (
                  <option key={grade} value={grade}>
                    {grade === 0 ? '미상' : `${grade} 등급`}
                  </option>
                ))}
              </select>
            </label>

            <div className="button-row">
              <button type="button" className="ghost-button" onClick={() => setInput(DEFAULT_INPUT)}>
                <RefreshCw size={16} />
                기본값
              </button>
              {selectedWell && (
                <button type="button" className="primary-button" onClick={() => loadWellIntoSimulator(selectedWell)}>
                  선택 지점 예측에 불러오기
                </button>
              )}
            </div>
          </form>

          <section className="xai-card" aria-label="XAI-lite 변수 민감도">
            <div className="section-title">
              <BarChart2 size={16} />
              <span>XAI-lite 변수 민감도</span>
            </div>
            <p className="helper-copy">
              각 변수를 기준값으로 바꿨을 때 현재 확률이 얼마나 달라지는지 계산한 값입니다.
            </p>
            <div className="impact-list">
              {impactRows.slice(0, 6).map((row) => {
                const width = Math.max((Math.abs(row.delta) / maxImpact) * 100, 4);
                const style = { '--impact-width': `${width}%` } as CSSProperties;
                return (
                  <div key={row.key} className="impact-row">
                    <div className="impact-label">
                      <span>{row.label}</span>
                      <strong>
                        {row.delta >= 0 ? '+' : ''}
                        {(row.delta * 100).toFixed(1)}%p
                      </strong>
                    </div>
                    <div className="impact-track">
                      <div
                        className={`impact-bar ${row.delta >= 0 ? 'positive' : 'negative'}`}
                        style={style}
                      />
                    </div>
                    <small>기준값: {row.baselineText}</small>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </aside>

      <aside className="detail-panel liquid-panel" aria-label="선택 지점 상세 정보">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Selected Groundwater</p>
            <h2>지점 상세</h2>
          </div>
          {selectedWell && (
            <button type="button" className="icon-button" onClick={clearSelection} aria-label="선택 지점 닫기">
              <X size={18} />
            </button>
          )}
        </div>

        {selectedWell ? (
          <div className="panel-scroll">
            <section className="selected-summary">
              <span className="status-pill">{getLabelText(selectedWell)}</span>
              <h3>{selectedWell.name}</h3>
              <p>
                <MapPin size={15} />
                {[selectedWell.prov, selectedWell.city, selectedWell.town].filter(Boolean).join(' ')}
              </p>
              <div className="selected-score">
                <strong>{formatPercent(selectedWell.prob)}</strong>
                <span>사전 계산 적합도</span>
              </div>
            </section>

            <section className="metric-grid">
              <div className="metric-card">
                <span>관정 깊이</span>
                <strong>{formatNumber(selectedWell.depth)} m</strong>
              </div>
              <div className="metric-card">
                <span>평균 양수량</span>
                <strong>{formatNumber(selectedWell.pump)} m³/d</strong>
              </div>
              <div className="metric-card">
                <span>자연수위</span>
                <strong>{formatNumber(selectedWell.nat_lvl)} m</strong>
              </div>
              <div className="metric-card">
                <span>안정수위</span>
                <strong>{formatNumber(selectedWell.stab_lvl)} m</strong>
              </div>
              <div className="metric-card">
                <span>가뭄 등급</span>
                <strong>{selectedWell.drought || '미상'}</strong>
              </div>
              <div className="metric-card">
                <span>저류계수</span>
                <strong>{selectedWell.storage === 1 ? '측정 완료' : '미측정'}</strong>
              </div>
            </section>

            <section className="profile-list">
              <div>
                <span>수문지질</span>
                <strong>{selectedWell.hydro || '-'}</strong>
              </div>
              <div>
                <span>대수층</span>
                <strong>{selectedWell.aquifer || '-'}</strong>
              </div>
              <div>
                <span>수질 군집</span>
                <strong>유형 {selectedWell.wq_type}</strong>
              </div>
              <div>
                <span>좌표</span>
                <strong>
                  {selectedWell.lat.toFixed(4)}, {selectedWell.lng.toFixed(4)}
                </strong>
              </div>
            </section>

            <button type="button" className="primary-button wide" onClick={() => loadWellIntoSimulator(selectedWell)}>
              선택 지점 예측에 불러오기
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <Info size={30} />
            <h3>지도 위 점을 선택하세요</h3>
            <p>마우스를 올리면 적합도 요약이 보이고, 클릭하면 상세 지표와 예측 입력값을 확인할 수 있습니다.</p>
          </div>
        )}
      </aside>

      <section className="status-strip liquid-panel" aria-live="polite">
        {loadState === 'loading' && (
          <>
            <RefreshCw size={16} className="spin" />
            <span>관정 데이터 로딩 중</span>
          </>
        )}
        {loadState === 'error' && (
          <>
            <Info size={16} />
            <span>{loadError}</span>
          </>
        )}
        {loadState === 'ready' && (
          <>
            <Droplet size={16} />
            <span className="mode-pill">{getDisplayModeLabel(mapVisual.mode)}</span>
            {' '}
            <span>
              전체 {stats.total.toLocaleString()}개 중 필터 결과 {stats.visible.toLocaleString()}개 · 지도 표시{' '}
              {mapVisual.displayedCount.toLocaleString()}개 · 적합 예측 {stats.suitable.toLocaleString()}개 (
              {formatPercent(stats.suitableRatio)})
            </span>
          </>
        )}
        {loadState === 'ready' && filteredWells.length === 0 && <strong>필터 조건에 맞는 지점이 없습니다.</strong>}
      </section>
    </main>
  );
}
