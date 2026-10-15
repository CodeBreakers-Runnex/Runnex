import { api } from "@/services/apiClient";
import type { FeedActivity, RunningShoe, ShoeInput } from "@/types";

export const getShoes = () => api.get<RunningShoe[]>("/shoes");
export const createShoe = (shoe: ShoeInput) =>
  api.post<RunningShoe>("/shoes", shoe);
export const updateShoe = (id: string, shoe: ShoeInput) =>
  api.put<RunningShoe>(`/shoes/${id}`, shoe);
export const assignActivityShoe = (activityId: string, shoeId: string | null) =>
  api.put<FeedActivity>(`/activities/${activityId}/shoe`, { shoeId });

export function shoeInput(shoe: RunningShoe): ShoeInput {
  const {
    name,
    brand,
    model,
    purchaseDate,
    initialKm,
    limitKm,
    isDefault,
    manuallyWorn,
    retired,
  } = shoe;
  return {
    name,
    brand,
    model,
    purchaseDate,
    initialKm,
    limitKm,
    isDefault,
    manuallyWorn,
    retired,
  };
}
