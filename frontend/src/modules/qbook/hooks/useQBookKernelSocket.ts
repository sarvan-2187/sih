import { useCallback, useEffect, useRef, useState } from 'react';
import { useQBookApi } from './useQBookApi';
import type { NotebookCellOutput } from '../types';

// No trailing slash expected. Defaults to the local notebook_service docker-compose
// port (see notebook_service/docker-compose.yml) — same fallback-default pattern
// apiClient.ts uses for VITE_API_URL.
const QBOOK_SERVICE_URL = import.meta.env.VITE_QBOOK_SERVICE_URL || 'ws://127.0.0.1:8081';

export type KernelStatus = 'idle' | 'connecting' | 'connected' | 'error';

type ServerMessage =
  | { type: 'output'; cell_id: string; output: NotebookCellOutput }
  | { type: 'execution_done'; cell_id: string; execution_count: number | null }
  | { type: 'timeout'; cell_id: string }
  | { type: 'input_request'; cell_id: string; prompt: string; password: boolean }
  | { type: 'dataset_attached'; filename: string }
  | { type: 'error'; message: string };

/** ArrayBuffer -> base64, chunked to avoid a single giant String.fromCharCode(...spread)
 * call blowing the call stack on larger CSVs (fine up to the ~10MB dataset cap —
 * see PLANS/qbook-qml.md §6.2 — but chunking costs nothing and removes the ceiling). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

interface RunCellHandlers {
  onOutput: (output: NotebookCellOutput) => void;
  onDone: (executionCount: number | null) => void;
  onTimeout: () => void;
  onError: (message: string) => void;
  /** Fired when the cell calls input()/getpass() — notebook_service pauses the
   * kernel until sendInputReply() is called for this cell. */
  onInputRequest: (prompt: string, password: boolean) => void;
}

/** One kernel WebSocket per open notebook — matches notebook_service's one-kernel-
 * per-(uid, notebook_id) session model (PLANS/qbook.md §1). Connects lazily on the
 * first cell run rather than on mount, so opening a notebook you never execute
 * doesn't spend a kernel slot.
 */
export const useQBookKernelSocket = (notebookId: string) => {
  const { createSession } = useQBookApi();
  const socketRef = useRef<WebSocket | null>(null);
  const connectingRef = useRef<Promise<WebSocket> | null>(null);
  const handlersRef = useRef<Map<string, RunCellHandlers>>(new Map());
  // At most one "attach_dataset" in flight at a time — the UI only ever triggers
  // one "Load into this notebook" click at a time, so a single pending slot (not
  // a map keyed by filename) is enough.
  const pendingDatasetRef = useRef<{ resolve: () => void; reject: (err: Error) => void } | null>(null);
  const [status, setStatus] = useState<KernelStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Closes the socket if this notebook is navigated away from mid-session, rather
  // than leaving it (and the kernel it's attached to) orphaned until
  // notebook_service's own idle-reap timeout eventually catches it.
  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
  }, []);

  const connect = useCallback(async (): Promise<WebSocket> => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return socketRef.current;
    }
    if (connectingRef.current) return connectingRef.current;

    setStatus('connecting');
    setStatusMessage(null);

    const connectPromise = (async () => {
      let sessionToken: string;
      try {
        ({ session_token: sessionToken } = await createSession(notebookId));
      } catch (err: any) {
        const detail = err.response?.data?.detail || err.message || 'unknown error';
        throw new Error(`Could not start a QBook session (backend rejected the request: ${detail})`);
      }

      const socket = new WebSocket(`${QBOOK_SERVICE_URL}/ws/session?token=${encodeURIComponent(sessionToken)}`);

      socket.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);

        if (message.type === 'dataset_attached') {
          pendingDatasetRef.current?.resolve();
          pendingDatasetRef.current = null;
          return;
        }

        if (message.type === 'error') {
          // Connection-level errors (e.g. "at capacity", or a rejected
          // attach_dataset — see main.py's write_dataset() failure path) have no
          // cell_id — surface to every cell currently waiting, and to a pending
          // dataset attach if one is in flight.
          handlersRef.current.forEach((handlers) => handlers.onError(message.message));
          pendingDatasetRef.current?.reject(new Error(message.message));
          pendingDatasetRef.current = null;
          return;
        }

        const handlers = handlersRef.current.get(message.cell_id);
        if (!handlers) return;

        if (message.type === 'output') {
          handlers.onOutput(message.output);
        } else if (message.type === 'execution_done') {
          handlers.onDone(message.execution_count);
          handlersRef.current.delete(message.cell_id);
        } else if (message.type === 'timeout') {
          handlers.onTimeout();
        } else if (message.type === 'input_request') {
          handlers.onInputRequest(message.prompt, message.password);
        }
      };

      socket.onclose = (event) => {
        socketRef.current = null;
        setStatus('idle');
        // 4401 is what notebook_service/main.py's ws_session closes with on a
        // rejected/expired token — worth calling out specifically since "closed"
        // alone looks identical to a clean disconnect otherwise.
        if (event.code === 4401) {
          setStatusMessage('Kernel session was rejected (invalid or expired token) — click Run to get a fresh one.');
        }
      };

      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error(
          `Could not reach the QBook kernel service at ${QBOOK_SERVICE_URL} — is notebook_service running?`,
        ));
      });

      socketRef.current = socket;
      setStatus('connected');
      return socket;
    })();

    connectingRef.current = connectPromise;
    try {
      const socket = await connectPromise;
      return socket;
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message);
      throw err;
    } finally {
      connectingRef.current = null;
    }
  }, [createSession, notebookId]);

  const runCell = useCallback(async (cellId: string, code: string, handlers: RunCellHandlers) => {
    try {
      const socket = await connect();
      handlersRef.current.set(cellId, handlers);
      socket.send(JSON.stringify({ type: 'execute', cell_id: cellId, code }));
    } catch (err: any) {
      handlers.onError(err.message || 'Could not reach the notebook kernel service');
    }
  }, [connect]);

  const interrupt = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: 'interrupt' }));
  }, []);

  /** Answers a pending input()/getpass() call — cell_id is passed through for
   * clarity but the server doesn't need it for routing (only one cell can run,
   * and hold the kernel's stdin, at a time per session).
   */
  const sendInputReply = useCallback((cellId: string, value: string) => {
    socketRef.current?.send(JSON.stringify({ type: 'input_reply', cell_id: cellId, value }));
  }, []);

  /** Writes a dataset's bytes (already fetched from B2 by useQBookDatasetsApi's
   * fetchDatasetBytes) into this kernel's own datasets/ directory, so a cell can
   * then do pd.read_csv(`datasets/${filename}`). One at a time — see
   * pendingDatasetRef above.
   */
  const attachDataset = useCallback(async (filename: string, buffer: ArrayBuffer) => {
    const socket = await connect();
    await new Promise<void>((resolve, reject) => {
      pendingDatasetRef.current = { resolve, reject };
      socket.send(JSON.stringify({
        type: 'attach_dataset',
        filename,
        content_b64: arrayBufferToBase64(buffer),
      }));
    });
  }, [connect]);

  return { runCell, interrupt, attachDataset, sendInputReply, status, statusMessage };
};
