import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DietType } from "@zaavo/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// PRD §12 calls for MMKV, but react-native-mmkv needs a native module Expo
// Go can't run, and this app develops exclusively via Expo Go — persist to
// AsyncStorage instead (pure JS, Expo-Go-safe), same end result (cart
// survives an app restart).

export interface CartLineItem {
  menuItemId: string;
  // Snapshotted at add-time, not re-derived from a live menu query — mirrors
  // this project's order_items-snapshot principle (a vendor editing a dish's
  // name/price/packaging later must never change what's already sitting in
  // someone's cart), even though there's no orders table yet for this to be
  // literally enforced against.
  name: string;
  pricePaise: number;
  packagingChargePaise: number;
  dietType: DietType;
  thumbnailUrl: string | null;
  quantity: number;
}

interface CartState {
  restaurantId: string | null;
  restaurantName: string | null;
  items: CartLineItem[];
}

interface CartActions {
  /**
   * Adds one unit, or increments if already present. Returns "conflict"
   * (without mutating state) if the cart is non-empty and belongs to a
   * different restaurant — the caller must resolve that (e.g. a confirm
   * dialog) before retrying via clearCartAndAddItem. Atomic check+mutate in
   * one call rather than a separate "check first" method, so the two can
   * never drift out of sync.
   */
  addItem: (
    restaurantId: string,
    restaurantName: string,
    item: Omit<CartLineItem, "quantity">,
  ) => "added" | "conflict";
  /**
   * Explicit escape hatch: wipes the existing cart and starts a new one with
   * this single item at quantity 1. Only ever called after the UI's own
   * confirm dialog — the store itself never silently discards a different
   * restaurant's cart.
   */
  clearCartAndAddItem: (restaurantId: string, restaurantName: string, item: Omit<CartLineItem, "quantity">) => void;
  incrementQuantity: (menuItemId: string) => void;
  /** Decrements by 1; removes the line entirely at 0, and clears
   *  restaurantId/restaurantName back to null if that empties the cart. */
  decrementQuantity: (menuItemId: string) => void;
  removeItem: (menuItemId: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      restaurantName: null,
      items: [],

      addItem: (restaurantId, restaurantName, item) => {
        const state = get();
        if (state.items.length > 0 && state.restaurantId !== restaurantId) {
          return "conflict";
        }
        const existing = state.items.find((line) => line.menuItemId === item.menuItemId);
        set({
          restaurantId,
          restaurantName,
          items: existing
            ? state.items.map((line) =>
                line.menuItemId === item.menuItemId ? { ...line, quantity: line.quantity + 1 } : line,
              )
            : [...state.items, { ...item, quantity: 1 }],
        });
        return "added";
      },

      clearCartAndAddItem: (restaurantId, restaurantName, item) => {
        set({ restaurantId, restaurantName, items: [{ ...item, quantity: 1 }] });
      },

      incrementQuantity: (menuItemId) => {
        set((state) => ({
          items: state.items.map((line) =>
            line.menuItemId === menuItemId ? { ...line, quantity: line.quantity + 1 } : line,
          ),
        }));
      },

      decrementQuantity: (menuItemId) => {
        const state = get();
        const remaining = state.items
          .map((line) => (line.menuItemId === menuItemId ? { ...line, quantity: line.quantity - 1 } : line))
          .filter((line) => line.quantity > 0);
        set(
          remaining.length > 0
            ? { items: remaining }
            : { items: [], restaurantId: null, restaurantName: null },
        );
      },

      removeItem: (menuItemId) => {
        const remaining = get().items.filter((line) => line.menuItemId !== menuItemId);
        set(
          remaining.length > 0
            ? { items: remaining }
            : { items: [], restaurantId: null, restaurantName: null },
        );
      },

      clearCart: () => set({ items: [], restaurantId: null, restaurantName: null }),
    }),
    { name: "zaavo-customer-cart", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** menu_items.id is a globally unique UUID, so no restaurant check needed. */
export function useCartItemQuantity(menuItemId: string): number {
  return useCartStore((state) => state.items.find((line) => line.menuItemId === menuItemId)?.quantity ?? 0);
}

export function useCartTotalItemCount(): number {
  return useCartStore((state) => state.items.reduce((sum, line) => sum + line.quantity, 0));
}

export function cartItemSubtotalPaise(items: CartLineItem[]): number {
  return items.reduce((sum, line) => sum + line.pricePaise * line.quantity, 0);
}

export function cartPackagingTotalPaise(items: CartLineItem[]): number {
  return items.reduce((sum, line) => sum + line.packagingChargePaise * line.quantity, 0);
}
