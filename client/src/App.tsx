import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FacilityDetail from "./pages/FacilityDetail";
import Sales from "./pages/Sales";
import NotFound from "./pages/not-found";
import { Component, ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error: error?.message || "Something went wrong" };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#0f1117", color: "#6b7280", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "12px", fontFamily: "monospace", fontSize: "13px" }}>
          <div style={{ color: "#f45c6b" }}>Error loading dashboard</div>
          <div style={{ maxWidth: 400, textAlign: "center", opacity: 0.7 }}>{this.state.error}</div>
          <button onClick={() => { this.setState({ error: null }); window.location.reload(); }} style={{ marginTop: 16, padding: "8px 16px", background: "#33d4e0", color: "#0f1117", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppRoutes() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/facility/:id" component={FacilityDetail} />
        <Route path="/sales" component={Sales} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
