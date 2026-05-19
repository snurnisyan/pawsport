import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toaster } from "@/components/ui/toaster";
import {
  listActiveReminders,
  markRemindersRead,
  remindersQueryKey,
  type TReminder,
  type TReminderListResponse,
} from "@/lib/petsApi";
import { useAuthSession } from "@/lib/session";
import { apiErrorMessage } from "@/utils/apiErrorMessage";

const ACTIVE_REMINDER_FILTERS = { activeOnly: "true" } as const;
const ACTIVE_REMINDERS_QUERY_KEY = remindersQueryKey(ACTIVE_REMINDER_FILTERS);
const EMPTY_REMINDERS: TReminder[] = [];

export type TUseRemindersResult = {
  authenticated: boolean;
  reminders: TReminder[];
  isLoading: boolean;
  error: unknown;
  hasUnreadReminders: boolean;
};

export function useReminders(open: boolean): TUseRemindersResult {
  const session = useAuthSession();
  const queryClient = useQueryClient();
  const authenticated = Boolean(session);

  const remindersQuery = useQuery({
    queryKey: ACTIVE_REMINDERS_QUERY_KEY,
    queryFn: listActiveReminders,
    enabled: authenticated,
    staleTime: 60_000,
  });
  const reminders = remindersQuery.data?.items ?? EMPTY_REMINDERS;
  const unreadReminderIds = useMemo(
    () => reminders.filter((reminder) => !reminder.readAt).map((reminder) => reminder.id),
    [reminders]
  );
  const hasUnreadReminders = unreadReminderIds.length > 0;

  const markReadMutation = useMutation({
    mutationFn: markRemindersRead,
    onSuccess: (response) => {
      const readById = new Map(response.items.map((item) => [item.id, item.readAt]));
      queryClient.setQueryData<TReminderListResponse>(
        ACTIVE_REMINDERS_QUERY_KEY,
        (current) => {
          if (!current) return current;
          return {
            items: current.items.map((reminder) => {
              const readAt = readById.get(reminder.id);
              return readAt ? { ...reminder, readAt } : reminder;
            }),
          };
        }
      );
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось отметить напоминания",
        description: apiErrorMessage(error, "Попробуйте открыть напоминания еще раз."),
      });
    },
  });
  const markRead = markReadMutation.mutate;
  const markReadPending = markReadMutation.isPending;

  useEffect(() => {
    if (
      !open ||
      !remindersQuery.isSuccess ||
      unreadReminderIds.length === 0 ||
      markReadPending
    ) {
      return;
    }

    markRead(unreadReminderIds);
  }, [
    open,
    remindersQuery.isSuccess,
    unreadReminderIds,
    markRead,
    markReadPending,
  ]);

  return {
    authenticated,
    reminders,
    isLoading: remindersQuery.isLoading,
    error: remindersQuery.error,
    hasUnreadReminders,
  };
}
