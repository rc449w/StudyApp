import { idb } from './indexedDb';

const DIRECTORY_HANDLE_META_KEY = 'local_directory_handle';

export interface DirectoryHandleRecord {
  key: string;
  handle: FileSystemDirectoryHandle;
  directoryName: string;
  savedAt: string;
}

export interface FileSystemCapabilities {
  browserSupported: boolean;
  isTopLevelWindow: boolean;
  tauriDetected: boolean;
  recommendedAdapter: 'tauri-fs' | 'browser-fs-access' | 'indexeddb-fallback';
  statusDetail: string;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
  __TAURI_INTERNALS__?: unknown;
}

export interface FolderPickResult {
  success: boolean;
  directoryName?: string;
  error?: string;
}

export interface LocalFileSaveResult {
  savedToDirectory: boolean;
  folderLabel: string;
  error?: string;
}

/**
 * Modular local storage adapter designed for Browser File System Access API today
 * and clean Tauri Windows desktop filesystem migration in later stages.
 */
export const fileSystemAdapter = {
  getCapabilities(): FileSystemCapabilities {
    if (typeof window === 'undefined') {
      return {
        browserSupported: false,
        isTopLevelWindow: false,
        tauriDetected: false,
        recommendedAdapter: 'indexeddb-fallback',
        statusDetail: 'Window context unavailable.',
      };
    }

    const win = window as DirectoryPickerWindow;
    const tauriDetected = Boolean(win.__TAURI_INTERNALS__);
    const browserSupported = typeof win.showDirectoryPicker === 'function';
    let isTopLevelWindow = true;
    try {
      isTopLevelWindow = window.self === window.top;
    } catch {
      isTopLevelWindow = false;
    }

    if (tauriDetected) {
      return {
        browserSupported,
        isTopLevelWindow,
        tauriDetected: true,
        recommendedAdapter: 'tauri-fs',
        statusDetail: 'Tauri desktop runtime detected. Ready for native Windows filesystem access.',
      };
    }

    if (browserSupported && isTopLevelWindow) {
      return {
        browserSupported: true,
        isTopLevelWindow: true,
        tauriDetected: false,
        recommendedAdapter: 'browser-fs-access',
        statusDetail:
          'File System Access API supported. You can bind a local folder for offline document storage.',
      };
    }

    if (browserSupported && !isTopLevelWindow) {
      return {
        browserSupported: true,
        isTopLevelWindow: false,
        tauriDetected: false,
        recommendedAdapter: 'indexeddb-fallback',
        statusDetail:
          'Running inside an embedded preview frame where browsers may restrict folder pickers. IndexedDB metadata storage remains active; open in a standalone tab or future Tauri desktop build for direct folder access.',
      };
    }

    return {
      browserSupported: false,
      isTopLevelWindow,
      tauriDetected: false,
      recommendedAdapter: 'indexeddb-fallback',
      statusDetail:
        'Browser does not support File System Access API. Using IndexedDB local metadata storage.',
    };
  },

  async getSavedDirectoryRecord(): Promise<DirectoryHandleRecord | null> {
    try {
      const record = await idb.getByKey<DirectoryHandleRecord>(
        'appMeta',
        DIRECTORY_HANDLE_META_KEY
      );
      return record ?? null;
    } catch {
      return null;
    }
  },

  async pickAndSaveLocalDirectory(): Promise<FolderPickResult> {
    const win = window as DirectoryPickerWindow;
    if (typeof win.showDirectoryPicker !== 'function') {
      return {
        success: false,
        error:
          'This browser does not expose window.showDirectoryPicker(). Use Chromium/Edge in a top-level tab or the upcoming Windows Tauri app.',
      };
    }

    try {
      const handle = await win.showDirectoryPicker({
        id: 'studywise-local-library',
        mode: 'readwrite',
      });

      const record: DirectoryHandleRecord = {
        key: DIRECTORY_HANDLE_META_KEY,
        handle,
        directoryName: handle.name,
        savedAt: new Date().toISOString(),
      };

      await idb.put('appMeta', record);
      return {
        success: true,
        directoryName: handle.name,
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, error: 'Folder selection was cancelled.' };
      }
      if (err instanceof DOMException && err.name === 'SecurityError') {
        return {
          success: false,
          error:
            'Browser security policy blocked folder picking inside an embedded iframe. Open the app in a standalone browser tab to link a local folder, or use IndexedDB metadata storage.',
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unable to select local directory.',
      };
    }
  },

  async clearSavedDirectory(): Promise<void> {
    await idb.delete('appMeta', DIRECTORY_HANDLE_META_KEY);
  },

  async saveFileToLinkedDirectoryIfPermitted(file: File): Promise<LocalFileSaveResult> {
    const saved = await this.getSavedDirectoryRecord();
    if (!saved) {
      return {
        savedToDirectory: false,
        folderLabel: 'IndexedDB Local Metadata Only',
      };
    }

    try {
      const handle = saved.handle as FileSystemDirectoryHandle & {
        queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
        requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
      };

      let permission: PermissionState = 'granted';
      if (typeof handle.queryPermission === 'function') {
        permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted' && typeof handle.requestPermission === 'function') {
          permission = await handle.requestPermission({ mode: 'readwrite' });
        }
      }

      if (permission !== 'granted') {
        return {
          savedToDirectory: false,
          folderLabel: 'IndexedDB Metadata (Folder permission needed)',
          error: 'Write permission to the linked folder was not granted.',
        };
      }

      const fileHandle = await saved.handle.getFileHandle(file.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      return {
        savedToDirectory: true,
        folderLabel: `Local Folder: ${saved.directoryName}`,
      };
    } catch (err: unknown) {
      return {
        savedToDirectory: false,
        folderLabel: 'IndexedDB Local Metadata Only',
        error: err instanceof Error ? err.message : 'Failed writing file to linked directory.',
      };
    }
  },

  async readFileFromLinkedDirectoryIfPermitted(fileName: string): Promise<ArrayBuffer | null> {
    const saved = await this.getSavedDirectoryRecord();
    if (!saved) return null;

    try {
      const handle = saved.handle as FileSystemDirectoryHandle & {
        queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
      };

      if (typeof handle.queryPermission === 'function') {
        const permission = await handle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') return null;
      }

      const fileHandle = await saved.handle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      return await file.arrayBuffer();
    } catch {
      return null;
    }
  },
};
