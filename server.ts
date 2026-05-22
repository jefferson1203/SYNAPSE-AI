import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Server state for in-memory board sync
const boards: Record<string, any> = {};
const sseClients: Set<{ res: any; boardId: string; clientId: string }> = new Set();

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but is currently missing. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to reliably parse JSON array response from different AI providers
function parseJsonResponse(rawText: string, fallbackKey: string): any {
  const text = rawText.trim();
  // Strip markdown code fences if present
  let cleanText = text;
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
  }
  
  try {
    const parsed = JSON.parse(cleanText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // If it is an object, check if it contains the fallbackKey array, or another array property
    if (typeof parsed === "object" && parsed !== null) {
      if (Array.isArray(parsed[fallbackKey])) {
        return parsed[fallbackKey];
      }
      // Look for any array property in the object
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val)) {
          return val;
        }
      }
      return [parsed]; // fallback
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse JSON directly. Attempting regex extraction fallback.", err);
    // Try to extract JSON array using RegExp as a robust fallback
    const arrayMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (e) {
        // ignore
      }
    }
    const objectMatch = cleanText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const obj = JSON.parse(objectMatch[0]);
        if (Array.isArray(obj[fallbackKey])) return obj[fallbackKey];
        for (const val of Object.values(obj)) {
          if (Array.isArray(val)) return val;
        }
        return [obj];
      } catch (e) {
        // ignore
      }
    }
    throw new Error("Impossible de décoder le retour de l'IA au format JSON visé.\nContenu reçu :\n" + rawText);
  }
}

// Unified dispatcher for multiple AI providers (Gemini, DeepSeek, local Ollama)
async function executeAiCompletion({
  aiConfig,
  systemInstruction,
  prompt,
  isJson,
  responseSchema,
}: {
  aiConfig: any;
  systemInstruction: string;
  prompt: string;
  isJson: boolean;
  responseSchema?: any;
}) {
  const provider = aiConfig?.provider || "gemini";

  if (provider === "gemini") {
    const ai = getGeminiClient();
    const model = aiConfig?.geminiModel || "gemini-3.5-flash";
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: isJson ? "application/json" : undefined,
        responseSchema: isJson ? responseSchema : undefined,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Aucun contenu retourné par Gemini");
    }
    return text;
  }

  if (provider === "deepseek") {
    const apiKey = aiConfig?.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("Clé API DeepSeek manquante. Veuillez la configurer dans l'onglet Configuration de l'IA.");
    }
    const model = aiConfig?.deepseekModel || "deepseek-chat";
    
    // Request assistant to return formatted JSON
    const promptWithJsonTip = isJson 
      ? prompt + "\n\nCRITICAL: Tu devras obligatoirement retourner le résultat sous la forme d'un objet ou tableau JSON valide sans Markdown."
      : prompt;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: promptWithJsonTip }
        ],
        response_format: isJson ? { type: "json_object" } : undefined,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur API DeepSeek [${response.status}]: ${errText || response.statusText}`);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Aucun contenu retourné par DeepSeek.");
    }
    return text;
  }

  if (provider === "ollama") {
    const ollamaUrl = (aiConfig?.ollamaUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
    const model = aiConfig?.ollamaModel || process.env.OLLAMA_MODEL || "llama3";
    
    const promptWithJsonTip = isJson 
      ? prompt + "\n\nCRITICAL: Tu devras obligatoirement retourner uniquement un document JSON valide."
      : prompt;

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: promptWithJsonTip }
        ],
        format: isJson ? "json" : undefined,
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur de connexion Ollama [${response.status}]: ${errText || response.statusText}\nVérifiez que l'instance locale Ollama est lancée et accepte les connexions pour le modèle '${model}'.`);
    }

    const data: any = await response.json();
    const text = data.message?.content;
    if (!text) {
      throw new Error("Aucun contenu retourné par Ollama.");
    }
    return text;
  }

  throw new Error(`Fournisseur d'IA inconnu : ${provider}`);
}

// configuration variables endpoint
app.get("/api/config", (req, res) => {
  res.json({
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasDeepseekKey: !!process.env.DEEPSEEK_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3"
  });
});

// -------------------------------------------------------------
// Real-time Sync API Endpoints
// -------------------------------------------------------------

