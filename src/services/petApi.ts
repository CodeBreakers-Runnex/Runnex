import { api } from "@/services/apiClient";
import type { PetSpecies, PetAccessorySlot } from "@/types";

// Fase 1: pet* já fazia parte do schema Postgres desde a Fase 0 (mesmos
// campos do perfil migrado) — essas ações vão direto na API própria.
// addPetCoins não existe mais como função separada: o backend credita
// RunCoins dentro do próprio POST /activities (ver backend/app/routers/activities.py).

// Escolha do pet: só pode ser feita uma vez (o backend recusa com 409 se o
// usuário já tiver um petSpecies salvo).
export const choosePet = async (userId: string, species: PetSpecies, name: string): Promise<void> => {
  await api.post(`/users/${userId}/pet/choose`, { species, name: name.trim() });
};

// Compra um acessório da loja: o backend debita o preço do catálogo dele
// (backend/app/pet_catalog.py), nunca um valor vindo do app, e adiciona o
// id à lista de desbloqueados. Atômico no backend (commit único por request).
export const purchasePetAccessory = async (userId: string, accessoryId: string): Promise<void> => {
  await api.post(`/users/${userId}/pet/purchase`, { accessoryId });
};

// accessoryId === null desequipa o slot.
export const equipPetAccessory = async (userId: string, slot: PetAccessorySlot, accessoryId: string | null): Promise<void> => {
  await api.put(`/users/${userId}/pet/equip`, { slot, accessoryId });
};
