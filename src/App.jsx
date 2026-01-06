import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Beaker, 
  Calculator, 
  LayoutGrid, 
  RotateCcw, 
  Settings2, 
  Trash2, 
  Plus,
  FlaskConical,
  Grid3X3,
  Zap,
  Dna,
  Edit3,
  X,
  Download,
  PlusCircle,
  Monitor,
  Smartphone,
  RefreshCw,
  Columns,
  CheckSquare,
  Percent,
  Info,
  Move,
  AlertTriangle,
  Grid
} from 'lucide-react';

const PLATE_CONFIGS = {
  96: { rows: 8, cols: 12, size: 96, name: '96孔板' },
  384: { rows: 16, cols: 24, size: 384, name: '384孔板' }
};

const App = () => {
  // --- 初始常量定义 ---
  const DEFAULT_SAMPLES = 'S1, S2, S3';
  const DEFAULT_TARGETS = 'Gapdh, Target 1, Target 2';
  
  // 96孔板默认体系 (20μl)
  const DEFAULT_COMPONENTS_96 = [
    { id: 1, name: '2× Master Mix', volPerWell: 10 },
    { id: 2, name: 'Primer F/R (10μM)', volPerWell: 1 },
    { id: 3, name: 'Template DNA', volPerWell: 2 },
    { id: 4, name: 'ddH2O', volPerWell: 7 }
  ];

  // 384孔板默认体系 (10μl - 减半)
  const DEFAULT_COMPONENTS_384 = [
    { id: 1, name: '2× Master Mix', volPerWell: 5 },
    { id: 2, name: 'Primer F/R (10μM)', volPerWell: 0.5 },
    { id: 3, name: 'Template DNA', volPerWell: 1 },
    { id: 4, name: 'ddH2O', volPerWell: 3.5 }
  ];

  // --- 状态定义 ---
  const [viewMode, setViewMode] = useState('desktop'); 
  const [plateType, setPlateType] = useState(96); // 96 or 384
  const [samplesInput, setSamplesInput] = useState(DEFAULT_SAMPLES);
  const [targetsInput, setTargetsInput] = useState(DEFAULT_TARGETS);
  const [replicates, setReplicates] = useState(3);
  const [priority, setPriority] = useState('target'); 
  
  const [globalOrientation, setGlobalOrientation] = useState('vertical'); 
  const [groupConfigs, setGroupConfigs] = useState({});
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [draggedGroupIds, setDraggedGroupIds] = useState([]); 
  const [dragAnchorIdx, setDragAnchorIdx] = useState(null); 

  const [calcConfig, setCalcConfig] = useState({
    lossFactor: 10,
    components: DEFAULT_COMPONENTS_96
  });

  const currentPlate = PLATE_CONFIGS[plateType];

  const [wells, setWells] = useState(Array(96).fill(null));
  const [overflowInfo, setOverflowInfo] = useState({ isOverflowing: false, missingGroups: 0 });
// --- Google Analytics 追踪代码集成 ---
  useEffect(() => {
    // 1. 创建并注入 gtag.js 脚本
    const script = document.createElement('script');
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=G-87Y5WZS74R";
    document.head.appendChild(script);

    // 2. 创建并注入配置脚本
    const inlineScript = document.createElement('script');
    inlineScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-87Y5WZS74R');
    `;
    document.head.appendChild(inlineScript);

    // 3. 清理函数：组件卸载时移除脚本（防止开发环境下重复加载）
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
      if (document.head.contains(inlineScript)) {
        document.head.removeChild(inlineScript);
      }
    };
  }, []);
  // --- 数据解析 ---
  const samples = useMemo(() => samplesInput.split(/[,\n，]/).map(s => s.trim()).filter(s => s), [samplesInput]);
  const targets = useMemo(() => targetsInput.split(/[,\n，]/).map(s => s.trim()).filter(s => s), [targetsInput]);

  // --- 智能方向决策算法 ---
  const calculateBestOrientation = useCallback((n) => {
    // 96孔板逻辑：8行12列
    // 384孔板逻辑：16行24列
    // 两者行数都是8的倍数，列数都是12的倍数，所以核心逻辑通用
    
    // 1. 如果能被行数整除（对于96是8，384是16），竖排是绝对完美的
    // 这里为了简化兼容，我们主要参考传统8联管/12联管的逻辑
    // 即使是384孔板，通常也是通过移液枪（8/12通道）或自动化工作站操作
    
    if (8 % n === 0) return 'vertical';
    if (12 % n === 0) return 'horizontal';
    
    const verticalWaste = 8 % n;
    const horizontalWaste = 12 % n;
    
    return verticalWaste <= horizontalWaste ? 'vertical' : 'horizontal';
  }, []);

  // --- 核心操作函数 ---
  const handleFullReset = () => {
    const defaultReplicates = 3;
    setReplicates(defaultReplicates);
    setPriority('target');
    
    const bestOri = calculateBestOrientation(defaultReplicates);
    setGlobalOrientation(bestOri);
    
    setGroupConfigs({});
    setSelectedGroupIds([]);
    setCalcConfig({
      lossFactor: 10,
      components: plateType === 384 ? DEFAULT_COMPONENTS_384 : DEFAULT_COMPONENTS_96
    });
    // Reset wells size based on current plate type
    setWells(Array(currentPlate.size).fill(null));
  };
  
  // 切换孔板模式
  const togglePlateType = () => {
    const nextType = plateType === 96 ? 384 : 96;
    setPlateType(nextType);
    setWells(Array(PLATE_CONFIGS[nextType].size).fill(null));
    setGroupConfigs({});
    setSelectedGroupIds([]);
    
    // 切换模式时自动应用对应的默认体系
    setCalcConfig(prev => ({
      ...prev,
      components: nextType === 384 ? DEFAULT_COMPONENTS_384 : DEFAULT_COMPONENTS_96
    }));
  };

  // 配置更改逻辑：自动决策方向并重置局部
  useEffect(() => {
    const bestOri = calculateBestOrientation(replicates);
    setGlobalOrientation(bestOri);
    setGroupConfigs({});
    setSelectedGroupIds([]);
  }, [samples.length, targets.length, replicates, priority, calculateBestOrientation, plateType]);

  // --- 颜色逻辑 ---
  const COLOR_PALETTE = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1', 
    '#14B8A6', '#D946EF'
  ];

  const targetColorMap = useMemo(() => {
    const map = {};
    targets.forEach((t, i) => {
      map[t] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    });
    return map;
  }, [targets]);

  // --- 组件逻辑 ---
  const handleCompChange = (id, field, val) => {
    setCalcConfig(prev => ({
      ...prev,
      components: prev.components.map(c => c.id === id ? { ...c, [field]: val } : c)
    }));
  };

  const addComponent = () => {
    const newId = Date.now();
    setCalcConfig(prev => ({
      ...prev,
      components: [...prev.components, { id: newId, name: 'New Comp', volPerWell: 0 }]
    }));
  };

  const removeComponent = (id) => {
    setCalcConfig(prev => ({
      ...prev,
      components: prev.components.filter(c => c.id !== id)
    }));
  };

  const toggleAllOrientations = () => {
    const next = globalOrientation === 'vertical' ? 'horizontal' : 'vertical';
    setGlobalOrientation(next);
    setGroupConfigs({}); 
  };

  const updateSelectedGroupsOrientation = (orientation) => {
    if (selectedGroupIds.length === 0) return;
    setGroupConfigs(prev => {
      const next = { ...prev };
      selectedGroupIds.forEach(id => {
        next[id] = { ...next[id], orientation };
      });
      return next;
    });
  };

  const handleWellClick = (e, groupId) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedGroupIds(prev => 
        prev.includes(groupId) 
          ? prev.filter(id => id !== groupId) 
          : [...prev, groupId]
      );
    } else {
      setSelectedGroupIds([groupId]);
    }
  };

  const handleClearSelection = () => {
    if (selectedGroupIds.length > 0) {
      setSelectedGroupIds([]);
    }
  };

  const quickAddSample = () => {
    const nextId = samples.length + 1;
    setSamplesInput(prev => prev.trim().endsWith(',') || prev.trim().endsWith('，') || prev === '' 
      ? `${prev}S${nextId}` : `${prev}, S${nextId}`);
  };

  const quickAddTarget = () => {
    const nextId = targets.length;
    setTargetsInput(prev => prev.trim().endsWith(',') || prev.trim().endsWith('，') || prev === '' 
      ? `${prev}Target ${nextId}` : `${prev}, Target ${nextId}`);
  };

  // --- 排版算法 ---
  const autoLayout = useCallback(() => {
    const pRows = currentPlate.rows;
    const pCols = currentPlate.cols;
    const pSize = currentPlate.size;

    let tempWells = Array(pSize).fill(null);
    const n = replicates;
    
    let units = [];
    if (priority === 'target') {
      targets.forEach(t => samples.forEach(s => units.push({ sample: s, target: t, id: `${t}-${s}` })));
    } else {
      samples.forEach(s => targets.forEach(t => units.push({ sample: s, target: t, id: `${t}-${s}` })));
    }

    let virtualWells = Array(pSize).fill(null);
    let maxColUsed = 0;
    
    const findPlace = (wellArray, unit, config) => {
      const w = config.orientation === 'vertical' ? 1 : n;
      const h = config.orientation === 'vertical' ? n : 1;
      
      // 遍历所有可能的起始点
      for (let x = 0; x <= pCols - w; x++) {
        for (let y = 0; y <= pRows - h; y++) {
          let canFit = true;
          // 检查该区域是否被占用
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              if (wellArray[(y + dy) * pCols + (x + dx)] !== null) { canFit = false; break; }
            }
            if (!canFit) break;
          }
          // 如果可以放下，占位并返回
          if (canFit) {
            for (let dy = 0; dy < h; dy++) {
              for (let dx = 0; dx < w; dx++) {
                wellArray[(y + dy) * pCols + (x + dx)] = unit.id;
                maxColUsed = Math.max(maxColUsed, x + dx);
              }
            }
            return true;
          }
        }
      }
      return false;
    };

    let placedCount = 0;
    units.forEach(unit => {
      const config = groupConfigs[unit.id] || { orientation: globalOrientation };
      if (findPlace(virtualWells, unit, config)) placedCount++;
    });

    // 计算为了居中显示的列偏移
    // 统一逻辑：无论是96还是384孔板，都计算偏移量以实现居中
    const offsetCols = Math.max(0, Math.floor((pCols - (maxColUsed + 1)) / 2));

    units.forEach(unit => {
      const config = groupConfigs[unit.id] || { orientation: globalOrientation };
      const w = config.orientation === 'vertical' ? 1 : n;
      const h = config.orientation === 'vertical' ? n : 1;
      for (let x = offsetCols; x <= pCols - w; x++) {
        for (let y = 0; y <= pRows - h; y++) {
          let canFit = true;
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              if (tempWells[(y + dy) * pCols + (x + dx)] !== null) { canFit = false; break; }
            }
            if (!canFit) break;
          }
          if (canFit) {
            for (let dy = 0; dy < h; dy++) {
              for (let dx = 0; dx < w; dx++) {
                tempWells[(y + dy) * pCols + (x + dx)] = { ...unit, orientation: config.orientation };
              }
            }
            return;
          }
        }
      }
    });

    setWells(tempWells);
    setOverflowInfo({
      isOverflowing: placedCount < units.length,
      missingGroups: units.length - placedCount
    });
  }, [samples, targets, replicates, priority, groupConfigs, globalOrientation, currentPlate, plateType]);

  useEffect(() => {
    autoLayout();
  }, [autoLayout]);

  const activeCols = useMemo(() => {
    let first = currentPlate.cols - 1, last = 0;
    let any = false;
    wells.forEach((w, i) => {
      if (w) {
        const col = i % currentPlate.cols;
        first = Math.min(first, col);
        last = Math.max(last, col);
        any = true;
      }
    });
    // 如果没有内容，默认显示一部分列
    const defaultEnd = plateType === 384 ? 12 : 7;
    const defaultStart = plateType === 384 ? 0 : 4;
    return any ? { start: first, end: last } : { start: defaultStart, end: defaultEnd };
  }, [wells, currentPlate, plateType]);

  const totalVolPerWell = useMemo(() => 
    calcConfig.components.reduce((sum, c) => sum + (Number(c.volPerWell) || 0), 0)
  , [calcConfig.components]);

  const mixSummary = useMemo(() => {
    if (targets.length === 0) return null;
    const refT = targets[0];
    const count = wells.filter(w => w?.target === refT).length;
    if (count === 0) return null;
    const factor = count * (1 + calcConfig.lossFactor / 100);
    return {
      target: refT,
      count,
      totalVol: (factor * totalVolPerWell).toFixed(1),
      components: calcConfig.components.map(c => ({
        name: c.name,
        total: (factor * (Number(c.volPerWell) || 0)).toFixed(1)
      }))
    };
  }, [wells, calcConfig, targets, totalVolPerWell]);

  const utilization = useMemo(() => Math.round((wells.filter(w => w).length / currentPlate.size) * 100), [wells, currentPlate]);

  const exportToSVG = () => {
    // 强制显示所有列或者根据内容
    const startCol = activeCols.start; // 或者从0开始
    const endCol = activeCols.end;
    const colCount = endCol - startCol + 1;
    const rowCount = currentPlate.rows;
    
    const cellSize = 50; // 导出时稍微小一点，避免384太大
    const padding = 50;
    const svgWidth = (colCount + 1) * cellSize + padding * 2;
    const svgHeight = (rowCount + 1) * cellSize + padding * 2;
    
    let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="100%" height="100%" fill="#f8fafc" />`;
    
    // Draw Column Headers
    for(let i = 0; i < colCount; i++) {
      svg += `<text x="${padding + (i + 1) * cellSize + cellSize/2}" y="${padding + 30}" font-family="Arial" font-weight="bold" font-size="14" fill="#94a3b8" text-anchor="middle">${startCol + i + 1}</text>`;
    }
    
    // Draw Row Headers
    for(let j = 0; j < rowCount; j++) {
      svg += `<text x="${padding + 20}" y="${padding + (j + 1) * cellSize + cellSize/2 + 5}" font-family="Arial" font-weight="bold" font-size="16" fill="#94a3b8" text-anchor="middle">${String.fromCharCode(65 + j)}</text>`;
    }
    
    // Draw Grid
    for(let r = 0; r < rowCount; r++) {
      for(let c = 0; c < colCount; c++) {
        const wellIdx = r * currentPlate.cols + (startCol + c);
        const well = wells[wellIdx];
        const x = padding + (c + 1) * cellSize;
        const y = padding + (r + 1) * cellSize;
        
        if (well) {
          svg += `<rect x="${x + 2}" y="${y + 2}" width="${cellSize - 4}" height="${cellSize - 4}" rx="6" fill="${targetColorMap[well.target]}" stroke="#ffffff" stroke-width="2" />`;
          // 384孔板字体要小
          const fontSizeTarget = plateType === 384 ? 8 : 10;
          const fontSizeSample = plateType === 384 ? 8 : 10;
          
          svg += `<text x="${x + cellSize/2}" y="${y + cellSize/2 - 5}" font-family="Arial" font-weight="bold" font-size="${fontSizeTarget}" fill="white" text-anchor="middle">${well.target}</text>`;
          svg += `<text x="${x + cellSize/2}" y="${y + cellSize/2 + 15}" font-family="Arial" font-weight="bold" font-size="${fontSizeSample}" fill="white" text-anchor="middle" opacity="0.9">${well.sample}</text>`;
        } else {
          svg += `<rect x="${x + 2}" y="${y + 2}" width="${cellSize - 4}" height="${cellSize - 4}" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-dasharray="4" />`;
        }
      }
    }
    svg += `</svg>`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    link.download = `qPCR_${plateType}Well_Layout_${new Date().getTime()}.svg`;
    link.click();
  };

  const handleDragStart = (idx, wellId) => {
    setDragAnchorIdx(idx); 
    if (selectedGroupIds.includes(wellId)) {
      setDraggedGroupIds(selectedGroupIds);
    } else {
      setDraggedGroupIds([wellId]);
    }
  };

  const handleDrop = (targetIdx) => {
    if (draggedGroupIds.length === 0 || dragAnchorIdx === null) return;
    
    const pCols = currentPlate.cols;
    const pRows = currentPlate.rows;
    const newWells = [...wells];
    
    const sAnchorRow = Math.floor(dragAnchorIdx / pCols);
    const sAnchorCol = dragAnchorIdx % pCols;
    const tAnchorRow = Math.floor(targetIdx / pCols);
    const tAnchorCol = targetIdx % pCols;
    
    const sourceIndices = [];
    wells.forEach((w, idx) => {
      if (w && draggedGroupIds.includes(w.id)) sourceIndices.push(idx);
    });
    
    const mapping = [];
    let isOutOfBound = false;
    
    sourceIndices.forEach(sIdx => {
      const sRow = Math.floor(sIdx / pCols);
      const sCol = sIdx % pCols;
      const tRow = tAnchorRow + (sRow - sAnchorRow);
      const tCol = tAnchorCol + (sCol - sAnchorCol);
      
      if (tRow < 0 || tRow >= pRows || tCol < 0 || tCol >= pCols) isOutOfBound = true;
      else mapping.push({ sIdx, tIdx: tRow * pCols + tCol });
    });
    
    if (!isOutOfBound && mapping.length === sourceIndices.length) {
      mapping.forEach(({ sIdx, tIdx }) => {
        const temp = newWells[sIdx];
        newWells[sIdx] = newWells[tIdx];
        newWells[tIdx] = temp;
      });
      setWells(newWells);
    }
    setDraggedGroupIds([]);
    setDragAnchorIdx(null);
  };

  const isMobile = viewMode === 'mobile';
  
  // 动态计算单元格大小
  const getCellSize = () => {
    if (isMobile) {
      return plateType === 384 ? '2.8rem' : '4.2rem';
    }
    return plateType === 384 ? '3.2rem' : '4.8rem';
  };
  const cellSizeVal = getCellSize();

  return (
    <div 
      className={`min-h-screen bg-slate-100 font-sans text-slate-900 transition-all duration-500 ${isMobile ? 'p-2' : 'p-6'}`}
      onClick={handleClearSelection}
    >
      <div 
        className={`mx-auto ${isMobile ? 'max-w-md' : 'max-w-[1700px]'} grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-12'} gap-6`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* 全局控制顶栏 */}
        <div className={`${isMobile ? '' : 'lg:col-span-12'} bg-white p-4 rounded-[2rem] shadow-lg border border-white flex flex-wrap justify-between items-center gap-4`}>
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg animate-pulse">
                <Dna className="w-6 h-6" />
             </div>
             <h1 className="text-xl font-black tracking-tighter uppercase italic text-indigo-900">qPCR Smart Layout</h1>
          </div>
          
          <div className="flex items-center gap-4">
             {/* 孔板模式切换按钮 */}
             <div className="flex bg-slate-100 rounded-[1.2rem] p-1 border border-slate-200">
                <button 
                  onClick={() => plateType !== 96 && togglePlateType()}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${plateType === 96 ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Grid3X3 className="w-4 h-4" /> 96孔板
                </button>
                <button 
                  onClick={() => plateType !== 384 && togglePlateType()}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${plateType === 384 ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Grid className="w-4 h-4" /> 384孔板
                </button>
             </div>

             <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-[1.5rem] border border-slate-100 shadow-inner">
               <div className="flex bg-white rounded-xl shadow-sm p-0.5 border border-slate-200">
                  <button onClick={() => setViewMode('desktop')} className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'desktop' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                     <Monitor className="w-4 h-4" />
                  </button>
                  <button onClick={() => setViewMode('mobile')} className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'mobile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                     <Smartphone className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        </div>

        {/* 配置区 */}
        <div className={`${isMobile ? 'order-2' : 'lg:col-span-3'} space-y-5`}>
          <section className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
            <h2 className="text-lg font-black mb-5 flex items-center gap-2 text-indigo-600 uppercase tracking-tight">
              <Settings2 className="w-5 h-5" /> 配置中心
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button onClick={() => setPriority('target')} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black transition-all ${priority === 'target' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>引物集中</button>
                <button onClick={() => setPriority('sample')} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black transition-all ${priority === 'sample' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>样本集中</button>
              </div>

              <button 
                onClick={toggleAllOrientations}
                className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-2xl border-2 border-indigo-100 hover:border-indigo-500 transition-all font-black text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95"
              >
                <Columns className={`w-4 h-4 transition-transform duration-500 ${globalOrientation === 'vertical' ? 'rotate-90' : ''}`} />
                一键反转全局复孔方向
              </button>

              <div className="space-y-4">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex justify-between items-center group">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">复孔数量 (n)</label>
                  <input type="number" value={replicates} onChange={e => setReplicates(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 text-center font-black text-indigo-600 bg-transparent text-xl outline-none" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">引物清单</label>
                    <button onClick={quickAddTarget} className="text-indigo-500 hover:scale-125 transition-all"><PlusCircle className="w-5 h-5 shadow-sm rounded-full" /></button>
                  </div>
                  <textarea value={targetsInput} onChange={e => setTargetsInput(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs h-28 focus:ring-4 ring-indigo-50 transition-all shadow-inner" placeholder="Gapdh, Target 1..." />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">样本清单</label>
                    <button onClick={quickAddSample} className="text-indigo-500 hover:scale-125 transition-all"><PlusCircle className="w-5 h-5 shadow-sm rounded-full" /></button>
                  </div>
                  <textarea value={samplesInput} onChange={e => setSamplesInput(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs h-28 focus:ring-4 ring-indigo-50 transition-all shadow-inner" placeholder="S1, S2, S3..." />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50">
            <h2 className="text-lg font-black mb-5 flex items-center gap-2 text-emerald-600 uppercase tracking-tight">
              <FlaskConical className="w-5 h-5" /> 体系配制
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-black text-emerald-600 uppercase">单孔总体积</span>
                  <span className="text-xl font-black text-emerald-700 tracking-tighter">{totalVolPerWell.toFixed(1)} <small className="text-xs">μl</small></span>
                </div>
                
                <div className="flex justify-between items-center bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">损耗余量 (%)</span>
                  </div>
                  <input 
                    type="number" 
                    value={calcConfig.lossFactor} 
                    onChange={e => setCalcConfig({ ...calcConfig, lossFactor: Number(e.target.value) || 0 })} 
                    className="w-16 text-center font-black text-amber-700 bg-transparent text-lg outline-none" 
                  />
                </div>
              </div>

              <div className="max-h-[200px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {calcConfig.components.map(comp => (
                  <div key={comp.id} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                    <input type="text" value={comp.name} onChange={e => handleCompChange(comp.id, 'name', e.target.value)} className="flex-1 bg-transparent text-[11px] font-bold outline-none text-slate-700" />
                    <div className="flex items-center bg-white rounded-lg px-2 py-1 border border-slate-200">
                      <input type="number" step="0.1" value={comp.volPerWell} onChange={e => handleCompChange(comp.id, 'volPerWell', parseFloat(e.target.value) || 0)} className="w-10 bg-transparent text-[11px] font-black text-right outline-none text-emerald-600" />
                      <span className="text-[8px] text-slate-400 ml-1 font-bold">μl</span>
                    </div>
                    <button onClick={() => removeComponent(comp.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={addComponent} className="w-full py-3 border-2 border-dashed border-emerald-100 rounded-2xl text-emerald-400 hover:text-emerald-600 hover:border-emerald-300 transition-all flex items-center justify-center gap-2 text-[11px] font-black uppercase">
                <Plus className="w-4 h-4" /> 添加组分
              </button>
            </div>
          </section>
        </div>

        {/* 主示窗 */}
        <div className={`${isMobile ? 'order-1' : 'lg:col-span-9'} space-y-6`}>
          <section className={`bg-white rounded-[3.5rem] shadow-lg border border-slate-200 relative flex flex-col ${isMobile ? 'p-4 min-h-[500px]' : 'p-10 min-h-[600px]'}`}>
            
            <div className={`flex ${isMobile ? 'flex-col items-center gap-6 text-center' : 'justify-between items-center'} mb-10`}>
              <div className="flex flex-col gap-1">
                <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-black text-slate-800 tracking-tighter uppercase italic`}>Plate Explorer</h2>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg">利用率: {utilization}%</span>
                  <div className="text-[10px] font-black px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">{currentPlate.name}模式 | 默认 {globalOrientation === 'vertical' ? '竖向' : '横向'}</div>
                </div>
              </div>

              {/* 调节窗口与溢出提示 */}
              <div className={`${isMobile ? 'w-full' : 'flex-1 mx-8'} flex justify-center`}>
                {selectedGroupIds.length > 0 ? (
                  <div className="bg-indigo-600 px-5 py-2.5 rounded-[2rem] shadow-2xl text-white flex items-center gap-4 animate-in fade-in zoom-in duration-300 w-full max-w-sm border border-indigo-400 relative overflow-hidden">
                    <div className="flex flex-col border-r border-white/20 pr-4 shrink-0 text-left relative z-10">
                      <p className="text-[9px] font-black opacity-60 uppercase tracking-widest leading-none mb-1.5">
                        {selectedGroupIds.length === 1 ? '选中组' : `已选中 ${selectedGroupIds.length} 组`}
                      </p>
                      <p className="text-[11px] font-black truncate max-w-[90px] leading-none">
                        {selectedGroupIds.length === 1 ? selectedGroupIds[0] : '批量编辑中'}
                      </p>
                    </div>
                    <div className="flex-1 flex gap-1.5 bg-black/20 p-1 rounded-[1.2rem] relative z-10">
                      <button 
                        onClick={() => updateSelectedGroupsOrientation('horizontal')} 
                        className={`flex-1 py-2 text-white rounded-xl transition-all font-black text-[10px] uppercase hover:bg-white/10`}
                      >
                        横向
                      </button>
                      <button 
                        onClick={() => updateSelectedGroupsOrientation('vertical')} 
                        className={`flex-1 py-2 text-white rounded-xl transition-all font-black text-[10px] uppercase hover:bg-white/10`}
                      >
                        竖向
                      </button>
                    </div>
                    <button onClick={handleClearSelection} className="ml-1 text-white/50 hover:text-white transition-colors relative z-10"><X className="w-5 h-5" /></button>
                  </div>
                ) : overflowInfo.isOverflowing && (
                  <div className="bg-rose-600 px-5 py-2.5 rounded-[2rem] shadow-2xl text-white flex items-center gap-4 animate-bounce w-full max-w-sm border border-rose-400 relative overflow-hidden">
                    <div className="bg-white/20 p-2 rounded-full">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">孔位不足</p>
                      <p className="text-[11px] font-black leading-tight">
                        有 {overflowInfo.missingGroups} 组复孔无法放下，请尝试切换复孔方向，必要时减少样本或引物。
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
                <button onClick={exportToSVG} className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-black text-xs shadow-lg shadow-emerald-100">
                  <Download className="w-5 h-5" /> 导出 SVG
                </button>
                <button onClick={handleFullReset} className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all active:scale-90 shadow-sm border border-rose-100 flex items-center justify-center" title="初始化方案">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 加样区 */}
            <div 
              className="bg-slate-50 p-8 rounded-[3.5rem] border border-slate-100 shadow-inner flex justify-center overflow-hidden"
              onClick={handleClearSelection}
            >
              <div className="overflow-x-auto max-w-full pb-6 scrollbar-hide" onClick={(e) => e.stopPropagation()}>
                <div 
                  className="grid gap-2 p-2" 
                  style={{ 
                    // 动态列数配置
                    gridTemplateColumns: `3rem repeat(${activeCols.end - activeCols.start + 1}, ${cellSizeVal})` 
                  }}
                >
                  {/* Header Row */}
                  <div className="h-8"></div>
                  {Array.from({ length: activeCols.end - activeCols.start + 1 }).map((_, i) => (
                    <div key={i} className="text-center text-xs font-black text-slate-300 h-8 flex items-center justify-center uppercase tracking-widest bg-slate-200/20 rounded-xl">
                      {activeCols.start + i + 1}
                    </div>
                  ))}
                  
                  {/* Content Rows */}
                  {Array.from({ length: currentPlate.rows }).map((_, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      <div className="flex items-center justify-center text-xl font-black text-slate-200 h-full mr-2 uppercase italic">
                        {String.fromCharCode(65 + rowIndex)}
                      </div>
                      {Array.from({ length: activeCols.end - activeCols.start + 1 }).map((_, i) => {
                        const colIdx = activeCols.start + i;
                        const idx = rowIndex * currentPlate.cols + colIdx;
                        const well = wells[idx];
                        const isSelected = well && selectedGroupIds.includes(well.id);
                        const isDragging = well && draggedGroupIds.includes(well.id);
                        
                        return (
                          <div
                            key={idx}
                            draggable={!!well}
                            onDragStart={() => well && handleDragStart(idx, well.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(idx)}
                            onClick={(e) => {
                              if (well) handleWellClick(e, well.id);
                              else handleClearSelection();
                            }}
                            className={`relative border rounded-[0.8rem] flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-sm overflow-hidden
                              ${well ? 'border-white hover:scale-105' : 'bg-white/50 border-dashed border-slate-200 opacity-20'}
                              ${isSelected ? 'ring-[4px] ring-indigo-500 ring-offset-2 z-10 scale-110 border-indigo-500 shadow-indigo-200 shadow-xl' : 'ring-1 ring-slate-100'}
                              ${isDragging ? 'opacity-50 border-indigo-300' : ''}
                            `}
                            style={{ 
                              backgroundColor: well ? targetColorMap[well.target] : 'transparent',
                              width: cellSizeVal,
                              height: cellSizeVal,
                            }}
                          >
                            {well && (
                              <div className="text-center w-full px-0.5 overflow-hidden select-none">
                                <div className={`font-black truncate leading-tight text-white tracking-tighter drop-shadow-md uppercase ${plateType === 384 ? 'text-[8px]' : 'text-[10px]'}`}>{well.target}</div>
                                <div className={`text-white font-black truncate leading-tight mt-0.5 tracking-tighter drop-shadow-md opacity-90 ${plateType === 384 ? 'text-[7px]' : 'text-[9px]'}`}>{well.sample}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* 下置配液表 */}
            <div className={`mt-12 grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-8 border-t-4 border-slate-50 pt-10`}>
              {mixSummary ? (
                <div className="bg-emerald-50 p-8 rounded-[3rem] border border-emerald-100 relative overflow-hidden shadow-xl shadow-emerald-50 transition-all hover:scale-[1.02]">
                   <div className="flex justify-between items-center mb-8">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">Reference Master Mix</span>
                        <h3 className="text-2xl font-black text-emerald-800 leading-none">{mixSummary.target} 体系指南</h3>
                      </div>
                      <div className="bg-emerald-600 text-white px-5 py-2 rounded-2xl text-[11px] font-black shadow-lg uppercase">
                        {mixSummary.count} Wells
                      </div>
                   </div>
                   <div className="space-y-4 relative z-10">
                      {mixSummary.components.map((c, i) => (
                        <div key={i} className="flex justify-between text-base py-2.5 border-b border-emerald-200/50 border-dashed group transition-colors hover:bg-white/30 rounded-lg px-2">
                          <span className="text-slate-600 font-bold group-hover:text-emerald-800 transition-colors">{c.name}</span>
                          <span className="font-mono font-black text-emerald-700 tracking-tighter">{c.total} μl</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xl pt-6 mt-2 border-t-2 border-emerald-200 font-black text-slate-900 uppercase tracking-tighter">
                        <span>总配液体积 (含{calcConfig.lossFactor}%损耗)</span>
                        <span className="text-emerald-600">{mixSummary.totalVol} μl</span>
                      </div>
                   </div>
                   <Dna className="absolute -bottom-12 -right-12 w-56 h-56 text-emerald-200/20 rotate-12 pointer-events-none" />
                </div>
              ) : (
                <div className="bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200 flex items-center justify-center p-16 text-slate-300 font-black text-xl uppercase tracking-widest">Waiting for data</div>
              )}

              <div className="flex flex-col justify-center space-y-6 px-4">
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex items-start gap-6 shadow-xl shadow-slate-100 transition-all hover:bg-indigo-50/20">
                    <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-lg flex-shrink-0 animate-bounce"><Info className="w-8 h-8" /></div>
                    <div className="flex-1">
                      <h4 className="font-black text-indigo-900 text-lg mb-3 uppercase tracking-tight border-b border-slate-100 pb-2 text-left">操作提示</h4>
                      <ul className="text-[12px] text-slate-500 leading-relaxed font-bold space-y-2 text-left">
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                         切换到384孔板模式时，建议使用大屏幕设备查看。
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                          直接点击目标加样孔可选中一组复孔，并单独调整复孔方向；按住 Ctrl/Command 键点击可实现多选并批量调节方向。
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                          结构化交换：拖拽已选中孔位，可整体移动并保持其内部横纵结构不变。
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center text-[10px] shrink-0 mt-0.5">4</span>
                          修改配置后，系统会重置自定义排版并重新执行智能方向决策。
                        </li>
                      </ul>
                    </div>
                 </div>
              </div>
            </div>
            
            <footer className="mt-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] pb-4 italic">
              All rights reserved by ZHANG SHUANG
            </footer>
          </section>
        </div>

      </div>
    </div>
  );
};

export default App;