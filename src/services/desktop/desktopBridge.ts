import { invoke } from '@tauri-apps/api/core';
import { cloneToFreshUint8Array } from '../storage/binaryUtils';

export interface DesktopStoragePaths {
  appDataDir: string;
  documentsVaultDir: string;
  sqliteDbPath: string;
  backupsDir: string;
}

export interface VaultSaveResult {
  saved: boolean;
  localVaultPath?: string;
  documentsVaultDir?: string;
  error?: string;
}

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: unknown;
}

export const desktopBridge = {
  isTauri(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as TauriWindow).__TAURI_INTERNALS__);
  },

  async notifyAppReady(): Promise<void> {
    if (!this.isTauri()) return;
    try {
      await invoke('close_splashscreen');
    } catch {
      // Splashscreen may already be closed
    }
  },

  async getStoragePaths(): Promise<DesktopStoragePaths | null> {
    if (!this.isTauri()) return null;
    try {
      return await invoke<DesktopStoragePaths>('get_app_storage_paths');
    } catch {
      return null;
    }
  },

  async saveDocumentToVault(fileName: string, buffer: ArrayBuffer): Promise<VaultSaveResult> {
    if (!this.isTauri()) {
      return { saved: false, error: 'Not running in Tauri desktop runtime.' };
    }
    try {
      const safeBytes = cloneToFreshUint8Array(buffer);
      const bytes = Array.from(safeBytes);
      const localVaultPath = await invoke<string>('save_document_to_local_vault', {
        fileName,
        bytes,
      });
      const paths = await this.getStoragePaths();
      return {
        saved: true,
        localVaultPath,
        documentsVaultDir: paths?.documentsVaultDir,
      };
    } catch (err: unknown) {
      return {
        saved: false,
        error: err instanceof Error ? err.message : 'Failed saving document to Windows local vault.',
      };
    }
  },

  async readDocumentFromVault(localVaultPath: string): Promise<ArrayBuffer | null> {
    if (!this.isTauri()) return null;
    try {
      const bytes = await invoke<number[]>('read_document_from_local_vault', {
        localVaultPath,
      });
      return new Uint8Array(bytes).buffer;
    } catch {
      return null;
    }
  },

  async pickLocalFolder(): Promise<string | null> {
    if (!this.isTauri()) return null;
    try {
      return await invoke<string | null>('pick_local_storage_folder');
    } catch {
      return null;
    }
  },
};
