import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Note, NoteFolder } from "../types/note.types";
import { useAutosave } from "../hooks/useAutosave";
import { downloadNoteAsPdf } from "../utils/downloadNoteAsPdf";
import {
  FaCheckCircle,
  FaBold,
  FaItalic,
  FaListUl,
  FaEye,
  FaEdit,
  FaTrash,
  FaHeading,
  FaUndo,
  FaRedo,
  FaDownload,
  FaMapSigns,
} from "react-icons/fa";
import { toast } from "sonner";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface NoteEditorProps {
  note: Note;
  folders: NoteFolder[];
  onSaveNote: (updatedPayload: Partial<Note>) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Markdown preview
//
// This used to be a hand-rolled line parser that understood headings, bullets and
// code fences but not LaTeX, so $...$ and $$...$$ showed up as raw text. It now uses
// the same react-markdown + remark-math + rehype-katex stack as TheoryPanel, with each
// element mapped to the classes the old renderer used, so the preview looks the same
// but renders maths (plus links, images, numbered lists and tables it never handled).
// ---------------------------------------------------------------------------
function markdownComponents(theme: string): Components {
  const dark = theme === "dark";
  return {
    h1: ({ children }) => (
      <h1 className={cn("text-2xl font-medium tracking-tight mt-6 mb-2", dark ? "text-white" : "text-zinc-900")}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={cn("text-xl font-medium tracking-tight mt-5 mb-1", dark ? "text-white" : "text-zinc-900")}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={cn("text-base font-medium tracking-tight mt-4 mb-1", dark ? "text-zinc-100" : "text-zinc-800")}>
        {children}
      </h3>
    ),
    p: ({ children }) => <p className="leading-relaxed my-2">{children}</p>,
    ul: ({ children }) => <ul className="space-y-1 my-2 ml-5 list-disc">{children}</ul>,
    ol: ({ children }) => <ol className="space-y-1 my-2 ml-5 list-decimal">{children}</ol>,
    hr: () => <hr className={cn("my-4 border-t", dark ? "border-white/10" : "border-zinc-200")} />,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-500 underline underline-offset-2">
        {children}
      </a>
    ),
    img: ({ src, alt }) => <img src={src} alt={alt ?? ""} className="my-3 rounded-lg max-w-full" />,
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className={cn("border px-2 py-1 font-medium", dark ? "border-white/10" : "border-zinc-200")}>{children}</th>
    ),
    td: ({ children }) => (
      <td className={cn("border px-2 py-1", dark ? "border-white/10" : "border-zinc-200")}>{children}</td>
    ),
    // Inline code; fenced blocks are styled by `pre` below, which resets these classes.
    code: ({ className, children }) => (
      <code className={cn("px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono text-[0.82em]", className)}>
        {children}
      </code>
    ),
    pre: ({ children }) => {
      const lang = React.isValidElement<{ className?: string }>(children)
        ? /language-([\w-]+)/.exec(children.props.className ?? "")?.[1]
        : undefined;
      return (
        <div className={cn("my-3 rounded-xl border overflow-hidden", dark ? "border-white/10 bg-zinc-950" : "border-zinc-200 bg-white")}>
          {lang && (
            <div
              className={cn(
                "px-4 py-1 text-[10px] font-mono uppercase tracking-widest border-b",
                dark ? "text-emerald-400 border-white/10 bg-black" : "text-emerald-600 border-zinc-200 bg-zinc-50"
              )}
            >
              {lang}
            </div>
          )}
          <pre className="px-4 py-3 font-mono text-xs overflow-x-auto leading-relaxed text-emerald-500 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[1em]">
            {children}
          </pre>
        </div>
      );
    },
  };
}

