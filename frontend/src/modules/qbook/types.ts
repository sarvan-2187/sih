export interface NotebookCellOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error';
  name?: string;
  text?: string;
  data?: Record<string, string>;
  execution_count?: number | null;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

export interface NotebookCell {
  id: string;
  cell_type: 'code' | 'markdown';
  source: string;
  outputs: NotebookCellOutput[];
  execution_count: number | null;
}

export interface NotebookSummary {
  id: string;
  title: string;
  cell_count: number;
  updated_at: string;
}

export interface Notebook {
  id: string;
  owner_uid: string;
  title: string;
  cells: NotebookCell[];
  created_at: string;
  updated_at: string;
}

export interface NotebookSessionResponse {
  session_token: string;
  expires_in: number;
}

export interface Dataset {
  id: string;
  owner_uid: string;
  filename: string;
  b2_key: string;
  content_type: string;
  size_bytes: number;
  status: 'pending' | 'confirmed';
  created_at: string;
}

export interface DatasetUploadUrlResponse {
  upload_url: string;
  dataset_id: string;
}

export interface DatasetDownloadUrlResponse {
  download_url: string;
  filename: string;
}

// --- Qrious Code (formerly QPilot) — QBook's per-cell AI coding assistant. Type and API
//     names keep the QPilot prefix; only user-facing text was renamed. ---

export interface QPilotError {
  ename: string;
  evalue: string;
  traceback: string[];
}

export interface QPilotRequest {
  code: string;
  instruction: string;
  error: QPilotError | null;
}

export interface QPilotResult {
  explanation: string;
  suggested_code: string | null;
}
