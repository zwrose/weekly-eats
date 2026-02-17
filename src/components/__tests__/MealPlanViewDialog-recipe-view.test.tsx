import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock fetch utilities
const mockFetchRecipe = vi.fn();
const mockFetchRecipeUserData = vi.fn();
vi.mock("@/lib/recipe-utils", () => ({
  fetchRecipe: (...args: unknown[]) => mockFetchRecipe(...args),
}));
vi.mock("@/lib/recipe-user-data-utils", () => ({
  fetchRecipeUserData: (...args: unknown[]) => mockFetchRecipeUserData(...args),
}));

// Mock RecipeViewDialog to avoid deep dependency tree
vi.mock("@/components/RecipeViewDialog", () => ({
  default: ({
    open,
    onClose,
    selectedRecipe,
    editMode,
    onNavigateToRecipe,
  }: {
    open: boolean;
    onClose: () => void;
    selectedRecipe: { _id?: string; title: string } | null;
    editMode: boolean;
    onNavigateToRecipe?: (id: string) => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="recipe-view-dialog">
        <span data-testid="recipe-title">{selectedRecipe?.title}</span>
        <span data-testid="recipe-edit-mode">{String(editMode)}</span>
        <button data-testid="recipe-close" onClick={onClose}>
          Close
        </button>
        {onNavigateToRecipe && selectedRecipe?._id && (
          <button
            data-testid="edit-in-recipes"
            onClick={() => onNavigateToRecipe(selectedRecipe._id!)}
          >
            Edit in Recipes
          </button>
        )}
      </div>
    );
  },
}));

// Mock MealEditor to avoid its dependency tree
vi.mock("@/components/MealEditor", () => ({
  default: () => <div data-testid="meal-editor" />,
}));

import MealPlanViewDialog from "../MealPlanViewDialog";
import type { MealPlanWithTemplate } from "@/types/meal-plan";