// Post dynamic changes to a board
app.post("/api/sync/update", (req, res) => {
  const { boardId, clientId, nodes, connections, groups, lastModified } = req.body;
  
  if (!boardId) {
    return res.status(400).json({ error: "boardId required" });
  }

  // Retrieve or create board memory
  if (!boards[boardId]) {
    boards[boardId] = {
      nodes: {},
      connections: {},
      groups: {},
      lastModified: 0,
    };
  }

  const currentBoard = boards[boardId];

  // Merge the updates using Last-Write-Wins (Conflict resolution)
  if (nodes) {
    for (const [id, node] of Object.entries(nodes)) {
      const existing = currentBoard.nodes[id];
      if (!existing || (node as any).lastModified > existing.lastModified) {
        currentBoard.nodes[id] = node;
      }
    }
  }

  if (connections) {
    for (const [id, conn] of Object.entries(connections)) {
      const existing = currentBoard.connections[id];
      if (!existing || (conn as any).lastModified > existing.lastModified) {
        currentBoard.connections[id] = conn;
      }
    }
  }

  if (groups) {
    for (const [id, grp] of Object.entries(groups)) {
      const existing = currentBoard.groups[id];
      if (!existing || (grp as any).lastModified > existing.lastModified) {
        currentBoard.groups[id] = grp;
      }
    }
  }

  if (lastModified > currentBoard.lastModified) {
    currentBoard.lastModified = lastModified;
  }

  // Respond with the newly merged server board state
  res.json({ board: currentBoard });

  // Broadcast update to all other connected clients
  // Create an array list of clients to update
  for (const client of sseClients) {
    if (client.boardId === boardId && client.clientId !== clientId) {
      try {
        client.res.write(`data: ${JSON.stringify({
          type: "SYNC_UPDATE",
          boardId,
          nodes,
          connections,
          groups,
          lastModified: currentBoard.lastModified,
        })}\n\n`);
      } catch (err) {
        console.error("SSE notify failed, removing client reference", err);
      }
    }
  }
});

// Full state recovery endpoint
app.get("/api/sync/fetch/:boardId", (req, res) => {
  const { boardId } = req.params;
  const currentBoard = boards[boardId] || {
    nodes: {},
    connections: {},
    groups: {},
    lastModified: 0,
  };
  res.json({ board: currentBoard });
});

// Real-time synchronization stream (SSE)
app.get("/api/sync/stream", (req, res) => {
  const { boardId, clientId } = req.query;

  if (!boardId || !clientId) {
    return res.status(400).json({ error: "boardId and clientId parameters are required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Keep connection alive with simple heartbeat
  const pingInterval = setInterval(() => {
    res.write(":\n\n");
  }, 15000);

  const clientInfo = { res, boardId: boardId as string, clientId: clientId as string };
  sseClients.add(clientInfo);

  // Send initial bootstrap complete signal
  res.write(`data: ${JSON.stringify({ type: "SYNC_CONNECTED" })}\n\n`);

  req.on("close", () => {
    clearInterval(pingInterval);
    sseClients.delete(clientInfo);
  });
});


// -------------------------------------------------------------
// AI-Augmented Brainstorming Endpoints (using Gemini-3.5-flash)
// -------------------------------------------------------------

app.post("/api/gemini/brainstorm", async (req, res) => {
  try {
    const { prompt, count = 6, existingThemes = [], aiConfig } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Le thème de brainstorming ou prompt est obligatoire." });
    }

    const systemInstruction = `Tu es un facilitateur professionnel spécialisé dans l'innovation créative et le design thinking.
Retourne une liste d'idées colorées et pleines d'originalité.
Pour chaque idée, attribue un titre percutant de 3 à 5 mots maximum, une description détaillée de 1 à 2 phrases explicatives, et suggère une couleur de post-it chaleureuse parmi les options suivantes (en minuscules): "yellow", "blue", "green", "pink", "purple", "orange".`;

    const userPrompt = `Génère ${count} idées innovantes, créatives et diversifiées pour le thème ou problème suivant: "${prompt}".
Certaines idées déjà évoquées: [${existingThemes.join(", ")}]. Produis des idées nouvelles et complémentaires.`;

    const rawText = await executeAiCompletion({
      aiConfig,
      systemInstruction,
      prompt: userPrompt,
      isJson: true,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Titre succinct et dynamique de l'idée (3 à 5 mots).",
            },
            text: {
              type: Type.STRING,
              description: "Explication claire et constructive de l'idée (1 à 2 phrases).",
            },
            color: {
              type: Type.STRING,
              description: "Couleur suggérée parmi yellow, blue, green, pink, purple, orange.",
            },
          },
          required: ["title", "text", "color"],
        },
      },
    });

    const ideas = parseJsonResponse(rawText, "ideas");
    res.json({ ideas });
  } catch (err: any) {
    console.error("Erreur Gemini/Hybrid Brainstorm:", err);
    res.status(500).json({ error: err.message || "Erreur lors de la génération d'idées" });
  }
});

app.post("/api/gemini/extend", async (req, res) => {
  try {
    const { ideaText, ideaTitle, aiConfig } = req.body;
    if (!ideaText) {
      return res.status(400).json({ error: "L'idée originale est obligatoire pour pouvoir l'approfondir." });
    }

    const systemInstruction = `Tu es un conseiller expert en ingénierie de l'innovation. Propose des points de réflexion concrets et activables.
Pour chaque concept d'approfondissement, donne-lui un titre et une description courte. Suggère également une couleur parmi "pink", "purple", "orange", "blue", "green".`;

    const userPrompt = `Propose 3 sous-idées, étapes d'implémentation concrètes, risques à mitiger ou aspects techniques pour développer et approfondir l'idée suivante:
Titre: "${ideaTitle || "Idée principale"}"
Description: "${ideaText}"`;

    const rawText = await executeAiCompletion({
      aiConfig,
      systemInstruction,
      prompt: userPrompt,
      isJson: true,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Titre représentatif de l'étape ou sous-idée.",
            },
            text: {
              type: Type.STRING,
              description: "Explication ou plan d'action de 1 phrase.",
            },
            color: {
              type: Type.STRING,
            },
          },
          required: ["title", "text", "color"],
        },
      },
    });

    const ideas = parseJsonResponse(rawText, "ideas");
    res.json({ ideas });
  } catch (err: any) {
    console.error("Erreur Gemini/Hybrid Extend:", err);
    res.status(500).json({ error: err.message || "Erreur lors de l'extension de l'idée" });
  }
});

