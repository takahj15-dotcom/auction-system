import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EventProvider } from "./contexts/EventContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Members from "./pages/Members";
import Transactions from "./pages/Transactions";
import Closing from "./pages/Closing";
import Settlements from "./pages/Settlements";
import SettlementDetail from "./pages/SettlementDetail";
import BulkSettlementPrint from "./pages/BulkSettlementPrint";
import AuditLog from "./pages/AuditLog";
import Register from "./pages/Register";
import PortalLogin from "./pages/PortalLogin";
import PortalDashboard from "./pages/PortalDashboard";
import PortalSettlementDetail from "./pages/PortalSettlementDetail";
import PortalChangePassword from "./pages/PortalChangePassword";
import Reception from "./pages/Reception";
import Settings from "./pages/Settings";
import RegisterClosing from "./pages/RegisterClosing";


function Router() {
  return (
    <Switch>
      {/* Portal routes (no DashboardLayout) */}
      <Route path="/portal/login" component={PortalLogin} />
      <Route path="/portal/change-password" component={PortalChangePassword} />
      <Route path="/portal/settlement/:id" component={PortalSettlementDetail} />
      {/* Bulk settlement print (no layout, opens in new tab) */}
      <Route path="/settlements/print-all/:eventId" component={BulkSettlementPrint} />
      <Route path="/portal" component={PortalDashboard} />
      {/* Admin routes (with DashboardLayout) */}
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/transactions" component={Transactions} />
            <Route path="/closing" component={Closing} />
            <Route path="/settlements" component={Settlements} />
            <Route path="/settlements/:id" component={SettlementDetail} />

            <Route path="/reception" component={Reception} />
            <Route path="/register/closing" component={RegisterClosing} />
            <Route path="/register" component={Register} />
            <Route path="/members" component={Members} />
            <Route path="/audit" component={AuditLog} />
            <Route path="/settings" component={Settings} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <EventProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </EventProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