const mockRecipe = {
  _id: "recipe-123",
  title: "Test Pasta Recipe",
  emoji: "🍝",
  ingredients: [],
  instructions: "Cook pasta",
  isGlobal: true,
  createdBy: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserData = {
  tags: ["italian"],
  rating: 4,
};

function makeMealPlan(
  overrides?: Partial<MealPlanWithTemplate>
): MealPlanWithTemplate {
  return {
    _id: "mp-1",
    name: "Test Meal Plan",
    startDate: "2026-02-14",
    endDate: "2026-02-20",
    userId: "user-1",
    templateId: "tpl-1",
    items: [
      {
        _id: "item-1",
        mealPlanId: "mp-1",
        dayOfWeek: "saturday",
        mealType: "dinner",
        items: [
          {
            type: "recipe",
            id: "recipe-123",
            name: "Test Pasta Recipe",
            quantity: 2,
          },
          {
            type: "foodItem",
            id: "food-1",
            name: "Bread",
            quantity: 1,
            unit: "loaf",
          },
        ],
      },
    ],
    template: {
      startDay: "saturday",
      meals: { breakfast: true, lunch: true, dinner: true, staples: false },
      weeklyStaples: [],
    },
    ...overrides,
  } as MealPlanWithTemplate;
}

function getDefaultProps() {
  return {
    open: true,
    onClose: vi.fn(),
    editMode: false,
    selectedMealPlan: makeMealPlan(),
    mealPlanValidationErrors: [] as string[],
    showValidationErrors: false,
    onEditMode: vi.fn(),
    onCancelEdit: vi.fn(),
    onSave: vi.fn(),
    onDeleteConfirm: vi.fn(),
    onMealPlanChange: vi.fn(),
    onValidationUpdate: vi.fn(),
    onShowValidationErrors: vi.fn(),
    onFoodItemAdded: vi.fn(),
    getDaysInOrder: () => ["saturday"],
    getDateForDay: (day: string) => `${day} - Feb 14`,
    getMealTypeName: (type: string) =>
      type.charAt(0).toUpperCase() + type.slice(1),
    validateMealPlan: () => ({ isValid: true, errors: [] as string[] }),
  };
}

describe("MealPlanViewDialog - Recipe View Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRecipe.mockResolvedValue(mockRecipe);
    mockFetchRecipeUserData.mockResolvedValue(mockUserData);
  });

  afterEach(() => {
    cleanup();
  });

  describe("Clickable recipe items in view mode", () => {
    it("renders recipe items as clickable in view mode", () => {
      const { container } = render(<MealPlanViewDialog {...getDefaultProps()} />);
      const dialog = container.closest("body")!;

      const recipeLink = within(dialog).getByRole("button", {
        name: "Test Pasta Recipe",
      });
      expect(recipeLink).toBeInTheDocument();
    });

    it("renders food items as plain text (not clickable)", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      // Bread should be visible but not as a button
      expect(within(baseElement).getAllByText(/Bread/).length).toBeGreaterThan(0);
      expect(
        within(baseElement).queryByRole("button", { name: "Bread" })
      ).not.toBeInTheDocument();
    });

    it("does not render recipe items as clickable in edit mode", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} editMode={true} />);

      // In edit mode, MealEditor is used instead of the view rendering
      expect(
        within(baseElement).queryByRole("button", { name: "Test Pasta Recipe" })
      ).not.toBeInTheDocument();
    });
  });

  describe("RecipeViewDialog integration", () => {
    it("opens RecipeViewDialog when a recipe item is clicked", async () => {
      const user = userEvent.setup();
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      const recipeLink = within(baseElement).getByRole("button", {
        name: "Test Pasta Recipe",
      });
      await user.click(recipeLink);

      await waitFor(() => {
        expect(mockFetchRecipe).toHaveBeenCalledWith("recipe-123");
        expect(mockFetchRecipeUserData).toHaveBeenCalledWith("recipe-123");
      });

      await waitFor(() => {
        expect(within(baseElement).getByTestId("recipe-view-dialog")).toBeInTheDocument();
      });
    });

    it("opens RecipeViewDialog in read-only mode", async () => {
      const user = userEvent.setup();
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      await user.click(
        within(baseElement).getByRole("button", { name: "Test Pasta Recipe" })
      );

      await waitFor(() => {
        expect(within(baseElement).getByTestId("recipe-edit-mode")).toHaveTextContent(
          "false"
        );
      });
    });

    it("displays the fetched recipe title in the dialog", async () => {
      const user = userEvent.setup();
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      await user.click(
        within(baseElement).getByRole("button", { name: "Test Pasta Recipe" })
      );

      await waitFor(() => {
        expect(within(baseElement).getByTestId("recipe-title")).toHaveTextContent(
          "Test Pasta Recipe"
        );
      });
    });

    it("closes RecipeViewDialog and returns to meal plan view", async () => {
      const user = userEvent.setup();
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      await user.click(
        within(baseElement).getByRole("button", { name: "Test Pasta Recipe" })
      );

      await waitFor(() => {
        expect(within(baseElement).getByTestId("recipe-view-dialog")).toBeInTheDocument();
      });

      await user.click(within(baseElement).getByTestId("recipe-close"));

      await waitFor(() => {
        expect(
          within(baseElement).queryByTestId("recipe-view-dialog")
        ).not.toBeInTheDocument();
      });

      // Meal plan should still be visible
      expect(within(baseElement).getByText("Test Meal Plan")).toBeInTheDocument();
    });

    it("does not open dialog when fetch fails", async () => {
      mockFetchRecipe.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      await user.click(
        within(baseElement).getByRole("button", { name: "Test Pasta Recipe" })
      );

      await waitFor(() => {
        expect(mockFetchRecipe).toHaveBeenCalled();
      });

      expect(
        within(baseElement).queryByTestId("recipe-view-dialog")
      ).not.toBeInTheDocument();
    });
  });

  describe("Edit in Recipes navigation", () => {
    it("shows Edit in Recipes button in recipe dialog", async () => {
      const user = userEvent.setup();
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      await user.click(
        within(baseElement).getByRole("button", { name: "Test Pasta Recipe" })
      );

      await waitFor(() => {
        expect(within(baseElement).getByTestId("edit-in-recipes")).toBeInTheDocument();
      });
    });

    it("navigates to recipes page with correct params", async () => {
      const user = userEvent.setup();
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      await user.click(
        within(baseElement).getByRole("button", { name: "Test Pasta Recipe" })
      );

      await waitFor(() => {
        expect(within(baseElement).getByTestId("edit-in-recipes")).toBeInTheDocument();
      });

      await user.click(within(baseElement).getByTestId("edit-in-recipes"));

      expect(mockPush).toHaveBeenCalledWith(
        "/recipes?viewRecipe=recipe-123&editMode=true"
      );
    });

    it("closes both dialogs when navigating to recipes", async () => {
      const user = userEvent.setup();
      const props = getDefaultProps();
      const { baseElement } = render(<MealPlanViewDialog {...props} />);

      await user.click(
        within(baseElement).getByRole("button", { name: "Test Pasta Recipe" })
      );

      await waitFor(() => {
        expect(within(baseElement).getByTestId("edit-in-recipes")).toBeInTheDocument();
      });

      await user.click(within(baseElement).getByTestId("edit-in-recipes"));

      // Recipe dialog should be closed
      expect(
        within(baseElement).queryByTestId("recipe-view-dialog")
      ).not.toBeInTheDocument();

      // onClose should be called to close the meal plan dialog
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  describe("Weekly staples recipe items", () => {
    it("renders staples recipe items as clickable in view mode", async () => {
      const mealPlan = makeMealPlan({
        items: [
          {
            _id: "staples-1",
            mealPlanId: "mp-1",
            dayOfWeek: "saturday",
            mealType: "staples",
            items: [
              {
                type: "recipe",
                id: "recipe-456",
                name: "Weekly Granola",
                quantity: 1,
              },
            ],
          },
        ],
        template: {
          startDay: "saturday",
          meals: {
            breakfast: true,
            lunch: true,
            dinner: true,
            staples: true,
          },
          weeklyStaples: [],
        },
      });

      const { baseElement } = render(
        <MealPlanViewDialog {...getDefaultProps()} selectedMealPlan={mealPlan} />
      );

      const recipeLink = within(baseElement).getByRole("button", {
        name: "Weekly Granola",
      });
      expect(recipeLink).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(recipeLink);

      await waitFor(() => {
        expect(mockFetchRecipe).toHaveBeenCalledWith("recipe-456");
      });
    });
  });
});
