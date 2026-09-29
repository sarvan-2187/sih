import React, { useState, useEffect, useRef } from 'react';
import { useAiTutorApi } from '../hooks/useAiTutorApi';
import type { CircuitContext } from '../hooks/useAiTutorApi';
import { QuantumMarkdownRenderer } from './QuantumMarkdownRenderer';
import { SchrodingerCat } from './SchrodingerCat';
import { FaPaperPlane, FaTimes, FaMagic, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CircuitCopilotSidebarProps {
  circuitContext: CircuitContext;
  isOpen: boolean;
  onClose: () => void;
  /** Omitted on pages with no circuit, which hides the Apply button on code blocks. */
  onApplyCode?: (code: string) => void;
  /** False when Qrious Code is opened from a page that has no circuit to inspect. */
  hasCircuit?: boolean;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
  isCatInCopilot?: boolean;
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
}

export const CircuitCopilotSidebar: React.FC<CircuitCopilotSidebarProps> = ({ 
  circuitContext, 
  isOpen, 
  onClose, 
  onApplyCode, 
  hasCircuit = true,
  anchorRef,
  isCatInCopilot,
  copilotWidth,
  setCopilotWidth
}) => {
  const isMobile = useIsMobile();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const rightEdgeRef = useRef<number>(0);

  const { askAi, explainCircuit, optimizeCircuit, detectMistakes, loading } = useAiTutorApi();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      // Width = distance from the cursor to the panel's own right edge,
      // captured once at drag-start (see onMouseDown below). Previously this
      // assumed the panel's right edge always sits at window.innerWidth,
      // which only holds if nothing (the app's own left nav sidebar, a
      // scrollbar, a centered/max-width layout container) ever offsets it —
      // any such offset made the computed width wrong by that whole amount,
      // which is what dragged the panel sharply to the left instead of
      // tracking the cursor.
      const newWidth = rightEdgeRef.current - e.clientX;
      // Constrain width
      if (newWidth > 300 && newWidth < 800) {
        setCopilotWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = 'default';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, setCopilotWidth]);

  useEffect(() => {
    if (messages.length === 0) {
      if (!hasCircuit) {
        setMessages([{ role: 'assistant', content: "I'm Qrious Code. Ask me about any quantum concept, or have me write and explain Qiskit or OpenQASM code." }]);
      } else if (circuitContext.gateCount === 0) {
        setMessages([{ role: 'assistant', content: "Start building your circuit and I can explain gates, suggest structures, and help you debug it." }]);
      } else {
        setMessages([{ role: 'assistant', content: "I can see your current circuit. What would you like to understand or improve?" }]);
      }
    }
  }, [circuitContext.gateCount, messages.length, hasCircuit]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    
    try {
      const res = await askAi(userMsg, circuitContext);
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I ran into an error connecting to my brain." }]);
    }
  };
  
  const handleAction = async (action: 'explain' | 'optimize' | 'mistakes') => {
    const actionText = action === 'explain' ? 'Explain Circuit' : action === 'optimize' ? 'Optimize Circuit' : 'Find Mistakes';
    setMessages(prev => [...prev, { role: 'user', content: actionText }]);
    try {
      let result;
      if (action === 'explain') result = await explainCircuit(circuitContext);
      else if (action === 'optimize') result = (await optimizeCircuit(circuitContext)).join('\n\n');
      else result = (await detectMistakes(circuitContext)).join('\n\n');
      
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I failed to process the ${action} request.` }]);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent global playground shortcuts when typing in AI chat
    e.stopPropagation();
    if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  };

  // renderMarkdown is handled by QuantumMarkdownRenderer
  const SidebarContent = (
    <div className="flex flex-col h-full bg-qp-card border-l border-qp-border text-qp-text overflow-hidden shadow-2xl z-20 relative">
      {/* Resize Handle */}
      <div
        ref={dragRef}
        onMouseDown={(e) => {
          const panel = e.currentTarget.parentElement;
          rightEdgeRef.current = panel ? panel.getBoundingClientRect().right : window.innerWidth;
          setIsDragging(true);
        }}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 z-50 transition-colors"
      />
      
      <div className="bg-qp-secondary/80 border-b border-qp-border p-4 flex justify-between items-center shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 font-bold text-sm relative">
            <div ref={anchorRef} className="w-8 h-8 shrink-0 relative flex items-center justify-center">
              {isCatInCopilot && (
                <div className="absolute inset-0 pointer-events-none z-50 scale-100 flex items-center justify-center -top-3">
                  <SchrodingerCat state="thinking" />
                </div>
              )}
            </div>
            Qrious Code
          </div>
          <div className="text-[10px] text-qp-text-muted font-mono mt-1">
            {hasCircuit
              ? `${circuitContext.qubits} qubits • ${circuitContext.cbits} cbits • ${circuitContext.gateCount} gates`
              : 'Quantum coding assistant'}
          </div>
        </div>
        <button onClick={onClose} className="hover:bg-qp-hover text-qp-text-muted hover:text-qp-text p-2 rounded-lg transition-colors">
          <FaTimes />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-qp-bg/30 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        {hasCircuit && (
        <div className="flex gap-2 overflow-x-auto pb-2 whitespace-nowrap mb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <button onClick={() => handleAction('explain')} className="text-xs bg-qp-card hover:bg-qp-hover text-qp-text px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-qp-border transition-colors font-medium shadow-sm">
            <FaInfoCircle className="text-blue-400" /> Explain
          </button>
          <button onClick={() => handleAction('optimize')} className="text-xs bg-qp-card hover:bg-qp-hover text-qp-text px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-qp-border transition-colors font-medium shadow-sm">
            <FaMagic className="text-emerald-500" /> Optimize
          </button>
          <button onClick={() => handleAction('mistakes')} className="text-xs bg-qp-card hover:bg-qp-hover text-qp-text px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-qp-border transition-colors font-medium shadow-sm">
            <FaExclamationTriangle className="text-orange-500" /> Find Mistakes
          </button>
        </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={cn(
              "max-w-[90%] p-3.5 rounded-2xl text-sm leading-relaxed",
              m.role === 'user' 
                ? "bg-emerald-500 text-white rounded-br-sm shadow-sm" 
                : "bg-qp-secondary border border-qp-border rounded-bl-sm text-qp-text shadow-sm"
            )}>
              <div className="max-w-full overflow-hidden">
                <QuantumMarkdownRenderer content={m.content} onApplyCode={onApplyCode} />
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-qp-secondary border border-qp-border rounded-2xl rounded-bl-sm shadow-sm px-4 py-3 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-qp-text-muted animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-qp-text-muted animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-qp-text-muted animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSend} className="p-3 bg-qp-secondary border-t border-qp-border flex items-center gap-2 shrink-0">
        <input 
          ref={inputRef}
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={hasCircuit ? 'Ask about your circuit...' : 'Ask about quantum code...'}
          className="flex-1 bg-qp-bg text-qp-text border border-qp-border rounded-xl px-3 py-2 outline-none focus:border-emerald-500 transition-colors text-sm"
        />
        <button 
          type="submit" 
          disabled={!input.trim() || loading}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white p-2.5 rounded-xl transition-colors shadow-sm"
        >
          <FaPaperPlane className="w-3 h-3" />
        </button>
      </form>
    </div>
  );

  if (!isOpen) return null;

  if (!isMobile) {
    return (
      <motion.div 
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: copilotWidth, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "h-full shrink-0 overflow-hidden relative",
          isDragging ? "pointer-events-none select-none" : ""
        )}
      >
        <div style={{ width: `${copilotWidth}px` }} className="h-full pointer-events-auto">
          {SidebarContent}
        </div>
      </motion.div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 border-l border-qp-border bg-qp-bg">
        {SidebarContent}
      </SheetContent>
    </Sheet>
  );
};
