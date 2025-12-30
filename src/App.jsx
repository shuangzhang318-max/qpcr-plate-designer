import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Trash2, Download, Calculator, Wand2, 
  Info, Layout, Beaker, 
  Plus, Minus, ArrowRightLeft, ArrowDownUp,
  ChevronRight, CheckCircle2, Settings2, Box,
  Smartphone, Monitor, Activity, FlaskConical, 
  RotateCcw, ImageIcon, FileImage
} from 'lucide-react';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const COLS = Array.from({ length: 12 }, (_, i) => i + 1);

const App = () => {
  const [viewMode, setViewMode] = useState('desktop');
  const plateRef = useRef(null); // 用于引用孔板DOM元素进行截图

  const [wells, setWells] = useState(Array(96).fill(null).map((_, i) => ({
    id: i,
    row: ROWS[Math.floor(i / 12)],
    col: COLS[i % 12],
    sample: '',
    gene: '',
  })));

  // 在组件加载时引入 html2canvas 库用于图片生成
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      // 清理脚本（可选）
    };
  }, []);

  // 计算已使用的孔数
  const usedWellsCount = useMemo(() => wells.filter(w => w.sample || w.gene).length, [wells]);

  const [autoInput, setAutoInput] = useState({
    samples: "Sample1\nSample2\nSample3\nSample4\nSample5\nSample6\nSample7\nSample8",
    genes: "GAPDH\nTarget1",
    replicates: 3,
    priority: 'gene', 
    repDirection: 'vertical', 
  });

  const [recipe, setRecipe] = useState([
    { id: 1, name: '2× Master Mix', vol: 10 },
    { id: 2, name: 'Primer Mix (F+R)', vol: 1 },
    { id: 3, name: 'cDNA 模板', vol: 2 },
    { id: 4, name: '无核酸酶水', vol: 7 }
  ]);

  const [extraPercent, setExtraPercent] = useState(10);

  const totalVolPerWell = useMemo(() => recipe.reduce((acc, curr) => acc + curr.vol, 0), [recipe]);

  const geneColors = useMemo(() => {
    const uniqueGenes = [...new Set(wells.map(w => w.gene).filter(g => g !== ''))];
    const colors = [
      'bg-blue-50 border-blue-200', 'bg-emerald-50 border-emerald-200', 
      'bg-amber-50 border-amber-200', 'bg-purple-50 border-purple-200', 
      'bg-rose-50 border-rose-200', 'bg-cyan-50 border-cyan-200'
    ];
    return uniqueGenes.reduce((acc, gene, i) => {
      acc[gene] = colors[i % colors.length];
      return acc;
    }, {});
  }, [wells]);

  const sampleColors = useMemo(() => {
    const uniqueSamples = [...new Set(wells.map(w => w.sample).filter(s => s !== ''))];
    const colors = [
      'bg-blue-500', 'bg-red-500', 'bg-emerald-500', 'bg-amber-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500',
      'bg-teal-500', 'bg-lime-500', 'bg-fuchsia-500', 'bg-sky-500'
    ];
    const textColors = [
      'text-blue-700', 'text-red-700', 'text-emerald-700', 'text-amber-700', 
      'text-purple-700', 'text-pink-700', 'text-indigo-700', 'text-orange-700',
      'text-teal-700', 'text-lime-700', 'text-fuchsia-700', 'text-sky-700'
    ];
    return uniqueSamples.reduce((acc, sample, i) => {
      acc[sample] = {
        stripe: colors[i % colors.length],
        text: textColors[i % textColors.length]
      };
      return acc;
    }, {});
  }, [wells]);

  const generateLayout = () => {
    const sampleList = autoInput.samples.split('\n').map(s => s.trim()).filter(s => s);
    const geneList = autoInput.genes.split('\n').map(g => g.trim()).filter(g => g);
    const reps = parseInt(autoInput.replicates);
    if (sampleList.length === 0 || geneList.length === 0) return;
    
    const items = [];
    if (autoInput.priority === 'gene') {
      geneList.forEach(gene => sampleList.forEach(sample => items.push({ sample, gene })));
    } else {
      sampleList.forEach(sample => geneList.forEach(gene => items.push({ sample, gene })));
    }
    
    const totalNeeded = items.length * reps;
    if (totalNeeded > 96) return alert("所需孔数超过96孔限制！");
    
    const newWells = Array(96).fill(null).map((_, i) => ({ id: i, row: ROWS[Math.floor(i / 12)], col: COLS[i % 12], sample: '', gene: '', }));
    const colsNeeded = Math.ceil(totalNeeded / 8);
    const startCol = Math.floor((12 - colsNeeded) / 2);

    if (autoInput.repDirection === 'vertical') {
      let cur = 0;
      items.forEach(item => {
        for (let r = 0; r < reps; r++) {
          const col = startCol + Math.floor(cur / 8);
          const row = cur % 8;
          const idx = row * 12 + col;
          if (idx < 96) { newWells[idx] = { ...newWells[idx], ...item }; cur++; }
        }
      });
    } else {
      const numBlocks = Math.ceil(items.length / 8);
      const startColH = Math.floor((12 - (numBlocks * reps)) / 2);
      items.forEach((item, itemIdx) => {
        const block = Math.floor(itemIdx / 8);
        const row = itemIdx % 8;
        for (let r = 0; r < reps; r++) {
          const col = startColH + (block * reps) + r;
          const idx = row * 12 + col;
          if (idx < 96) newWells[idx] = { ...newWells[idx], ...item };
        }
      });
    }
    setWells(newWells);
  };

  const handleExportPNG = async () => {
  try {
    // ===== 1) 用“同一套规则”生成颜色映射（避免依赖 Tailwind/oklch）=====
    const uniqueGenes = [...new Set(wells.map(w => w.gene).filter(Boolean))];
    const uniqueSamples = [...new Set(wells.map(w => w.sample).filter(Boolean))];

    const genePalette = [
      { bg: '#eff6ff', border: '#bfdbfe' }, // blue-50 / blue-200
      { bg: '#ecfdf5', border: '#a7f3d0' }, // emerald-50 / emerald-200
      { bg: '#fffbeb', border: '#fde68a' }, // amber-50 / amber-200
      { bg: '#faf5ff', border: '#e9d5ff' }, // purple-50 / purple-200
      { bg: '#fff1f2', border: '#fecdd3' }, // rose-50 / rose-200
      { bg: '#ecfeff', border: '#a5f3fc' }, // cyan-50 / cyan-200
    ];

    const sampleStripePalette = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#a855f7', '#ec4899', '#6366f1', '#f97316',
      '#14b8a6', '#84cc16', '#d946ef', '#0ea5e9',
    ];

    const sampleTextPalette = [
      '#1d4ed8', '#b91c1c', '#047857', '#b45309',
      '#6d28d9', '#be185d', '#4338ca', '#c2410c',
      '#0f766e', '#4d7c0f', '#a21caf', '#0369a1',
    ];

    const geneMap = {};
    uniqueGenes.forEach((g, i) => { geneMap[g] = genePalette[i % genePalette.length]; });

    const sampleMap = {};
    uniqueSamples.forEach((s, i) => {
      sampleMap[s] = {
        stripe: sampleStripePalette[i % sampleStripePalette.length],
        text: sampleTextPalette[i % sampleTextPalette.length],
      };
    });

    // ===== 2) 生成 SVG（96孔板：含行列标签、孔号、样本名/引物名、颜色条）=====
    const ROWS_LOCAL = ROWS; // 你代码里已有 ROWS / COLS
    const COLS_LOCAL = COLS;

    // 尺寸：可按需要微调
    const pad = 18;
    const labelW = 44;
    const labelH = 28;
    const cellW = 122;
    const cellH = 74;
    const stripeW = 7;

    const width = pad * 2 + labelW + COLS_LOCAL.length * cellW;
    const height = pad * 2 + labelH + ROWS_LOCAL.length * cellH;

    const esc = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // 简单文本换行：按“字符数”粗略折行（够用且稳定）
    const wrap = (txt, maxCharsPerLine, maxLines = 2) => {
      const t = String(txt ?? '').trim();
      if (!t) return [];
      const out = [];
      let cur = '';
      for (const ch of t) {
        if (cur.length >= maxCharsPerLine) {
          out.push(cur);
          cur = '';
          if (out.length >= maxLines) break;
        }
        cur += ch;
      }
      if (out.length < maxLines && cur) out.push(cur);
      return out;
    };

    let svg = '';
    svg += `<?xml version="1.0" encoding="UTF-8"?>`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // 背景
    svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`;

    // 标题（可删）
    svg += `<text x="${pad}" y="${pad - 4 + 14}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="14" font-weight="800" fill="#0f172a">96孔板布局</text>`;

    const gridX0 = pad + labelW;
    const gridY0 = pad + labelH;

    // 列标签
    COLS_LOCAL.forEach((c, cIdx) => {
      const x = gridX0 + cIdx * cellW + cellW / 2;
      const y = pad + labelH - 10;
      svg += `<text x="${x}" y="${y}" text-anchor="middle"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
        font-size="12" font-weight="800" fill="#f97316">${esc(c)}</text>`;
    });

    // 行标签 + 单元格
    ROWS_LOCAL.forEach((r, rIdx) => {
      // 行标签
      const lx = pad + labelW / 2;
      const ly = gridY0 + rIdx * cellH + cellH / 2 + 5;
      svg += `<text x="${lx}" y="${ly}" text-anchor="middle"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
        font-size="12" font-weight="900" fill="#f97316">${esc(r)}</text>`;

      COLS_LOCAL.forEach((c, cIdx) => {
        const idx = rIdx * 12 + cIdx;
        const well = wells[idx];
        const hasData = !!(well?.sample || well?.gene);

        const geneStyle = hasData && well.gene ? geneMap[well.gene] : null;
        const sampleStyle = hasData && well.sample ? sampleMap[well.sample] : null;

        const x = gridX0 + cIdx * cellW;
        const y = gridY0 + rIdx * cellH;

        const bg = hasData && geneStyle ? geneStyle.bg : '#f8fafc';
        const border = hasData && geneStyle ? geneStyle.border : '#e2e8f0';

        // 外框
        svg += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="14" ry="14" fill="${bg}" stroke="${border}" stroke-width="2"/>`;

        // 左侧样本条
        if (hasData && sampleStyle) {
          svg += `<rect x="${x}" y="${y}" width="${stripeW}" height="${cellH}" rx="14" ry="14" fill="${sampleStyle.stripe}"/>`;
          // 覆盖右侧圆角（让条只在左侧圆角）
          svg += `<rect x="${x + stripeW}" y="${y}" width="2" height="${cellH}" fill="${bg}"/>`;
        }

        // 孔号（左上角）
        svg += `<text x="${x + stripeW + 8}" y="${y + 16}"
          font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          font-size="9" font-weight="700" fill="#cbd5e1">${esc(r)}${esc(c)}</text>`;

        // 内容：样本名 + 分割线 + 引物名
        if (hasData) {
          const contentX = x + stripeW + 10;
          const contentW = cellW - stripeW - 20;

          const sample = (well?.sample || '').trim();
          const gene = (well?.gene || '').trim();

          // 样本名（尽量两行）
          const sampleLines = wrap(sample, 10, 2);
          const sampleColor = sampleStyle?.text || '#0f172a';

          let ty = y + 34;
          sampleLines.forEach((line) => {
            svg += `<text x="${contentX + contentW / 2}" y="${ty}" text-anchor="middle"
              font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
              font-size="14" font-weight="900" fill="${sampleColor}">${esc(line)}</text>`;
            ty += 16;
          });

          // 分割线
          if (sample) {
            const midY = y + 52;
            svg += `<line x1="${x + cellW / 2 - 10}" y1="${midY}" x2="${x + cellW / 2 + 10}" y2="${midY}" stroke="#cbd5e1" stroke-opacity="0.5" stroke-width="2" />`;
          }

          // 引物名
          if (gene) {
            svg += `<text x="${contentX + contentW / 2}" y="${y + cellH - 14}" text-anchor="middle"
              font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
              font-size="12" font-weight="800" fill="#94a3b8">${esc(gene.toUpperCase())}</text>`;
          }
        }
      });
    });

    svg += `</svg>`;

    // ===== 3) SVG -> PNG（canvas）并下载 =====
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    // 如果将来你在 SVG 里嵌入外部资源，再考虑 crossOrigin
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error('SVG 渲染失败，无法生成图片'));
      img.src = url;
    });

    const scale = 2; // 2倍更清晰
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);

    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `96孔板_${new Date().getTime()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('导出图片失败:', err);
    alert(`导出图片失败：${err?.message || err}`);
  }
};

  const geneCalculations = useMemo(() => {
    const stats = {};
    wells.forEach(w => { if (w.gene) stats[w.gene] = (stats[w.gene] || 0) + 1; });
    return Object.entries(stats).map(([geneName, count]) => {
      const n = count * (1 + extraPercent / 100);
      return { 
        geneName, count, actualN: n.toFixed(1), 
        items: recipe.map(r => ({ name: r.name, total: (r.vol * n).toFixed(1) })) 
      };
    });
  }, [wells, recipe, extraPercent]);

  const globalCalculations = useMemo(() => {
    const n = usedWellsCount * (1 + extraPercent / 100);
    return {
      total: (totalVolPerWell * n).toFixed(1),
      items: recipe.map(r => ({ name: r.name, total: (r.vol * n).toFixed(1) }))
    };
  }, [usedWellsCount, extraPercent, recipe, totalVolPerWell]);

  const updateRecipeItem = (id, field, val) => {
    setRecipe(recipe.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  return (
    <div className={`min-h-screen bg-slate-50 transition-all duration-500 font-sans ${viewMode === 'mobile' ? 'p-2' : 'p-4 lg:p-10'}`}>
      <div className={`mx-auto transition-all duration-500 ${viewMode === 'mobile' ? 'max-w-md' : 'max-w-[1800px]'}`}>
        
        {/* Header Section */}
        <header className={`flex flex-col md:flex-row justify-between items-center bg-white shadow-sm border border-slate-200 mb-8 transition-all overflow-hidden ${viewMode === 'mobile' ? 'p-4 rounded-2xl' : 'p-6 rounded-3xl'}`}>
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200"><Box size={24}/></div>
            <div>
              <h1 className={`${viewMode === 'mobile' ? 'text-lg' : 'text-2xl'} font-black text-slate-900 tracking-tight leading-none`}>qPCR 专家排版系统</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Smart Layout Engine v2.0</p>
              </div>
            </div>
          </div>
          
          <div className={`flex items-center gap-4 ${viewMode === 'mobile' ? 'mt-6 w-full justify-between' : ''}`}>
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setViewMode('desktop')} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-bold ${viewMode === 'desktop' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <Monitor size={14} /> {viewMode === 'desktop' && '桌面端'}
              </button>
              <button onClick={() => setViewMode('mobile')} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-bold ${viewMode === 'mobile' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <Smartphone size={14} /> {viewMode === 'mobile' && '手机端'}
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={handleExportPNG} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center gap-2" title="导出为图片">
                <FileImage size={14}/> 导出 PNG
              </button>
              <button onClick={() => {
                const csv = "Well,Sample,Gene\n" + wells.filter(w => w.sample).map(w => `${w.row}${w.col},${w.sample},${w.gene}`).join("\n");
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'qPCR_Layout.csv';
                a.click();
              }} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black transition flex items-center gap-2">
                <Download size={14}/> 导出 CSV
              </button>
              <button onClick={() => setWells(wells.map(w => ({ ...w, sample: '', gene: '' })))} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="重置">
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-col gap-8 items-start">
          
          {/* PLATE PREVIEW (FULL WIDTH ON TOP) */}
          <div className="w-full space-y-8">
            <div id="plate-capture" ref={plateRef} className={`bg-white border border-slate-200 shadow-sm relative transition-all ${viewMode === 'mobile' ? 'p-4 rounded-3xl' : 'p-10 rounded-[3rem]'}`}>
              <div className="flex justify-between items-center mb-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Layout size={18} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Plate Grid System</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">实验孔板实时预览</h2>
                </div>
                <div className="flex items-end gap-1">
                   <div className={`${viewMode === 'mobile' ? 'text-3xl' : 'text-5xl'} font-black text-slate-900 font-mono leading-none tracking-tighter`}>{usedWellsCount}</div>
                   <div className="text-slate-300 font-bold mb-1">/ 96</div>
                </div>
              </div>

              <div className="relative group">
                <div className="overflow-x-auto pb-4 custom-scrollbar">
                  <div className="inline-grid grid-cols-[40px_repeat(12,1fr)] gap-3 min-w-[800px]">
                    <div />
                    {COLS.map(c => <div key={c} className={`text-center font-black text-[11px] ${[6,7].includes(c) ? 'text-orange-500 bg-orange-50/50 rounded-t-lg' : 'text-orange-500'}`}>{c}</div>)}
                    {ROWS.map((row, rIdx) => (
                      <React.Fragment key={row}>
                        <div className="flex items-center justify-center font-black text-orange-500 text-xs">{row}</div>
                        {COLS.map((col, cIdx) => {
                          const idx = rIdx * 12 + cIdx;
                          const well = wells[idx];
                          const hasData = well.sample || well.gene;
                          const colorClass = hasData ? (geneColors[well.gene] || 'bg-slate-50 border-slate-200') : 'bg-slate-50/20 border-slate-100';
                          const sampleStyles = hasData ? sampleColors[well.sample] : null;
                          return (
                            <div key={idx} className={`${viewMode === 'mobile' ? 'h-20' : 'h-12'} border rounded-2xl transition-all flex flex-row items-stretch overflow-hidden relative ${colorClass} ${hasData ? 'shadow-sm border-opacity-60 scale-100 hover:scale-110 z-10' : 'hover:border-slate-200'} ${[6,7].includes(col) && !hasData ? 'bg-indigo-50/5' : ''}`}>
                              {hasData && <div className={`w-1.5 shrink-0 ${sampleStyles?.stripe || 'bg-slate-300'}`}></div>}
                              <div className="flex-1 flex flex-col items-center justify-center p-1.5 text-center relative overflow-hidden">
                                <span className="text-[7px] text-slate-300 absolute top-1 left-1.5 font-mono">{row}{col}</span>
                                {well.sample && (
                                  <div className="flex flex-col w-full px-1">
                                    <span className={`text-[11px] font-black leading-tight break-all ${sampleStyles?.text || 'text-slate-900'}`}>{well.sample}</span>
                                    <div className="h-px w-4 bg-slate-300/30 mx-auto my-1"></div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{well.gene}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-slate-100 flex flex-wrap gap-8 items-center justify-center">
                <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div> 侧边条: 样品来源</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-indigo-50 border border-indigo-200 rounded-md"></div> 背景色: 引物体系</div>
                </div>
              </div>
            </div>

            {/* Calculations Row */}
            <div className={`grid grid-cols-1 ${viewMode === 'desktop' ? 'lg:grid-cols-2' : ''} gap-6`}>
              {geneCalculations.map((calc, idx) => (
                <div key={idx} className="bg-white rounded-[2.5rem] p-8 text-slate-900 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-10 rounded-full shadow-sm ${geneColors[calc.geneName]?.split(' ')[0] || 'bg-blue-400'}`}></div>
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">{calc.geneName}</h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Master Mix Recipe</p>
                      </div>
                    </div>
                    <div className="text-right bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                      <span className="text-2xl font-black text-indigo-600 font-mono">{calc.actualN}</span>
                      <span className="text-[9px] text-slate-400 font-bold ml-1 uppercase">Wells</span>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-slate-50 pt-4">
                    {calc.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs py-1 group">
                        <span className="font-bold text-slate-500 group-hover:text-slate-700 transition-colors">{item.name}</span>
                        <div className="flex items-baseline gap-1">
                           <span className="font-mono font-black text-slate-900">{item.total}</span>
                           <span className="text-[9px] text-slate-400 font-bold uppercase">微升</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SETTINGS PANELS (PARALLEL ON DESKTOP) */}
          <div className={`w-full flex ${viewMode === 'desktop' ? 'flex-row' : 'flex-col'} gap-6`}>
            
            {/* Dashboard Control Panel */}
            <div className="flex-1 bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-800 overflow-hidden text-white">
              <div className="p-8 bg-indigo-600 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl"><Settings2 size={20}/></div>
                  <h2 className="font-black uppercase tracking-widest text-sm text-white">Dashboard</h2>
                </div>
                <div className="text-[10px] bg-black/20 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-white/10">Configuration</div>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <Layout size={12}/> 样品列表 Samples (一行一个)
                    </label>
                    <textarea 
                      className="w-full h-32 text-xs border-2 border-slate-800 rounded-3xl p-5 focus:border-indigo-500 outline-none font-mono bg-slate-800/40 text-slate-200 shadow-inner resize-none"
                      value={autoInput.samples}
                      onChange={e => setAutoInput({...autoInput, samples: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <FlaskConical size={12}/> 基因列表 Genes (一行一个)
                    </label>
                    <textarea 
                      className="w-full h-24 text-xs border-2 border-slate-800 rounded-3xl p-5 focus:border-indigo-500 outline-none font-mono bg-slate-800/40 text-slate-200 shadow-inner resize-none"
                      value={autoInput.genes}
                      onChange={e => setAutoInput({...autoInput, genes: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-8">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">排布优先级</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button onClick={() => setAutoInput({...autoInput, priority: 'gene'})} className={`py-3 px-4 rounded-2xl text-[10px] font-black transition-all flex items-center justify-between ${autoInput.priority === 'gene' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:text-slate-400'}`}>
                        引物优先 {autoInput.priority === 'gene' && <CheckCircle2 size={12}/>}
                      </button>
                      <button onClick={() => setAutoInput({...autoInput, priority: 'sample'})} className={`py-3 px-4 rounded-2xl text-[10px] font-black transition-all flex items-center justify-between ${autoInput.priority === 'sample' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:text-slate-400'}`}>
                        样本优先 {autoInput.priority === 'sample' && <CheckCircle2 size={12}/>}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">复孔排列方向</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button onClick={() => setAutoInput({...autoInput, repDirection: 'vertical'})} className={`py-3 px-4 rounded-2xl text-[10px] font-black transition-all flex items-center justify-between ${autoInput.repDirection === 'vertical' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:text-slate-400'}`}>
                        纵向填充 <ArrowDownUp size={12}/>
                      </button>
                      <button onClick={() => setAutoInput({...autoInput, repDirection: 'horizontal'})} className={`py-3 px-4 rounded-2xl text-[10px] font-black transition-all flex items-center justify-between ${autoInput.repDirection === 'horizontal' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:text-slate-400'}`}>
                        横向跨管 <ArrowRightLeft size={12}/>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-black/30 p-5 rounded-[2rem] border border-slate-800">
                   <div className="flex-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">重复数 (n)</label>
                      <div className="flex items-center gap-3">
                         <input type="number" className="bg-transparent text-xl font-black text-indigo-400 outline-none w-12 font-mono" value={autoInput.replicates} onChange={e => setAutoInput({...autoInput, replicates: e.target.value})} />
                         <span className="text-[10px] font-bold text-slate-600 uppercase">Replicates</span>
                      </div>
                   </div>
                   <button onClick={generateLayout} className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black text-xs hover:bg-indigo-50 transition-colors shadow-xl">生成方案</button>
                </div>
              </div>
            </div>

            {/* Reagent Recipe Configuration Panel */}
            <div className="flex-1 bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Beaker size={18}/></div>
                  <h2 className="font-black uppercase tracking-widest text-xs text-slate-700">Master Mix Recipe</h2>
                </div>
                <button onClick={() => setRecipe([...recipe, { id: Date.now(), name: '新成分', vol: 0 }])} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl transition-colors"><Plus size={20}/></button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {recipe.map((item) => (
                    <div key={item.id} className="flex gap-4 items-center group bg-white border border-slate-100 p-4 rounded-2xl hover:border-indigo-200 hover:shadow-sm transition-all">
                      <div className="flex-1">
                        <input className="w-full bg-transparent text-xs font-black outline-none text-slate-700 uppercase tracking-tight" value={item.name} onChange={e => updateRecipeItem(item.id, 'name', e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.1" className="w-16 bg-slate-50 rounded-xl px-2 py-1.5 text-xs font-mono font-black text-right border border-transparent focus:bg-white focus:border-indigo-200 outline-none" value={item.vol} onChange={e => updateRecipeItem(item.id, 'vol', parseFloat(e.target.value) || 0)} />
                        <span className="text-[10px] font-black text-slate-300">微升</span>
                      </div>
                      <button onClick={() => setRecipe(recipe.filter(r => r.id !== item.id))} className="text-slate-200 hover:text-red-400 transition-colors"><Minus size={16}/></button>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-slate-100 space-y-6">
                  <div className="flex justify-between items-baseline px-2 text-slate-900">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">单孔体系总量:</label>
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter italic">
                      {totalVolPerWell.toFixed(1)} <span className="text-xs uppercase ml-1 not-italic text-slate-400">微升</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100/50">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block">Loss Factor</label>
                       <p className="text-[9px] text-indigo-400 font-medium italic leading-none">损耗余量比例</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 bg-white border border-indigo-100 rounded-xl px-2 py-2 text-right text-sm font-black text-indigo-600 outline-none shadow-sm" value={extraPercent} onChange={e => setExtraPercent(parseFloat(e.target.value) || 0)} />
                      <span className="text-sm font-black text-indigo-300">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}} />
    </div>
  );
};

export default App;