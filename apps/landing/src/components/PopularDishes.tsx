import Image from "next/image";
import { Container } from "./Container";
import { PlusIcon } from "./icons";

const DISHES = [
  {
    name: "Chicken Tikka Pizza",
    category: "Wood-fired Pizza",
    description: "Tandoori chicken chunks, onions, & capsicum with extra cheese.",
    price: "₹249",
    image: "/dishes/chicken-tikka-pizza.webp",
    badge: "Bestseller",
    rating: "4.8",
    diet: "nonveg" as const,
  },
  {
    name: "Paneer Butter Masala",
    category: "Main Course",
    description: "Cottage cheese cubes simmered in a rich tomato-butter gravy.",
    price: "₹180",
    image: "/dishes/paneer-butter-masala.webp",
    badge: "Must Try",
    rating: "4.7",
    diet: "veg" as const,
  },
  {
    name: "Special Veg Thali",
    category: "Full Thali",
    description: "Complete meal with paneer, dal, sabzi, rice, roti & sweet.",
    price: "₹160",
    image: "/dishes/veg-thali.webp",
    badge: "Popular",
    rating: "4.9",
    diet: "veg" as const,
  },
  {
    name: "Steamed Chicken Momos",
    category: "Snacks & Starters",
    description: "Juicy chicken momos served with fiery red chutney.",
    price: "₹110",
    image: "/dishes/chicken-momos.webp",
    badge: "Popular",
    rating: "4.6",
    diet: "nonveg" as const,
  },
];

function FssaiMarker({ diet }: { diet: "veg" | "nonveg" }) {
  const color = diet === "veg" ? "var(--color-veg)" : "var(--color-nonveg)";
  return (
    <span
      className="absolute left-3 top-3 z-10 flex h-4 w-4 items-center justify-center rounded-[3px] border bg-surface-container-lowest shadow-sm"
      style={{ borderColor: color }}
      aria-label={diet === "veg" ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

export function PopularDishes() {
  return (
    <section id="popular" className="scroll-mt-24 py-14 sm:py-16">
      <Container>
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.01em] text-on-surface sm:text-4xl">
            Popular near you
          </h2>
          <p className="mt-3 text-base text-on-surface-variant sm:text-lg">
            Fan favorites from Silchar&apos;s top-rated kitchens.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DISHES.map((dish) => (
            <div
              key={dish.name}
              className="group overflow-hidden rounded-lg border bg-surface-container-lowest transition-shadow hover:shadow-md"
              style={{ borderColor: "var(--color-card-border)" }}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-surface-container-low">
                <Image
                  src={dish.image}
                  alt={dish.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <FssaiMarker diet={dish.diet} />
              </div>
              <div className="p-4">
                <h3 className="font-display text-base font-semibold leading-6 text-on-surface">{dish.name}</h3>
                <p className="mt-0.5 text-sm text-on-surface-variant">{dish.category}</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="tnum font-display text-lg font-bold text-on-surface">{dish.price}</p>
                  <button
                    type="button"
                    aria-label={`Add ${dish.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container transition-opacity hover:opacity-90 active:scale-95"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
