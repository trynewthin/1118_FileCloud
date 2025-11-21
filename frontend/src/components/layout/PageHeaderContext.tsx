import { createContext, useContext, useMemo, useState } from "react";
import type { FC, PropsWithChildren, ReactNode } from "react";

interface PageHeaderConfig {
  title?: string;
  actions?: ReactNode;
}

interface PageHeaderContextValue {
  config: PageHeaderConfig;
  setConfig: (config: PageHeaderConfig) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export const PageHeaderProvider: FC<PropsWithChildren> = ({ children }) => {
  const [config, setConfig] = useState<PageHeaderConfig>({});

  const value = useMemo<PageHeaderContextValue>(
    () => ({ config, setConfig }),
    [config],
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
};

export const usePageHeader = () => {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error("usePageHeader 必须在 PageHeaderProvider 内部使用");
  }
  return ctx;
};
