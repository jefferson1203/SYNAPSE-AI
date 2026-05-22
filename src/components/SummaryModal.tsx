import { X, Copy, Download, Check, FileText } from "lucide-react";
import { useState } from "react";

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  markdown: string;
}

export default function SummaryModal({ isOpen, onClose, markdown }: SummaryModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erreur de copie:", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `synthese-brainstorming-${new Date().toISOString().split("T")[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Basic markdown parser for clean presentation without external dependencies
  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        return (
          <h1 key={idx} className="text-2xl font-black font-display text-white mt-6 mb-3 border-b pb-2 border-slate-800 uppercase tracking-widest text-indigo-400">
            {trimmed.substring(2)}
          </h1>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-lg font-extrabold font-display text-slate-200 mt-5 mb-2 uppercase tracking-wider text-indigo-300">
            {trimmed.substring(3)}
          </h2>
        );
      }
      if (trimmed.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-base font-bold text-slate-300 mt-4 mb-1">
            {trimmed.substring(4)}
          </h3>
        );
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const content = trimmed.substring(2);
        return (
          <li key={idx} className="ml-5 list-disc text-slate-300 my-1 leading-relaxed">
            {renderInlineMarkdown(content)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const content = trimmed.replace(/^\d+\.\s/, "");
        return (
          <li key={idx} className="ml-5 list-decimal text-slate-300 my-1 leading-relaxed">
            {renderInlineMarkdown(content)}
          </li>
        );
      }
      if (trimmed === "") {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p key={idx} className="text-slate-350 my-2 leading-relaxed text-sm">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (text: string) => {
    // Regex parsing for bold **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-extrabold text-indigo-400">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-[#16161A] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-800">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-[#111115] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-950 text-indigo-400 p-2 rounded-lg border border-indigo-500/20">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-md font-extrabold font-display text-slate-100 uppercase tracking-widest">Synthèse Augmentée par l'IA</h2>
              <p className="text-xs text-slate-500 font-mono">Générée en temps réel à partir de vos post-its</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 select-text scrollbar-hide">
          <div className="prose max-w-none text-slate-300 bg-[#0B0B0C] p-6 rounded-xl border border-slate-850">
            {renderMarkdown(markdown)}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-between items-center px-6 py-4 bg-[#111115] border-t border-slate-800">
          <p className="text-xs text-slate-500">
            Vous pouvez télécharger ce rapport sous format Markdown (.md)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 rounded-xl bg-[#0F0F12] hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copier</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-extrabold uppercase tracking-wide text-white shadow-md cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger .md</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
