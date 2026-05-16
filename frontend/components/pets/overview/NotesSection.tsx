import { useState } from "react";
import { HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { LuFileText, LuPlus, LuX } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { FormActions } from "./FormActions";
import { SectionCardHeader } from "./SectionCardHeader";

type TNotesSectionProps = { notes: string[] };

export function NotesSection({ notes: initialNotes }: TNotesSectionProps) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<string[]>(initialNotes);
  const [draft, setDraft] = useState("");

  const addNote = () => {
    const value = draft.trim();
    if (!value) return;
    setNotes((n) => [...n, value]);
    setDraft("");
  };

  const removeNote = (index: number) => {
    setNotes((n) => n.filter((_, i) => i !== index));
  };

  const cancel = () => {
    setNotes(initialNotes);
    setDraft("");
    setEditing(false);
  };

  return (
    <Card>
      <SectionCardHeader
        icon={<LuFileText />}
        title="Заметки"
        editing={editing}
        onEditClick={() => setEditing(true)}
      />
      <Stack gap="16px">
        {notes.length === 0 && !editing && (
          <Text fontSize="14px" color="fg.muted">
            Нет заметок
          </Text>
        )}
        {notes.length > 0 && (
          <HStack gap="8px" flexWrap="wrap">
            {notes.map((note, index) => (
              <HStack
                key={`${note}-${index}`}
                bg="secondary.700"
                rounded="full"
                px="12px"
                py="6px"
                gap="8px"
              >
                <Text fontSize="14px">{note}</Text>
                {editing && (
                  <IconButton
                    aria-label="Удалить заметку"
                    size="2xs"
                    variant="ghost"
                    color="fg.muted"
                    minW="auto"
                    h="auto"
                    p="0"
                    onClick={() => removeNote(index)}
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
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNote();
                  }
                }}
                pl="12px"
                placeholder="Новая заметка"
                bg="bg.field"
                borderColor="border.subtle"
                rounded="field"
                h="40px"
                color="fg.default"
                _placeholder={{ color: "fg.muted" }}
                _hover={{ borderColor: "border.default" }}
                _focusVisible={{ borderColor: "primary.500", boxShadow: "glowSoft" }}
              />
              <IconButton
                aria-label="Добавить заметку"
                onClick={addNote}
                disabled={!draft.trim()}
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
            <FormActions onSave={() => setEditing(false)} onCancel={cancel} />
          </>
        )}
      </Stack>
    </Card>
  );
}
