import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { StudyLog, DayStats, HeatmapTheme } from '../types';
import { useTheme } from '../AppContext';

interface HeatmapProps {
  data: StudyLog[];
  year: number;
  onDayClick: (date: string) => void;
  isDarkMode: boolean;
  theme: HeatmapTheme;
  onThemeChange: (theme: HeatmapTheme) => void;
}

type Density = 'compact' | 'standard' | 'spacious';
type LayoutType = 'vertical' | 'horizontal' | 'frequency';

export const Heatmap: React.FC<HeatmapProps> = ({ data, year, onDayClick, isDarkMode, theme, onThemeChange }) => {
  const { appTheme } = useTheme();
  const isCyberpunk = appTheme === 'cyberpunk';
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  
  // View Preferences
  const [density, setDensity] = useState<Density>(() => {
      if (typeof window === 'undefined') return 'standard';
      return (localStorage.getItem('heatmap_density') as Density) || 'standard';
  });
  
  const [showWeekends, setShowWeekends] = useState(() => {
      if (typeof window === 'undefined') return true;
      const s = localStorage.getItem('heatmap_weekends');
      return s !== null ? s === 'true' : true;
  });

  const [layout, setLayout] = useState<LayoutType>(() => {
      if (typeof window === 'undefined') return 'vertical';
      const old = localStorage.getItem('heatmap_orientation');
      if (old === 'horizontal') return 'horizontal';
      return (localStorage.getItem('heatmap_layout') as LayoutType) || 'vertical';
  });

  useEffect(() => {
      localStorage.setItem('heatmap_density', density);
  }, [density]);

  useEffect(() => {
      localStorage.setItem('heatmap_weekends', String(showWeekends));
  }, [showWeekends]);

  useEffect(() => {
      localStorage.setItem('heatmap_layout', layout);
  }, [layout]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
              setShowSettings(false);
          }
      };
      if (showSettings) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  useEffect(() => {
      if (!containerRef.current) return;
      
      const resizeObserver = new ResizeObserver((entries) => {
          if (!entries || entries.length === 0) return;
          
          const entry = entries[0];
          // Debounce slightly to prevent "ResizeObserver loop limit exceeded"
          // and reduce render frequency during rapid resizing
          setTimeout(() => {
              if (entry.contentRect.width > 0) {
                  setContainerWidth(prev => {
                      const newWidth = Math.round(entry.contentRect.width);
                      // Only update if difference is significant (>2px) to prevent jitter/loops
                      if (Math.abs(prev - newWidth) > 2) {
                          return newWidth;
                      }
                      return prev;
                  });
              }
          }, 10);
      });
      
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
  }, []);

  // Configuration for Skins
  const config = useMemo(() => ({
      compact: { height: 10, gap: 2, radius: 2 },
      standard: { height: 14, gap: 4, radius: 3 },
      spacious: { height: 18, gap: 6, radius: 4 }
  })[density], [density]);
  
  // Layout Constants
  const MONTH_LABEL_SIZE = 30;
  const DAY_LABEL_SIZE = 30;
  const TOP_LABEL_HEIGHT = 20;
  
  // Generate full year of dates
  const days = useMemo(() => {
    const dayArray: DayStats[] = [];
    const logMap = new Map<string, StudyLog>();
    data.forEach(log => logMap.set(log.date, log));

    // Determine number of days in year to iterate safely
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;

    for (let i = 0; i < daysInYear; i++) {
        // Create date from day 1 + index to allow automatic month rollover
        const d = new Date(year, 0, 1 + i);
        
        // Construct YYYY-MM-DD manually from local date components to avoid any timezone shifting
        const yearStr = d.getFullYear();
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

        const log = logMap.get(dateStr);
        dayArray.push({
            date: d,
            dateStr,
            value: log?.hours || 0,
            notes: log?.notes
        });
    }

    if (!showWeekends) {
        return dayArray.filter(d => {
            const day = d.date.getDay();
            return day !== 0 && day !== 6;
        });
    }

    return dayArray;
  }, [data, year, showWeekends]);

  // Color Scales
  const colorScale = useMemo(() => {
      let range: string[] = [];
      if (isCyberpunk) {
          switch (theme) {
            case 'blue': range = ['#001133', '#00f0ff']; break;
            case 'orange': range = ['#331100', '#ff9900']; break;
            case 'purple': range = ['#220033', '#ff00ff']; break;
            case 'green': 
            default: range = ['#003300', '#00ff00']; break;
          }
      } else if (isDarkMode) {
          switch (theme) {
            case 'blue': range = ['#172554', '#3b82f6']; break;
            case 'orange': range = ['#431407', '#f97316']; break;
            case 'purple': range = ['#3b0764', '#d8b4fe']; break;
            case 'green': 
            default: range = ['#052e16', '#4ade80']; break;
          }
      } else {
           switch (theme) {
            case 'blue': range = ['#dbeafe', '#1e40af']; break;
            case 'orange': range = ['#ffedd5', '#9a3412']; break;
            case 'purple': range = ['#f3e8ff', '#7e22ce']; break;
            case 'green': 
            default: range = ['#dcfce7', '#166534']; break;
          }
      }
      
      return d3.scaleLinear<string>()
        .domain([0.1, 8])
        .range(range)
        .clamp(true);
  }, [theme, isDarkMode, isCyberpunk]);

  // Helpers for Layout
  const isHorizontal = layout === 'horizontal' || layout === 'frequency';
  const numDaysPerRow = showWeekends ? 7 : 5;
  const weeksCount = 53; 

  // Calculate Dimensions
  let graphWidth = 0;
  let graphHeight = 0;
  
  if (isHorizontal) {
      graphWidth = DAY_LABEL_SIZE + weeksCount * (config.height + config.gap) + 20;
      graphHeight = TOP_LABEL_HEIGHT + numDaysPerRow * (config.height + config.gap) + 10;
  } else {
      // Dynamic width based on container
      // Padding roughly 48px from container p-6
      graphWidth = Math.max(300, containerWidth - 48); 
      const availableWidth = graphWidth - MONTH_LABEL_SIZE - 20;
      const minCellW = config.height;
      let verticalCellWidth = (availableWidth - ((numDaysPerRow - 1) * config.gap)) / numDaysPerRow;
      
      if (verticalCellWidth < minCellW) {
          verticalCellWidth = minCellW;
          graphWidth = MONTH_LABEL_SIZE + 20 + (verticalCellWidth * numDaysPerRow) + (config.gap * (numDaysPerRow - 1));
      }
      graphHeight = TOP_LABEL_HEIGHT + weeksCount * (config.height + config.gap) + 20;
  }

  // Calculate Cell Positions
  const cells = useMemo(() => days.map(day => {
    const dayOfWeek = day.date.getDay(); 
    const weekIndex = d3.timeMonday.count(d3.timeYear(day.date), day.date);
    
    let gridDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const maxRadius = config.height / 2;
    const radius = day.value === 0 
        ? 1.5 
        : Math.min(maxRadius, Math.max(2, Math.sqrt(day.value / 8) * maxRadius));

    if (isHorizontal) {
        return {
            ...day,
            x: DAY_LABEL_SIZE + weekIndex * (config.height + config.gap),
            y: TOP_LABEL_HEIGHT + gridDayIndex * (config.height + config.gap),
            width: config.height,
            height: config.height,
            color: day.value === 0 ? (isCyberpunk ? '#1a1a1a' : isDarkMode ? '#2d3748' : '#ebedf0') : colorScale(day.value),
            radius: radius
        };
    } else {
        const availableWidth = graphWidth - MONTH_LABEL_SIZE - 20;
        const cellW = (availableWidth - ((numDaysPerRow - 1) * config.gap)) / numDaysPerRow;
        
        return {
            ...day,
            x: MONTH_LABEL_SIZE + gridDayIndex * (cellW + config.gap),
            y: TOP_LABEL_HEIGHT + weekIndex * (config.height + config.gap),
            width: cellW,
            height: config.height,
            color: day.value === 0 ? (isCyberpunk ? '#1a1a1a' : isDarkMode ? '#2d3748' : '#ebedf0') : colorScale(day.value),
            radius: radius
        };
    }
  }), [days, isHorizontal, config, numDaysPerRow, isDarkMode, colorScale, graphWidth, isCyberpunk]);

  // Labels
  const labels = useMemo(() => {
      const monthNodes = [];
      const months = d3.timeMonths(new Date(year, 0, 1), new Date(year, 11, 31));

      if (isHorizontal) {
          months.forEach(d => {
              const weekIndex = d3.timeMonday.count(d3.timeYear(d), d);
              monthNodes.push({
                  x: DAY_LABEL_SIZE + weekIndex * (config.height + config.gap),
                  y: 10,
                  label: d3.timeFormat("%b")(d),
                  anchor: 'start'
              });
          });
          
          const dayNames = showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
          dayNames.forEach((name, i) => {
               monthNodes.push({
                   x: DAY_LABEL_SIZE - 6,
                   y: TOP_LABEL_HEIGHT + i * (config.height + config.gap) + config.height / 2,
                   label: name,
                   anchor: 'end',
                   isDay: true
               });
          });

      } else {
           months.forEach(d => {
              const weekIndex = d3.timeMonday.count(d3.timeYear(d), d);
              monthNodes.push({
                  x: 0,
                  y: TOP_LABEL_HEIGHT + weekIndex * (config.height + config.gap) + config.height / 2,
                  label: d3.timeFormat("%b")(d),
                  anchor: 'start'
              });
          });
          
          const dayNames = showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
          const availableWidth = graphWidth - MONTH_LABEL_SIZE - 20;
          const cellW = (availableWidth - ((numDaysPerRow - 1) * config.gap)) / numDaysPerRow;
          
          dayNames.forEach((name, i) => {
               monthNodes.push({
                   x: MONTH_LABEL_SIZE + i * (cellW + config.gap) + cellW / 2,
                   y: 10,
                   label: name,
                   anchor: 'middle',
                   isDay: true
               });
          });
      }
      return monthNodes;
  }, [year, config, isHorizontal, showWeekends, numDaysPerRow, graphWidth]);

  // Memoize the chart content to prevent re-rendering the entire SVG when tooltip state changes
  const chartContent = useMemo(() => (
      <svg 
          viewBox={`0 0 ${graphWidth} ${graphHeight}`} 
          className="w-full h-auto"
          style={isHorizontal ? { minWidth: graphWidth, height: graphHeight } : { maxHeight: 'none' }} 
      >
          {labels.map((l, i) => (
              <text
                  key={`label-${i}`}
                  x={l.x}
                  y={l.y}
                  className={`text-[10px] ${l.isDay ? (isCyberpunk ? 'fill-[#00f0ff]/60' : 'fill-gray-400') : (isCyberpunk ? 'fill-[#00f0ff] font-bold' : 'fill-gray-500 font-bold')}`}
                  textAnchor={l.anchor as any}
                  dominantBaseline="middle"
              >
                  {l.label}
              </text>
          ))}

          {cells.map((cell) => {
              const cellProps = {
                  key: cell.dateStr,
                  className: "cursor-pointer transition-opacity duration-200 hover:opacity-80",
                  onClick: () => onDayClick(cell.dateStr),
                  onMouseEnter: (e: React.MouseEvent) => {
                      if (containerRef.current) {
                          const containerRect = containerRef.current.getBoundingClientRect();
                          const cellRect = e.currentTarget.getBoundingClientRect();
                          
                          setTooltip({
                              x: cellRect.left - containerRect.left + cellRect.width / 2,
                              y: cellRect.top - containerRect.top - 10,
                              content: (
                                  <div className="text-center">
                                      <div className={`font-semibold ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-200'}`}>{cell.dateStr}</div>
                                      <div className={isCyberpunk ? 'text-[#00f0ff]/80' : 'text-gray-300'}>{cell.value > 0 ? `${cell.value} hours` : 'No study logged'}</div>
                                      {cell.notes && (
                                          <div className={`text-[10px] mt-1 max-w-[150px] italic border-t pt-1 ${isCyberpunk ? 'text-[#00f0ff]/60 border-[#00f0ff]/30' : 'text-gray-400 border-gray-600'}`}>
                                              "{cell.notes}"
                                          </div>
                                      )}
                                      <div className={`text-[9px] mt-1 ${isCyberpunk ? 'text-[#00f0ff]/40' : 'text-gray-500'}`}>Click to edit</div>
                                  </div>
                              )
                          });
                      }
                  },
                  onMouseLeave: () => setTooltip(null)
              };

              if (layout === 'frequency') {
                  return (
                      <g key={cell.dateStr}>
                          <circle
                              cx={cell.x + cell.width / 2}
                              cy={cell.y + cell.height / 2}
                              r={config.height / 4} 
                              className={`${isCyberpunk ? 'fill-[#1a1a1a]' : 'fill-gray-200 dark:fill-gray-700/50'} pointer-events-none`}
                          />
                          <circle
                              cx={cell.x + cell.width / 2}
                              cy={cell.y + cell.height / 2}
                              r={cell.radius}
                              fill={cell.color}
                              {...cellProps}
                          />
                      </g>
                  );
              } else {
                  return (
                      <rect
                          x={cell.x}
                          y={cell.y}
                          width={cell.width}
                          height={cell.height}
                          rx={config.radius}
                          fill={cell.color}
                          {...cellProps}
                      />
                  );
              }
          })}
      </svg>
  ), [graphWidth, graphHeight, isHorizontal, labels, cells, config, layout, onDayClick, isCyberpunk]);

  return (
    <div className={`w-full flex flex-col rounded-2xl border p-1 shadow-sm relative group ${isCyberpunk ? 'bg-[#0a0a0a] border-[#00f0ff]/30' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
        
        {/* Settings Panel Overlay */}
        {showSettings && (
            <div 
                ref={settingsRef}
                className={`absolute top-14 right-4 z-20 p-5 rounded-2xl shadow-2xl animate-fade-in-up w-72 backdrop-blur-xl ${isCyberpunk ? 'bg-black/90 border border-[#00f0ff]/50' : 'bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-700/50'}`}
            >
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500'}`}>Theme</label>
                        </div>
                        <div className={`flex justify-between p-2 rounded-xl ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-[#2c2c2e]'}`}>
                            {(['green', 'blue', 'orange', 'purple'] as HeatmapTheme[]).map(t => (
                                <button 
                                    key={t}
                                    onClick={() => onThemeChange(t)}
                                    className={`relative w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                                        t === 'green' ? 'bg-green-500 border-green-300 dark:border-green-800' : 
                                        t === 'blue' ? 'bg-blue-500 border-blue-300 dark:border-blue-800' : 
                                        t === 'orange' ? 'bg-orange-500 border-orange-300 dark:border-orange-800' : 'bg-purple-500 border-purple-300 dark:border-purple-800'
                                    } ${theme === t ? 'scale-110 ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600 dark:ring-offset-[#1c1c1e]' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                                >
                                    {theme === t && (
                                        <div className="w-2 h-2 bg-white rounded-full shadow-sm"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500'}`}>Layout</label>
                        </div>
                        <div className={`flex p-1 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-[#2c2c2e]'}`}>
                            {(['vertical', 'horizontal', 'frequency'] as LayoutType[]).map(o => (
                                <button
                                    key={o}
                                    onClick={() => setLayout(o)}
                                    className={`flex-1 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                                        layout === o 
                                        ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-sm' : 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm')
                                        : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700')
                                    }`}
                                >
                                    {o.charAt(0).toUpperCase() + o.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500'}`}>Box Size</label>
                        </div>
                        <div className={`flex p-1 rounded-lg ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/20' : 'bg-gray-100 dark:bg-[#2c2c2e]'}`}>
                             {(['compact', 'standard', 'spacious'] as Density[]).map((d) => (
                                 <button
                                    key={d}
                                    onClick={() => setDensity(d)}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                                        density === d 
                                        ? (isCyberpunk ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-sm' : 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm')
                                        : (isCyberpunk ? 'text-[#00f0ff]/40 hover:text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700')
                                    }`}
                                 >
                                     {d.charAt(0).toUpperCase() + d.slice(1)}
                                 </button>
                             ))}
                        </div>
                    </div>

                    <div>
                         <div className="flex justify-between items-center mb-3">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500'}`}>View Options</label>
                        </div>
                        <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group/opt ${isCyberpunk ? 'hover:bg-[#00f0ff]/10' : 'hover:bg-gray-50 dark:hover:bg-[#2c2c2e]'}`}>
                            <span className={`text-sm font-medium ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-700 dark:text-gray-300'}`}>Show Weekends</span>
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    checked={showWeekends}
                                    onChange={(e) => setShowWeekends(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className={`w-10 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isCyberpunk ? 'bg-[#0a0a0a] border border-[#00f0ff]/30 peer-checked:bg-[#00f0ff]' : 'bg-gray-200 dark:bg-gray-700 peer-checked:bg-blue-500'}`}></div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        )}

        <div ref={containerRef} className={`flex flex-col rounded-xl border p-6 relative transition-colors w-full ${isCyberpunk ? 'bg-black border-[#00f0ff]/20' : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-gray-700/50'}`}>
            <div className="flex justify-between items-start mb-4">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isCyberpunk ? 'text-[#00f0ff]' : 'text-gray-500 dark:text-gray-400'}`}>Activity Map</h3>
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`transition-colors p-1.5 rounded-lg ${isCyberpunk ? 'text-[#00f0ff] hover:bg-[#00f0ff]/10' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10'} ${showSettings ? (isCyberpunk ? 'bg-[#00f0ff]/20' : 'text-gray-900 bg-gray-100 dark:text-white dark:bg-white/10') : ''}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </button>
                </div>
            </div>

            <div className={`w-full flex ${isHorizontal ? 'overflow-x-auto pb-2' : 'justify-center'} min-h-[200px] custom-scrollbar`}>
                {chartContent}
            </div>

            {tooltip && (
                <div
                    className={`absolute z-50 px-3 py-2 text-xs rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full backdrop-blur-sm bg-opacity-95 ${isCyberpunk ? 'bg-black border border-[#00f0ff]/50 text-[#00f0ff]' : 'text-white bg-gray-900 border border-gray-700'}`}
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.content}
                    <div className={`absolute w-2 h-2 transform rotate-45 left-1/2 -translate-x-1/2 -bottom-1 border-r border-b ${isCyberpunk ? 'bg-black border-[#00f0ff]/50' : 'bg-gray-900 border-gray-700'}`}></div>
                </div>
            )}
        </div>
    </div>
  );
};