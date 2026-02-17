import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ItemEditorDialog from "../ItemEditorDialog";
import type { FoodItemOption } from "../ItemEditorDialog";

const mockFoodItems: FoodItemOption[] = [
  { _id: "f1", name: "Apple", singularName: "Apple", pluralName: "Apples", unit: "each" },
  { _id: "f2", name: "Banana", singularName: "Banana", pluralName: "Bananas", unit: "each" },
];

describe("ItemEditorDialog", () => {
  const defaultProps = {
    open: true,
    mode: "add" as const,
    foodItems: mockFoodItems,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to get the item name input (the first Autocomplete in the dialog)
  function getItemNameInput() {
    return screen.getByRole("combobox", { name: /item name/i });
  }

  it('shows "Add as a Food Item" option when input has no exact matches', async () => {
    const user = userEvent.setup();
    render(<ItemEditorDialog {...defaultProps} />);

    const input = getItemNameInput();
    await user.clear(input);
    await user.type(input, "Zucchini");

    expect(await screen.findByRole("button", { name: /add "zucchini" as a food item/i })).toBeInTheDocument();
  });

  it("opens AddFoodItemDialog when create option is clicked", async () => {
    const user = userEvent.setup();
    render(<ItemEditorDialog {...defaultProps} />);

    const input = getItemNameInput();
    await user.clear(input);
    await user.type(input, "Zucchini");

    const createBtn = await screen.findByRole("button", { name: /add "zucchini" as a food item/i });
    await user.click(createBtn);

    // The AddFoodItemDialog should now be open with the prefilled name
    expect(await screen.findByText("Add Food Item")).toBeInTheDocument();
  });

  it('shows "Add as a Food Item" option alongside matching results', async () => {
    const user = userEvent.setup();
    render(<ItemEditorDialog {...defaultProps} />);

    const input = getItemNameInput();
    await user.clear(input);
    await user.type(input, "App");

    // Both the matching option and the "Add new" option should appear
    expect(await screen.findByText("Apple")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add "app" as a food item/i })).toBeInTheDocument();
  });
});
