import React, { useState, useRef, useEffect } from "react";
import { IdeaNode, IdeaConnection, IdeaGroup } from "../types";
import { 
  Trash2, 
  Map, 
  Sparkles, 
  Link2, 
  Move, 
  ZoomIn, 
  ZoomOut, 
  Minimize, 
  User, 
  MessageSquare, 
  Check, 
  X,
  Loader2,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BoardCanvasProps {
  nodes: Record<string, IdeaNode>;
  connections: Record<string, IdeaConnection>;
  groups: Record<string, IdeaGroup>;
  onNodeChange: (id: string, updates: Partial<IdeaNode>) => void;
  onNodeDelete: (id: string) => void;
  onConnectionAdd: (fromId: string, toId: string) => void;
  onConnectionDelete: (id: string) => void;
  onGroupChange: (id: string, updates: Partial<IdeaGroup>) => void;
  onGroupDelete: (id: string) => void;
  onTriggerExtend: (id: string) => Promise<void>;
  isAiLoading: boolean;
}

export default function BoardCanvas({
  nodes,
  connections,
  groups,
  onNodeChange,
  onNodeDelete,
  onConnectionAdd,
  onConnectionDelete,
  onGroupChange,
  onGroupDelete,
  onTriggerExtend,
  isAiLoading
}: BoardCanvasProps) {
  // Navigation states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Drag states for nodes
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Drag states for groups
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const groupDragOffset = useRef({ x: 0, y: 0 });

  // Connections builder states
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);

  // Editing states
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingText, setEditingText] = useState("");
  
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState("");

  const boardRef = useRef<HTMLDivElement>(null);

  // Zoom helpers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 1.8));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.4));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 100, y: 100 });
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking on some input or node, don't pan
    if (e.target !== boardRef.current && !(e.target as HTMLElement).classList.contains("board-grid-bg")) {
      return;
    }
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handling Panning
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      });
      return;
    }

    // Handling Node Dragging
    if (draggedNodeId && nodes[draggedNodeId]) {
      // Calculate adjusted coordinates relative to zoom
      const rawX = e.clientX - pan.x;
      const rawY = e.clientY - pan.y;
      
      const newX = Math.round((rawX - dragOffset.current.x) / zoom);
      const newY = Math.round((rawY - dragOffset.current.y) / zoom);

      onNodeChange(draggedNodeId, { x: newX, y: newY, lastModified: Date.now() });
      return;
    }

    // Handling Group Dragging
    if (draggedGroupId && groups[draggedGroupId]) {
      const rawX = e.clientX - pan.x;
      const rawY = e.clientY - pan.y;
      
      const newX = Math.round((rawX - groupDragOffset.current.x) / zoom);
      const newY = Math.round((rawY - groupDragOffset.current.y) / zoom);

      onGroupChange(draggedGroupId, { x: newX, y: newY, lastModified: Date.now() });
      return;
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
    setDraggedGroupId(null);
  };

  // Node Drag Trigger
  const startNodeDrag = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectionSourceId) return; // Don't drag if linking
    setDraggedNodeId(nodeId);
    
    // Position of cursor relative to node top-left scaled by zoom
    const node = nodes[nodeId];
    const cursorOnBoardX = e.clientX - pan.x;
    const cursorOnBoardY = e.clientY - pan.y;

    dragOffset.current = {
      x: cursorOnBoardX - node.x * zoom,
      y: cursorOnBoardY - node.y * zoom
    };
  };

  // Group Drag Trigger
  const startGroupDrag = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Only drag from absolute handle header
    if ((e.target as HTMLElement).closest(".group-drag-handle")) {
      setDraggedGroupId(groupId);
      const grp = groups[groupId];
      const cursorOnBoardX = e.clientX - pan.x;
      const cursorOnBoardY = e.clientY - pan.y;

      groupDragOffset.current = {
        x: cursorOnBoardX - grp.x * zoom,
        y: cursorOnBoardY - grp.y * zoom
      };
    }
  };

  // Connections triggers
  const clickNodeLink = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectionSourceId === null) {
      setConnectionSourceId(nodeId);
    } else {
      if (connectionSourceId !== nodeId) {
        onConnectionAdd(connectionSourceId, nodeId);
      }
      setConnectionSourceId(null);
    }
  };

  // Cancel any active binding state
  const handleCancelLink = () => {
    setConnectionSourceId(null);
  };

  // Node Text Editing
  const startEditingNode = (node: IdeaNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditingTitle(node.title || "");
    setEditingText(node.text);
  };

  const saveNodeEditing = (id: string) => {
    onNodeChange(id, {
      title: editingTitle,
      text: editingText,
      lastModified: Date.now()
    });
    setEditingNodeId(null);
  };

  // Group title editing
  const startEditingGroup = (grp: IdeaGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroupId(grp.id);
    setEditingGroupTitle(grp.title);
  };

  const saveGroupEditing = (id: string) => {
    onGroupChange(id, { title: editingGroupTitle, lastModified: Date.now() });
    setEditingGroupId(null);
  };

  // Node colors
  const getNodeColorClass = (color: string) => {
    switch (color) {
      case "yellow": return "bg-[#1E1B13]/90 border-amber-500/30 text-amber-200 shadow-[0_0_20px_rgba(234,179,8,0.03)]";
      case "blue": return "bg-[#111925]/90 border-sky-500/30 text-sky-200 shadow-[0_0_20px_rgba(14,165,233,0.03)]";
      case "green": return "bg-[#111B15]/90 border-emerald-500/30 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.03)]";
      case "pink": return "bg-[#1E1318]/90 border-rose-500/30 text-rose-200 shadow-[0_0_20px_rgba(236,72,153,0.03)]";
      case "purple": return "bg-[#161320]/90 border-purple-500/30 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.03)]";
      case "orange": return "bg-[#201511]/90 border-orange-500/30 text-orange-200 shadow-[0_0_20px_rgba(249,115,22,0.03)]";
      default: return "bg-[#1E1B13]/90 border-amber-500/30 text-amber-200 shadow-[0_0_20px_rgba(234,179,8,0.02)]";
    }
  };

  const getGroupColorClass = (color: string) => {
    switch (color) {
      case "yellow": return "bg-[#1E1B13]/10 border-amber-500/20 text-amber-200";
      case "blue": return "bg-[#111925]/10 border-sky-500/20 text-sky-200";
      case "green": return "bg-[#111B15]/10 border-emerald-500/20 text-emerald-200";
      case "pink": return "bg-[#1E1318]/10 border-rose-500/20 text-rose-200";
      case "purple": return "bg-[#161320]/10 border-purple-500/20 text-purple-200";
      case "orange": return "bg-[#201511]/10 border-orange-500/20 text-orange-200";
      default: return "bg-[#111925]/10 border-indigo-500/20 text-indigo-200";
    }
  };

  const getDotColor = (color: string) => {
    switch (color) {
      case "yellow": return "#eab308";
      case "blue": return "#0ea5e9";
      case "green": return "#10b981";
      case "pink": return "#ec4899";
      case "purple": return "#a855f7";
      case "orange": return "#f97316";
      default: return "#eab308";
    }
  };

  // Trigger click on outer board to close active modes
  const handleBoardClick = () => {
    setConnectionSourceId(null);
    setEditingNodeId(null);
    setEditingGroupId(null);
  };

  return (
    <div 
      id="brainstorm-board-canvas"
      ref={boardRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleBoardClick}
      className="flex-1 w-full h-full relative overflow-hidden select-none cursor-grab active:cursor-grabbing board-grid-bg bg-[#0B0B0C]"
    >
      
      {/* Zoom and Linking Indicators overlay */}
      <div className="absolute top-4 right-4 flex flex-col md:flex-row gap-2 z-10 pointer-events-none">
        {connectionSourceId && (
          <div className="bg-indigo-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-lg animate-bounce pointer-events-auto">
            <Link2 className="w-4 h-4" />
            <span>Mode Liaison : Cliquez sur un second post-it</span>
            <button 
              onClick={handleCancelLink}
              className="ml-1 p-0.5 hover:bg-white/10 rounded"
              title="Annuler"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 bg-[#16161A] border border-slate-800 rounded-xl p-1.5 shadow-xl pointer-events-auto">
          <button 
            onClick={handleZoomOut} 
            className="p-1.5 hover:bg-[#222226] rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-300 w-11 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={handleZoomIn} 
            className="p-1.5 hover:bg-[#222226] rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />
          <button 
            onClick={handleResetZoom} 
            className="p-1.5 hover:bg-[#222226] rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Recadrer"
          >
            <Minimize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Instructions Banner */}
      <div className="absolute bottom-4 left-4 max-w-sm hidden md:block bg-[#16161A]/95 border border-slate-800/80 rounded-xl p-3 shadow-xl backdrop-blur-xs pointer-events-none z-10">
        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Raccourcis & Astuces</p>
        <ul className="text-[11px] text-slate-400 space-y-1.5 font-medium">
          <li>• <b className="text-slate-205 text-slate-200 font-bold">Glisser le fond</b> pour naviguer sur le tableau infini</li>
          <li>• <b className="text-slate-210 text-slate-200 font-bold">Glisser l'étiquette</b> des post-its pour les déplacer</li>
          <li>• <b className="text-slate-215 text-slate-200 font-bold">Bouton Lier (Liaison)</b> pour tracer des fils de sens</li>
          <li>• <b className="text-slate-220 text-slate-200 font-bold">Double-cliquer</b> sur les titres ou le texte pour éditer</li>
        </ul>
      </div>

      {/* INFINITY CANVAS SCALER ELEMENT */}
      <div 
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
      >
        
        {/* SVG RENDER FOR VECTOR CONNECTIONS */}
        <svg className="absolute overflow-visible top-0 left-0 w-1 h-1 pointer-events-none z-0">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#bcaf9d" />
            </marker>
          </defs>
          
          {Object.values(connections).map((connection) => {
            const fromNode = nodes[connection.fromId];
            const toNode = nodes[connection.toId];
            
            if (!fromNode || !toNode) return null;

            // Compute center coords of 220px width x 160px height sticky notes
            const fromX = fromNode.x + 110;
            const fromY = fromNode.y + 70;
            const toX = toNode.x + 110;
            const toY = toNode.y + 70;

            // Draw line
            return (
              <g key={connection.id} className="pointer-events-auto">
                {/* Visual hover link hit-box */}
                <line
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke="transparent"
                  strokeWidth={15}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if(confirm("Supprimer ce lien thématique ?")) {
                      onConnectionDelete(connection.id);
                    }
                  }}
                  title="Cliquez pour détruire le lien de dépendance"
                />
                
                {/* Thin styled pointer connection */}
                <line
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke="#94a3b8"
                  strokeWidth={2.2}
                  strokeDasharray="5,5"
                  className="transition-all hover:stroke-rose-400"
                  markerEnd="url(#arrow)"
                />
              </g>
            );
          })}
        </svg>

        {/* 1. GROUPS RENDER (Behind Nodes) */}
        {Object.values(groups).map((group) => {
          const isGroupEditing = editingGroupId === group.id;

          return (
            <div
              key={group.id}
              style={{
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
              }}
              onMouseDown={(e) => startGroupDrag(group.id, e)}
              className={`absolute border-2 border-dashed rounded-2xl p-4 pointer-events-auto transition-all transition-shadow flex flex-col ${getGroupColorClass(group.color)}`}
            >
              {/* Draggable header panel */}
              <div className="group-drag-handle flex items-center justify-between p-1.5 select-none cursor-move bg-black/20 hover:bg-black/45 rounded-lg -mt-1 -mx-1 mb-2 border border-white/5">
                <div className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 opacity-60 text-slate-300" />
                  {isGroupEditing ? (
                    <input
                      type="text"
                      value={editingGroupTitle}
                      onChange={(e) => setEditingGroupTitle(e.target.value)}
                      onBlur={() => saveGroupEditing(group.id)}
                      onKeyDown={(e) => e.key === "Enter" && saveGroupEditing(group.id)}
                      autoFocus
                      className="px-1 py-0.5 text-xs text-slate-200 bg-[#0F0F12] border border-slate-800 rounded font-bold"
                    />
                  ) : (
                    <span 
                      onDoubleClick={(e) => startEditingGroup(group, e)}
                      className="text-xs font-bold font-display tracking-tight text-slate-200 hover:text-indigo-400 cursor-pointer"
                    >
                      {group.title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Select Group color */}
                  <select
                    value={group.color}
                    onChange={(e) => onGroupChange(group.id, { color: e.target.value })}
                    className="text-[9px] font-bold uppercase bg-[#0F0F12] text-slate-300 rounded border border-slate-800 outline-hidden px-1 py-0.5"
                  >
                    <option value="blue">Bleu</option>
                    <option value="green">Vert</option>
                    <option value="purple">Violet</option>
                    <option value="orange">Orange</option>
                    <option value="yellow">Jaune</option>
                    <option value="pink">Rose</option>
                  </select>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Voulez-vous dissoudre ce groupe thématique ? Les post-its ne seront pas supprimés.")) {
                        onGroupDelete(group.id);
                      }
                    }}
                    className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-700 rounded transition-colors cursor-pointer"
                    title="Dissoudre la catégorie"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Resize Handle trigger */}
              <div 
                className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 text-slate-400 group-hover:text-slate-600"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  const startW = group.width;
                  const startH = group.height;
                  const initialX = e.clientX;
                  const initialY = e.clientY;

                  const handleResizeMove = (moveEv: MouseEvent) => {
                    const adjustedDeltaX = (moveEv.clientX - initialX) / zoom;
                    const adjustedDeltaY = (moveEv.clientY - initialY) / zoom;
                    onGroupChange(group.id, {
                      width: Math.max(startW + adjustedDeltaX, 180),
                      height: Math.max(startH + adjustedDeltaY, 150),
                    });
                  };

                  const handleResizeUp = () => {
                    window.removeEventListener("mousemove", handleResizeMove);
                    window.removeEventListener("mouseup", handleResizeUp);
                  };

                  window.addEventListener("mousemove", handleResizeMove);
                  window.addEventListener("mouseup", handleResizeUp);
                }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" className="opacity-45">
                  <line x1="6" y1="0" x2="6" y2="6" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="0" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          );
        })}

        {/* 2. NODES / STICKY NOTES RENDER */}
        {Object.values(nodes).map((node) => {
          const isNodeEditing = editingNodeId === node.id;
          const isSelectedSource = connectionSourceId === node.id;

          return (
            <div
              key={node.id}
              style={{
                left: node.x,
                top: node.y,
                width: 220,
                height: 140,
              }}
              className="absolute pointer-events-auto"
            >
              <div 
                className={`w-full h-full border rounded-2xl flex flex-col p-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group ${getNodeColorClass(node.color)} ${
                  isSelectedSource ? "ring-4 ring-indigo-500 ring-offset-2 animate-pulse" : ""
                }`}
              >
                {/* Node Dragging Header / Handle */}
                <div 
                  onMouseDown={(e) => startNodeDrag(node.id, e)}
                  className="flex items-center justify-between cursor-move bg-black/5 hover:bg-black/80 hover:text-white rounded-lg px-2 py-1 mb-2 select-none -mt-1 -mx-1 text-[10px] text-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden truncate">
                    <Move className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate font-semibold uppercase font-mono leading-none tracking-tight">
                      {node.title || "Idée"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
                    {/* Link trigger */}
                    <button
                      onClick={(e) => clickNodeLink(node.id, e)}
                      className={`p-1 hover:bg-black/10 rounded transition-colors ${isSelectedSource ? "bg-indigo-600 text-white" : ""}`}
                      title="Créer un lien thématique vers..."
                    >
                      <Link2 className="w-3 h-3" />
                    </button>

                    {/* Delete Node */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNodeDelete(node.id);
                      }}
                      className="p-1 hover:bg-rose-500/10 hover:text-rose-600 rounded transition-colors"
                      title="Supprimer la note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Sub-body editing vs standard */}
                <div className="flex-1 flex flex-col overflow-hidden justify-between">
                  {isNodeEditing ? (
                    <div className="space-y-1" onMouseDown={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        placeholder="Titre de l'idée..."
                        className="w-full text-xs font-bold border-b border-black/10 focus:outline-hidden bg-transparent"
                      />
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        placeholder="Qu'avez vous en tête ?"
                        className="w-full text-[11px] leading-tight resize-none bg-transparent focus:outline-hidden h-12"
                      />
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => setEditingNodeId(null)}
                          className="px-2 py-0.5 text-[9px] rounded hover:bg-black/5"
                        >
                          X
                        </button>
                        <button 
                          onClick={() => saveNodeEditing(node.id)}
                          className="px-2 py-0.5 bg-black/10 text-[9px] rounded font-bold hover:bg-black/20"
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="flex-1 flex flex-col justify-between cursor-text"
                      onDoubleClick={(e) => startEditingNode(node, e)}
                      title="Double-cliquez pour éditer"
                    >
                      <div>
                        {node.title && (
                          <p className="font-bold text-xs truncate select-text leading-tight text-white mb-0.5">{node.title}</p>
                        )}
                        <p className="text-[11px] font-normal leading-normal select-text opacity-90 line-clamp-3 mt-1">
                          {node.text}
                        </p>
                      </div>

                      {/* Footer Info line */}
                      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-white/5 text-[9px] text-slate-400">
                        <div className="flex items-center gap-0.5 truncate max-w-[100px]">
                          <User className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate font-semibold">{node.authorName || "Invité"}</span>
                        </div>
                        
                        {/* Interactive operations */}
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          
                          {/* Color toggle selector */}
                          <div className="flex gap-0.5" onMouseDown={e => e.stopPropagation()}>
                            {["yellow", "blue", "green", "pink"].map(c => (
                              <button
                                key={c}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNodeChange(node.id, { color: c, lastModified: Date.now() });
                                }}
                                className={`w-2 h-2 rounded-full border border-black/20 ${c === node.color ? "ring-1 ring-black/50" : ""}`}
                                style={{ backgroundColor: getDotColor(c) }}
                              />
                            ))}
                          </div>

                          {/* Trigger AI extend */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onTriggerExtend(node.id);
                            }}
                            disabled={isAiLoading}
                            className="bg-indigo-600 text-white rounded-md p-1 font-bold text-[8px] flex items-center gap-0.5 select-none hover:bg-indigo-700 transition"
                            title="Laisser l'IA approfondir ce sujet"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Approfondir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
