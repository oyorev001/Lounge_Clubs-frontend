import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { clearSession, getStoredSession, queryKeys, sessionQuery } from "@/services";

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: session, isPending } = useQuery(sessionQuery());

  useEffect(() => {
    if (!queryClient.getQueryData(queryKeys.auth.session())) {
      const stored = getStoredSession();
      if (stored) queryClient.setQueryData(queryKeys.auth.session(), stored);
    }
  }, [queryClient]);

  const logout = useMutation({
    mutationFn: async () => {
      clearSession();
    },
    onSuccess: () => {
      queryClient.clear();
      void navigate({ to: "/" });
    },
  });

  return {
    session: session ?? null,
    isAuthenticated: Boolean(session),
    isLoading: isPending,
    logout,
  };
}
