import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PetStep, type TPetData } from "@/components/auth/PetStep";
import { RegisterStep } from "@/components/auth/RegisterStep";
import { ReminderStep } from "@/components/auth/ReminderStep";

type TWizardState = {
  email: string;
  password: string;
  pet: TPetData;
};

const INITIAL: TWizardState = {
  email: "",
  password: "",
  pet: { name: "", species: null, breed: "", sex: null },
};

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [state, setState] = useState<TWizardState>(INITIAL);

  const finish = () => router.push("/pets");

  return (
    <>
      <Head>
        <title>PawsPort — Регистрация</title>
      </Head>
      <AuthLayout
        showHeader={step > 1}
        onBack={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s))}
      >
        {step === 1 && (
          <RegisterStep
            email={state.email}
            password={state.password}
            onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <PetStep
            data={state.pet}
            onChange={(patch) =>
              setState((s) => ({ ...s, pet: { ...s.pet, ...patch } }))
            }
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && <ReminderStep onSave={finish} onSkip={finish} />}
      </AuthLayout>
    </>
  );
}
