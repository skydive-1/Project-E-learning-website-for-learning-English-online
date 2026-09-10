/**
 * PDF Highlight & Personal Notes Frontend Service (TASK-PDF-SMART-NOTES-01)
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai & kiểm thử: AI Agent
 * 
 * Features:
 * - Offline-first support with IndexedDB/LocalStorage caching
 * - Conflict resolution with multiple strategies
 * - Offline queue with background sync
 * - Conflict detection and resolution
 * - Optimistic UI updates
 */

import apiClient from '../../../config/api.config';

const OFFLINE_QUEUE_KEY = 'pdf_notes_offline_queue';
const CONFLICT_RESOLUTION_KEY = 'pdf_notes_conflicts';

/**
 * Lấy danh sách ghi chú theo bài học và tài liệu PDF
 * @param {string|number} lessonId 
 * @param {string} documentRef 
 * @param {number} [page] 
 */
export const fetchPdfNotes = async (lessonId, documentRef, page) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const params = {};
  if (documentRef) params.documentRef = documentRef;
  if (page) params.page = page;

  try {
    const response = await apiClient.get(`/lessons/${cleanId}/pdf-notes`, { params });
    const notes = response.data?.data || [];
    
    // Cache successful response for offline use
    cacheNotes(lessonId, documentRef || 'primary', response.data?.data || []);
    
    return notes;
  } catch (error) {
    // Offline fallback - return cached data
    const cached = getCachedNotes(lessonId, documentRef || 'primary');
    if (cached.length > 0) {
      console.warn('Offline mode: returning cached PDF notes');
      return cached;
    }
    throw error;
  }
};

/**
 * Cache notes locally for offline access
 */
const cacheNotes = (lessonId, documentRef, notes) => {
  try {
    const key = `pdf_notes_cache_${lessonId}_${documentRef || 'primary'}`;
    localStorage.setItem(key, JSON.stringify({
      notes,
      timestamp: Date.now(),
      lessonId,
      documentRef
    }));
  } catch (e) {
    console.warn('Failed to cache PDF notes:', e);
  }
};

