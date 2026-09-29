import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, RefObject } from 'react';

import { useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { CircuitCopilotSidebar } from '@/modules/gates-playground/components/CircuitCopilotSidebar';
import { SchrodingerLauncher } from '@/modules/gates-playground/components/SchrodingerLauncher';
import { CatOverlay } from '@/modules/gates-playground/components/CatOverlay';
import { COPILOT_WIDTH } from '@/modules/gates-playground/constants/layout';
import type { CircuitContext } from '@/modules/gates-playground/hooks/useAiTutorApi';

/**
 * Qrious Code: the app-wide AI coding assistant (formerly "Circuit Copilot").
 *
 * One panel and one Schrodinger's-cat launcher live in AppLayout, so they are on every
 * page. Opening it plays the original cat animation (the cat teleports from the launcher
 * into the panel header) and collapses the left nav to make room, exactly as the
 * per-page Circuit Copilot did in Gates Playground.
 *
 * Pages that own a circuit (Gates Playground, Puzzles, Bloch sphere) register it with
 * useQriousCodeCircuit, which turns on circuit awareness: the Explain / Optimize /
 * Find-mistakes actions and "Apply code" back into the circuit. Everywhere else it is a
 * general quantum and Qiskit assistant.
 *
 * State is split across two contexts on purpose. Circuit pages only read the stable
 * controls context, so registering their circuit never re-renders them, which is what
 * would otherwise loop (register -> provider update -> page re-render -> register...).
 */

const EMPTY_CIRCUIT: CircuitContext = { qasm: '', qubits: 0, cbits: 0, gateCount: 0 };

interface CircuitBinding {
  context: CircuitContext;
  applyCode: (code: string) => void;
}

interface QriousCodeControls {
  open: () => void;
  close: () => void;
  toggle: () => void;
  bindCircuit: (binding: CircuitBinding | null) => void;
}

interface CatRefs {
  launcher: RefObject<HTMLButtonElement | null>;
  gateA: RefObject<HTMLDivElement | null>;
  gateB: RefObject<HTMLDivElement | null>;
  catAnchor: RefObject<HTMLDivElement | null>;
}

interface QriousCodeState {
  isOpen: boolean;
  circuit: CircuitBinding | null;
  width: number;
  setWidth: (width: number) => void;
  isCatInPanel: boolean;
  setIsCatInPanel: (value: boolean) => void;
  catRefs: CatRefs;
}

const ControlsContext = createContext<QriousCodeControls | null>(null);
const StateContext = createContext<QriousCodeState | null>(null);

export function QriousCodeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [circuit, setCircuit] = useState<CircuitBinding | null>(null);
  const [width, setWidth] = useState(COPILOT_WIDTH);
  const [isCatInPanel, setIsCatInPanel] = useState(false);

  // Refs for the cat's flight path: launcher -> gate A -> gate B -> panel header.
  const launcher = useRef<HTMLButtonElement | null>(null);
  const gateA = useRef<HTMLDivElement | null>(null);
  const gateB = useRef<HTMLDivElement | null>(null);
  const catAnchor = useRef<HTMLDivElement | null>(null);
  const catRefs = useMemo<CatRefs>(() => ({ launcher, gateA, gateB, catAnchor }), []);

  // The controls object must stay referentially stable (see the module comment), so it
  // reads the latest open state and nav sidebar through refs rather than closing over them.
  const sidebar = useSidebar();
  const sidebarRef = useRef(sidebar);
  sidebarRef.current = sidebar;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const navWasOpen = useRef(true);

  const controls = useMemo<QriousCodeControls>(() => {
    const open = () => {
      if (isOpenRef.current) return;
      // Remember the nav's state so closing restores it instead of always re-opening it.
      navWasOpen.current = sidebarRef.current.open;
      sidebarRef.current.setOpen(false);
      setIsOpen(true);
    };
    const close = () => {
      if (!isOpenRef.current) return;
      setIsOpen(false);
      setIsCatInPanel(false);
      sidebarRef.current.setOpen(navWasOpen.current);
    };
    return {
      open,
      close,
      toggle: () => (isOpenRef.current ? close() : open()),
      bindCircuit: setCircuit,
    };
  }, []);

  const state = useMemo<QriousCodeState>(
    () => ({ isOpen, circuit, width, setWidth, isCatInPanel, setIsCatInPanel, catRefs }),
    [isOpen, circuit, width, isCatInPanel, catRefs],
  );

  return (
    <ControlsContext.Provider value={controls}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ControlsContext.Provider>
  );
}

function useControls(): QriousCodeControls {
  const controls = useContext(ControlsContext);
  if (!controls) throw new Error('Qrious Code hooks must be used inside <QriousCodeProvider>');
  return controls;
}

