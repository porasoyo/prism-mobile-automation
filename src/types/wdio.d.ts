import type { ChainablePromiseElement } from 'webdriverio';

declare global {
  const $: (selector: string) => ChainablePromiseElement<WebdriverIO.Element>;
  const $$: (selector: string) => Promise<WebdriverIO.ElementArray>;
  const driver: WebdriverIO.Browser;
  const browser: WebdriverIO.Browser;
  
  namespace WebdriverIO {
    interface Browser {
      pause(milliseconds: number): Promise<void>;
      saveScreenshot(filepath: string): Promise<void>;
      getPageSource(): Promise<string>;
      getCurrentActivity(): Promise<string>;
      getCurrentPackage(): Promise<string>;
      pressKeyCode(keycode: number): Promise<void>;
      execute(script: string, args?: any): Promise<any>;
      getContexts(): Promise<string[]>;
      url(path: string): Promise<void>;
      getTitle(): Promise<string>;
    }
  }
}

export {};
