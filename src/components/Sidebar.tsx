import { 
  Sparkles, 
  Layers, 
  FileCheck, 
  Wifi, 
  WifiOff, 
  Users, 
  Plus, 
  FileText, 
  Loader2, 
  RotateCw,
  HelpCircle,
  Settings,
  Cpu,
  Globe,
  Terminal,
  Key
} from "lucide-react";
import { useState } from "react";
import { UserSession } from "../types";

interface SidebarProps {
  boardName: string;
  onChangeBoardName: (name: string) => void;
  isOnline: boolean;
  currentUser: UserSession;
  onChangeUserName: (name: string) => void;
  onChangeUserColor: (color: string) => void;
  onAddManualNode: (color: string) => void;
  onAddGroup: () => void;
  
  // AI triggers
  onTriggerBrainstorm: (prompt: string, count: number) => Promise<void>;
  onTriggerCategorize: () => Promise<void>;
  onTriggerSynthesize: () => Promise<void>;
  
  isAiLoading: boolean;
  activeCollaboratorsCount: number;

  aiConfig: {
    provider: "gemini" | "deepseek" | "ollama";
    geminiModel: string;
    deepseekApiKey: string;
    deepseekModel: string;
    ollamaUrl: string;
    ollamaModel: string;
  };
  onChangeAiConfig: (config: any) => void;
}

const COLOR_PALETTE = [
  { name: "Jaune", class: "bg-amber-100 border-amber-300 text-amber-800", hex: "yellow" },
  { name: "Bleu", class: "bg-sky-100 border-sky-300 text-sky-800", hex: "blue" },
  { name: "Vert", class: "bg-emerald-100 border-emerald-300 text-emerald-800", hex: "green" },
  { name: "Rose", class: "bg-rose-100 border-rose-300 text-rose-800", hex: "pink" },
  { name: "Violet", class: "bg-purple-100 border-purple-300 text-purple-800", hex: "purple" },
  { name: "Orange", class: "bg-orange-100 border-orange-300 text-orange-800", hex: "orange" },
];

const BOARD_PRESETS = [
  { 
    title: "Startup : Nouveau Produit", 
    prompt: "Trouver des fonctionnalités disruptives pour une app de livraison de plats faits maison locaux par abonnement." 
  },
  { 
    title: "Agile : Rétrospective Sprint", 
    prompt: "Qu'est ce qui a bien marché, qu'est ce qui a échoué et quelles actions d'amélioration proposez-vous pour notre équipe de développement ?" 
  },
  { 
    title: "UX/UI : Optimiser l'Onboarding", 
    prompt: "Idées pour simplifier l'inscription des utilisateurs seniors sur une plateforme d'échange intergénérationnel." 
  },
  { 
    title: "Marketing : Lancement Viral", 
    prompt: "Stratégies créatives de guérilla marketing pour faire connaître une marque de vêtements éco-conçus sans budget publicitaire." 
  }
];