function useQriousCodeState(): QriousCodeState {
  const state = useContext(StateContext);
  if (!state) throw new Error('Qrious Code hooks must be used inside <QriousCodeProvider>');
  return state;
}

/** Open / close Qrious Code from anywhere inside the app shell. */
export const useQriousCode = useControls;

/**
 * Circuit pages call this every render with their live circuit and an apply-code handler.
 * It is keyed on the circuit's content, so passing a fresh-but-equal object each render
 * does not churn the provider, and the binding is removed when the page unmounts.
 */
export function useQriousCodeCircuit(context: CircuitContext, applyCode: (code: string) => void) {
  const { bindCircuit } = useControls();

  const applyRef = useRef(applyCode);
  applyRef.current = applyCode;
  const stableApply = useCallback((code: string) => applyRef.current(code), []);

  const contentKey = JSON.stringify(context);
  useEffect(() => {
    bindCircuit({ context, applyCode: stableApply });
    // `context` is represented by contentKey; depending on the object identity would
    // re-bind on every render of the host page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, bindCircuit, stableApply]);

  useEffect(() => () => bindCircuit(null), [bindCircuit]);
}

/**
 * The panel itself. Rendered once, beside the routed page, in AppLayout.
 *
 * The app shell only has a MINIMUM height (min-h-svh), so on a long page such as the
 * Dashboard the document scrolls and an `h-full` panel would stretch to the page's full
 * height, with its input far below the fold. So on desktop the panel is pinned to the
 * viewport under the 56px header (h-14), and a spacer of the same width sits in the
 * layout so the page still reflows beside it instead of sliding underneath.
 * (Making the shell fixed-height would also work, but RoadmapPage scrolls the window.)
 */
export function QriousCodePanel() {
  const { close } = useControls();
  const { isOpen, circuit, width, setWidth, isCatInPanel, catRefs } = useQriousCodeState();
  const isMobile = useIsMobile();

  const sidebar = (
    <CircuitCopilotSidebar
      isOpen={isOpen}
      onClose={close}
      circuitContext={circuit?.context ?? EMPTY_CIRCUIT}
      hasCircuit={circuit !== null}
      // Undefined on non-circuit pages, which hides the "Apply" button on code blocks
      // rather than showing one that has nowhere to apply to.
      onApplyCode={circuit?.applyCode}
      anchorRef={catRefs.catAnchor}
      isCatInCopilot={isCatInPanel}
      copilotWidth={width}
      setCopilotWidth={setWidth}
    />
  );

  // On mobile the sidebar renders as its own full-height Sheet overlay.
  if (isMobile) return sidebar;

  return (
    <>
      <div
        aria-hidden
        className="shrink-0 transition-[width] duration-300 ease-in-out"
        style={{ width: isOpen ? width : 0 }}
      />
      {isOpen && <div className="fixed right-0 top-14 bottom-0 z-30">{sidebar}</div>}
    </>
  );
}

/**
 * The Schrodinger's-cat launcher, bottom-right on every page, plus the cat's teleport
 * animation into the panel header. Same components and geometry the per-page Circuit
 * Copilot used; the launcher fades out and ignores clicks while the panel is open.
 */
export function QriousCodeLauncher() {
  const { toggle } = useControls();
  const { isOpen, width, isCatInPanel, setIsCatInPanel, catRefs } = useQriousCodeState();

  return (
    <>
      <div className="fixed bottom-10 right-10 z-50">
        <SchrodingerLauncher anchorRef={catRefs.launcher} onClick={toggle} isOpen={isOpen} />
      </div>

      {/* Waypoints for the cat's flight path, tracking the panel's left edge. */}
      <div
        ref={catRefs.gateA}
        className="fixed bottom-16 pointer-events-none w-0 h-0 z-0 bg-transparent"
        style={{ right: isOpen ? width : COPILOT_WIDTH }}
        aria-hidden="true"
      />
      <div
        ref={catRefs.gateB}
        className="fixed top-32 pointer-events-none w-0 h-0 z-0 bg-transparent"
        style={{ right: isOpen ? width : COPILOT_WIDTH }}
        aria-hidden="true"
      />

      <CatOverlay
        isOpen={isOpen}
        launcherAnchorRef={catRefs.launcher}
        gateAAnchorRef={catRefs.gateA}
        gateBAnchorRef={catRefs.gateB}
        copilotCatAnchorRef={catRefs.catAnchor}
        isCatInCopilot={isCatInPanel}
        onCatArrived={() => setIsCatInPanel(true)}
      />
    </>
  );
}
