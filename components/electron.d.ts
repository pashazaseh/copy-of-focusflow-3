export {};

declare global {
  interface Window {
    electronAPI: any; // Replace 'any' with the specific interface of your Electron API if known
  }
}