import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchHealth, fetchQuotes } from "../utils/api";
import { useAppStore } from "../store";

export function useHealth() {
  const { setLive, setMock } = useAppStore();
  const query = useQuery({
    queryKey       : ["health"],
    queryFn        : fetchHealth,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (query.data) {
      setLive(!query.data.mock_mode);
      setMock(query.data.mock_mode);
    }
  }, [query.data]);

  return query;
}

export function useQuotes() {
  const { setNifty, setBankNifty } = useAppStore();
  const query = useQuery({
    queryKey       : ["quotes"],
    queryFn        : () => fetchQuotes("NSE:NIFTY50-INDEX,NSE:NIFTYBANK-INDEX,NSE:NIFTYMID100-INDEX"),
    refetchInterval: 3_000,
  });

  useEffect(() => {
    if (query.data?.success) {
      const d = query.data.data;
      setNifty(d["NSE:NIFTY50-INDEX"]?.ltp     ?? 0);
      setBankNifty(d["NSE:NIFTYBANK-INDEX"]?.ltp ?? 0);
    }
  }, [query.data]);

  return query;
}
