export {};

declare global {
  var isElectron: boolean;
  
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      onUpdateAvailable: (callback: () => void) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;
      restartApp: () => void;
      close: () => void;
      minimize: () => void;
      maximize: () => void;
      updateTrayTitle: (title: string) => void;
      startQuickTimer: (minutes: number) => void;
      cancelQuickTimer: () => void;
      onQuickTimerTriggered: (callback: (minutes: number) => void) => () => void;
      onOAuthCode: (callback: (code: string) => void) => () => void;
      factoryReset: () => void;
      platform: string;
      updateTitleBarOverlay: (options: { color?: string; symbolColor?: string; height?: number }) => void;
      preventAppSuspension: (enable: boolean) => void;
      getOpenAtLogin: () => Promise<boolean>;
      setOpenAtLogin: (open: boolean) => void;
      selectBackupFolder: () => Promise<string | null>;
      selectFile: () => Promise<string | null>;
      selectDirectory: () => Promise<string | null>;
      createNewFile: () => Promise<string | null>;
      saveBackupFile: (path: string, data: string) => Promise<{success: boolean, path?: string, error?: string}>;
      saveFileToFolder: (path: string, filename: string, content: string) => Promise<{success: boolean, error?: string}>;
      saveBinaryFile: (path: string, filename: string, content: Uint8Array) => Promise<{success: boolean, error?: string}>;
      appendFileToFolder: (path: string, filename: string, content: string) => Promise<{success: boolean, error?: string}>;
      updateDailyNote: (path: string, filename: string, line: string, header: string, position: string) => Promise<{success: boolean, error?: string}>;
      getFileHeaders: (path: string, filename: string) => Promise<{success: boolean, headers?: string[], error?: string}>;
      watchPath: (path: string) => void;
      unwatchPath: () => void;
      onFileChange: (callback: (data: { eventType: string; filename: string; path: string }) => void) => () => void;
      updateGlobalShortcut: (shortcut: string) => Promise<boolean>;
      openQuickCapture: () => void;
      onTimerUpdate: (callback: (event: any, ...args: any[]) => void) => () => void;
      onTrayAction: (callback: (action: { type: string; duration?: number }) => void) => () => void;
      onSyncTimerState: (callback: (state: any) => void) => () => void;
      getTimerState: () => void;
      broadcastTimerAction: (action: string, payload: any) => void;
    };
  }
}