function renderMarkdown(raw: string, theme: string): React.ReactNode {
  if (!raw.trim()) {
    return (
      <p className={cn("italic text-sm", theme === "dark" ? "text-zinc-500" : "text-zinc-400")}>
        Preview is empty — start typing on the left…
      </p>
    );
  }

  return (
    <div
      className={cn(
        "font-sans text-sm leading-relaxed",
        // wide display equations scroll sideways instead of overflowing the card
        "[&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden",
        theme === "dark" ? "text-zinc-300" : "text-zinc-700"
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents(theme)}
      >
        {raw}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export const EmptyNoteEditorState: React.FC<{ onCreateNote: () => void }> = ({ onCreateNote }) => {
  const { theme } = useTheme();
  return (
    <div
      className={cn(
        "flex-1 min-h-[520px] rounded-[2rem] border p-8 flex flex-col items-center justify-center text-center font-sans shadow-sm",
        theme === "dark"
          ? "bg-zinc-950/50 border-white/10 text-white"
          : "bg-white border-zinc-200 text-zinc-900"
      )}
    >
      <div
        className={cn(
          "w-16 h-16 rounded-2xl border flex items-center justify-center mb-6 shadow-sm",
          theme === "dark"
            ? "bg-black border-white/10 text-emerald-400"
            : "bg-zinc-50 border-zinc-200 text-emerald-600"
        )}
      >
        <FaEdit className="text-2xl" />
      </div>
      <h3 className="text-xl font-sans tracking-tight mb-2">Personal Quantum Workspace</h3>
      <p
        className={cn(
          "text-sm max-w-sm leading-relaxed mb-6 font-sans",
          theme === "dark" ? "text-zinc-400" : "text-zinc-600"
        )}
      >
        Select a note from the sidebar or create a new one to capture quantum insights, formulas, and code snippets.
      </p>
      <button
        onClick={onCreateNote}
        className="px-6 py-2 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium transition-colors flex items-center gap-2"
      >
        <FaEdit className="text-xs" />
        Create First Note
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------
export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  folders,
  onSaveNote,
  onDeleteNote,
}) => {
  const { theme } = useTheme();
  const [title, setTitle] = useState(note.title || "");
  const [content, setContent] = useState(note.content_markdown || "");
  const [folderId, setFolderId] = useState<string | null>(note.folder_id || null);
  const [tagInput, setTagInput] = useState(note.tags?.join(", ") || "");
  const [activeTab, setActiveTab] = useState<"split" | "edit" | "preview">("split");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const navigate = useNavigate();

  // Reference for inserting markdown wrapping
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Download as PDF
  const handleDownloadPdf = async () => {
    const toastId = toast.loading("Generating PDF…");
    setIsDownloading(true);
    try {
      // Pass the current in-editor state (may be unsaved yet)
      const liveNote: Note = {
        ...note,
        title,
        content_markdown: content,
        tags: tagInput ? tagInput.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      await downloadNoteAsPdf(liveNote);
      toast.success("PDF downloaded!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF.", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  // Sync when note switches
  useEffect(() => {
    setTitle(note.title || "");
    setContent(note.content_markdown || "");
    setFolderId(note.folder_id || null);
    const safeTags = Array.isArray(note.tags)
      ? note.tags
      : typeof note.tags === "string"
      ? [note.tags]
      : [];
    setTagInput(safeTags.join(", "));
  }, [note._id]);

  // Autosave
  const autosaveValue = React.useMemo(
    () => ({
      title,
      content_markdown: content,
      folder_id: folderId,
      tags: tagInput
        ? tagInput.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    }),
    [title, content, folderId, tagInput]
  );

  const { isSaving, lastSavedAt } = useAutosave({
    value: autosaveValue,
    onSave: async (val) => { await onSaveNote(val); },
    delayMs: 1000,
  });

  // Insert text using execCommand so browser undo stack is preserved
  const insertText = useCallback((prefix: string, suffix = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);

    let replacement: string;
    if (suffix && selected.includes("\n")) {
      // Multi-line selection with wrapping syntax (bold/italic):
      // Apply prefix+suffix to each line individually so markdown stays valid.
      // For bullet lines "- text" → "- **text**" (preserve the "- " prefix)
      replacement = selected
        .split("\n")
        .map((line) => {
          if (!line.trim()) return line; // leave blank lines untouched
          if (line.startsWith("- ") || line.startsWith("* ")) {
            const bulletPrefix = line.slice(0, 2);
            const lineContent = line.slice(2);
            return bulletPrefix + prefix + lineContent + suffix;
          }
          return prefix + line + suffix;
        })
        .join("\n");
    } else {
      replacement = prefix + selected + suffix;
    }

    document.execCommand("insertText", false, replacement);
    // Place cursor between prefix and suffix when nothing was selected
    if (suffix && !selected) {
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    }
  }, []);

  // Bullet list — each selected line gets a "- " prefix
  const insertBullets = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);

    let replacement: string;
    if (selected && selected.includes("\n")) {
      // Multi-line selection: prefix every non-empty line with "- "
      replacement = selected
        .split("\n")
        .map((line) => (line.trim() ? "- " + line : line))
        .join("\n");
    } else if (selected) {
      replacement = "- " + selected;
    } else {
      replacement = "\n- ";
    }
    document.execCommand("insertText", false, replacement);
  }, []);

  // Toolbar button helper — onMouseDown prevents textarea losing selection
  const ToolBtn = ({
    icon,
    label,
    onClick,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={label}
      className={cn(
        "p-1.5 rounded-lg transition-colors text-sm",
        theme === "dark"
          ? "text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
      )}
    >
      {icon}
    </button>
  );

  const Divider = () => (
    <span className={cn("w-px h-4 mx-1", theme === "dark" ? "bg-white/10" : "bg-zinc-300")} />
  );

  return (
    <div
      className={cn(
        "w-full h-full rounded-[2rem] border p-6 font-sans flex flex-col gap-4 shadow-sm transition-all duration-300",
        theme === "dark"
          ? "bg-zinc-950/50 border-white/10 text-white"
          : "bg-white border-zinc-200 text-zinc-900"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b",
          theme === "dark" ? "border-white/10" : "border-zinc-200"
        )}
      >
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title…"
            className={cn(
              "w-full bg-transparent text-2xl font-sans tracking-tight outline-none",
              theme === "dark"
                ? "text-white placeholder:text-zinc-600"
                : "text-zinc-900 placeholder:text-zinc-400"
            )}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs font-sans">
            <select
              value={folderId || ""}
              onChange={(e) => setFolderId(e.target.value || null)}
              className={cn(
                "border rounded-lg px-3 py-1.5 text-xs outline-none font-sans",
                theme === "dark"
                  ? "bg-black border-white/10 text-zinc-300"
                  : "bg-zinc-50 border-zinc-200 text-zinc-700"
              )}
            >
              <option value="">No Folder</option>
              {folders.map((f) => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Tags (comma separated)…"
              className={cn(
                "border rounded-lg px-3 py-1.5 text-xs outline-none w-48 font-sans",
                theme === "dark"
                  ? "bg-black border-white/10 text-zinc-300 placeholder:text-zinc-600"
                  : "bg-zinc-50 border-zinc-200 text-zinc-700 placeholder:text-zinc-400"
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isSaving ? (
            <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] font-sans flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              Saving…
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[11px] font-sans flex items-center gap-2">
              <FaCheckCircle className="text-xs shrink-0" />
              {lastSavedAt
                ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "All changes saved"}
            </div>
          )}
          {note.topic_slug && (
            <button
              type="button"
              onClick={() => navigate(`/roadmap?topic=${note.topic_slug}`)}
              className={cn(
                "px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-mono font-medium shadow-sm",
                theme === "dark"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
              )}
              title="Jump to Roadmap Topic"
            >
              <FaMapSigns /> Roadmap
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className={cn(
              "p-2 rounded-lg border transition-colors hover:text-emerald-500 disabled:opacity-50",
              theme === "dark"
                ? "bg-black border-white/10 text-zinc-400"
                : "bg-zinc-50 border-zinc-200 text-zinc-600"
            )}
            title="Download as PDF"
          >
            <FaDownload className="text-xs" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteNote(note._id)}
            className={cn(
              "p-2 rounded-lg border transition-colors hover:text-red-500",
              theme === "dark"
                ? "bg-black border-white/10 text-zinc-400"
                : "bg-zinc-50 border-zinc-200 text-zinc-600"
            )}
            title="Delete Note"
          >
            <FaTrash className="text-xs" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border px-2 py-1.5 rounded-xl",
          theme === "dark" ? "bg-black border-white/10" : "bg-zinc-50 border-zinc-200"
        )}
      >
        <div className="flex items-center gap-0.5">
          <ToolBtn icon={<FaBold />}    label="Bold"         onClick={() => insertText("**", "**")} />
          <ToolBtn icon={<FaItalic />}  label="Italic"       onClick={() => insertText("*", "*")} />
          <Divider />
          <ToolBtn icon={<FaHeading />} label="Heading"      onClick={() => insertText("# ")} />
          <ToolBtn icon={<FaListUl />}  label="Bullet list"  onClick={insertBullets} />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertText("\n```python\n", "\n```"); }}
            title="Code block"
            className={cn(
              "px-2 py-1 rounded-lg transition-colors text-[11px] font-mono",
              theme === "dark"
                ? "text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
            )}
          >
            {"</>"}
          </button>
          <Divider />
          <ToolBtn
            icon={<FaUndo />}
            label="Undo (Ctrl+Z)"
            onClick={() => { textareaRef.current?.focus(); document.execCommand("undo"); }}
          />
          <ToolBtn
            icon={<FaRedo />}
            label="Redo (Ctrl+Y)"
            onClick={() => { textareaRef.current?.focus(); document.execCommand("redo"); }}
          />
        </div>

        {/* View mode */}
        <div
          className={cn(
            "flex items-center gap-1 p-1 rounded-lg border",
            theme === "dark" ? "bg-zinc-900 border-white/10" : "bg-zinc-100 border-zinc-200"
          )}
        >
          {(["split", "edit", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-sans transition-colors",
                activeTab === tab
                  ? "bg-emerald-500 text-white shadow-sm"
                  : theme === "dark"
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-800"
              )}
            >
              {tab === "split" ? "Split" : tab === "edit" ? <FaEdit /> : <FaEye />}
            </button>
          ))}
        </div>
      </div>

      {/* Editor panes */}
      <div
        className={cn(
          "grid gap-4 flex-1 min-h-[420px]",
          activeTab === "split" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        )}
      >
        {(activeTab === "split" || activeTab === "edit") && (
          <div
            className={cn(
              "flex flex-col h-full border rounded-2xl p-4",
              theme === "dark" ? "bg-black border-white/10" : "bg-zinc-50 border-zinc-200"
            )}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"Start writing Markdown…\n\n# Heading\n**bold**, *italic*, `code`\n- bullet point"}
              spellCheck
              className={cn(
                "w-full h-full bg-transparent font-mono text-xs outline-none resize-none leading-loose cursor-text",
                theme === "dark"
                  ? "text-zinc-200 placeholder:text-zinc-700"
                  : "text-zinc-800 placeholder:text-zinc-400"
              )}
            />
          </div>
        )}

        {(activeTab === "split" || activeTab === "preview") && (
          <div
            className={cn(
              "flex flex-col h-full border rounded-2xl p-5 overflow-y-auto",
              theme === "dark" ? "bg-black border-white/10" : "bg-zinc-50 border-zinc-200"
            )}
          >
            <div className="text-[10px] font-mono uppercase tracking-widest mb-4 text-emerald-500">
              Rendered Preview
            </div>
            {renderMarkdown(content, theme)}
          </div>
        )}
      </div>
    </div>
  );
};
