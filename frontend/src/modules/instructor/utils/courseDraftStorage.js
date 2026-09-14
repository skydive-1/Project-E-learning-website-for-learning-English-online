const DATABASE_NAME = 'e-learn-course-editor';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
const LOCAL_STORAGE_PREFIX = 'course-editor-draft:';

const hasIndexedDb = () => typeof window !== 'undefined' && Boolean(window.indexedDB);

const openDatabase = () => new Promise((resolve, reject) => {
  const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'key' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Không thể mở kho bản nháp trên trình duyệt.'));
});

const runStoreRequest = async (mode, operation) => {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Không thể truy cập bản nháp trên trình duyệt.'));
      transaction.onabort = () => reject(transaction.error || new Error('Giao dịch lưu bản nháp đã bị hủy.'));
    });
  } finally {
    database.close();
  }
};

const localStorageKey = (key) => `${LOCAL_STORAGE_PREFIX}${key}`;

const withoutBinaryFiles = (record) => ({
  ...record,
  stagedMaterials: [],
  stagedMaterialMetadata: (record.stagedMaterials || []).map(([lessonId, file]) => ([
    lessonId,
    {
      name: file?.name || 'Tài liệu PDF',
      type: file?.type || 'application/pdf',
      size: Number(file?.size) || 0,
      lastModified: Number(file?.lastModified) || 0
    }
  ]))
});

export const buildCourseDraftKey = ({ userId, courseId }) => (
  `${userId || 'anonymous'}:${courseId || 'new'}`
);

export const saveCourseEditorDraft = async (key, snapshot, stagedMaterials = {}) => {
  const record = {
    key,
    snapshot,
    savedAt: new Date().toISOString(),
    stagedMaterials: Object.entries(stagedMaterials).filter(([, file]) => Boolean(file))
  };

  if (hasIndexedDb()) {
    try {
      await runStoreRequest('readwrite', (store) => store.put(record));
      try {
        window.localStorage.removeItem(localStorageKey(key));
      } catch (_ignored) {
        // IndexedDB là nguồn chính; việc dọn fallback không được làm hỏng auto-save.
      }
      return { savedAt: record.savedAt, filesPreserved: true, storage: 'indexeddb' };
    } catch (error) {
      console.warn('[CourseDraftStorage] IndexedDB không khả dụng, chuyển sang localStorage:', error?.message);
    }
  }

  const fallbackRecord = withoutBinaryFiles(record);
  window.localStorage.setItem(localStorageKey(key), JSON.stringify(fallbackRecord));
  return {
    savedAt: record.savedAt,
    filesPreserved: record.stagedMaterials.length === 0,
    storage: 'localStorage'
  };
};

export const loadCourseEditorDraft = async (key) => {
  if (hasIndexedDb()) {
    try {
      const record = await runStoreRequest('readonly', (store) => store.get(key));
      if (record) {
        return {
          ...record,
          stagedMaterials: Object.fromEntries(record.stagedMaterials || []),
          filesPreserved: true,
          storage: 'indexeddb'
        };
      }
    } catch (error) {
      console.warn('[CourseDraftStorage] Không thể đọc IndexedDB, thử localStorage:', error?.message);
    }
  }

  try {
    const rawRecord = window.localStorage.getItem(localStorageKey(key));
    if (!rawRecord) return null;
    const record = JSON.parse(rawRecord);
    return {
      ...record,
      stagedMaterials: {},
      filesPreserved: (record.stagedMaterialMetadata || []).length === 0,
      storage: 'localStorage'
    };
  } catch (error) {
    console.warn('[CourseDraftStorage] Bản nháp localStorage không đọc được:', error?.message);
    return null;
  }
};

export const removeCourseEditorDraft = async (key) => {
  if (hasIndexedDb()) {
    try {
      await runStoreRequest('readwrite', (store) => store.delete(key));
    } catch (error) {
      console.warn('[CourseDraftStorage] Không thể xóa bản nháp IndexedDB:', error?.message);
    }
  }
  try {
    window.localStorage.removeItem(localStorageKey(key));
  } catch (error) {
    console.warn('[CourseDraftStorage] Không thể xóa bản nháp localStorage:', error?.message);
  }
};
