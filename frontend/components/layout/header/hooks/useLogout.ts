import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { logoutUser } from "@/lib/authApi";
import { clearAuthSession } from "@/lib/session";
import { usePetNavigationStore } from "@/store/petNavigation";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      clearAuthSession();
      usePetNavigationStore.getState().reset();
      queryClient.clear();
      router.push("/auth/login");
    },
  });

  return () => mutation.mutate();
}
