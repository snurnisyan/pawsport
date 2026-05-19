import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { logoutUser } from "@/lib/authApi";
import { clearAuthSession } from "@/lib/session";

export function useLogout() {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      clearAuthSession();
      router.push("/auth/login");
    },
  });

  return () => mutation.mutate();
}
