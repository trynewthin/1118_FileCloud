import type { FC, PropsWithChildren } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppRouter } from "@/router/AppRouter";

const AppShell: FC<PropsWithChildren> = ({ children }) => {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
};

export const App: FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <AppRouter />
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
};
