import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock window.open
const mockWindowOpen = vi.fn();
vi.stubGlobal("open", mockWindowOpen);

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
    it("renders recipe items as clickable in view mode", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      const recipeLink = within(baseElement).getByRole("button", {
        name: "Test Pasta Recipe",
      });
      expect(recipeLink).toBeInTheDocument();
    });

    it("renders food items as plain text (not clickable)", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      expect(within(baseElement).getAllByText(/Bread/).length).toBeGreaterThan(0);
      expect(
        within(baseElement).queryByRole("button", { name: "Bread" })
      ).not.toBeInTheDocument();
    });

    it("does not render recipe items as clickable in edit mode", () => {
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} editMode={true} />);

      expect(
        within(baseElement).queryByRole("button", { name: "Test Pasta Recipe" })
      ).not.toBeInTheDocument();
    });
  });

  describe("Opens recipe in new tab", () => {
    it("opens recipes page in new tab when recipe item is clicked", async () => {
      const user = userEvent.setup();
      const { baseElement } = render(<MealPlanViewDialog {...getDefaultProps()} />);

      await user.click(
        within(baseElement).getByRole("button", { name: "Test Pasta Recipe" })
      );

      expect(mockWindowOpen).toHaveBeenCalledWith(
        "/recipes?viewRecipe=true&viewRecipe_recipeId=recipe-123",
        "_blank"
      );
    });

    it("opens correct recipe for staples items", async () => {
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

      const user = userEvent.setup();
      const { baseElement } = render(
        <MealPlanViewDialog {...getDefaultProps()} selectedMealPlan={mealPlan} />
      );

      await user.click(
        within(baseElement).getByRole("button", { name: "Weekly Granola" })
      );

      expect(mockWindowOpen).toHaveBeenCalledWith(
        "/recipes?viewRecipe=true&viewRecipe_recipeId=recipe-456",
        "_blank"
      );
    });
  });
});
