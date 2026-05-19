import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { LuFileText, LuPlus, LuX } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { toaster } from "@/components/ui/toaster";
import {
  petQueryKey,
  petsQueryKey,
  updatePet,
  type TPetResponse,
} from "@/lib/petsApi";
import { apiErrorMessage } from "@/utils/apiErrorMessage";
import { FormActions } from "./FormActions";
import { SectionCardHeader } from "./SectionCardHeader";

type TNotesSectionProps = {
  notes: string[];
  backendPetId?: string;
};

type TNotesForm = {
  notes: { value: string }[];
  draft: string;
};

const SAVE_ERROR = "Не удалось сохранить изменения. Проверьте поля и попробуйте еще раз.";

const buildForm = (notes: string[]): TNotesForm => ({
  notes: notes.map((value) => ({ value })),
  draft: "",
});

export function NotesSection({ notes: initialNotes, backendPetId }: TNotesSectionProps) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const { control, handleSubmit, register, reset, setValue } =
    useForm<TNotesForm>({
      defaultValues: buildForm(initialNotes),
    });
  const { append, fields, remove } = useFieldArray({ control, name: "notes" });
  const draft = useWatch({ control, name: "draft" }) ?? "";

  useEffect(() => {
    reset(buildForm(initialNotes));
  }, [initialNotes, reset]);

  const mutation = useMutation({
    mutationFn: (values: TNotesForm) => {
      if (!backendPetId) throw new Error(SAVE_ERROR);

      return updatePet(backendPetId, {
        notes: values.notes
          .map((note) => note.value.trim())
          .filter(Boolean),
      });
    },
    onSuccess: async (response) => {
      if (backendPetId) {
        queryClient.setQueryData<TPetResponse>(petQueryKey(backendPetId), response);
      }
      await queryClient.invalidateQueries({ queryKey: petsQueryKey });
      reset(buildForm(response.pet.notes));
      setEditing(false);
    },
    onError: (error) => {
      toaster.error({
        title: "Не удалось сохранить заметки",
        description: apiErrorMessage(error, SAVE_ERROR),
      });
    },
  });

  const addNote = () => {
    const value = draft.trim();
    if (!value) return;
    append({ value });
    setValue("draft", "");
  };

  const save = handleSubmit((values) => {
    if (!backendPetId) {
      setEditing(false);
      return;
    }
    mutation.mutate(values);
  });

  return (
    <Card>
      <SectionCardHeader
        icon={<LuFileText />}
        title="Заметки"
        editing={editing}
        onEditClick={() => setEditing(true)}
      />
      <Stack gap="16px">
        {fields.length === 0 && !editing && (
          <Text fontSize="14px" color="fg.muted">
            Нет заметок
          </Text>
        )}
        {fields.length > 0 && (
          <HStack gap="8px" flexWrap="wrap">
            {fields.map((note, index) => (
              <HStack
                key={note.id}
                bg="secondary.700"
                rounded="full"
                px="12px"
                py="6px"
                gap="8px"
              >
                <Text fontSize="14px">{note.value}</Text>
                {editing && (
                  <IconButton
                    aria-label="Удалить заметку"
                    size="2xs"
                    variant="ghost"
                    color="fg.muted"
                    minW="auto"
                    h="auto"
                    p="0"
                    disabled={mutation.isPending}
                    onClick={() => remove(index)}
                    _hover={{ color: "fg.default", bg: "transparent" }}
                  >
                    <LuX />
                  </IconButton>
                )}
              </HStack>
            ))}
          </HStack>
        )}
        {editing && (
          <>
            <HStack gap="8px">
              <Input
                flex={1}
                pl="12px"
                placeholder="Новая заметка"
                bg="bg.field"
                borderColor="border.subtle"
                rounded="field"
                h="40px"
                color="fg.default"
                _placeholder={{ color: "fg.muted" }}
                _hover={{ borderColor: "border.default" }}
                _focusVisible={{
                  borderColor: "primary.500",
                  boxShadow: "glowSoft",
                }}
                {...register("draft")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNote();
                  }
                }}
              />
              <IconButton
                aria-label="Добавить заметку"
                onClick={addNote}
                disabled={!draft.trim() || mutation.isPending}
                bg="transparent"
                borderColor="fg.accent"
                color="fg.accent"
                rounded="field"
                h="40px"
                w="40px"
                _hover={{ color: "white" }}
              >
                <LuPlus />
              </IconButton>
            </HStack>
            <FormActions
              onSave={save}
              onCancel={() => {
                reset(buildForm(initialNotes));
                setEditing(false);
              }}
              isSaving={mutation.isPending}
            />
          </>
        )}
      </Stack>
    </Card>
  );
}