const getCachedNotes = (lessonId, documentRef) => {
  try {
    const key = `pdf_notes_cache_${lessonId}_${documentRef || 'primary'}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const data = JSON.parse(cached);
      return data.notes || [];
    }
  } catch (e) {
    console.warn('Failed to read cached PDF notes:', e);
  }
  return [];
};

/**
 * Tạo mới ghi chú / highlight trên PDF (with offline support)
 * @param {string|number} lessonId 
 * @param {object} noteData 
 */
export const createPdfNote = async (lessonId, noteData) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  
  // Add client-side metadata for conflict resolution
  const noteWithMeta = {
    ...noteData,
    _clientId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    _createdAt: new Date().toISOString(),
    _version: 1,
    _dirty: true // Mark as pending sync
  };

  try {
    const response = await apiClient.post(`/lessons/${cleanId}/pdf-notes`, noteWithMeta);
    const serverNote = response.data?.data;
    
    // Update cache with server response
    if (serverNote) {
      updateCachedNote(lessonId, noteData.documentRef || 'primary', noteWithMeta._clientId, serverNote);
    }
    
    return serverNote;
  } catch (error) {
    // Offline: queue for later sync
    queueOfflineOperation('create', cleanId, noteWithMeta);
    return noteWithMeta; // Return optimistic note
  }
};

/**
 * Cập nhật nội dung hoặc phân loại ghi chú (with offline support)
 * @param {string|number} lessonId 
 * @param {string|number} noteId 
 * @param {object} updateData 
 */
export const updatePdfNote = async (lessonId, noteId, updateData) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  
  const updateWithMeta = {
    ...updateData,
    _version: (updateData._version || 0) + 1,
    _updatedAt: new Date().toISOString(),
    _dirty: true
  };

  try {
    const response = await apiClient.put(`/lessons/${cleanId}/pdf-notes/${noteId}`, updateWithMeta);
    const serverNote = response.data?.data;
    
    if (serverNote) {
      updateCachedNote(lessonId, updateData.documentRef || 'primary', noteId, serverNote);
    }
    
    return serverNote;
  } catch (error) {
    // Offline: queue for later sync
    queueOfflineOperation('update', cleanId, { noteId, ...updateWithMeta });
    return { ...updateWithMeta, id: noteId, _dirty: true };
  }
};

/**
 * Xóa một ghi chú (with offline support)
 * @param {string|number} lessonId 
 * @param {string|number} noteId 
 */
export const deletePdfNote = async (lessonId, noteId) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  
  try {
    const response = await apiClient.delete(`/lessons/${cleanId}/pdf-notes/${noteId}`);
    
    // Remove from cache
    removeCachedNote(lessonId, noteId);
    
    return response.data;
  } catch (error) {
    // Offline: queue for later sync
    queueOfflineOperation('delete', cleanId, { noteId });
    return { success: true, _dirty: true };
  }
};

/**
 * Queue offline operation for later sync
 */
const queueOfflineOperation = (operation, lessonId, data) => {
  try {
    const queue = JSON.parse(localStorage.getItem('pdf_notes_offline_queue') || '[]');
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      lessonId,
      data,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('pdf_notes_offline_queue', JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to queue offline operation:', e);
  }
};

/**
 * Process offline queue when online
 */
export const syncOfflineQueue = async () => {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  
  try {
    const queue = JSON.parse(localStorage.getItem('pdf_notes_offline_queue') || '[]');
    if (queue.length === 0) return { synced: 0, failed: 0 };
    
    let synced = 0;
    let failed = 0;
    const remaining = [];
    
    for (const item of queue) {
      try {
        switch (item.operation) {
          case 'create':
            await apiClient.post(`/lessons/${item.lessonId}/pdf-notes`, item.data);
            break;
          case 'update':
            await apiClient.put(`/lessons/${item.lessonId}/pdf-notes/${item.data.noteId}`, item.data);
            break;
          case 'delete':
            await apiClient.delete(`/lessons/${item.lessonId}/pdf-notes/${item.data.noteId}`);
            break;
        }
        synced++;
      } catch (error) {
        failed++;
        remaining.push(item);
      }
    }
    
    localStorage.setItem('pdf_notes_offline_queue', JSON.stringify(remaining));
    return { synced, failed };
  } catch (e) {
    console.error('Failed to sync offline queue:', e);
    return { synced: 0, failed: 0 };
  }
};

/**
 * Conflict resolution for notes
 */
export const resolveConflict = (localNote, serverNote, strategy = 'server') => {
  if (strategy === 'server') return serverNote;
  if (strategy === 'local') return localNote;
  
  // Merge strategy: combine changes
  return {
    ...serverNote,
    ...localNote,
    _version: Math.max(serverNote._version || 0, localNote._version || 0) + 1,
    _mergedAt: new Date().toISOString()
  };
};

/**
 * Detect conflict between local and server versions
 */
export const detectConflict = (localNote, serverNote) => {
  if (!localNote || !serverNote) return false;
  return localNote._version !== serverNote._version && 
         localNote._updatedAt !== serverNote._updatedAt;
};

/**
 * Get offline queue status
 */
export const getOfflineQueueStatus = () => {
  try {
    const queue = JSON.parse(localStorage.getItem('pdf_notes_offline_queue') || '[]');
    return {
      pending: queue.length,
      operations: queue.map(q => ({ operation: q.operation, lessonId: q.lessonId, timestamp: q.timestamp }))
    };
  } catch (e) {
    return { pending: 0, operations: [] };
  }
};

/**
 * Update cached note with server response
 */
const updateCachedNote = (lessonId, documentRef, clientId, serverNote) => {
  const cached = getCachedNotes(lessonId, documentRef);
  const index = cached.findIndex(n => n._clientId === clientId);
  if (index >= 0) {
    cached[index] = { ...serverNote, _dirty: false };
    cacheNotes(lessonId, documentRef, cached);
  }
};

/**
 * Remove cached note
 */
const removeCachedNote = (lessonId, noteId) => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('pdf_notes_cache_'));
  keys.forEach(key => {
    try {
      const cached = JSON.parse(localStorage.getItem(key));
      if (cached.notes) {
        cached.notes = cached.notes.filter(n => n.id !== noteId && n._clientId !== noteId);
        localStorage.setItem(key, JSON.stringify(cached));
      }
    } catch (e) { }
  });
};

/**
 * Lấy bản nháp ghi chú tạm thời từ LocalStorage
 */
export const getLocalDraft = (userId, lessonId, documentRef) => {
  if (!userId || !lessonId) return '';
  try {
    return localStorage.getItem(`pdf_draft_${userId}_${lessonId}_${documentRef || 'primary'}`) || '';
  } catch (e) {
    return '';
  }
};

/**
 * Lưu bản nháp ghi chú tạm thời vào LocalStorage
 */
export const setLocalDraft = (userId, lessonId, documentRef, text) => {
  if (!userId || !lessonId) return;
  try {
    if (text) {
      localStorage.setItem(`pdf_draft_${userId}_${lessonId}_${documentRef || 'primary'}`, text);
    } else {
      localStorage.removeItem(`pdf_draft_${userId}_${lessonId}_${documentRef || 'primary'}`);
    }
  } catch (e) { }
};

/**
 * Sync notes when coming online
 */
window.addEventListener('online', () => {
  syncOfflineQueue().then(result => {
    if (result.synced > 0) {
      console.log(`Synced ${result.synced} offline operations`);
    }
  });
});

// Auto-sync every 5 minutes when online
setInterval(() => {
  if (navigator.onLine) {
    syncOfflineQueue();
  }
}, 5 * 60 * 1000);