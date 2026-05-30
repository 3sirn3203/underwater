import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import { 
  Search, Sliders, Info, Cpu, MapPin, RefreshCw, BarChart2, Filter, Droplet, Sparkles, X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import wellsDataRaw from './data/wells_data.json';
import { predictSuitability } from './model/predict';

interface Well {
  id: number;
  name: string;
  prov: string;
  city: string;
  town: string;
  lat: number;
  lng: number;
  is_dev: number; // -1: Unknown, 0: Unsuitable, 1: Suitable
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

const wellsData: Well[] = wellsDataRaw as Well[];

// Map view controller
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom, { animate: true, duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function App() {
  // States
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('전체');
  const [suitabilityFilter, setSuitabilityFilter] = useState('전체');
  
  // Map Position
  const [mapCenter, setMapCenter] = useState<[number, number]>([36.2, 127.8]);
  const [mapZoom, setMapZoom] = useState(7.5);

  // Simulator Form States
  const [simHydro, setSimHydro] = useState('f');
  const [simAquifer, setSimAquifer] = useState('충적');
  const [simWqType, setSimWqType] = useState('0');
  const [simDepth, setSimDepth] = useState(55);
  const [simDrought, setSimDrought] = useState(3);
  const [simPump, setSimPump] = useState(200);
  const [simNatLvl, setSimNatLvl] = useState(12);
  const [simStabLvl, setSimStabLvl] = useState(15);
  const [simStorage, setSimStorage] = useState(1);

  // Simulation Pred State
  const [predProbability, setPredProbability] = useState<number | null>(null);
  const [predLabel, setPredLabel] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Filter unique provinces
  const provinces = useMemo(() => {
    const set = new Set(wellsData.map(w => w.prov).filter(Boolean));
    return ['전체', ...Array.from(set).sort()];
  }, []);

  // Filter wells
  const filteredWells = useMemo(() => {
    return wellsData.filter(well => {
      const matchesSearch = 
        well.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        well.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        well.town.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesProv = provinceFilter === '전체' || well.prov === provinceFilter;
      
      let matchesSuit = true;
      if (suitabilityFilter === '적합') {
        matchesSuit = well.is_dev === 1 || (well.is_dev === -1 && well.pred === 1);
      } else if (suitabilityFilter === '부적합') {
        matchesSuit = well.is_dev === 0 || (well.is_dev === -1 && well.pred === 0);
      } else if (suitabilityFilter === '실제적합') {
        matchesSuit = well.is_dev === 1;
      } else if (suitabilityFilter === '미판정') {
        matchesSuit = well.is_dev === -1;
      }

      return matchesSearch && matchesProv && matchesSuit;
    });
  }, [searchQuery, provinceFilter, suitabilityFilter]);

  // Load selected well parameters into simulator sandbox
  const loadWellIntoSimulator = (well: Well) => {
    setSimHydro(well.hydro || 'f');
    setSimAquifer(well.aquifer || '충적');
    setSimWqType(String(well.wq_type));
    setSimDepth(Math.round(well.depth));
    setSimDrought(well.drought || 3);
    setSimPump(Math.round(well.pump));
    setSimNatLvl(Math.round(well.nat_lvl));
    setSimStabLvl(Math.round(well.stab_lvl));
    setSimStorage(well.storage);
    
    // Auto-predict after load
    const result = predictSuitability({
      hydrogeology: well.hydro || 'f',
      aquifer: well.aquifer || '충적',
      water_quality_type: String(well.wq_type),
      mean_well_depth: well.depth,
      drought_vulnerability: well.drought,
      mean_pumped_volume_per_day: well.pump,
      mean_natural_water_level: well.nat_lvl,
      mean_stable_water_level: well.stab_lvl,
      mean_storage_coef: well.storage
    });
    setPredProbability(result.probability);
    setPredLabel(result.label);
  };

  // Predict Simulation
  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    
    setTimeout(() => {
      const result = predictSuitability({
        hydrogeology: simHydro,
        aquifer: simAquifer,
        water_quality_type: simWqType,
        mean_well_depth: simDepth,
        drought_vulnerability: simDrought,
        mean_pumped_volume_per_day: simPump,
        mean_natural_water_level: simNatLvl,
        mean_stable_water_level: simStabLvl,
        mean_storage_coef: simStorage
      });

      setPredProbability(result.probability);
      setPredLabel(result.label);
      setIsSimulating(false);

      if (result.label === 1) {
        confetti({
          particleCount: 140,
          spread: 90,
          origin: { y: 0.5, x: 0.2 },
          colors: ['#10B981', '#34D399', '#3B82F6', '#06B6D4']
        });
      }
    }, 450);
  };

  const handleSelectWell = (well: Well) => {
    setSelectedWell(well);
    setMapCenter([well.lat, well.lng]);
    setMapZoom(13.5);
    loadWellIntoSimulator(well);
  };

  useEffect(() => {
    // Initial run
    const result = predictSuitability({
      hydrogeology: simHydro,
      aquifer: simAquifer,
      water_quality_type: simWqType,
      mean_well_depth: simDepth,
      drought_vulnerability: simDrought,
      mean_pumped_volume_per_day: simPump,
      mean_natural_water_level: simNatLvl,
      mean_stable_water_level: simStabLvl,
      mean_storage_coef: simStorage
    });
    setPredProbability(result.probability);
    setPredLabel(result.label);
  }, []);

  // Compute stats for current filter
  const totalCount = filteredWells.length;
  const suitableCount = useMemo(() => {
    return filteredWells.filter(w => w.pred === 1).length;
  }, [filteredWells]);
  const suitableRatio = totalCount > 0 ? (suitableCount / totalCount * 100).toFixed(1) : '0';

  return (
    <div className="relative h-screen w-screen bg-[#060814] overflow-hidden font-sans">
      
      {/* BACKGROUND FULLSCREEN MAP */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={mapCenter} 
          zoom={mapZoom} 
          preferCanvas={true} 
          zoomControl={false}
          className="w-full h-full"
        >
          <ChangeView center={mapCenter} zoom={mapZoom} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {filteredWells.slice(0, 18000).map((well) => {
            let color = '#3B82F6';
            let fillOpacity = 0.55;

            if (well.is_dev === 1) {
              color = '#10B981';
              fillOpacity = 0.9;
            } else if (well.is_dev === 0) {
              color = '#EF4444';
              fillOpacity = 0.9;
            } else {
              if (well.prob >= 0.7) {
                color = '#34D399';
                fillOpacity = 0.75;
              } else if (well.prob <= 0.3) {
                color = '#F87171';
                fillOpacity = 0.75;
              } else {
                color = '#06B6D4';
                fillOpacity = 0.5;
              }
            }

            return (
              <CircleMarker
                key={well.id}
                center={[well.lat, well.lng]}
                radius={selectedWell?.id === well.id ? 8 : (mapZoom > 11 ? 5 : 2.5)}
                pathOptions={{
                  color: selectedWell?.id === well.id ? '#FFFFFF' : color,
                  weight: selectedWell?.id === well.id ? 2.5 : 0.5,
                  fillColor: color,
                  fillOpacity: fillOpacity
                }}
                eventHandlers={{
                  click: () => handleSelectWell(well)
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* FLOATING TOP BAR: Search & High-Level Filters */}
      <header className="absolute top-5 left-5 right-5 z-20 flex flex-wrap gap-3 pointer-events-none">
        
        {/* Search */}
        <div className="flex-1 min-w-[280px] max-w-[400px] floating-glass p-2.5 flex items-center gap-3 pointer-events-auto">
          <Search className="w-4.5 h-4.5 text-gray-400 ml-1.5" />
          <input 
            type="text" 
            placeholder="지하수 관정명 또는 도시 검색..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-white focus:outline-none w-full text-sm placeholder-gray-500 font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Filters Panel */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Province Filter */}
          <div className="floating-glass py-2.5 px-3.5 flex items-center gap-2 text-xs font-semibold">
            <MapPin className="w-4 h-4 text-blue-400" />
            <select 
              value={provinceFilter} 
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none pr-5 cursor-pointer"
            >
              {provinces.map(p => (
                <option key={p} value={p} className="bg-[#0D1324]">{p === '전체' ? '행정구역: 전체' : p}</option>
              ))}
            </select>
          </div>

          {/* Suitability Filter */}
          <div className="floating-glass py-2.5 px-3.5 flex items-center gap-2 text-xs font-semibold">
            <Filter className="w-4 h-4 text-blue-400" />
            <select 
              value={suitabilityFilter} 
              onChange={(e) => setSuitabilityFilter(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none pr-5 cursor-pointer"
            >
              <option value="전체" className="bg-[#0D1324]">적합도 판정: 전체</option>
              <option value="적합" className="bg-[#0D1324]">적합 판정지 (전체)</option>
              <option value="부적합" className="bg-[#0D1324]">부적합 판정지 (전체)</option>
              <option value="실제적합" className="bg-[#0D1324]">실제 적합 판정지 (Labeled)</option>
              <option value="미판정" className="bg-[#0D1324]">미판정 예측 대상지 (Unlabeled)</option>
            </select>
          </div>
        </div>

        {/* Global Statistics Pill */}
        <div className="floating-glass py-2 px-4 flex items-center gap-4 text-xs ml-auto pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">검색 대상 관정:</span>
            <span className="font-mono font-bold text-white text-sm">{totalCount.toLocaleString()}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-gray-400">적합 비중:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{suitableRatio}%</span>
          </div>
        </div>

      </header>

      {/* FLOATING LEFT SIDEBAR PANEL: Simulator */}
      <aside className="absolute left-5 top-24 bottom-5 w-[380px] z-10 flex flex-col gap-5 pointer-events-none">
        
        {/* Main Glass Control Card */}
        <div className="floating-glass w-full flex-1 flex flex-col pointer-events-auto overflow-hidden">
          
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600/10 rounded-lg border border-blue-500/20">
                <Droplet className="w-5 h-5 text-blue-400 fill-blue-400/10" />
              </div>
              <div>
                <h2 className="text-md font-bold font-display tracking-tight text-white">지하수 저류댐 분석</h2>
                <p className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">Siting Suitability Engine</p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
          </div>

          {/* Form Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
            
            <div className="flex items-center gap-2 pb-1 border-b border-white/5">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-400">가상 입지 시뮬레이터</h3>
            </div>

            <form onSubmit={handleSimulate} className="flex flex-col gap-4">
              
              {/* Sliders Grid */}
              <div className="flex flex-col gap-4">
                {/* Mean Well Depth */}
                <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="input-label">평균 관정 깊이</label>
                    <span className="text-xs text-white font-mono font-bold">{simDepth} m</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="250" 
                    value={simDepth} 
                    onChange={(e) => setSimDepth(Number(e.target.value))} 
                  />
                </div>

                {/* Pumping volume */}
                <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="input-label">하루 평균 양수량</label>
                    <span className="text-xs text-white font-mono font-bold">{simPump} m³/d</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1500" 
                    value={simPump} 
                    onChange={(e) => setSimPump(Number(e.target.value))} 
                  />
                </div>

                {/* Natural water level */}
                <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="input-label">자연 지하수 수위</label>
                    <span className="text-xs text-white font-mono font-bold">{simNatLvl} m</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="60" 
                    value={simNatLvl} 
                    onChange={(e) => setSimNatLvl(Number(e.target.value))} 
                  />
                </div>

                {/* Stable water level */}
                <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="input-label">안정 지하수 수위</label>
                    <span className="text-xs text-white font-mono font-bold">{simStabLvl} m</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="80" 
                    value={simStabLvl} 
                    onChange={(e) => setSimStabLvl(Number(e.target.value))} 
                  />
                </div>
              </div>

              {/* Multi inputs block */}
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex flex-col gap-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">가뭄 취약 등급</label>
                    <select 
                      className="glass-input" 
                      value={simDrought} 
                      onChange={(e) => setSimDrought(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map(v => (
                        <option key={v} value={v} className="bg-[#0D1324]">{v} 등급</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="input-label">저류계수 측정</label>
                    <select 
                      className="glass-input" 
                      value={simStorage} 
                      onChange={(e) => setSimStorage(Number(e.target.value))}
                    >
                      <option value={1} className="bg-[#0D1324]">측정 완료</option>
                      <option value={0} className="bg-[#0D1324]">미측정</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="input-label">대수층 형태 (Aquifer)</label>
                  <select 
                    className="glass-input" 
                    value={simAquifer} 
                    onChange={(e) => setSimAquifer(e.target.value)}
                  >
                    {['충적', '암반', '용천수', '지표수', '샘물'].map(v => (
                      <option key={v} value={v} className="bg-[#0D1324]">{v}층</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">수문지질 특성</label>
                    <select 
                      className="glass-input" 
                      value={simHydro} 
                      onChange={(e) => setSimHydro(e.target.value)}
                    >
                      {['a', 'b', 'c', 'd', 'e-1', 'e-2', 'f', 'g', 'h-1', 'h-2', '수류지역'].map(v => (
                        <option key={v} value={v} className="bg-[#0D1324]">{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="input-label">화학 수질 군집</label>
                    <select 
                      className="glass-input" 
                      value={simWqType} 
                      onChange={(e) => setSimWqType(e.target.value)}
                    >
                      {[-1, 0, 1, 3, 4, 5, 8, 11, 16, 17, 18, 19, 41, 64].map(v => (
                        <option key={v} value={v} className="bg-[#0D1324]">유형 {v}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* Simulation Trigger button */}
              <button 
                type="submit" 
                disabled={isSimulating}
                className="w-full mt-1 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all duration-200"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>예측 모델 연산 가동 중...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    <span>입지 타당성 시뮬레이션 실행</span>
                  </>
                )}
              </button>
            </form>

            {/* Results visualization block */}
            {predProbability !== null && predLabel !== null && (
              <div className={`p-4 rounded-xl border flex items-center gap-4 glass-panel fade-in transition-all duration-300 ${
                predLabel === 1 
                  ? 'border-emerald-500/20 bg-emerald-950/5 glow-suitable' 
                  : 'border-red-500/20 bg-red-950/5'
              }`}>
                {/* Conic progress gauge */}
                <div 
                  className="circular-progress shrink-0" 
                  style={{
                    '--gauge-percent': `${predProbability * 360}deg`,
                    '--gauge-color': predLabel === 1 ? 'var(--neon-emerald)' : 'var(--neon-coral)',
                    '--gauge-glow': predLabel === 1 ? 'var(--neon-emerald-glow)' : 'var(--neon-coral-glow)'
                  } as React.CSSProperties}
                >
                  <div className="circular-progress-inner">
                    <span className="text-[15px] font-mono font-extrabold text-white leading-none">
                      {Math.round(predProbability * 100)}
                    </span>
                    <span className="text-[8px] text-gray-400 font-semibold tracking-wider mt-0.5">%</span>
                  </div>
                </div>

                {/* Score details */}
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    {predLabel === 1 ? (
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                    )}
                    <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">예측 결과</span>
                  </div>
                  <h4 className={`text-md font-bold font-display ${predLabel === 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {predLabel === 1 ? '지하수 저류댐 적합' : '수치상 설치 부적합'}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-medium">
                    {predLabel === 1 
                      ? '수문지질 및 수질 화학 특성이 저류 댐 입지 기준에 부합합니다.' 
                      : '자연/안정 수위 편차 및 저류 능력이 부족한 환경입니다.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </aside>

      {/* FLOATING RIGHT INSPECTOR DRAWERS */}
      <aside className="absolute right-5 top-24 bottom-5 w-[360px] z-10 flex flex-col gap-5 pointer-events-none">
        
        {selectedWell ? (
          <div className="floating-glass w-full h-full flex flex-col pointer-events-auto overflow-hidden slide-in-right">
            
            {/* Header / Dismiss */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">상세 데이터 분석기</h2>
              </div>
              <button 
                onClick={() => setSelectedWell(null)} 
                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
              
              {/* Title Location Card */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded w-max">
                  후보지 #{selectedWell.id}
                </span>
                <h3 className="text-lg font-bold text-white leading-snug">{selectedWell.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span>{selectedWell.prov} {selectedWell.city} {selectedWell.town}</span>
                </div>
              </div>

              {/* Glow decision card */}
              <div className={`p-4 rounded-xl border flex items-center gap-4 ${
                selectedWell.pred === 1 
                  ? 'border-emerald-500/20 bg-emerald-950/5 glow-suitable' 
                  : 'border-red-500/20 bg-red-950/5'
              }`}>
                {/* Conic progress gauge */}
                <div 
                  className="circular-progress shrink-0" 
                  style={{
                    '--gauge-percent': `${selectedWell.prob * 360}deg`,
                    '--gauge-color': selectedWell.pred === 1 ? 'var(--neon-emerald)' : 'var(--neon-coral)',
                    '--gauge-glow': selectedWell.pred === 1 ? 'var(--neon-emerald-glow)' : 'var(--neon-coral-glow)'
                  } as React.CSSProperties}
                >
                  <div className="circular-progress-inner">
                    <span className="text-[15px] font-mono font-extrabold text-white leading-none">
                      {Math.round(selectedWell.prob * 100)}
                    </span>
                    <span className="text-[8px] text-gray-400 font-semibold tracking-wider mt-0.5">%</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      selectedWell.is_dev === -1 
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    }`}>
                      {selectedWell.is_dev === -1 ? '모델 예측 후보' : '검증 실측 관정'}
                    </span>
                  </div>
                  <h4 className={`text-md font-bold font-display ${
                    selectedWell.pred === 1 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {selectedWell.pred === 1 ? '저류댐 입지 적합' : '입지 부적합 판정'}
                  </h4>
                </div>
              </div>

              {/* Physical Parameters List */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">수문지질 물리 지표</h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  
                  {/* Well Depth */}
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">관정 평균 깊이</span>
                    <span className="text-white font-mono font-bold text-sm">{selectedWell.depth.toFixed(1)} m</span>
                  </div>

                  {/* Pump Capacity */}
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">하루 평균 양수량</span>
                    <span className="text-white font-mono font-bold text-sm">{selectedWell.pump.toFixed(1)} m³/d</span>
                  </div>

                  {/* Natural level */}
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">자연 지하 수위</span>
                    <span className="text-white font-mono font-bold text-sm">{selectedWell.nat_lvl.toFixed(1)} m</span>
                  </div>

                  {/* Stable level */}
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">안정 지하 수위</span>
                    <span className="text-white font-mono font-bold text-sm">{selectedWell.stab_lvl.toFixed(1)} m</span>
                  </div>

                  {/* Drought */}
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">가뭄 취약 등급</span>
                    <span className="text-white font-bold text-sm">{selectedWell.drought} 등급</span>
                  </div>

                  {/* Storage */}
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">저류 계수</span>
                    <span className="text-white font-bold text-sm">{selectedWell.storage === 1 ? '측정 완료' : '미측정'}</span>
                  </div>

                </div>
              </div>

              {/* Geological Properties */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">지하지반 및 화학 군집 프로필</h4>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5 text-xs">
                    <span className="text-gray-400 font-semibold">대수층 형태 (Aquifer)</span>
                    <span className="font-bold text-white">{selectedWell.aquifer}층</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5 text-xs">
                    <span className="text-gray-400 font-semibold">수문지질 특성 (Hydro)</span>
                    <span className="font-bold text-white">{selectedWell.hydro}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5 text-xs">
                    <span className="text-gray-400 font-semibold">수질 화학 군집 분류</span>
                    <span className="font-mono font-bold text-blue-400">유형 {selectedWell.wq_type}</span>
                  </div>
                </div>
              </div>

              {/* Load Sandbox Button */}
              <button 
                onClick={() => loadWellIntoSimulator(selectedWell)}
                className="w-full mt-auto py-3 border border-blue-500/25 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>시뮬레이터에 파라미터 로드</span>
              </button>

            </div>

          </div>
        ) : (
          <div className="floating-glass w-full p-6 flex flex-col items-center justify-center text-center text-gray-500 gap-3 border-dashed">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-full">
              <Info className="w-6 h-6 text-gray-400 stroke-[1.5]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">관정 상세 분석기</h3>
              <p className="text-xs text-gray-400 leading-normal">
                대한민국 지도에서 후보 관정 점을 클릭하면 해당 입지의 상세 물리·화학 데이터를 즉시 분석할 수 있습니다.
              </p>
            </div>
          </div>
        )}

      </aside>

    </div>
  );
}
