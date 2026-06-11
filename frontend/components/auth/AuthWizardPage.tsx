import Head from "next/head";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PetStep, type TPetData } from "@/components/auth/PetStep";
import { RegisterStep } from "@/components/auth/RegisterStep";
import { ReminderStep, type TReminderDraft } from "@/components/auth/ReminderStep";
import { ApiError } from "@/lib/api";
import { registerUser } from "@/lib/authApi";
import { createPetEvent } from "@/lib/eventsApi";
import { createPet, petEventsQueryPrefix, petsQueryKey } from "@/lib/petsApi";
import { toIsoDateTime } from "@/utils/dates";
import {
  persistAuthSession,
  useAuthSession,
  useClientReady,
} from "@/lib/session";

type TWizardState = {
  email: string;
  password: string;
  personalDataConsent: boolean;
  pet: TPetData;
};

type TAuthWizardPageProps = {
  redirectPlainRegistration?: boolean;
};

const REGISTRATION_PATH = "/auth/register";
const ONBOARDING_PATH = "/auth?step=pet";

const INITIAL: TWizardState = {
  email: "",
  password: "",
  personalDataConsent: false,
  pet: { name: "", species: null, breed: "", sex: null, photo: null },
};

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Введите корректный email.",
  INVALID_PASSWORD: "Пароль должен быть не короче 8 символов.",
  PERSONAL_DATA_CONSENT_REQUIRED: "Для регистрации нужно согласие на обработку данных.",
  EMAIL_ALREADY_EXISTS: "Аккаунт с таким email уже существует.",
  INVALID_NAME: "Введите имя питомца.",
  INVALID_SPECIES: "Выберите вид питомца.",
  INVALID_SEX: "Выберите корректный пол питомца или оставьте поле пустым.",
  UNAUTHORIZED: "Сессия истекла. Войдите снова.",
};

const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code] ?? error.message;
  }

  return "Не удалось выполнить запрос. Попробуйте еще раз.";
};

export function AuthWizardPage({ redirectPlainRegistration = false }: TAuthWizardPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useAuthSession();
  const clientReady = useClientReady();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [state, setState] = useState<TWizardState>(INITIAL);
  const [petId, setPetId] = useState<string | null>(null);
  const shouldRedirectPlainRegistration =
    redirectPlainRegistration && router.isReady && router.query.step !== "pet";
  const isOnPetStep = router.query.step === "pet";
  const shouldRedirectAuthenticated =
    clientReady && Boolean(session) && router.isReady && !isOnPetStep && step === 1;
  const visibleStep: 1 | 2 | 3 =
    isOnPetStep && step === 1 && clientReady && session ? 2 : step;

  useEffect(() => {
    if (!router.isReady) return;

    if (shouldRedirectPlainRegistration) {
      router.replace(REGISTRATION_PATH);
      return;
    }

    if (shouldRedirectAuthenticated) {
      router.replace("/pets");
      return;
    }

    if (!clientReady || !isOnPetStep || session) {
      return;
    }

    router.replace(REGISTRATION_PATH, undefined, { shallow: true });
  }, [
    clientReady,
    isOnPetStep,
    router,
    router.isReady,
    session,
    shouldRedirectAuthenticated,
    shouldRedirectPlainRegistration,
  ]);

  const registerMutation = useMutation({
    mutationFn: () =>
      registerUser({
        email: state.email.trim(),
        password: state.password,
        personalDataConsent: true,
    }),
    onSuccess: (response) => {
      persistAuthSession({
        user: response.user,
      });
      setStep(2);
      router.replace(ONBOARDING_PATH);
    },
  });

  const createPetMutation = useMutation({
    mutationFn: () =>
      createPet({
        name: state.pet.name.trim(),
        species: state.pet.species ?? "",
        breed: state.pet.breed.trim() || undefined,
        sex: state.pet.sex ?? "unknown",
        tags: [],
        notes: [],
      }),
    onSuccess: async (response) => {
      setPetId(response.pet.id);
      await queryClient.invalidateQueries({ queryKey: petsQueryKey });
      setStep(3);
    },
  });

  const finish = () => router.push("/pets");

  const saveRemindersMutation = useMutation({
    mutationFn: async (reminders: TReminderDraft[]) => {
      if (!petId) return;
      for (const reminder of reminders) {
        await createPetEvent(petId, {
          type: reminder.type,
          subtype: reminder.subtype,
          title: reminder.title,
          eventDate: toIsoDateTime(reminder.lastDate),
          nextDate: reminder.nextDate
            ? toIsoDateTime(reminder.nextDate)
            : undefined,
          fileIds: [],
        });
        if (reminder.nextDate) {
          await createPetEvent(petId, {
            type: reminder.type,
            subtype: reminder.subtype,
            title: reminder.title,
            eventDate: toIsoDateTime(reminder.nextDate),
            reminderOffset: "day",
            fileIds: [],
          });
        }
      }
    },
    onSuccess: async () => {
      if (petId) {
        await queryClient.invalidateQueries({
          queryKey: petEventsQueryPrefix(petId),
        });
      }
      finish();
    },
  });

  if (shouldRedirectPlainRegistration || shouldRedirectAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Pawsport — Регистрация</title>
      </Head>
      <AuthLayout
        showHeader={visibleStep > 1}
        onBack={() => {
          if (router.query.step === "pet") {
            router.replace(REGISTRATION_PATH);
            setStep(1);
            return;
          }
          setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s));
        }}
      >
        {visibleStep === 1 && (
          <RegisterStep
            email={state.email}
            password={state.password}
            personalDataConsent={state.personalDataConsent}
            isSubmitting={registerMutation.isPending}
            errorText={
              registerMutation.isError ? errorMessage(registerMutation.error) : undefined
            }
            onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
            onNext={() => registerMutation.mutate()}
          />
        )}
        {visibleStep === 2 && (
          <PetStep
            data={state.pet}
            onChange={(patch) =>
              setState((s) => ({ ...s, pet: { ...s.pet, ...patch } }))
            }
            isSubmitting={createPetMutation.isPending}
            errorText={
              createPetMutation.isError ? errorMessage(createPetMutation.error) : undefined
            }
            onNext={() => createPetMutation.mutate()}
          />
        )}
        {visibleStep === 3 && (
          <ReminderStep
            isSubmitting={saveRemindersMutation.isPending}
            errorText={
              saveRemindersMutation.isError
                ? errorMessage(saveRemindersMutation.error)
                : undefined
            }
            onSave={(reminders) => {
              if (!petId || reminders.length === 0) {
                finish();
                return;
              }
              saveRemindersMutation.mutate(reminders);
            }}
            onSkip={finish}
          />
        )}
      </AuthLayout>
    </>
  );
}
