import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import ClientsSpasenie from "./pages/ClientsSpasenie";
import Auth from "./pages/Auth";
import AllProjects from "./pages/AllProjects";
import LeadGeneration from "./pages/LeadGeneration";
import Employees from "./pages/Employees";
import Payroll from "./pages/Payroll";
import Settings from "./pages/Settings";
import FinancialModel from "./pages/FinancialModel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

// Route guard that blocks manager_oz from accessing non-dashboard pages
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isManagerOz, loading } = useAuth();
  
  if (loading) return null;
  if (isManagerOz) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients-spasenie" element={<ProtectedRoute><ClientsSpasenie /></ProtectedRoute>} />
            <Route path="/all-projects" element={<ProtectedRoute><AllProjects /></ProtectedRoute>} />
            <Route path="/lead-generation" element={<ProtectedRoute><LeadGeneration /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/financial-model" element={<ProtectedRoute><FinancialModel /></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
