declare module '@/theme/app-direction' {
  export function setAppRTL(next: boolean): void;
  export function getAppRTL(): boolean;
  export function subscribeAppRTL(
    listener: (isRTL: boolean) => void
  ): () => void;
}

declare module '../../theme/app-direction' {
  export function setAppRTL(next: boolean): void;
  export function getAppRTL(): boolean;
  export function subscribeAppRTL(
    listener: (isRTL: boolean) => void
  ): () => void;
}
