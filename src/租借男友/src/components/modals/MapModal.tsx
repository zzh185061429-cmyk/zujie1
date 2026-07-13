import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Map as MapIcon, MapPin, Building, Trees, Coffee } from "lucide-react";
import { useGameContext } from "../../state/GameContext";
import { MAP_LOCATIONS } from "../../data/gameData";

const CATEGORIES = [
  { id: "校内", icon: Building, color: "bg-pop-cyan text-pop-black" },
  { id: "周边", icon: Trees, color: "bg-pop-yellow text-pop-black" },
  { id: "市内", icon: Coffee, color: "bg-pop-pink text-white" }
];

export function MapModal() {
  const { isMapOpen, setIsMapOpen, setPendingMessage } = useGameContext();
  const [activeTab, setActiveTab] = useState("校内");

  if (!isMapOpen) return null;

  // 点击地点：将"我前往了XX"写入酒馆输入框，并关闭地图
  const handleLocationClick = (locName: string) => {
    setPendingMessage('我前往了' + locName);
    setIsMapOpen(false);
  };

  const filteredLocations = MAP_LOCATIONS.filter(l => l.category === activeTab);

  return (
    <div className="fixed inset-0 z-100 flex items-start md:items-center justify-center pt-0 md:pt-0 p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-pop-black/80 backdrop-blur-sm"
        onClick={() => setIsMapOpen(false)}
      />
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="relative w-full h-full md:w-auto md:max-w-4xl bg-white pop-border shadow-[8px_8px_0_#ffcc00] z-10 flex flex-col overflow-hidden clip-diagonal md:max-h-[calc(100vh-6rem)]"
      >
        <div className="bg-pop-yellow text-pop-black p-4 flex justify-between items-center border-b-4 border-pop-black shrink-0">
          <div className="flex items-center gap-2">
            <MapIcon className="w-6 h-6 shrink-0" />
            <h3 className="text-2xl font-black italic uppercase">City Map / 地点索引</h3>
          </div>
          <button 
            onClick={() => setIsMapOpen(false)}
            className="bg-pop-black text-white p-2 hover:scale-110 active:scale-90 transition-transform clip-diagonal shadow-[2px_2px_0_#ff3366]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden bg-stripes-cyan-pink">
          {/* Sidebar Tabs */}
          <div className="flex md:flex-col bg-pop-black p-4 gap-2 overflow-x-auto shrink-0 border-b-4 md:border-b-0 md:border-r-4 border-pop-black z-20 shadow-pop-lg">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`px-4 py-3 font-black text-lg flex items-center gap-2 clip-diagonal transition-all whitespace-nowrap md:whitespace-normal
                    ${isActive ? `${cat.color} shadow-[4px_4px_0_#fff] scale-105 ml-0 md:ml-2` : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
                  `}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {cat.id}
                </button>
              );
            })}
          </div>

          {/* Location List */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto hide-scrollbar relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLocations.map((loc, idx) => {
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleLocationClick(loc.name)}
                    className="bg-white border-4 border-pop-black p-4 shadow-pop clip-diagonal flex flex-col cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-pop-cyan" />
                      <h4 className="text-xl font-black">{loc.name}</h4>
                    </div>
                    <p className="text-sm font-bold text-gray-600">
                      {loc.desc}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}