export default function Sidebar({
  boardName,
  onChangeBoardName,
  isOnline,
  currentUser,
  onChangeUserName,
  onChangeUserColor,
  onAddManualNode,
  onAddGroup,
  onTriggerBrainstorm,
  onTriggerCategorize,
  onTriggerSynthesize,
  isAiLoading,
  activeCollaboratorsCount,
  aiConfig,
  onChangeAiConfig
}: SidebarProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [nodeCount, setNodeCount] = useState(6);
  const [errorText, setErrorText] = useState("");
  const [showAiSettings, setShowAiSettings] = useState(false);

  const handleBrainstormSubmit = async (promptToUse: string) => {
    if (!promptToUse.trim()) {
      setErrorText("Veuillez saisir ou choisir un sujet de brainstorming.");
      return;
    }
    setErrorText("");
    try {
      await onTriggerBrainstorm(promptToUse, nodeCount);
      setCustomPrompt("");
    } catch (err: any) {
      setErrorText(err.message || "La génération d'idées a échoué.");
    }
  };

  return (
    <aside className="w-full lg:w-80 h-full bg-[#16161A] border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col z-25 overflow-y-auto scrollbar-hide">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 bg-[#16161A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-650 text-white p-2 rounded-lg shadow-sm border border-indigo-450/20 bg-indigo-600">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="font-bold font-display text-sm tracking-tight text-slate-200">SYNAPSE <span className="text-indigo-400 uppercase font-bold text-xs">AI</span></h1>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">Tactical Brainstorm</p>
          </div>
        </div>
        
        {/* Sync state badge */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
          isOnline ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40" : "bg-slate-900 text-slate-500 border border-slate-800"
        }`}>
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-slate-500" />
              <span>OFFLINE</span>
            </>
          )}
        </div>
      </div>

      {/* Inputs Board Details */}
      <div className="p-4 border-b border-slate-800">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nom du Tableau</label>
        <input
          type="text"
          value={boardName}
          onChange={(e) => onChangeBoardName(e.target.value)}
          placeholder="Mon Tableau de Brainstorm"
          className="w-full px-3 py-2 rounded-lg text-xs border border-slate-800 bg-[#0F0F12] text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
        />
      </div>

      {/* Profil Collaborateur */}
      <div className="p-4 border-b border-slate-800 bg-[#1A1A22]/20">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mon Profil</label>
          <div className="flex items-center gap-1 text-slate-500 text-[10px] font-mono">
            <Users className="w-3 h-3" />
            <span>{activeCollaboratorsCount + 1} ACTIF(S)</span>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentUser.name}
            onChange={(e) => onChangeUserName(e.target.value)}
            placeholder="Votre nom"
            maxLength={18}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-slate-800 bg-[#0F0F12] text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
          />
          <input
            type="color"
            value={currentUser.color}
            onChange={(e) => onChangeUserColor(e.target.value)}
            className="w-8 h-8 rounded-lg cursor-pointer border border-slate-800 bg-transparent flex-shrink-0"
            title="Choisissez votre couleur d'avatar"
          />
        </div>
      </div>

      {/* Actions de création manuelle */}
      <div className="p-4 border-b border-slate-800">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ajouter Manuellement</label>
        <div className="grid grid-cols-6 gap-1.5 mb-2.5">
          {COLOR_PALETTE.map((color) => {
            const getButtonBg = (col: string) => {
              switch (col) {
                case "yellow": return "bg-amber-950/30 border-amber-850 text-amber-400 hover:bg-amber-900/40";
                case "blue": return "bg-sky-950/30 border-sky-850 text-sky-400 hover:bg-sky-900/40";
                case "green": return "bg-emerald-950/30 border-emerald-850 text-emerald-400 hover:bg-emerald-900/40";
                case "pink": return "bg-rose-950/30 border-rose-850 text-rose-400 hover:bg-rose-900/40";
                case "purple": return "bg-purple-950/30 border-purple-850 text-purple-400 hover:bg-purple-900/40";
                case "orange": return "bg-orange-950/30 border-orange-850 text-orange-400 hover:bg-orange-900/40";
                default: return "bg-slate-900 border-slate-850 text-slate-400";
              }
            };
            return (
              <button
                key={color.hex}
                onClick={() => onAddManualNode(color.hex)}
                className={`group h-8 rounded border flex items-center justify-center hover:scale-[1.03] active:scale-95 transition-all cursor-pointer ${getButtonBg(color.hex)}`}
                title={`Ajouter un post-it ${color.name}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
        <button
          onClick={onAddGroup}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-800 hover:border-slate-700 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 bg-[#1A1A22]/40 hover:bg-[#1A1A22]/70 transition-colors cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Créer une Catégorie</span>
        </button>
      </div>

      {/* AI Operations */}
      <div className="p-4 border-b border-slate-800 bg-indigo-950/5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <h3 className="font-bold text-[10px] text-indigo-400 uppercase tracking-widest">Assistant Créateur</h3>
          </div>
          <button 
            type="button"
            onClick={() => setShowAiSettings(!showAiSettings)}
            className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${showAiSettings ? "text-indigo-450 bg-indigo-950/40" : "text-slate-500"}`}
            title="Configuration de l'IA"
          >
            <Settings className="w-3.5 h-3.5 animate-spin-slow" />
          </button>
        </div>

        {/* Collapsible settings panel */}
        {showAiSettings && (
          <div className="mb-4 p-3 rounded-lg border border-slate-800 bg-[#16161A] text-slate-300">
            <div className="flex items-center gap-1.5 mb-2.5 border-b border-slate-800 pb-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configuration de l'IA</span>
            </div>

            {/* Provider Selection */}
            <div className="mb-2.5">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Source AI</label>
              <select
                value={aiConfig.provider}
                onChange={(e) => onChangeAiConfig({ ...aiConfig, provider: e.target.value })}
                className="w-full bg-[#0f0f12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-hidden font-semibold"
              >
                <option value="gemini">Gemini API (Online)</option>
                <option value="deepseek">DeepSeek API (Online)</option>
                <option value="ollama">Ollama (Modèle Local)</option>
              </select>
            </div>

            {/* Gemini settings */}
            {aiConfig.provider === "gemini" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Modèle Gemini</label>
                  <select
                    value={aiConfig.geminiModel}
                    onChange={(e) => onChangeAiConfig({ ...aiConfig, geminiModel: e.target.value })}
                    className="w-full bg-[#0f0f12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-hidden font-semibold mb-1"
                  >
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Standard)</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Avancé)</option>
                    <option value="custom">Saisie manuelle...</option>
                  </select>
                  {aiConfig.geminiModel === "custom" && (
                    <input
                      type="text"
                      placeholder="Identifiant du modèle..."
                      onChange={(e) => onChangeAiConfig({ ...aiConfig, geminiModel: e.target.value })}
                      className="w-full mt-1.5 px-2 py-1 bg-[#0f0f12] border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden font-semibold"
                    />
                  )}
                </div>
              </div>
            )}

            {/* DeepSeek settings */}
            {aiConfig.provider === "deepseek" && (
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Modèle DeepSeek</label>
                  </div>
                  <input
                    type="text"
                    value={aiConfig.deepseekModel}
                    onChange={(e) => onChangeAiConfig({ ...aiConfig, deepseekModel: e.target.value })}
                    placeholder="default: deepseek-chat"
                    className="w-full px-2 py-1 bg-[#0f0f12] border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden font-semibold"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Clé API DeepSeek</label>
                    <Key className="w-3 h-3 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    value={aiConfig.deepseekApiKey}
                    onChange={(e) => onChangeAiConfig({ ...aiConfig, deepseekApiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-2 py-1 bg-[#0f0f12] border border-slate-800 rounded text-xs text-slate-205 focus:outline-hidden font-mono"
                  />
                  <p className="text-[8px] text-slate-500 mt-1 leading-normal">Optionnelle s'il y a une clé par défaut sur le serveur.</p>
                </div>
              </div>
            )}

            {/* Ollama settings */}
            {aiConfig.provider === "ollama" && (
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Modèle Ollama</label>
                    <Terminal className="w-3 h-3 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={aiConfig.ollamaModel}
                    onChange={(e) => onChangeAiConfig({ ...aiConfig, ollamaModel: e.target.value })}
                    placeholder="ex: llama3 ou gemma"
                    className="w-full px-2 py-1 bg-[#0f0f12] border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden font-semibold"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Endpoint Ollama URL</label>
                    <Globe className="w-3 h-3 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={aiConfig.ollamaUrl}
                    onChange={(e) => onChangeAiConfig({ ...aiConfig, ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="w-full px-2 py-1 bg-[#0f0f12] border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden font-mono font-semibold"
                  />
                  <p className="text-[8px] text-slate-500 mt-1 leading-normal">
                    Pour l'Ollama local de votre machine depuis le container, utilisez <code className="bg-[#0f0f12] px-1 py-0.5 rounded text-indigo-300">http://host.docker.internal:11434</code>.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input prompt custom */}
        <div className="mb-4">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Sujet de brainstorm..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-xs border border-slate-800 bg-[#0F0F12] text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all leading-relaxed resize-none font-medium"
          />
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-mono">
              <span>POST-ITS :</span>
              <select
                value={nodeCount}
                onChange={(e) => setNodeCount(Number(e.target.value))}
                className="bg-[#0f0f12] border border-slate-800 rounded px-1 py-0.5 text-[10px] text-slate-300 focus:outline-hidden font-bold"
              >
                <option value={3}>3</option>
                <option value={6}>6</option>
                <option value={9}>9</option>
                <option value={12}>12</option>
              </select>
            </div>
            
            <button
              onClick={() => handleBrainstormSubmit(customPrompt)}
              disabled={isAiLoading}
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 disabled:text-slate-500 text-white text-[11px] font-semibold rounded transition-colors cursor-pointer"
            >
              {isAiLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-indigo-200" />
              ) : (
                <Sparkles className="w-3 h-3 text-indigo-200" />
              )}
              <span>Générer</span>
            </button>
          </div>
          {errorText && (
            <p className="mt-1.5 text-[10px] text-rose-400 leading-tight bg-rose-950/20 p-2 rounded border border-rose-900/35 font-medium">{errorText}</p>
          )}
        </div>

        {/* Presets thématiques rapides */}
        <div className="mb-4">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Modèles tactiques</label>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {BOARD_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCustomPrompt(preset.prompt);
                  handleBrainstormSubmit(preset.prompt);
                }}
                disabled={isAiLoading}
                className="w-full text-left p-1.5 bg-[#1A1A22]/20 hover:bg-[#1A1A22]/50 rounded text-xs leading-tight border border-slate-800/60 hover:border-slate-800 transition-all flex justify-between items-center group cursor-pointer"
              >
                <div className="pr-1 overflow-hidden">
                  <p className="font-semibold text-slate-300 group-hover:text-indigo-400 text-[11px] truncate">{preset.title}</p>
                </div>
                <Plus className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic global processing actions */}
        <div className="space-y-1.5 mt-auto pt-3 border-t border-slate-800">
          <button
            onClick={onTriggerCategorize}
            disabled={isAiLoading}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 text-amber-300 disabled:opacity-50 text-[11px] font-bold rounded transition-all cursor-pointer group"
          >
            {isAiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Layers className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
            )}
            <span>Regrouper Thématiquement</span>
          </button>

          <button
            onClick={onTriggerSynthesize}
            disabled={isAiLoading}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1A1A22] hover:bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 disabled:opacity-50 text-[11px] font-bold rounded transition-all cursor-pointer group shadow-[0_0_15px_rgba(99,102,241,0.05)]"
          >
            {isAiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileCheck className="w-3.5 h-3.5 group-hover:scale-105 transition-transform text-indigo-400" />
            )}
            <span>Rédiger le Compte-Rendu</span>
          </button>
        </div>
      </div>

      {/* Footer / Info */}
      <div className="p-3 bg-[#111115] border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-slate-600" />
          <span>Local Sync Online</span>
        </div>
        <span>v2.0.0</span>
      </div>
    </aside>
  );
}
