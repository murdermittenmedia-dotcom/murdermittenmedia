export type MerchShirtColorway = {
  id: string;
  number: string;
  name: string;
  shirtColor: string;
  designColors: readonly string[];
  inspiredBy: string;
};

/**
 * The ten Murder Mitten shirt colorways shown in the supplied collection board.
 * Sneaker references are used as colorway descriptors, not as product claims.
 */
export const MERCH_SHIRT_COLORWAYS: readonly MerchShirtColorway[] = [
  {
    id: "michigan",
    number: "01",
    name: "Michigan",
    shirtColor: "Midnight Navy",
    designColors: ["Gold", "White"],
    inspiredBy: "Nike Dunk Low “Michigan” (2024)",
  },
  {
    id: "olive",
    number: "02",
    name: "Olive",
    shirtColor: "Olive",
    designColors: ["Orange", "White"],
    inspiredBy: "Air Jordan 4 Retro SE “Craft Olive” (2023)",
  },
  {
    id: "black-cement",
    number: "03",
    name: "Black Cement",
    shirtColor: "Black",
    designColors: ["Red", "White"],
    inspiredBy: "Air Jordan 3 Retro “Black Cement” (2024)",
  },
  {
    id: "bordeaux",
    number: "04",
    name: "Bordeaux",
    shirtColor: "White",
    designColors: ["Bordeaux", "Dusty Rose"],
    inspiredBy: "Nike Dunk Low “Bordeaux” (2023)",
  },
  {
    id: "grape",
    number: "05",
    name: "Grape",
    shirtColor: "White",
    designColors: ["Purple", "Teal"],
    inspiredBy: "Air Jordan 5 Retro “Grape” (2025)",
  },
  {
    id: "military-blue",
    number: "06",
    name: "Military Blue",
    shirtColor: "White",
    designColors: ["Military Blue", "Wolf Grey"],
    inspiredBy: "Air Jordan 4 Retro “Military Blue” (2024)",
  },
  {
    id: "cherry",
    number: "07",
    name: "Cherry",
    shirtColor: "White",
    designColors: ["Cherry Red", "Black"],
    inspiredBy: "Air Jordan 13 Retro “Cherry” (2024)",
  },
  {
    id: "platinum",
    number: "08",
    name: "Platinum",
    shirtColor: "Black",
    designColors: ["Platinum", "Wolf Grey"],
    inspiredBy: "Air Jordan 5 Retro “Wolf Grey” (2021)",
  },
  {
    id: "red-black-cream",
    number: "09",
    name: "Red Black Cream",
    shirtColor: "Varsity Red",
    designColors: ["Black", "Cream"],
    inspiredBy: "Air Jordan 1 High OG “Bred Toe” (2018)",
  },
  {
    id: "taupe-haze",
    number: "10",
    name: "Taupe Haze",
    shirtColor: "Taupe",
    designColors: ["Mocha Brown", "Cream"],
    inspiredBy: "Air Jordan 1 Low “Mocha” (2024)",
  },
] as const;

export const MERCH_SHIRT_COLORWAY_NAMES = MERCH_SHIRT_COLORWAYS.map(({ name }) => name);
