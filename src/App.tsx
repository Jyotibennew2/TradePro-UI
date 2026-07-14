import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header    from "./components/layout/Header";
import Sidebar   from "./components/layout/Sidebar";
import Dashboard  from "./pages/Dashboard";
import OptionChain from "./pages/OptionChain";
import Scanner    from "./pages/Scanner";
import Strategy   from "./pages/Strategy";
import PaperTrade from "./pages/PaperTrade";
import Portfolio  from "./pages/Portfolio";
import Settings   from "./pages/Settings";
import Simulator  from "./pages/Simulator";
import Backtest     from "./pages/Backtest";
import AIAssistant from "./pages/AIAssistant";
import Workspace  from "./pages/Workspace";
import Screener2 from "./pages/Screener";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry          : 1,
      staleTime      : 2000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className="flex flex-col h-screen overflow-hidden"
          style={{ background: "#03050d" }}>

          {/* Header */}
          <Header />

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">

            {/* Sidebar */}
            <Sidebar />

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/"         element={<Dashboard  />} />
                <Route path="/chain"    element={<OptionChain />} />
                <Route path="/scanner"  element={<Scanner    />} />
                <Route path="/strategy" element={<Strategy   />} />
                <Route path="/paper"    element={<PaperTrade />} />
                <Route path="/portfolio"element={<Portfolio  />} />
                <Route path="/settings"   element={<Settings   />} />
                <Route path="/simulator" element={<Simulator  />} />
                <Route path="/backtest"  element={<Backtest   />} />
                <Route path="/ai"        element={<AIAssistant />} />
                <Route path="/workspace" element={<Workspace  />} />
                <Route path="/screener2" element={<Screener2 />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
