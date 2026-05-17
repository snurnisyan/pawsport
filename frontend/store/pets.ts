import { create } from "zustand";
import type { components } from "@/types/api";

export type TPetStatus = {
  tone: "danger" | "warning" | "success";
  label: string;
};

export type TPet = {
  id: string;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string;
  sex: "male" | "female" | "unknown";
  ageLabel: string;
  weightKg: number;
  imageUrl?: string;
  chipNumber?: string;
  birthDate?: string;
  status?: TPetStatus;
  nextEvent?: string;
  notes: string[];
  vet?: { name: string; phone: string; email: string };
};

export type TPetEventType = components["schemas"]["Event"]["type"];

export type TPetEvent = {
  id: string;
  petId: string;
  type: TPetEventType;
  title: string;
  date: string;
  time?: string;
  place?: string;
  comment?: string;
};

const PETS: TPet[] = [
  {
    id: "kuper",
    name: "Купер",
    species: "dog",
    breed: "Золотистый ретривер",
    sex: "male",
    ageLabel: "4 года",
    weightKg: 32.5,
    chipNumber: "#982000344211",
    birthDate: "2021-05-12",
    nextEvent: "Следующий визит: июнь 13",
    notes: ["Аллергия на курицу", "Кастрирован"],
    vet: {
      name: "Юлия Фёдорова",
      phone: "+79123456789",
      email: "julia_fedorova@vet.ru",
    },
  },
  {
    id: "bublik",
    name: "Бублик",
    species: "cat",
    breed: "—",
    sex: "male",
    ageLabel: "5 лет",
    weightKg: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=1200&q=80",
    status: { tone: "danger", label: "Просрочена вакцинация" },
    nextEvent: "Просрочена вакцинация: март 19",
    notes: [],
  },
  {
    id: "musya",
    name: "Муся",
    species: "dog",
    breed: "—",
    sex: "female",
    ageLabel: "1 год",
    weightKg: 7,
    imageUrl:
      "https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?w=1200&q=80",
    status: { tone: "warning", label: "Скоро вакцинация" },
    nextEvent: "Следующая вакцинация: май 5",
    notes: [],
  },
];

const EVENTS: TPetEvent[] = [
  {
    id: "e1",
    petId: "kuper",
    type: "visit",
    title: "Ежегодный чек-ап",
    date: "2024-06-12",
    time: "10:00",
    place: "Ветеринарная клиника",
    comment: "Прийти натощак, 8 часов голода",
  },
  {
    id: "e2",
    petId: "kuper",
    type: "vaccine",
    title: "Вакцинация (бешенство)",
    date: "2024-04-24",
    time: "14:30",
    place: "Ветеринарная клиника",
  },
  {
    id: "e3",
    petId: "kuper",
    type: "treatment",
    title: "Обработка от паразитов",
    date: "2024-04-14",
    time: "09:00",
    comment: "NexGard таблетки (8мес)",
  },
  {
    id: "e4",
    petId: "kuper",
    type: "operation",
    title: "Чистка зубов (наркоз)",
    date: "2023-12-18",
    place: "Ветеринарная клиника",
  },
  {
    id: "e5",
    petId: "kuper",
    type: "lab",
    title: "Биохимический анализ крови",
    date: "2023-11-06",
    place: "Ветеринарная лаборатория",
  },
];

type TPetsState = {
  pets: TPet[];
  events: TPetEvent[];
  getById: (id: string) => TPet | undefined;
  getEventsFor: (petId: string) => TPetEvent[];
};

export const usePetsStore = create<TPetsState>((set, get) => ({
  pets: PETS,
  events: EVENTS,
  getById: (id) => get().pets.find((p) => p.id === id),
  getEventsFor: (petId) => get().events.filter((e) => e.petId === petId),
}));
