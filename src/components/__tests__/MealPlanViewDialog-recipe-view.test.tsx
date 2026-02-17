import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";

// Mock MealEditor to avoid its dependency tree
vi.mock("@/components/MealEditor", () => ({
  default: () => <div data-testid="meal-editor" />,
}));

import MealPlanViewDialog from "../MealPlanViewDialog";
import type { MealPlanWithTemplate } from "@/types/meal-plan";

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
  });

  afterEach(() => {
    cleanup();
  });

  describe("Clickable recipe items in view mode", () => {
    it("renders recipe items as links in view mode", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      const recipeLink = within(baseElement).getByRole("link", {
        name: "Test Pasta Recipe",
      });
      expect(recipeLink).toBeInTheDocument();
      expect(recipeLink).toHaveAttribute(
        "href",
        "/recipes?viewRecipe=true&viewRecipe_recipeId=recipe-123"
      );
      expect(recipeLink).toHaveAttribute("target", "_blank");
    });

    it("renders food items as plain text (not clickable)", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      expect(within(baseElement).getAllByText(/Bread/).length).toBeGreaterThan(0);
      expect(
        within(baseElement).queryByRole("link", { name: "Bread" })
      ).not.toBeInTheDocument();
    });

    it("does not render recipe items as links in edit mode", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} editMode={true} />);

      expect(
        within(baseElement).queryByRole("link", { name: "Test Pasta Recipe" })
      ).not.toBeInTheDocument();
    });
  });

  describe("Recipe link URLs", () => {
    it("links to correct recipe URL for daily meal items", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      const recipeLink = within(baseElement).getByRole("link", {
        name: "Test Pasta Recipe",
      });
      expect(recipeLink).toHaveAttribute(
        "href",
        "/recipes?viewRecipe=true&viewRecipe_recipeId=recipe-123"
      );
    });

    it("links to correct recipe URL for staples items", () => {
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

      const recipeLink = within(baseElement).getByRole("link", {
        name: "Weekly Granola",
      });
      expect(recipeLink).toHaveAttribute(
        "href",
        "/recipes?viewRecipe=true&viewRecipe_recipeId=recipe-456"
      );
    });
  });
});
