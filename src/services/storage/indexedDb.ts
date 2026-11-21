const DB_NAME = 'studywise_ai_local_db';
const DB_VERSION = 3;

export type StoreName =
  | 'profile'
  | 'subjects'
  | 'documents'
  | 'documentContents'
  | 'topics'
  | 'studyGuides'
  | 'researchNotes'
  | 'mockExams'
  | 'examAttempts'
  | 'appMeta';

const ALL_STORES: StoreName[] = [
  'profile',
  'subjects',
  'documents',
  'documentContents',
  'topics',
  'studyGuides',
  'researchNotes',
  'mockExams',
  'examAttempts',
  'appMeta',
];

function getKeyPath(storeName: StoreName): string {
  if (storeName === 'appMeta') return 'key';
  if (storeName === 'documentContents') return 'documentId';
  return 'id';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of ALL_STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: getKeyPath(storeName) });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open local IndexedDB database.'));
  });
}

export const idb = {
  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error(`Failed reading ${storeName}`));
      tx.oncomplete = () => db.close();
    });
  },

  async getByKey<T>(storeName: StoreName, key: string): Promise<T | undefined> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error ?? new Error(`Failed reading key from ${storeName}`));
      tx.oncomplete = () => db.close();
    });
  },

  async put<T>(storeName: StoreName, record: T): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      let tx: IDBTransaction | undefined;
      const finishError = (err: unknown, activeTx?: IDBTransaction) => {
        if (settled) return;
        settled = true;
        try {
          activeTx?.abort();
        } catch {
          // ignore if transaction already finished/aborted
        }
        db.close();
        reject(
          err instanceof Error
            ? err
            : new Error(`Failed writing to ${storeName}`)
        );
      };

      try {
        tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          db.close();
          resolve();
        };
        tx.onerror = () =>
          finishError(tx?.error ?? new Error(`Failed writing to ${storeName}`), tx);
        tx.onabort = () =>
          finishError(tx?.error ?? new Error(`Transaction aborted while writing to ${storeName}`));

        const req = store.put(record);
        req.onerror = () =>
          finishError(req.error ?? tx?.error ?? new Error(`Failed writing record to ${storeName}`), tx);
      } catch (err) {
        finishError(err, tx);
      }
    });
  },

  async putDocumentBundle<TDoc, TContent>(doc: TDoc, content: TContent): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      let tx: IDBTransaction | undefined;
      const finishError = (err: unknown, activeTx?: IDBTransaction) => {
        if (settled) return;
        settled = true;
        try {
          activeTx?.abort();
        } catch {
          // ignore if transaction already finished/aborted
        }
        db.close();
        reject(
          err instanceof Error
            ? err
            : new Error('Failed atomically saving document and extracted content.')
        );
      };

      try {
        tx = db.transaction(['documents', 'documentContents'], 'readwrite');
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          db.close();
          resolve();
        };
        tx.onerror = () =>
          finishError(tx?.error ?? new Error('Failed saving document bundle to IndexedDB.'), tx);
        tx.onabort = () =>
          finishError(
            tx?.error ?? new Error('Document save transaction was aborted before committing.')
          );

        const docReq = tx.objectStore('documents').put(doc);
        docReq.onerror = () =>
          finishError(docReq.error ?? tx?.error ?? new Error('Failed writing document metadata.'), tx);

        const contentReq = tx.objectStore('documentContents').put(content);
        contentReq.onerror = () =>
          finishError(
            contentReq.error ?? tx?.error ?? new Error('Failed writing extracted document content.'),
            tx
          );
      } catch (err) {
        finishError(err, tx);
      }
    });
  },

  async putMany<T>(storeName: StoreName, records: T[]): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      let tx: IDBTransaction | undefined;
      const finishError = (err: unknown, activeTx?: IDBTransaction) => {
        if (settled) return;
        settled = true;
        try {
          activeTx?.abort();
        } catch {
          // ignore
        }
        db.close();
        reject(
          err instanceof Error
            ? err
            : new Error(`Failed batch writing to ${storeName}`)
        );
      };

      try {
        tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          db.close();
          resolve();
        };
        tx.onerror = () =>
          finishError(tx?.error ?? new Error(`Failed batch writing to ${storeName}`), tx);
        tx.onabort = () =>
          finishError(tx?.error ?? new Error(`Batch write aborted on ${storeName}`));

        for (const item of records) {
          const req = store.put(item);
          req.onerror = () =>
            finishError(req.error ?? tx?.error ?? new Error(`Failed batch item on ${storeName}`), tx);
        }
      } catch (err) {
        finishError(err, tx);
      }
    });
  },

  async delete(storeName: StoreName, key: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finishError = (err: unknown) => {
        if (settled) return;
        settled = true;
        db.close();
        reject(err instanceof Error ? err : new Error(`Failed deleting from ${storeName}`));
      };
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(key);
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          db.close();
          resolve();
        };
        tx.onerror = () => finishError(tx.error ?? new Error(`Failed deleting from ${storeName}`));
        tx.onabort = () => finishError(tx.error ?? new Error(`Delete aborted on ${storeName}`));
      } catch (err) {
        finishError(err);
      }
    });
  },

  async clearStore(storeName: StoreName): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finishError = (err: unknown) => {
        if (settled) return;
        settled = true;
        db.close();
        reject(err instanceof Error ? err : new Error(`Failed clearing ${storeName}`));
      };
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          db.close();
          resolve();
        };
        tx.onerror = () => finishError(tx.error ?? new Error(`Failed clearing ${storeName}`));
        tx.onabort = () => finishError(tx.error ?? new Error(`Clear aborted on ${storeName}`));
      } catch (err) {
        finishError(err);
      }
    });
  },

  async clearAll(): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finishError = (err: unknown) => {
        if (settled) return;
        settled = true;
        db.close();
        reject(err instanceof Error ? err : new Error('Failed clearing IndexedDB database.'));
      };
      try {
        const tx = db.transaction(ALL_STORES, 'readwrite');
        for (const storeName of ALL_STORES) {
          tx.objectStore(storeName).clear();
        }
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          db.close();
          resolve();
        };
        tx.onerror = () =>
          finishError(tx.error ?? new Error('Failed clearing IndexedDB database.'));
        tx.onabort = () =>
          finishError(tx.error ?? new Error('Clear all transaction aborted.'));
      } catch (err) {
        finishError(err);
      }
    });
  },
};
