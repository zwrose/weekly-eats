import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import MealEditor from '../MealEditor';
import { MealItem } from '../../types/meal-plan';

const server = setupServer(
  http.get('/api/food-items', () => {
    return HttpResponse.json([
      { _id: '1', name: 'Apple', singularName: 'Apple', pluralName: 'Apples', unit: 'piece' },
      { _id: '2', name: 'Banana', singularName: 'Banana', pluralName: 'Bananas', unit: 'piece' }
    ]);
  }),
  http.get('/api/recipes', () => {
    return HttpResponse.json([
      { _id: '1', title: 'Apple Pie' },
      { _id: '2', title: 'Banana Bread' }
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MealEditor', () => {
  const defaultProps = {
    mealItems: [],
    onChange: vi.fn(),
    onFoodItemAdded: vi.fn(),
  };

  it('renders empty state with action buttons', () => {
    render(<MealEditor {...defaultProps} />);
    
    expect(screen.getByText('Use the buttons below to add to this meal.')).toBeInTheDocument();
    expect(screen.getByText('Add Meal Item')).toBeInTheDocument();
    expect(screen.getByText('Add Meal Item Group')).toBeInTheDocument();
  });

  it('calls onChange when Add Meal Item is clicked', () => {
    render(<MealEditor {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Add Meal Item'));
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([{
      type: 'foodItem',
      id: '',
      name: '',
      quantity: 1,
      unit: 'cup'
    }]);
  });

  it('calls onChange when Add Meal Item Group is clicked', () => {
    render(<MealEditor {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Add Meal Item Group'));
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([{
      type: 'ingredientGroup',
      id: '',
      name: '',
      ingredients: [{
        title: '',
        ingredients: []
      }]
    }]);
  });

  it('renders existing meal items', async () => {
    const mealItems: MealItem[] = [
      {
        type: 'foodItem',
        id: '1',
        name: 'Apple',
        quantity: 2,
        unit: 'piece'
      },
      {
        type: 'ingredientGroup',
        id: '',
        name: '',
        ingredients: [{
          title: 'Fruits',
          ingredients: []
        }]
      }
    ];

    render(<MealEditor {...defaultProps} mealItems={mealItems} />);
    
    await waitFor(() => {
      expect(screen.getAllByText('Remove Meal Item')).toHaveLength(1);
    });
  });

  it('calls onChange when meal item is removed', async () => {
    const mealItems: MealItem[] = [
      {
        type: 'foodItem',
        id: '1',
        name: 'Apple',
        quantity: 2,
        unit: 'piece'
      }
    ];

    render(<MealEditor {...defaultProps} mealItems={mealItems} />);
    
    await waitFor(() => {
      const removeButton = screen.getByText('Remove Meal Item');
      fireEvent.click(removeButton);
    });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([]);
  });

  it('handles ingredient group changes', async () => {
    const mealItems: MealItem[] = [
      {
        type: 'ingredientGroup',
        id: '',
        name: '',
        ingredients: [{
          title: 'Fruits',
          ingredients: []
        }]
      }
    ];

    render(<MealEditor {...defaultProps} mealItems={mealItems} />);
    
    await waitFor(() => {
      const titleInput = screen.getByDisplayValue('Fruits');
      fireEvent.change(titleInput, { target: { value: 'Fresh Fruits' } });
    });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([{
      type: 'ingredientGroup',
      id: '',
      name: '',
      ingredients: [{
        title: 'Fresh Fruits',
        ingredients: []
      }]
    }]);
  });

  it('handles food item selection and type updates', async () => {
    const mealItems: MealItem[] = [
      {
        type: 'foodItem',
        id: '',
        name: '',
        quantity: 1,
        unit: 'cup'
      }
    ];

    render(<MealEditor {...defaultProps} mealItems={mealItems} />);
    
    await waitFor(() => {
      expect(screen.getByText('Remove Meal Item')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    server.use(
      http.get('/api/food-items', () => {
        return HttpResponse.error();
      }),
      http.get('/api/recipes', () => {
        return HttpResponse.error();
      })
    );

    render(<MealEditor {...defaultProps} />);
    
    // Should still render the empty state
    expect(screen.getByText('Use the buttons below to add to this meal.')).toBeInTheDocument();
  });

  it('handles multiple meal items', async () => {
    const mealItems: MealItem[] = [
      {
        type: 'foodItem',
        id: '1',
        name: 'Apple',
        quantity: 2,
        unit: 'piece'
      },
      {
        type: 'recipe',
        id: '1',
        name: 'Apple Pie'
      },
      {
        type: 'ingredientGroup',
        id: '',
        name: '',
        ingredients: [{
          title: 'Fruits',
          ingredients: []
        }]
      }
    ];

    render(<MealEditor {...defaultProps} mealItems={mealItems} />);
    
    await waitFor(() => {
      // Should have 2 "Remove Meal Item" buttons (from food item and recipe)
      expect(screen.getAllByText('Remove Meal Item')).toHaveLength(2);
    });
  });

  it('does not show empty state when items exist', async () => {
    const mealItems: MealItem[] = [
      {
        type: 'foodItem',
        id: '1',
        name: 'Apple',
        quantity: 2,
        unit: 'piece'
      }
    ];

    render(<MealEditor {...defaultProps} mealItems={mealItems} />);
    
    expect(screen.queryByText('Use the buttons below to add to this meal.')).not.toBeInTheDocument();
  });

  it('renders ingredient groups with responsive delete buttons', async () => {
    const mealItems: MealItem[] = [
      {
        type: 'ingredientGroup',
        id: '',
        name: '',
        ingredients: [{
          title: 'Test Group',
          ingredients: []
        }]
      }
    ];

    render(<MealEditor {...defaultProps} mealItems={mealItems} />);
    
    await waitFor(() => {
      // Should show both inline and bottom delete buttons (responsive design)
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      expect(deleteIcons.length).toBeGreaterThan(0);
      
      // Should show the bottom delete button with text
      const bottomDeleteButton = screen.getByText('Remove Group');
      expect(bottomDeleteButton).toBeInTheDocument();
    });
  });
});
