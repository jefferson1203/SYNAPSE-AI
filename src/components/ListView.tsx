import { useState } from "react";
import { IdeaNode, IdeaGroup } from "../types";
import { 
  Trash2, 
  ArrowRight, 
  Layers, 
  Tag, 
  User, 
  MessageSquare, 
  Check, 
  Plus, 
  Sparkles, 
  Loader2 
} from "lucide-react";

interface ListViewProps {
  nodes: Record<string, IdeaNode>;
  groups: Record<string, IdeaGroup>;
  onNodeChange: (id: string, updates: Partial<IdeaNode>) => void;
  onDeleteNode: (id: string) => void;
  onAddManualNode: (color: string, groupId?: string) => void;
  onTriggerExtend: (id: string) => Promise<void>;
  isAiLoading: boolean;
}

export default function ListView({
  nodes,
  groups,
  onNodeChange,
  onDeleteNode,
  onAddManualNode,
  onTriggerExtend,
  isAiLoading
}: ListViewProps) {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingText, setEditingText] = useState("");
  const [extendingNodeId, setExtendingNodeId] = useState<string | null>(null);

  const startEditing = (node: IdeaNode) => {
    setEditingNodeId(node.id);
    setEditingTitle(node.title || "");
    setEditingText(node.text);
  };

  const saveEditing = (id: string) => {
    onNodeChange(id, {
      title: editingTitle,
      text: editingText,
      lastModified: Date.now(),
    });
    setEditingNodeId(null);
  };

  const handleExtend = async (id: string) => {
    setExtendingNodeId(id);
    try {
      await onTriggerExtend(id);
    } finally {
      setExtendingNodeId(null);
    }
  };

  const nodeList = Object.values(nodes);
  const groupList = Object.values(groups);

  // Group nodes by their groupId
  const nodeGroups: Record<string, IdeaNode[]> = {
    uncategorized: [],
  };

  groupList.forEach((group) => {
    nodeGroups[group.id] = [];
  });

  nodeList.forEach((node) => {
    const gid = node.groupId || "uncategorized";
    if (nodeGroups[gid]) {
      nodeGroups[gid].push(node);
    } else {
      nodeGroups.uncategorized.push(node);
    }
  });

  const getBgClass = (color: string) => {
    switch (color) {
      case "yellow": return "bg-[#1E1B13] border-amber-500/20 text-amber-200";
      case "blue": return "bg-[#111925] border-sky-500/20 text-sky-200";
      case "green": return "bg-[#111B15] border-emerald-500/20 text-emerald-200";
      case "pink": return "bg-[#1E1318] border-rose-500/20 text-rose-200";
      case "purple": return "bg-[#161320] border-purple-500/20 text-purple-200";
      case "orange": return "bg-[#201511] border-orange-500/20 text-orange-200";
      default: return "bg-[#1E1B13] border-amber-500/20 text-amber-200";
    }
  };

  const getColorLabelClass = (color: string) => {
    switch (color) {
      case "yellow": return "bg-amber-400";
      case "blue": return "bg-sky-400";
      case "green": return "bg-emerald-400";
      case "pink": return "bg-rose-400";
      case "purple": return "bg-purple-400";
      case "orange": return "bg-orange-400";
      default: return "bg-amber-400";
    }
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 py-6 bg-[#0B0B0C] scrollbar-hide text-slate-300">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Render columns like a clean list */}
        {/* Render Categorized groups first */}
        {groupList.map((group) => {
          const groupNodes = nodeGroups[group.id] || [];
          return (
            <div key={group.id} className="bg-[#16161A] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div 
                className="px-5 py-4 flex items-center justify-between border-b border-slate-800"
                style={{ borderLeft: `5px solid ${
                  group.color === "yellow" ? "#eab308" : 
                  group.color === "blue" ? "#0ea5e9" : 
                  group.color === "green" ? "#10b981" : 
                  group.color === "pink" ? "#ec4899" : 
                  group.color === "purple" ? "#a855f7" : 
                  group.color === "orange" ? "#f97316" : "#4f46e5"
                }` }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                    <Layers className="w-4 h-4 text-indigo-400" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-slate-100 font-display text-sm uppercase tracking-wide">{group.title}</h3>
                    <p className="text-xs text-slate-500">{groupNodes.length} post-it(s)</p>
                  </div>
                </div>
                
                <button
                  onClick={() => onAddManualNode("yellow", group.id)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-850 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>

              <div className="p-4 space-y-4">
                {groupNodes.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2 text-center">Aucune idée dans cette catégorie pour le moment.</p>
                ) : (
                  groupNodes.map((node) => (
                    <div 
                      key={node.id} 
                      className={`p-4 rounded-xl border transition-all ${getBgClass(node.color)}`}
                    >
                      {editingNodeId === node.id ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-slate-850 rounded-md focus:outline-hidden bg-[#0F0F12] text-slate-100 font-semibold"
                            placeholder="Titre"
                          />
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-slate-850 rounded-md focus:outline-hidden bg-[#0F0F12] text-slate-100 min-h-[60px]"
                            placeholder="Description"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingNodeId(null)}
                              className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => saveEditing(node.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold text-white rounded-md flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3 text-emerald-100" />
                              Sauver
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${getColorLabelClass(node.color)}`} />
                              <h4 className="font-bold text-xs text-slate-200 tracking-tight">{node.title || "Note sans titre"}</h4>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Color picker */}
                              <select
                                value={node.color}
                                onChange={(e) => onNodeChange(node.id, { color: e.target.value, lastModified: Date.now() })}
                                className="text-[10px] font-semibold bg-[#0F0F12] hover:bg-[#16161A] text-slate-300 border border-slate-850 rounded-md px-1.5 py-0.5 outline-hidden"
                              >
                                <option value="yellow">Jaune</option>
                                <option value="blue">Bleu</option>
                                <option value="green">Vert</option>
                                <option value="pink">Rose</option>
                                <option value="purple">Violet</option>
                                <option value="orange">Orange</option>
                              </select>
                              
                              <button
                                onClick={() => startEditing(node)}
                                className="p-1.5 hover:bg-slate-800/60 rounded-md text-slate-400 hover:text-slate-200 cursor-pointer"
                                title="Modifier"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => onDeleteNode(node.id)}
                                className="p-1.5 hover:bg-rose-950/30 hover:text-rose-400 rounded-md text-slate-500 hover:text-rose-450 cursor-pointer transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          <p className="text-xs mt-1.5 leading-relaxed opacity-90">{node.text}</p>
                          
                          {/* Footer with author & actions */}
                          <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-between items-center text-[10px]">
                            <div className="flex items-center gap-1 text-slate-500">
                              <User className="w-3 h-3" />
                              <span>{node.authorName || "Visiteur"}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              {/* Category shift dropdown */}
                              <select
                                value={node.groupId || "uncategorized"}
                                onChange={(e) => onNodeChange(node.id, { groupId: e.target.value === "uncategorized" ? null : e.target.value, lastModified: Date.now() })}
                                className="text-[10px] bg-[#0F0F12] hover:bg-[#16161A] text-slate-300 border border-slate-850 rounded-md px-1 py-0.5"
                              >
                                <option value="uncategorized">Non classé</option>
                                {groupList.map(g => (
                                  <option key={g.id} value={g.id}>{g.title}</option>
                                ))}
                              </select>

                              {/* AI Extend Action */}
                              <button
                                onClick={() => handleExtend(node.id)}
                                disabled={isAiLoading}
                                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50"
                              >
                                {extendingNodeId === node.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                                ) : (
                                  <Sparkles className="w-3 h-3 text-indigo-200" />
                                )}
                                <span>Approfondir</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Uncategorized Column */}
        <div className="bg-[#16161A] rounded-2xl border border-dashed border-slate-800 shadow-xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between bg-slate-900/10 border-b border-slate-800">
            <div className="flex items-center gap-2.5 text-slate-400">
              <Tag className="w-4 h-4 text-slate-500" />
              <div>
                <h3 className="font-extrabold font-display text-sm text-slate-300 uppercase tracking-wide">Idées Non Classées</h3>
                <p className="text-xs text-slate-500">{nodeGroups.uncategorized.length} post-it(s)</p>
              </div>
            </div>
            
            <button
              onClick={() => onAddManualNode("yellow")}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-850 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau Post-it</span>
            </button>
          </div>

          <div className="p-4 space-y-4">
            {nodeGroups.uncategorized.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">Aucune idée flottante. Idéal !</p>
            ) : (
              nodeGroups.uncategorized.map((node) => (
                <div 
                  key={node.id} 
                  className={`p-4 rounded-xl border transition-all ${getBgClass(node.color)}`}
                >
                  {editingNodeId === node.id ? (
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-850 rounded-md focus:outline-hidden bg-[#0F0F12] text-slate-100 font-semibold"
                        placeholder="Titre"
                      />
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-850 rounded-md focus:outline-hidden bg-[#0F0F12] text-slate-100 min-h-[60px]"
                        placeholder="Description"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingNodeId(null)}
                          className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => saveEditing(node.id)}
                          className="px-2.5 py-1 bg-[#10b981] text-[10px] font-bold text-white rounded-md flex items-center gap-1 cursor-pointer hover:bg-emerald-500"
                        >
                          <Check className="w-3 h-3 text-emerald-100" />
                          Sauver
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${getColorLabelClass(node.color)}`} />
                          <h4 className="font-bold text-xs text-slate-200 tracking-tight">{node.title || "Note sans titre"}</h4>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Color picker */}
                          <select
                            value={node.color}
                            onChange={(e) => onNodeChange(node.id, { color: e.target.value, lastModified: Date.now() })}
                            className="text-[10px] font-semibold bg-[#0F0F12] hover:bg-[#16161A] text-slate-300 border border-slate-850 rounded-md px-1.5 py-0.5 outline-hidden"
                          >
                            <option value="yellow">Jaune</option>
                            <option value="blue">Bleu</option>
                            <option value="green">Vert</option>
                            <option value="pink">Rose</option>
                            <option value="purple">Violet</option>
                            <option value="orange">Orange</option>
                          </select>
                          
                          <button
                            onClick={() => startEditing(node)}
                            className="p-1.5 hover:bg-slate-800/60 rounded-md text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => onDeleteNode(node.id)}
                            className="p-1.5 hover:bg-rose-955/30 hover:text-rose-455 hover:bg-rose-950/30 hover:text-rose-400 rounded-md text-slate-550 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-xs mt-1.5 leading-relaxed opacity-90">{node.text}</p>
                      
                      {/* Footer with author & actions */}
                      <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-between items-center text-[10px]">
                        <div className="flex items-center gap-1 text-slate-500">
                          <User className="w-3.5 h-3.5" />
                          <span>{node.authorName || "Visiteur"}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Categorize selection dropdown */}
                          <select
                            value="uncategorized"
                            onChange={(e) => onNodeChange(node.id, { groupId: e.target.value === "uncategorized" ? null : e.target.value, lastModified: Date.now() })}
                            className="text-[10px] bg-[#0F0F12] hover:bg-[#16161A] text-slate-300 border border-slate-850 rounded px-1.5 max-w-[120px] py-0.5"
                          >
                            <option value="uncategorized">Classer dans...</option>
                            {groupList.map(g => (
                              <option key={g.id} value={g.id}>{g.title}</option>
                            ))}
                          </select>

                          {/* AI Extend Action */}
                          <button
                            onClick={() => handleExtend(node.id)}
                            disabled={isAiLoading}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50"
                          >
                            {extendingNodeId === node.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-white" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-indigo-200" />
                            )}
                            <span>Approfondir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
