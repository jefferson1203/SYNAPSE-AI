import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Map, 
  Layers, 
  FileText, 
  Wifi, 
  WifiOff, 
  Plus, 
  RefreshCw,
  Eye,
  Menu,
  X,
  Loader2,
  Trash2
} from "lucide-react";

import { BrainstormBoard, IdeaNode, IdeaConnection, IdeaGroup, UserSession } from "./types";
import Sidebar from "./components/Sidebar";
import BoardCanvas from "./components/BoardCanvas";
import ListView from "./components/ListView";
import SummaryModal from "./components/SummaryModal";

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Helper to get random adjective/noun in French for playful avatars
const adjectives = ["Créatif", "Visionnaire", "Innovant", "Constructif", "Logique", "Audacieux", "Dynamique"];
const nouns = ["Penseur", "Cerveau", "Faiseur", "Facilitateur", "Architecte", "Catalyseur", "Esprit"];
const generateRandomUser = (): UserSession => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
  return {
    id: generateId(),
    name: `${adj} ${noun}`,
    color,
  };
};

export default function App() {
  // 1. Initial Identity setups
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    const saved = localStorage.getItem("brainstorm_user");
    if (saved) return JSON.parse(saved);
    const generated = generateRandomUser();
    localStorage.setItem("brainstorm_user", JSON.stringify(generated));
    return generated;
  });

  const clientId = currentUser.id;
  const boardId = "default-board"; // Single global workspace by default

  // 2. Responsive UI viewport & view mode mapping
  const [viewMode, setViewMode] = useState<"canvas" | "list">("canvas");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto detect mobile sizes to force touch-optimized list layout
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setViewMode("list");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 3. Central Application local states (Offline-first source of truth)
  const [board, setBoard] = useState<BrainstormBoard>(() => {
    const saved = localStorage.getItem(`brainstorm_board_${boardId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error("Failed to parse board state, starting fresh", err);
      }
    }
    return {
      id: boardId,
      name: "Tableau de Brainstorm Tactique",
      nodes: {},
      connections: {},
      groups: {},
      lastModified: Date.now(),
    };
  });

  // 4. Synchronization, Network & Offline States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeCollaboratorsCount, setActiveCollaboratorsCount] = useState(0);

  // Hybrid AI Source Configuration (Gemini, DeepSeek, local Ollama)
  const [aiConfig, setAiConfig] = useState(() => {
    const saved = localStorage.getItem("synapse_ai_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      provider: "gemini",
      geminiModel: "gemini-3.5-flash",
      deepseekApiKey: "",
      deepseekModel: "deepseek-chat",
      ollamaUrl: "http://localhost:11434",
      ollamaModel: "llama3"
    };
  });

  // Fetch server-side environment configurations for defaults
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setAiConfig((prev: any) => {
          const saved = localStorage.getItem("synapse_ai_config");
          if (saved) {
            // If already customized, still merge newly introduced defaults if they weren't in saved state
            const parsed = JSON.parse(saved);
            return {
              ...prev,
              ollamaUrl: parsed.ollamaUrl || data.ollamaBaseUrl,
              ollamaModel: parsed.ollamaModel || data.ollamaModel,
            };
          }
          return {
            ...prev,
            ollamaUrl: data.ollamaBaseUrl || prev.ollamaUrl,
            ollamaModel: data.ollamaModel || prev.ollamaModel,
          };
        });
      })
      .catch((err) => console.error("Error fetching AI server config:", err));
  }, []);

  // Persist AI configuration
  useEffect(() => {
    localStorage.setItem("synapse_ai_config", JSON.stringify(aiConfig));
  }, [aiConfig]);

  // Markdown Summary
  const [markdownSummary, setMarkdownSummary] = useState("");
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Reference to SSE handle
  const sseSource = useRef<EventSource | null>(null);

  // Save changes to localStorage on any local change
  useEffect(() => {
    localStorage.setItem(`brainstorm_board_${boardId}`, JSON.stringify(board));
  }, [board]);

  // Handle Online / Offline network recovery
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      performCloudSync(board);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [board]);

  // Initialize server SSE sync
  useEffect(() => {
    if (!isOnline) return;

    // Direct SSE Stream connection in background
    const url = `/api/sync/stream?boardId=${boardId}&clientId=${clientId}`;
    const source = new EventSource(url);
    sseSource.current = source;

    source.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "SYNC_UPDATE") {
          // Merge incoming server mutations with local state
          mergeIncomingState(message);
        } else if (message.type === "SYNC_CONNECTED") {
          console.log("Realtime Sync established over Server-Sent Events!");
        }
      } catch (err) {
        console.error("SSE parse failure", err);
      }
    };

    source.onerror = (err) => {
      console.warn("SSE disconnected, offline state or connection drop. Reconnecting in background...", err);
    };

    // Pull full server recovery copy on boot
    fetchFullServerBoard();

    return () => {
      source.close();
    };
  }, [isOnline]);

  // Periodic recovery fallback
  const fetchFullServerBoard = async () => {
    try {
      const res = await fetch(`/api/sync/fetch/${boardId}`);
      if (res.ok) {
        const { board: serverBoard } = await res.json();
        if (serverBoard && serverBoard.lastModified > 0) {
          mergeIncomingState({
            nodes: serverBoard.nodes,
            connections: serverBoard.connections,
            groups: serverBoard.groups,
            lastModified: serverBoard.lastModified
          });
        }
      }
    } catch (err) {
      console.warn("Full state fetch offline, sticking to offline local database", err);
    }
  };

  // Push local update to server
  const performCloudSync = async (updatedBoard: BrainstormBoard) => {
    if (!isOnline) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: updatedBoard.id,
          clientId,
          nodes: updatedBoard.nodes,
          connections: updatedBoard.connections,
          groups: updatedBoard.groups,
          lastModified: updatedBoard.lastModified
        })
      });

      if (!res.ok) {
        throw new Error("Broadcaster rejected sync operation");
      }
      
      const data = await res.json();
      // Server might contain newer nodes, resolve it
      if (data.board && data.board.lastModified > updatedBoard.lastModified) {
        mergeIncomingState(data.board);
      }
    } catch (err) {
      console.warn("Sync failed. Edits are queued locally for next connection", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Merge server states securely using LWW (Last-Write-Wins) timestamps
  const mergeIncomingState = (serverData: {
    nodes?: Record<string, IdeaNode>;
    connections?: Record<string, IdeaConnection>;
    groups?: Record<string, IdeaGroup>;
    lastModified: number;
  }) => {
    setBoard((prev) => {
      const mergedNodes = { ...prev.nodes };
      const mergedConnections = { ...prev.connections };
      const mergedGroups = { ...prev.groups };
      let updated = false;

      if (serverData.nodes) {
        for (const [id, sNode] of Object.entries(serverData.nodes)) {
          const localNode = prev.nodes[id];
          if (!localNode || sNode.lastModified > localNode.lastModified) {
            mergedNodes[id] = sNode;
            updated = true;
          }
        }
      }

      if (serverData.connections) {
        for (const [id, sConn] of Object.entries(serverData.connections)) {
          const localConn = prev.connections[id];
          if (!localConn || sConn.lastModified > localConn.lastModified) {
            mergedConnections[id] = sConn;
            updated = true;
          }
        }
      }

      if (serverData.groups) {
        for (const [id, sGrp] of Object.entries(serverData.groups)) {
          const localGrp = prev.groups[id];
          if (!localGrp || sGrp.lastModified > localGrp.lastModified) {
            mergedGroups[id] = sGrp;
            updated = true;
          }
        }
      }

      if (!updated && serverData.lastModified <= prev.lastModified) {
        return prev;
      }

      return {
        ...prev,
        nodes: mergedNodes,
        connections: mergedConnections,
        groups: mergedGroups,
        lastModified: Math.max(prev.lastModified, serverData.lastModified)
      };
    });
  };


  // -------------------------------------------------------------
  // Mutations triggers
  // -------------------------------------------------------------

  const handleUpdateBoardName = (name: string) => {
    const updated = {
      ...board,
      name,
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  // User details trigger
  const handleUpdateUserName = (newName: string) => {
    const updated = { ...currentUser, name: newName };
    setCurrentUser(updated);
    localStorage.setItem("brainstorm_user", JSON.stringify(updated));
  };

  const handleUpdateUserColor = (newColor: string) => {
    const updated = { ...currentUser, color: newColor };
    setCurrentUser(updated);
    localStorage.setItem("brainstorm_user", JSON.stringify(updated));
  };

  // Manual Node Add
  const handleAddManualNode = (color: string, groupId: string | null = null) => {
    const id = generateId();
    // Compute random slightly centered coordinates for absolute visibility
    const x = 150 + Math.floor(Math.random() * 200);
    const y = 150 + Math.floor(Math.random() * 200);
    
    const newNode: IdeaNode = {
      id,
      title: `Idée #${Math.floor(Math.random() * 1000)}`,
      text: "Double-cliquez pour rédiger votre idée...",
      x,
      y,
      color,
      groupId,
      lastModified: Date.now(),
      userId: clientId,
      authorName: currentUser.name || "Visiteur",
    };

    const updated = {
      ...board,
      nodes: {
        ...board.nodes,
        [id]: newNode
      },
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  // Manual Group Add
  const handleAddGroup = () => {
    const id = generateId();
    // Centered visually
    const rngX = 100 + Math.floor(Math.random() * 300);
    const rngY = 80 + Math.floor(Math.random() * 180);

    const colors = ["blue", "green", "purple", "orange", "yellow", "pink"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newGroup: IdeaGroup = {
      id,
      title: `Catégorie ${Object.keys(board.groups).length + 1}`,
      color: randomColor,
      x: rngX,
      y: rngY,
      width: 480,
      height: 380,
      lastModified: Date.now()
    };

    const updated = {
      ...board,
      groups: {
        ...board.groups,
        [id]: newGroup
      },
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  // Update Node
  const handleNodeChange = (id: string, updates: Partial<IdeaNode>) => {
    if (!board.nodes[id]) return;
    const oldNode = board.nodes[id];
    const newNode = {
      ...oldNode,
      ...updates,
      lastModified: Date.now()
    };

    const updated = {
      ...board,
      nodes: {
        ...board.nodes,
        [id]: newNode
      },
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  // Delete Node
  const handleNodeDelete = (id: string) => {
    const newNodes = { ...board.nodes };
    delete newNodes[id];

    // Delete any associated connection
    const newConnections = { ...board.connections };
    for (const [connId, connVal] of Object.entries(board.connections)) {
      const conn = connVal as IdeaConnection;
      if (conn.fromId === id || conn.toId === id) {
        delete newConnections[connId];
      }
    }

    const updated = {
      ...board,
      nodes: newNodes,
      connections: newConnections,
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  // Connection triggers
  const handleConnectionAdd = (fromId: string, toId: string) => {
    // Check duplication
    const isDuplicate = Object.values(board.connections).some(
      cVal => {
        const c = cVal as IdeaConnection;
        return (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId);
      }
    );
    if (isDuplicate) return;

    const id = generateId();
    const newConn: IdeaConnection = {
      id,
      fromId,
      toId,
      lastModified: Date.now()
    };

    const updated = {
      ...board,
      connections: {
        ...board.connections,
        [id]: newConn
      },
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  const handleConnectionDelete = (id: string) => {
    const newConnections = { ...board.connections };
    delete newConnections[id];

    const updated = {
      ...board,
      connections: newConnections,
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  // Update Group
  const handleGroupChange = (id: string, updates: Partial<IdeaGroup>) => {
    if (!board.groups[id]) return;
    const oldGroup = board.groups[id];
    const newGroup = {
      ...oldGroup,
      ...updates,
      lastModified: Date.now()
    };

    const updated = {
      ...board,
      groups: {
        ...board.groups,
        [id]: newGroup
      },
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  // Delete Group
  const handleGroupDelete = (id: string) => {
    const newGroups = { ...board.groups };
    delete newGroups[id];

    // Detach nodes associated with this group
    const newNodes = { ...board.nodes };
    for (const [nodeId, nodeVal] of Object.entries(board.nodes)) {
      const node = nodeVal as IdeaNode;
      if (node.groupId === id) {
        newNodes[nodeId] = {
          ...node,
          groupId: null,
          lastModified: Date.now()
        };
      }
    }

    const updated = {
      ...board,
      groups: newGroups,
      nodes: newNodes,
      lastModified: Date.now()
    };
    setBoard(updated);
    performCloudSync(updated);
  };

  // Clear workspace presets
  const handleClearBoard = () => {
    if (confirm("Voulez-vous réinitialiser et vider tout le tableau de brainstorming ? Cette action est irréversible.")) {
      const updated = {
        id: boardId,
        name: "Tableau de Brainstorm Tactique",
        nodes: {},
        connections: {},
        groups: {},
        lastModified: Date.now(),
      };
      setBoard(updated);
      performCloudSync(updated);
    }
  };


  // -------------------------------------------------------------
  // AI API Integrations call proxies
  // -------------------------------------------------------------

  // 1. Brainstorm Cluster Generation
  const triggerBrainstorm = async (prompt: string, count: number) => {
    setIsAiLoading(true);
    try {
      // Gather existing themes/idea titles to produce novel ones
      const existingThemes = Object.values(board.nodes)
        .map(nVal => {
          const n = nVal as IdeaNode;
          return n.title || "";
        })
        .filter(t => t.trim().length > 0);

      const res = await fetch("/api/gemini/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count, existingThemes, aiConfig })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Échec de l'IA lors du brainstorming");
      }

      const { ideas } = await res.json();
      
      // Inject returned ideas as dynamic post-it cards on canvas
      const newNodes = { ...board.nodes };
      
      // Compute spiral coordinate placement algorithm around board center
      const centerX = 200;
      const centerY = 150;
      
      ideas.forEach((idea: any, idx: number) => {
        const id = generateId();
        const angle = (idx / ideas.length) * 2 * Math.PI;
        // Spiral radius
        const r = 180 + Math.random() * 50;
        const x = Math.round(centerX + r * Math.cos(angle) + (Math.random() * 40 - 20));
        const y = Math.round(centerY + r * Math.sin(angle) + (Math.random() * 40 - 20));

        newNodes[id] = {
          id,
          title: idea.title,
          text: idea.text,
          x,
          y,
          color: idea.color || "yellow",
          lastModified: Date.now(),
          userId: "ai-gemini",
          authorName: "IA Gemini",
        };
      });

      const updated = {
        ...board,
        nodes: newNodes,
        lastModified: Date.now()
      };
      setBoard(updated);
      performCloudSync(updated);
    } catch (err: any) {
      console.error("AI Brainstorm Error:", err);
      alert(`Erreur IA : ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // 2. Extend Idea details
  const triggerExtendIdea = async (id: string) => {
    const nodeToExtend = board.nodes[id];
    if (!nodeToExtend) return;

    setIsAiLoading(true);
    try {
      const res = await fetch("/api/gemini/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaTitle: nodeToExtend.title,
          ideaText: nodeToExtend.text,
          aiConfig
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Impossible d'approfondir le post-it");
      }

      const { ideas } = await res.json();
      const newNodes = { ...board.nodes };
      const newConnections = { ...board.connections };

      // Lay down the 3 sub-ideas physically branching outwards from original node
      ideas.forEach((sub: any, idx: number) => {
        const subId = generateId();
        
        // Offset direction based on index
        const angle = (idx * (120 * Math.PI / 180)) - (30 * Math.PI / 180); // Arc of 120 deg
        const r = 240; // distance
        const x = Math.round(nodeToExtend.x + r * Math.sin(angle));
        const y = Math.round(nodeToExtend.y + r * Math.cos(angle));

        newNodes[subId] = {
          id: subId,
          title: sub.title,
          text: sub.text,
          x,
          y,
          color: sub.color || "pink",
          groupId: nodeToExtend.groupId, // inherit category
          lastModified: Date.now(),
          userId: "ai-gemini",
          authorName: "IA Approfondissement",
        };

        // Create semantic relationship connection line!
        const connId = generateId();
        newConnections[connId] = {
          id: connId,
          fromId: id,
          toId: subId,
          lastModified: Date.now(),
        };
      });

      const updated = {
        ...board,
        nodes: newNodes,
        connections: newConnections,
        lastModified: Date.now()
      };
      setBoard(updated);
      performCloudSync(updated);
    } catch (err: any) {
      console.error("AI Extend Error:", err);
      alert(`Erreur IA : ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // 3. Auto Categorize scattered nodes
  const triggerCategorize = async () => {
    const activeNodes = Object.values(board.nodes);
    if (activeNodes.length === 0) {
      alert("Veuillez d'abord placer des post-its sur le tableau pour pouvoir les trier.");
      return;
    }

    setIsAiLoading(true);
    try {
      const res = await fetch("/api/gemini/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: activeNodes, aiConfig })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "L'IA a échoué à regrouper les post-its");
      }

      const { groups: aiCategorizations } = await res.json();

      // Clear existing visual groups to deploy the AI-driven classification cleanly
      const newGroups: Record<string, IdeaGroup> = {};
      const newNodes = { ...board.nodes };

      // Algorithm: Align Category groups horizontally
      aiCategorizations.forEach((category: any, groupIndex: number) => {
        const gid = generateId();
        
        // Layout placement metrics
        const startX = 50 + groupIndex * 460;
        const startY = 100;
        const width = 420;
        const height = Math.max(350, 150 + Math.ceil(category.nodeIds.length / 2) * 160);

        newGroups[gid] = {
          id: gid,
          title: category.title,
          color: category.color || "blue",
          x: startX,
          y: startY,
          width,
          height,
          lastModified: Date.now()
        };

        // Iterate category associated nodes and align them beautifully grid-wise inside new group bounding-box
        category.nodeIds.forEach((nid: string, nodeIndex: number) => {
          if (newNodes[nid]) {
            // Reposition node neatly
            const nodesPerRow = 1;
            const col = nodeIndex % nodesPerRow;
            const row = Math.floor(nodeIndex / nodesPerRow);
            
            const localX = startX + 30 + col * 240;
            const localY = startY + 60 + row * 160;

            newNodes[nid] = {
              ...newNodes[nid],
              groupId: gid,
              x: localX,
              y: localY,
              lastModified: Date.now()
            };
          }
        });
      });

      const updated = {
        ...board,
        groups: newGroups,
        nodes: newNodes,
        lastModified: Date.now()
      };
      setBoard(updated);
      performCloudSync(updated);
    } catch (err: any) {
      console.error("AI Categorize Error:", err);
      alert(`Erreur IA : ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // 4. Summarize and generate study document
  const triggerSynthesize = async () => {
    if (Object.keys(board.nodes).length === 0) {
      alert("Ajoutez des post-its sur le tableau pour pouvoir rédiger un résumé.");
      return;
    }

    setIsAiLoading(true);
    try {
      const res = await fetch("/api/gemini/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: board.nodes,
          connections: board.connections,
          groups: board.groups,
          aiConfig
        })
      });

      if (!res.ok) {
        throw new Error("Impossible d'obtenir la synthèse");
      }

      const { markdown } = await res.json();
      setMarkdownSummary(markdown);
      setIsSummaryModalOpen(true);
    } catch (err: any) {
      console.error("AI Synthesis Error:", err);
      alert(`Erreur IA Synthèse : ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };


  return (
    <div className="w-full h-screen flex flex-col lg:flex-row bg-[#0B0B0C] overflow-hidden font-sans text-slate-300">
      
      {/* Drawer header on mobile with board name */}
      <div className="lg:hidden w-full bg-[#16161A] border-b border-slate-800 px-4 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse-slow" />
          <h2 className="font-bold text-slate-100 font-display text-sm truncate max-w-[180px]">
            {board.name}
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Sync status indicators */}
          {isSyncing && <Loader2 className="w-3.5 h-3.5 text-indigo-450 animate-spin" />}
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 hover:bg-[#222226] rounded-lg text-slate-450 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-slate-300" /> : <Menu className="w-5 h-5 text-slate-300" />}
          </button>
        </div>
      </div>

      {/* Render sidebar menu - absolute modal drawer on mobile, static on desktop */}
      <div className={`
        absolute lg:static inset-y-0 left-0 w-80 max-w-[85vw] lg:w-80 h-full z-40 transition-transform duration-300 transform
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <Sidebar
          boardName={board.name}
          onChangeBoardName={handleUpdateBoardName}
          isOnline={isOnline}
          currentUser={currentUser}
          onChangeUserName={handleUpdateUserName}
          onChangeUserColor={handleUpdateUserColor}
          onAddManualNode={handleAddManualNode}
          onAddGroup={handleAddGroup}
          onTriggerBrainstorm={triggerBrainstorm}
          onTriggerCategorize={triggerCategorize}
          onTriggerSynthesize={triggerSynthesize}
          isAiLoading={isAiLoading}
          activeCollaboratorsCount={activeCollaboratorsCount}
          aiConfig={aiConfig}
          onChangeAiConfig={setAiConfig}
        />
      </div>

      {/* Mobile drawer backdrop screen */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-xs"
        />
      )}

      {/* Primary Workspace Space */}
      <div className="flex-1 h-full flex flex-col overflow-hidden relative">
        
        {/* Top bar controls */}
        <div className="bg-[#16161A] px-5 py-3 border-b border-slate-800 flex items-center justify-between z-10">
          
          <div className="hidden lg:flex items-center gap-3">
            <h2 className="font-extrabold font-display text-slate-100 tracking-tight text-sm uppercase">{board.name}</h2>
            
            {/* Sync status label */}
            <div className="flex items-center gap-2 text-xs">
              {isSyncing ? (
                <span className="flex items-center gap-1 bg-[#0F0F12] border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono select-none">
                  <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                  <span className="text-slate-400">Synchronisation...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-[#0F0F12] border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono select-none">
                  <span className="text-slate-400">Sauvegardé localement</span>
                </span>
              )}
            </div>
          </div>

          {/* View toggle choices */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-start">
            <div className="flex items-center gap-1 bg-[#0F0F12] border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setViewMode("canvas")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold cursor-pointer transition-all ${
                  viewMode === "canvas" ? "bg-indigo-600 text-white shadow-md font-extrabold" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Tableau infini interactif"
              >
                <Map className="w-3.5 h-3.5" />
                <span>Tableau Infini</span>
              </button>
              
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold cursor-pointer transition-all ${
                  viewMode === "list" ? "bg-indigo-600 text-white shadow-md font-extrabold" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Vue en colonnes simplifiée"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Vue Catégories</span>
              </button>
            </div>

            {/* Clear workspace trigger */}
            <button
              onClick={handleClearBoard}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-800/80 hover:border-rose-900/50 text-slate-400 hover:text-rose-450 bg-[#0F0F12]/60 hover:bg-rose-955/15 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:text-rose-400"
              title="Vider la table de travail"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tout effacer</span>
            </button>
          </div>
        </div>

        {/* Global Loading screen */}
        {isAiLoading && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center z-50 pointer-events-auto">
            <div className="bg-[#16161A]/95 border border-slate-800/80 rounded-2xl shadow-2xl p-6 max-w-sm text-center flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-slate-850 border-t-indigo-500 animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-100 font-display text-sm uppercase tracking-wider">Gemini réfléchit...</h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  L'IA analyse vos forces conceptuelles pour enrichir, regrouper ou synthétiser vos idées.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Inner Body workspace render */}
        {viewMode === "canvas" ? (
          <BoardCanvas
            nodes={board.nodes}
            connections={board.connections}
            groups={board.groups}
            onNodeChange={handleNodeChange}
            onNodeDelete={handleNodeDelete}
            onConnectionAdd={handleConnectionAdd}
            onConnectionDelete={handleConnectionDelete}
            onGroupChange={handleGroupChange}
            onGroupDelete={handleGroupDelete}
            onTriggerExtend={triggerExtendIdea}
            isAiLoading={isAiLoading}
          />
        ) : (
          <ListView
            nodes={board.nodes}
            groups={board.groups}
            onNodeChange={handleNodeChange}
            onDeleteNode={handleNodeDelete}
            onAddManualNode={handleAddManualNode}
            onTriggerExtend={triggerExtendIdea}
            isAiLoading={isAiLoading}
          />
        )}
      </div>

      {/* Study analysis markdown display Modal */}
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        markdown={markdownSummary}
      />
    </div>
  );
}
