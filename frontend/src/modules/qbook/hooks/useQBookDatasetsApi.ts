import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import type {
  Dataset,
  DatasetDownloadUrlResponse,
  DatasetUploadUrlResponse,
} from '../types';

/** CRUD + upload/download for QBook's "My Datasets" — mirrors useQBookApi.ts's
 * loading/error wrapper. The actual file bytes never pass through backend/: the
 * browser PUTs straight to the presigned B2 URL on upload, and GETs straight from
 * it on load (see PLANS/qbook-qml.md §0 for why notebook_service never touches B2
 * either — this hook is the "browser talks to both sides" piece of that design).
 */
export const useQBookDatasetsApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Request failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const listDatasets = useCallback(() => run(async () => {
    const response = await apiClient.get<Dataset[]>('/api/v1/qbook/datasets');
    return response.data;
  }), [run]);

  const deleteDataset = useCallback((datasetId: string) => run(async () => {
    await apiClient.delete(`/api/v1/qbook/datasets/${datasetId}`);
  }), [run]);

  /** Uploads a CSV: requests a presigned URL, PUTs the file directly to B2 (XHR,
   * so upload progress can be reported — same approach ResourceUpload.tsx already
   * uses for course resources), then confirms. Deliberately no Authorization
   * header on the PUT itself: B2 authenticates via the presigned URL's own
   * signature, not a bearer token.
   */
  const uploadDataset = useCallback(
    (file: File, onProgress?: (percent: number) => void) => run(async () => {
      const { data } = await apiClient.post<DatasetUploadUrlResponse>('/api/v1/qbook/datasets/upload-url', {
        filename: file.name,
        content_type: file.type || 'text/csv',
        size_bytes: file.size,
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', data.upload_url, true);
        xhr.setRequestHeader('Content-Type', file.type || 'text/csv');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload to storage failed (status ${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error('Upload to storage failed (network error).'));
        xhr.send(file);
      });

      await apiClient.post(`/api/v1/qbook/datasets/${data.dataset_id}/confirm`);
      return { id: data.dataset_id, filename: file.name };
    }),
    [run],
  );

  /** Fetches a dataset's bytes straight from B2 (via a presigned GET URL backend/
   * mints), for the caller to relay over the kernel WebSocket. Not wrapped in
   * apiClient since this second request goes to B2, not backend/.
   */
  const fetchDatasetBytes = useCallback(
    (datasetId: string) => run(async () => {
      const { data } = await apiClient.get<DatasetDownloadUrlResponse>(
        `/api/v1/qbook/datasets/${datasetId}/download-url`,
      );
      const response = await fetch(data.download_url);
      if (!response.ok) throw new Error(`Could not fetch dataset from storage (status ${response.status}).`);
      const buffer = await response.arrayBuffer();
      return { filename: data.filename, buffer };
    }),
    [run],
  );

  return {
    listDatasets,
    uploadDataset,
    fetchDatasetBytes,
    deleteDataset,
    loading,
    error,
  };
};