app.post("/api/gemini/categorize", async (req, res) => {
  try {
    const { nodes, aiConfig } = req.body; // Array of { id, title, text }
    if (!nodes || nodes.length === 0) {
      return res.status(400).json({ error: "Aucun post-it n'est présent sur le tableau pour classement." });
    }

    const systemInstruction = `Tu es un consultant expert en catégorisation logique de données qualitatives.
Crée des groupes pertinents (colonnes/clusters d'idées). Chaque catégorie doit avoir un titre élégant et une couleur désignée (parmi: "blue", "green", "purple", "orange", "yellow", "pink").
Retourne un tableau d'objets représentant chaque catégorie avec la liste des ID de post-its associés.`;

    const userPrompt = `Analyse ces post-its et regroupe-les logiquement par affinité thématique ou fonctionnelle en générant des catégories (groupes visuels).
Chaque catégorie doit regrouper au moins un post-it. Les post-its non classables peuvent être placés dans une catégorie globale ou diverse.
Post-its à analyser:
${JSON.stringify(nodes.map((n: any) => ({ id: n.id, title: n.title || "", text: n.text })))}`;

    const rawText = await executeAiCompletion({
      aiConfig,
      systemInstruction,
      prompt: userPrompt,
      isJson: true,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Titre explicite de la catégorie (ex: 'Technique', 'Financement', 'UX/Design').",
            },
            color: {
              type: Type.STRING,
              description: "Couleur assignée au groupe.",
            },
            nodeIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Liste des identifiants (ID) des post-its regroupés dans cette catégorie.",
            },
          },
          required: ["title", "color", "nodeIds"],
        },
      },
    });

    const groups = parseJsonResponse(rawText, "groups");
    res.json({ groups });
  } catch (err: any) {
    console.error("Erreur Gemini/Hybrid Categorize:", err);
    res.status(500).json({ error: err.message || "Erreur lors du regroupement IA" });
  }
});

app.post("/api/gemini/synthesize", async (req, res) => {
  try {
    const { nodes, connections, groups, aiConfig } = req.body;
    
    if (!nodes || Object.keys(nodes).length === 0) {
      return res.status(400).json({ error: "Veuillez d'abord ajouter des post-its pour générer une synthèse." });
    }

    // Prepare text summary of components
    const nodesSummary = Object.values(nodes).map((n: any) => `- [${n.title || "Post-it"}] : ${n.text} (${n.color})`).join("\n");
    const connectionsSummary = Object.values(connections || {}).map((c: any) => {
      const fromNode = nodes[c.fromId]?.title || c.fromId;
      const toNode = nodes[c.toId]?.title || c.toId;
      return `- Lien de "${fromNode}" vers "${toNode}" : ${c.label || "Associé"}`;
    }).join("\n");
    const groupsSummary = Object.values(groups || {}).map((g: any) => `- Groupe "${g.title}" (Couleur: ${g.color})`).join("\n");

    const systemInstruction = `Tu es un rapporteur professionnel de comités de direction et de hackathons d'innovation.
Rédige une synthèse professionnelle en Markdown (langue française).
Structure le compte-rendu avec un titre principal, une introduction synthétique, une section détaillée par axe thématique, une analyse des connexions phares ou pivots de réflexion, et une feuille de route finale listant les 5 prochaines étapes concrètes recommandées.
Évite les banalités, sois hautement pragmatique et direct pour transformer ce brainstorming créatif en un plan d'action clair.`;

    const userPrompt = `Rédige un compte-rendu ou une synthèse structurée et exploitable à partir du tableau de brainstorming suivant.
      
Post-its collectés:
${nodesSummary}

Regroupements thématiques définis:
${groupsSummary}

Liens conceptuels reliant les idées:
${connectionsSummary}
`;

    const rawText = await executeAiCompletion({
      aiConfig,
      systemInstruction,
      prompt: userPrompt,
      isJson: false,
    });

    res.json({ markdown: rawText });
  } catch (err: any) {
    console.error("Erreur Gemini/Hybrid Synthesize:", err);
    res.status(500).json({ error: err.message || "Erreur lors de la rédaction de la synthèse." });
  }
});


// -------------------------------------------------------------
// Dev Server & Production serving
// -------------------------------------------------------------

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server currently running on port ${PORT}`);
  });
}

start();
